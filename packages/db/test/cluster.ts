/**
 * The framework-free core of the @wringy/db test harness, exported as
 * `@wringy/db/testing/cluster` (kickoff-package.md §6.2-§6.3).
 *
 * `startTestCluster()` gives a real PostgreSQL 17 cluster with the Wringy roles
 * bootstrapped and a template database migrated from zero as the migrator (the
 * pg-boss schema, then every versioned SQL migration: never a hand-kept dump)
 * and marked as environment TEST_WRINGY_ENV (`ci`, which allows fixtures):
 *
 * - TEST_DATABASE_URL (an admin URL, e.g. CI's postgres:17 service) when set;
 * - otherwise a throwaway embedded PostgreSQL 17 on a free port in a temporary
 *   directory, TimeZone=UTC, removed by `stop()`.
 *
 * `createDatabaseIn(cluster)` clones the template (CREATE DATABASE ... TEMPLATE
 * ...) with CONNECT for the runtime groups only; `seedFixturesIn` and
 * `setEnvironmentIn` do what `pnpm db:seed:fixtures` and `pnpm db:env` do.
 *
 * Used by the Vitest harness (harness.ts, `@wringy/db/testing`), which reads the
 * cluster from Vitest's provide/inject, and by the Playwright internal suite's
 * database process (apps/web/tests/e2e-internal/database-server.ts, run with
 * tsx), which has no Vitest runtime. Playwright's own CommonJS loader cannot load
 * this module (migrate.ts and fixtures.ts use import.meta); test files there use
 * connect.ts (`@wringy/db/testing/connect`). Test-only code: product code never
 * imports it.
 */
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

import type { WringyEnv } from '@wringy/config';

import { ensureDatabase, ensureRoles, restrictDatabaseAccess } from '../src/bootstrap';
import { setEnvironment, type EnvironmentMarker } from '../src/environment';
import { seedFixtures as applyFixtureSeed, type SeedFixturesResult } from '../src/fixtures';
import { LOCAL_PASSWORDS, postgresUrl } from '../src/local-dev';
import { migrateDatabase } from '../src/migrate';
import { ROLES } from '../src/roles';
import { loginUrlsAt, withClientAt, type LoginUrls } from './connect';
import { TEST_WRINGY_ENV } from './test-env';

export { TEST_WRINGY_ENV, loginUrlsAt, withClientAt };
export type { LoginUrls };

export interface ClusterInfo {
  /** Superuser (or equivalent) URL of the test cluster. Never used by product code. */
  adminUrl: string;
  host: string;
  port: number;
  /** Prefix shared by every database this run creates, for cleanup. */
  runId: string;
  /** Migrated from zero by startTestCluster(); never connected to directly. */
  templateDatabase: string;
  passwords: { migrator: string; api: string; worker: string };
}

export interface RunningCluster {
  info: ClusterInfo;
  /** Drops every database this run created, then stops an embedded cluster and removes its files. */
  stop(): Promise<void>;
}

export interface TestDatabase {
  name: string;
  /** One URL per login role, all pointing at this clone. */
  urls: LoginUrls;
  drop(): Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('could not allocate a port'));
      });
    });
  });
}

async function startEmbedded(): Promise<{ adminUrl: string; stop: () => Promise<void> }> {
  const port = await freePort();
  const password = randomBytes(12).toString('hex');
  const root = mkdtempSync(path.join(tmpdir(), 'wringy-test-pg-'));
  const embedded = new EmbeddedPostgres({
    databaseDir: path.join(root, 'data'),
    user: 'postgres',
    password,
    port,
    authMethod: 'scram-sha-256',
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'TimeZone=UTC', '-c', 'log_timezone=UTC'],
    onLog: () => {},
  });
  await embedded.initialise();
  await embedded.start();
  return {
    adminUrl: postgresUrl({ user: 'postgres', password, host: '127.0.0.1', port, database: 'postgres' }),
    stop: async () => {
      // persistent: false makes stop() delete the data directory; the parent goes too.
      await embedded.stop();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** Runs `fn` with a short-lived admin connection to the cluster's `postgres` database. */
export function withAdminAt<T>(cluster: ClusterInfo, fn: (admin: pg.Client) => Promise<T>): Promise<T> {
  return withClientAt(cluster.adminUrl, fn);
}

/** A URL for `user` on `database` in the test cluster. */
export function clusterUrl(cluster: ClusterInfo, user: string, password: string, database: string): string {
  return postgresUrl({ user, password, host: cluster.host, port: cluster.port, database });
}

/** The three login URLs of `database` in the test cluster. */
export function databaseUrls(cluster: ClusterInfo, database: string): TestDatabase['urls'] {
  const { passwords } = cluster;
  return {
    migrator: clusterUrl(cluster, ROLES.migrator, passwords.migrator, database),
    api: clusterUrl(cluster, ROLES.apiLogin, passwords.api, database),
    worker: clusterUrl(cluster, ROLES.workerLogin, passwords.worker, database),
  };
}

/** Roles as `pnpm db:bootstrap` makes them, then the template migrated from zero and marked, as the migrator. */
async function prepareTemplate(cluster: ClusterInfo): Promise<void> {
  await withAdminAt(cluster, async (admin) => {
    // The fixed local development passwords, so pointing TEST_DATABASE_URL at the
    // `pnpm db:start` cluster leaves a working local .env untouched.
    await ensureRoles(admin, cluster.passwords);
    await ensureDatabase(admin, cluster.templateDatabase);
  });

  const migratorUrl = databaseUrls(cluster, cluster.templateDatabase).migrator;
  await migrateDatabase({ databaseUrl: migratorUrl });
  await withClientAt(migratorUrl, async (migrator) => {
    await setEnvironment(migrator, TEST_WRINGY_ENV);
  });
}

/** Drops every database whose name belongs to this run (clones and the template). */
async function dropRunDatabases(cluster: ClusterInfo): Promise<void> {
  await withAdminAt(cluster, async (admin) => {
    const { rows } = await admin.query<{ datname: string }>(
      'SELECT datname FROM pg_catalog.pg_database WHERE datname LIKE $1 OR datname = $2',
      [`wringy_t_${cluster.runId}_%`, cluster.templateDatabase],
    );
    for (const { datname } of rows) {
      await admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(datname)} WITH (FORCE)`);
    }
  });
}

export interface StartTestClusterOptions {
  /** An existing cluster's admin URL; defaults to TEST_DATABASE_URL, else an embedded cluster is started. */
  adminUrl?: string;
}

/** Starts (or attaches to) a cluster and migrates this run's template. See the module comment. */
export async function startTestCluster(options: StartTestClusterOptions = {}): Promise<RunningCluster> {
  const external = options.adminUrl ?? process.env.TEST_DATABASE_URL;
  const embedded = external ? undefined : await startEmbedded();
  const adminUrl = external ?? embedded!.adminUrl;
  const { hostname, port } = new URL(adminUrl);

  const runId = randomBytes(4).toString('hex');
  const info: ClusterInfo = {
    adminUrl,
    host: hostname.replace(/^\[|\]$/g, ''),
    port: Number(port || 5432),
    runId,
    templateDatabase: `wringy_tpl_${runId}`,
    passwords: { ...LOCAL_PASSWORDS },
  };

  try {
    await prepareTemplate(info);
  } catch (error) {
    await embedded?.stop();
    throw error;
  }

  return {
    info,
    stop: async () => {
      try {
        await dropRunDatabases(info);
      } finally {
        await embedded?.stop();
      }
    },
  };
}

/** A fresh database cloned from the migrated template, with CONNECT for the runtime groups only. */
export async function createDatabaseIn(cluster: ClusterInfo): Promise<TestDatabase> {
  const name = `wringy_t_${cluster.runId}_${randomBytes(4).toString('hex')}`;

  await withAdminAt(cluster, async (admin) => {
    await admin.query(
      `CREATE DATABASE ${admin.escapeIdentifier(name)} TEMPLATE ${admin.escapeIdentifier(cluster.templateDatabase)} OWNER ${admin.escapeIdentifier(ROLES.migrator)}`,
    );
    await restrictDatabaseAccess(admin, name);
  });

  return {
    name,
    urls: databaseUrls(cluster, name),
    drop: () =>
      withAdminAt(cluster, async (admin) => {
        await admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(name)} WITH (FORCE)`);
      }),
  };
}

/** Applies fixtures/internal-campaigns.sql to `db` as the migrator, as `pnpm db:seed:fixtures` does. */
export function seedFixturesIn(db: Pick<TestDatabase, 'urls'>): Promise<SeedFixturesResult> {
  return withClientAt(db.urls.migrator, (client) => applyFixtureSeed(client));
}

/** Re-marks `db` as environment `name` (fixtures allowed except in production). */
export async function setEnvironmentIn(db: Pick<TestDatabase, 'urls'>, name: WringyEnv): Promise<EnvironmentMarker> {
  const { marker } = await withClientAt(db.urls.migrator, (client) => setEnvironment(client, name, { relabel: true }));
  return marker;
}
