import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EXPECTED_PGBOSS_VERSION, type Pool } from '@wringy/db';

import { PGBOSS_APPLICATION_NAME } from '../src/connections';
import { WorkerStartupError } from '../src/worker';
import {
  buildWorker,
  createTestDatabase,
  heartbeatRow,
  migratorPool,
  type TestDatabase,
  type TestWorker,
} from './support';

async function startupRefusal(subject: TestWorker): Promise<WorkerStartupError> {
  const error = await subject.worker.start().then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(WorkerStartupError);
  return error as WorkerStartupError;
}

async function pgbossSessions(migrator: Pool, database: string): Promise<number> {
  const { rows } = await migrator.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_catalog.pg_stat_activity WHERE datname = $1 AND application_name = $2`,
    [database, PGBOSS_APPLICATION_NAME],
  );
  return rows[0]!.n;
}

describe('worker startup refusals (kickoff-package.md §8.3, §8.5)', () => {
  let db: TestDatabase;
  let migrator: Pool;
  let subject: TestWorker | undefined;

  beforeEach(async () => {
    db = await createTestDatabase();
    migrator = migratorPool(db);
  });

  afterEach(async () => {
    await subject?.dispose();
    subject = undefined;
    await migrator.end();
    await db.drop();
  });

  it('startup refuses an environment mismatch', async () => {
    // The harness marks every clone `ci`; this worker says staging.
    subject = buildWorker(db, { workerId: 'env-1', wringyEnv: 'staging' });
    const refusal = await startupRefusal(subject);
    expect(refusal.reason).toBe('environment_mismatch');
    expect(refusal.message).toBe(
      'This database is marked as environment "ci", but WRINGY_ENV is "staging". Refusing to start.',
    );
    expect(subject.worker.status).toBe('failed');
    // Refused before anything else: no beat written, pg-boss never connected.
    expect(await heartbeatRow(migrator, 'env-1')).toBeUndefined();
    expect(await pgbossSessions(migrator, db.name)).toBe(0);
  });

  it('startup refuses a database with no environment marker', async () => {
    await migrator.query('DELETE FROM ops.environment');
    subject = buildWorker(db, { workerId: 'env-2' });
    const refusal = await startupRefusal(subject);
    expect(refusal.reason).toBe('environment_unmarked');
    expect(await heartbeatRow(migrator, 'env-2')).toBeUndefined();
  });

  it('start() refuses when pgboss schema is missing/behind (migrate:false)', async () => {
    // Missing: the installed schema moved aside, as on a database pg-boss was never installed in.
    await migrator.query('ALTER SCHEMA pgboss RENAME TO pgboss_parked');
    subject = buildWorker(db, { workerId: 'boss-1' });
    let refusal = await startupRefusal(subject);
    expect(refusal.reason).toBe('pgboss_schema');
    expect(refusal.message).toContain('pg-boss is not installed');
    // migrate: false and createSchema: false: the worker created nothing in its place.
    const { rows: schema } = await migrator.query<{ present: boolean }>(
      `SELECT to_regnamespace('pgboss') IS NOT NULL AS present`,
    );
    expect(schema[0]!.present).toBe(false);
    expect(await heartbeatRow(migrator, 'boss-1')).toBeUndefined();
    await subject.dispose();
    await migrator.query('ALTER SCHEMA pgboss_parked RENAME TO pgboss');

    // Behind (and ahead): any version other than the one this pg-boss build expects.
    for (const version of [EXPECTED_PGBOSS_VERSION - 1, EXPECTED_PGBOSS_VERSION + 1]) {
      await migrator.query('UPDATE pgboss.version SET version = $1', [version]);
      subject = buildWorker(db, { workerId: `boss-v${version}` });
      refusal = await startupRefusal(subject);
      expect(refusal.reason).toBe('pgboss_schema');
      expect(refusal.message).toContain('pg-boss database requires migrations');
      // pg-boss did not migrate it: the recorded version is untouched.
      const { rows } = await migrator.query<{ version: number }>('SELECT version FROM pgboss.version');
      expect(rows[0]!.version).toBe(version);
      await subject.dispose();
    }
    subject = undefined;

    // pg-boss's pool opened for the check is closed again after the refusal.
    expect(await pgbossSessions(migrator, db.name)).toBe(0);

    // Put back, the same worker code starts.
    await migrator.query('UPDATE pgboss.version SET version = $1', [EXPECTED_PGBOSS_VERSION]);
    subject = buildWorker(db, { workerId: 'boss-ok' });
    await subject.worker.start();
    expect(subject.worker.status).toBe('running');
  });
});
