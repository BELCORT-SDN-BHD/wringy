/**
 * Integration-test harness on a real PostgreSQL (kickoff-package.md §6.3),
 * exported as `@wringy/db/testing` for the Vitest integration suites of
 * packages/db, apps/api and apps/worker.
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
 * The global setup (`@wringy/db/testing/global-setup`, global-setup.ts) starts
 * the cluster through cluster.ts, migrates the template with `pnpm db:migrate`'s
 * own code (pg-boss schema, then the SQL migrations), marks it as environment
 * TEST_WRINGY_ENV, which allows fixtures, and hands the cluster to the test
 * files through Vitest's provide/inject. A clone holds no fixture rows until a
 * test seeds them. Code without a Vitest runtime (the Playwright internal suite)
 * uses cluster.ts (`@wringy/db/testing/cluster`) directly.
 */
import pg from 'pg';
import { inject } from 'vitest';

import type { WringyEnv } from '@wringy/config';

import type { EnvironmentMarker } from '../src/environment';
import type { SeedFixturesResult } from '../src/fixtures';
import {
  clusterUrl,
  createDatabaseIn,
  seedFixturesIn,
  setEnvironmentIn,
  withAdminAt,
  withClientAt,
  type ClusterInfo,
  type TestDatabase,
} from './cluster';

export { TEST_WRINGY_ENV } from './test-env';
export { withClientAt };
export type { ClusterInfo, TestDatabase };

declare module 'vitest' {
  export interface ProvidedContext {
    wringyCluster: ClusterInfo;
  }
}

export function cluster(): ClusterInfo {
  return inject('wringyCluster');
}

/** Runs `fn` with a short-lived admin connection to the cluster's `postgres` database. */
export function withAdmin<T>(fn: (admin: pg.Client) => Promise<T>): Promise<T> {
  return withAdminAt(cluster(), fn);
}

/** A URL for `user` on `database` in the test cluster. */
export function urlFor(user: string, password: string, database: string): string {
  return clusterUrl(cluster(), user, password, database);
}

/** A fresh database cloned from the migrated template, with CONNECT for the runtime groups only. */
export function createTestDatabase(): Promise<TestDatabase> {
  return createDatabaseIn(cluster());
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

/** Applies fixtures/internal-campaigns.sql to `db` as the migrator, as `pnpm db:seed:fixtures` does. */
export function seedFixtures(db: TestDatabase): Promise<SeedFixturesResult> {
  return seedFixturesIn(db);
}

/** Re-marks `db` as environment `name` (fixtures allowed except in production). */
export function setTestEnvironment(db: TestDatabase, name: WringyEnv): Promise<EnvironmentMarker> {
  return setEnvironmentIn(db, name);
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
