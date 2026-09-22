/**
 * Vitest global setup for `pnpm test:int` (kickoff-package.md §6.2–§6.3).
 *
 * 1. Cluster: TEST_DATABASE_URL (an admin URL, e.g. CI's postgres:17 service)
 *    when set; otherwise a throwaway embedded PostgreSQL 17 on a free port in a
 *    temporary directory, TimeZone=UTC, removed at teardown.
 * 2. Roles: the same idempotent bootstrap `pnpm db:bootstrap` runs.
 * 3. Template: an empty database owned by the migrator, migrated from zero as
 *    the migrator by `pnpm db:migrate`'s own code (the pg-boss CLI, then the
 *    real versioned migrations; never a hand-kept dump), then marked as
 *    environment TEST_WRINGY_ENV the way `pnpm db:env` marks it. Test files
 *    clone it with `createTestDatabase()` (harness.ts).
 */
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

import { ensureDatabase, ensureRoles } from '../src/bootstrap';
import { setEnvironment } from '../src/environment';
import { LOCAL_PASSWORDS, postgresUrl } from '../src/local-dev';
import { migrateDatabase } from '../src/migrate';
import { ROLES } from '../src/roles';
import type { ClusterInfo } from './harness';
import { TEST_WRINGY_ENV } from './test-env';

declare module 'vitest' {
  export interface ProvidedContext {
    wringyCluster: ClusterInfo;
  }
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
  const cluster = new EmbeddedPostgres({
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
  await cluster.initialise();
  await cluster.start();
  return {
    adminUrl: postgresUrl({ user: 'postgres', password, host: '127.0.0.1', port, database: 'postgres' }),
    stop: async () => {
      // persistent: false makes stop() delete the data directory; the parent goes too.
      await cluster.stop();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** Roles as `pnpm db:bootstrap` makes them, then the template migrated from zero and marked, as the migrator. */
async function prepareTemplate(adminUrl: string, host: string, portNumber: number, templateDatabase: string) {
  const admin = new pg.Client({ connectionString: adminUrl, application_name: 'wringy-test-setup' });
  await admin.connect();
  try {
    // The fixed local development passwords, so pointing TEST_DATABASE_URL at the
    // `pnpm db:start` cluster leaves a working local .env untouched.
    await ensureRoles(admin, LOCAL_PASSWORDS);
    await ensureDatabase(admin, templateDatabase);
  } finally {
    await admin.end();
  }

  const migratorUrl = postgresUrl({
    user: ROLES.migrator,
    password: LOCAL_PASSWORDS.migrator,
    host,
    port: portNumber,
    database: templateDatabase,
  });
  await migrateDatabase({ databaseUrl: migratorUrl });

  const migrator = new pg.Client({ connectionString: migratorUrl, application_name: 'wringy-test-setup' });
  await migrator.connect();
  try {
    await setEnvironment(migrator, TEST_WRINGY_ENV);
  } finally {
    await migrator.end();
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const external = process.env.TEST_DATABASE_URL;
  const embedded = external ? undefined : await startEmbedded();
  const adminUrl = external ?? embedded!.adminUrl;
  const { hostname, port } = new URL(adminUrl);

  const runId = randomBytes(4).toString('hex');
  const templateDatabase = `wringy_tpl_${runId}`;
  const host = hostname.replace(/^\[|\]$/g, '');
  const portNumber = Number(port || 5432);

  try {
    await prepareTemplate(adminUrl, host, portNumber, templateDatabase);
  } catch (error) {
    await embedded?.stop();
    throw error;
  }

  project.provide('wringyCluster', {
    adminUrl,
    host,
    port: portNumber,
    runId,
    templateDatabase,
    passwords: LOCAL_PASSWORDS,
  });

  return async () => {
    const cleanup = new pg.Client({ connectionString: adminUrl });
    await cleanup.connect();
    try {
      const { rows } = await cleanup.query<{ datname: string }>(
        'SELECT datname FROM pg_catalog.pg_database WHERE datname LIKE $1 OR datname = $2',
        [`wringy_t_${runId}_%`, templateDatabase],
      );
      for (const { datname } of rows) {
        await cleanup.query(`DROP DATABASE IF EXISTS ${cleanup.escapeIdentifier(datname)} WITH (FORCE)`);
      }
    } finally {
      await cleanup.end();
    }
    await embedded?.stop();
  };
}
