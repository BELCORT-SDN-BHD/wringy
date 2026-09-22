/**
 * Integration-test harness on a real PostgreSQL (kickoff-package.md §6.3).
 *
 * - `createTestDatabase()` clones the migrated template once per test file
 *   (`CREATE DATABASE … TEMPLATE …`), for tests that need committed rows or
 *   several connections. Call `drop()` in `afterAll`.
 * - `withRollback(pool, fn)` runs `fn` on one connection inside a transaction
 *   that is always rolled back, for per-test isolation inside a file.
 * - `seedFixtures(db)` applies the internal-build fixture seed to a clone, the
 *   same way `pnpm db:seed:fixtures` does; `setTestEnvironment(db, name)`
 *   re-marks a clone (for example as production, to see fixtures refused).
 *
 * The global setup (global-setup.ts) starts the cluster, migrates the template
 * with `pnpm db:migrate`'s own code (pg-boss schema, then the SQL migrations),
 * and marks it as environment TEST_WRINGY_ENV, which allows fixtures. A clone
 * holds no fixture rows until a test seeds them.
 */
import { randomBytes } from 'node:crypto';

import pg from 'pg';
import { inject } from 'vitest';

import type { WringyEnv } from '@wringy/config';

import { restrictDatabaseAccess } from '../src/bootstrap';
import { setEnvironment, type EnvironmentMarker } from '../src/environment';
import { seedFixtures as applyFixtureSeed, type SeedFixturesResult } from '../src/fixtures';
import { postgresUrl } from '../src/local-dev';
import { ROLES } from '../src/roles';

export { TEST_WRINGY_ENV } from './test-env';

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

/** Runs `fn` with one short-lived client connected as `url`'s login. */
export async function withClientAt<T>(url: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url, application_name: 'wringy-test' });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Applies fixtures/internal-campaigns.sql to `db` as the migrator, as `pnpm db:seed:fixtures` does. */
export function seedFixtures(db: TestDatabase): Promise<SeedFixturesResult> {
  return withClientAt(db.urls.migrator, (client) => applyFixtureSeed(client));
}

/** Re-marks `db` as environment `name` (fixtures allowed except in production). */
export async function setTestEnvironment(db: TestDatabase, name: WringyEnv): Promise<EnvironmentMarker> {
  const { marker } = await withClientAt(db.urls.migrator, (client) => setEnvironment(client, name, { relabel: true }));
  return marker;
}

/** What a failed statement reports: the SQLSTATE, the constraint it names, and the message. */
export interface SqlFailure {
  code?: string;
  constraint?: string;
  message: string;
}

/**
 * Runs `fn` inside a savepoint on `client` and returns its failure (or undefined
 * when it succeeded), so a test can assert a refusal and keep using the same
 * transaction afterwards (a failed statement would otherwise abort it).
 */
export async function failureIn(
  client: pg.ClientBase,
  fn: () => Promise<unknown>,
): Promise<SqlFailure | undefined> {
  await client.query('SAVEPOINT wringy_expect_failure');
  try {
    await fn();
    await client.query('RELEASE SAVEPOINT wringy_expect_failure');
    return undefined;
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT wringy_expect_failure');
    const { code, constraint, message } = error as SqlFailure;
    return { code, constraint, message };
  }
}
