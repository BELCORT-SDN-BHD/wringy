/**
 * Integration-test harness on a real PostgreSQL (kickoff-package.md §6.3).
 *
 * - `createTestDatabase()` clones the migrated template once per test file
 *   (`CREATE DATABASE … TEMPLATE …`), for tests that need committed rows or
 *   several connections. Call `drop()` in `afterAll`.
 * - `withRollback(pool, fn)` runs `fn` on one connection inside a transaction
 *   that is always rolled back, for per-test isolation inside a file.
 *
 * The global setup (global-setup.ts) starts the cluster and migrates the template.
 */
import { randomBytes } from 'node:crypto';

import pg from 'pg';
import { inject } from 'vitest';

import { restrictDatabaseAccess } from '../src/bootstrap';
import { postgresUrl } from '../src/local-dev';
import { ROLES } from '../src/roles';

export interface ClusterInfo {
  /** Superuser (or equivalent) URL of the test cluster. Never used by product code. */
  adminUrl: string;
  host: string;
  port: number;
  /** Prefix shared by every database this run creates, for cleanup. */
  runId: string;
  /** Migrated from zero by the global setup; never connected to directly. */
  templateDatabase: string;
  passwords: { migrator: string; api: string; worker: string };
}

export interface TestDatabase {
  name: string;
  /** One URL per login role, all pointing at this clone. */
  urls: { migrator: string; api: string; worker: string };
  drop(): Promise<void>;
}

export function cluster(): ClusterInfo {
  return inject('wringyCluster');
}

/** Runs `fn` with a short-lived admin connection to the cluster's `postgres` database. */
export async function withAdmin<T>(fn: (admin: pg.Client) => Promise<T>): Promise<T> {
  const admin = new pg.Client({ connectionString: cluster().adminUrl, application_name: 'wringy-test-admin' });
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.end();
  }
}

/** A URL for `user` on `database` in the test cluster. */
export function urlFor(user: string, password: string, database: string): string {
  const { host, port } = cluster();
  return postgresUrl({ user, password, host, port, database });
}

/** A fresh database cloned from the migrated template, with CONNECT for the runtime groups only. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const { runId, templateDatabase, passwords } = cluster();
  const name = `wringy_t_${runId}_${randomBytes(4).toString('hex')}`;

  await withAdmin(async (admin) => {
    await admin.query(
      `CREATE DATABASE ${admin.escapeIdentifier(name)} TEMPLATE ${admin.escapeIdentifier(templateDatabase)} OWNER ${admin.escapeIdentifier(ROLES.migrator)}`,
    );
    await restrictDatabaseAccess(admin, name);
  });

  return {
    name,
    urls: {
      migrator: urlFor(ROLES.migrator, passwords.migrator, name),
      api: urlFor(ROLES.apiLogin, passwords.api, name),
      worker: urlFor(ROLES.workerLogin, passwords.worker, name),
    },
    drop: () =>
      withAdmin(async (admin) => {
        await admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(name)} WITH (FORCE)`);
      }),
  };
}

/** Runs `fn` inside a transaction on one pooled connection and always rolls it back. */
export async function withRollback<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return await fn(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

/** The SQLSTATE of a failed query, e.g. 42501 insufficient_privilege. */
export async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}
