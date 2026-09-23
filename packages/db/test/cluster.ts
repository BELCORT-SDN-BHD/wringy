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
 * An external cluster is used only when it is a throwaway: bootstrapping ALTERs
 * the cluster-wide login roles to the committed development passwords and
 * creates and drops databases there. assertThrowawayCluster() refuses a
 * TEST_DATABASE_URL whose host is not this machine (unless
 * WRINGY_TEST_CLUSTER_IS_THROWAWAY=1 says otherwise for a disposable remote
 * cluster), and any cluster where a database other than this harness's own is
 * marked as an environment other than local or ci.
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

import { isLoopbackUrl, type WringyEnv } from '@wringy/config';

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
    // The data directory is removed by stop() below, with retries: on Windows
    // embedded-postgres stops the server with `taskkill /f /t` and removes the
    // directory at once, while an exiting backend can still hold a file, so its
    // own removal (persistent: false) intermittently failed with the directory
    // left behind (seen on 2026-09-23 as a failed internal-suite teardown).
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'TimeZone=UTC', '-c', 'log_timezone=UTC'],
    onLog: () => {},
  });
  await embedded.initialise();
  await embedded.start();
  return {
    adminUrl: postgresUrl({ user: 'postgres', password, host: '127.0.0.1', port, database: 'postgres' }),
    stop: async () => {
      await embedded.stop();
      rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
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

/** Set to `1` to let the harness use a TEST_DATABASE_URL that is not on this machine: a disposable cluster only. */
export const THROWAWAY_CLUSTER_OPT_IN = 'WRINGY_TEST_CLUSTER_IS_THROWAWAY';

/** Environment markers the harness may meet on a cluster it bootstraps. */
const TEST_ENVIRONMENTS: readonly string[] = ['local', 'ci'];

/** The harness refuses to bootstrap roles or create databases on this cluster. */
export class TestClusterRefusedError extends Error {
  override readonly name = 'TestClusterRefusedError';
}

/** True for a database this harness creates (any run): `wringy_t_<run>_*` clones and `wringy_tpl_<run>` templates. */
export function isHarnessDatabase(name: string): boolean {
  return /^wringy_(t|tpl)_[0-9a-f]+(_|$)/.test(name);
}

/**
 * Why the harness refuses the host of `adminUrl` (a TEST_DATABASE_URL), or
 * undefined when it is on this machine or the throwaway opt-in is set. The
 * message names the host, never the credentials.
 */
export function externalClusterHostRefusal(
  adminUrl: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  if (isLoopbackUrl(adminUrl) || env[THROWAWAY_CLUSTER_OPT_IN] === '1') return undefined;
  let host = 'an unparseable host';
  try {
    host = new URL(adminUrl).hostname;
  } catch {
    // keep the placeholder
  }
  return (
    `TEST_DATABASE_URL points at ${host}, not this machine. The test harness resets the cluster-wide wringy_* ` +
    'login passwords to the committed development values and creates and drops databases there, so it only ' +
    `runs on a throwaway cluster: use a local one, or set ${THROWAWAY_CLUSTER_OPT_IN}=1 for a disposable remote cluster.`
  );
}

/**
 * Databases on the cluster, other than this harness's own and those `skip`
 * names, whose ops.environment marker names an environment other than local
 * or ci; a database the admin cannot open is reported as `unreadable`.
 */
export async function findNonTestEnvironments(
  adminUrl: string,
  skip: (database: string) => boolean = isHarnessDatabase,
): Promise<Array<{ database: string; environment: string }>> {
  const databases = await withClientAt(adminUrl, async (admin) => {
    const { rows } = await admin.query<{ datname: string }>(
      'SELECT datname FROM pg_catalog.pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname',
    );
    return rows.map((row) => row.datname).filter((name) => !skip(name));
  });
  const found: Array<{ database: string; environment: string }> = [];
  for (const database of databases) {
    const url = new URL(adminUrl);
    url.pathname = `/${encodeURIComponent(database)}`;
    try {
      const names = await withClientAt(url.toString(), async (client) => {
        const { rows } = await client.query<{ present: boolean }>(
          `SELECT to_regclass('ops.environment') IS NOT NULL AS present`,
        );
        if (!rows[0]?.present) return [];
        return (await client.query<{ name: string }>('SELECT name FROM ops.environment')).rows.map((row) => row.name);
      });
      for (const environment of names) {
        if (!TEST_ENVIRONMENTS.includes(environment)) found.push({ database, environment });
      }
    } catch {
      found.push({ database, environment: 'unreadable' });
    }
  }
  return found;
}

/** Throws TestClusterRefusedError unless `adminUrl` names a cluster this harness may bootstrap. See the module comment. */
export async function assertThrowawayCluster(adminUrl: string): Promise<void> {
  const hostRefusal = externalClusterHostRefusal(adminUrl);
  if (hostRefusal !== undefined) throw new TestClusterRefusedError(hostRefusal);
  const marked = await findNonTestEnvironments(adminUrl);
  if (marked.length > 0) {
    const listed = marked.map(({ database, environment }) => `${database} (${environment})`).join(', ');
    throw new TestClusterRefusedError(
      `The TEST_DATABASE_URL cluster holds databases of another environment: ${listed}. The test harness resets ` +
        'the cluster-wide wringy_* login passwords, so it refuses a cluster that serves anything but local or ci.',
    );
  }
}

/** Advisory-lock key (hashed by the server) that serialises bootstrapTestRoles across runs sharing a cluster. */
const BOOTSTRAP_LOCK = 'wringy-test-cluster-bootstrap';

/**
 * The login roles and groups as `pnpm db:bootstrap` makes them, with the fixed
 * local development passwords, so pointing TEST_DATABASE_URL at the
 * `pnpm db:start` cluster leaves a working local .env untouched.
 *
 * Roles are cluster-wide, and test runs can share one cluster: CI points every
 * suite at one postgres:17 service, and `pnpm test:int` runs the apps/api and
 * apps/worker suites at the same time. Two sessions altering or granting the
 * same role at once fail with "tuple concurrently updated" (XX000; seen in
 * `pnpm test:int` against one cluster on 2026-09-23), so the bootstrap holds a
 * session advisory lock. Every admin connection opens the same database (the
 * admin URL's), which is what an advisory lock is scoped to.
 */
export async function bootstrapTestRoles(cluster: ClusterInfo): Promise<void> {
  await withAdminAt(cluster, async (admin) => {
    await admin.query('SELECT pg_advisory_lock(hashtext($1))', [BOOTSTRAP_LOCK]);
    try {
      await ensureRoles(admin, cluster.passwords);
    } finally {
      await admin.query('SELECT pg_advisory_unlock(hashtext($1))', [BOOTSTRAP_LOCK]);
    }
  });
}

/** Roles as `pnpm db:bootstrap` makes them, then the template migrated from zero and marked, as the migrator. */
async function prepareTemplate(cluster: ClusterInfo): Promise<void> {
  await bootstrapTestRoles(cluster);
  await withAdminAt(cluster, async (admin) => {
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
  if (external) await assertThrowawayCluster(external);
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
    // On a cluster that outlives this run (TEST_DATABASE_URL), leave no half-made template behind.
    await dropRunDatabases(info).catch(() => {});
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
