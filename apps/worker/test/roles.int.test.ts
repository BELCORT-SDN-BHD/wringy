import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Pool } from '@wringy/db';

import { PGBOSS_APPLICATION_NAME, WORKER_APPLICATION_NAME } from '../src/connections';
import { HEARTBEAT_CRON, HEARTBEAT_QUEUE } from '../src/jobs/heartbeat';
import { buildWorker, createTestDatabase, migratorPool, type TestDatabase, type TestWorker } from './support';

async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe('M2-AC01 worker database role (kickoff-package.md §4.11, §8.5; ruling D33)', () => {
  let db: TestDatabase;
  let migrator: Pool;
  let subject: TestWorker;

  beforeAll(async () => {
    db = await createTestDatabase();
    migrator = migratorPool(db);
    subject = buildWorker(db, { workerId: 'roles-1' });
    await subject.worker.start();
  });

  afterAll(async () => {
    await subject?.dispose();
    await migrator?.end();
    await db?.drop();
  });

  it('M2-AC01/2 the worker runs as the runtime role and cannot read app.campaigns', async () => {
    const { rows: who } = await subject.pool.query<{ current_user: string; session_user: string }>(
      'SELECT current_user, session_user',
    );
    expect(who[0]).toEqual({ current_user: 'wringy_worker_login', session_user: 'wringy_worker_login' });

    // Both of the worker's pools, its own and pg-boss's, log in as the runtime login.
    const { rows: sessions } = await migrator.query<{ usename: string; application_name: string }>(
      `SELECT DISTINCT usename, application_name FROM pg_catalog.pg_stat_activity
        WHERE datname = $1 AND application_name = ANY($2) ORDER BY application_name`,
      [db.name, [WORKER_APPLICATION_NAME, PGBOSS_APPLICATION_NAME]],
    );
    expect(sessions).toEqual([
      { usename: 'wringy_worker_login', application_name: WORKER_APPLICATION_NAME },
      { usename: 'wringy_worker_login', application_name: PGBOSS_APPLICATION_NAME },
    ]);

    // No business data: 42501 insufficient_privilege on app.
    expect(await sqlState(subject.pool.query('SELECT count(*) FROM app.campaigns'))).toBe('42501');
    expect(await sqlState(subject.pool.query('SELECT count(*) FROM app.orgs'))).toBe('42501');
    // The environment marker is read-only to it.
    expect(await sqlState(subject.pool.query(`UPDATE ops.environment SET fixtures_allowed = true`))).toBe('42501');
  });

  it('M2-AC01/2 pg-boss runs under the runtime role with DML only: the queue and schedule exist, no DDL right', async () => {
    const { rows: rights } = await migrator.query<Record<string, boolean>>(
      `SELECT has_schema_privilege('wringy_worker_login', 'pgboss', 'CREATE') AS pgboss_create,
              has_schema_privilege('wringy_worker_login', 'ops', 'CREATE') AS ops_create,
              has_database_privilege('wringy_worker_login', current_database(), 'CREATE') AS database_create,
              has_schema_privilege('wringy_worker_login', 'app', 'USAGE') AS app_usage`,
    );
    expect(rights[0]).toEqual({ pgboss_create: false, ops_create: false, database_create: false, app_usage: false });

    // createQueue(..., { partition: false }) and schedule() succeeded as that role during start().
    const { rows: queues } = await migrator.query<{ name: string; partition: boolean; table_name: string }>(
      `SELECT name, partition, table_name FROM pgboss.queue WHERE name = $1`,
      [HEARTBEAT_QUEUE],
    );
    expect(queues).toEqual([{ name: HEARTBEAT_QUEUE, partition: false, table_name: 'job_common' }]);
    const { rows: schedules } = await migrator.query<{ name: string; cron: string }>(
      `SELECT name, cron FROM pgboss.schedule WHERE name = $1`,
      [HEARTBEAT_QUEUE],
    );
    expect(schedules).toEqual([{ name: HEARTBEAT_QUEUE, cron: HEARTBEAT_CRON }]);
  });
});
