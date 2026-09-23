import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Pool } from '@wringy/db';

import { HEARTBEAT_CRON, HEARTBEAT_QUEUE } from '../src/jobs/heartbeat';
import { buildWorker, createTestDatabase, heartbeatRow, migratorPool, waitFor, type TestDatabase, type TestWorker } from './support';

/**
 * Beat B end to end (kickoff-package.md §8.3): pg-boss turns the
 * `system.heartbeat` schedule (`* * * * *`) into a job and the worker's
 * handler stamps last_queue_round_trip_at, all as the runtime login. Nothing
 * here sends a job: no triggerRoundTrip(), no probe. The worker is built as
 * main.ts builds it, with pg-boss's default cron timing (the schedule is
 * evaluated every 30 s, at minute precision), so the first scheduled job can
 * take up to about 90 s. The cron monitor also stamps pgboss.version.cron_on,
 * one of the columns migration 0006 leaves the worker.
 */
describe('M2-AC01/2 the scheduled queue round trip (Beat B) under the runtime role', () => {
  let db: TestDatabase;
  let migrator: Pool;
  let subject: TestWorker | undefined;

  beforeAll(async () => {
    db = await createTestDatabase();
    migrator = migratorPool(db);
  });

  afterAll(async () => {
    await subject?.dispose();
    await migrator?.end();
    await db?.drop();
  });

  it('M2-AC01/2 the pg-boss schedule becomes a queue round trip with no job sent by hand', async () => {
    subject = buildWorker(db, { workerId: 'cron-1' });
    await subject.worker.start();
    expect((await heartbeatRow(migrator, 'cron-1'))?.last_queue_round_trip_at).toBeNull();

    const row = await waitFor(
      () => heartbeatRow(migrator, 'cron-1'),
      (current) => current?.last_queue_round_trip_at != null,
      120_000,
    );
    expect(row?.last_queue_round_trip_at).not.toBeNull();

    // The job that did it came from the schedule: no probe payload, and nothing else was sent.
    const { rows: jobs } = await migrator.query<{ state: string; probe: boolean }>(
      `SELECT state::text, coalesce(data ? 'probe', false) AS probe FROM pgboss.job WHERE name = $1`,
      [HEARTBEAT_QUEUE],
    );
    expect(jobs.length).toBeGreaterThanOrEqual(1);
    expect(jobs.every((job) => !job.probe)).toBe(true);
    expect(jobs.some((job) => job.state === 'completed' || job.state === 'active')).toBe(true);

    const { rows: schedule } = await migrator.query<{ cron: string }>(`SELECT cron FROM pgboss.schedule WHERE name = $1`, [
      HEARTBEAT_QUEUE,
    ]);
    expect(schedule).toEqual([{ cron: HEARTBEAT_CRON }]);
    // The cron monitor ran as the worker login and stamped its claim.
    const { rows: version } = await migrator.query<{ stamped: boolean }>(
      'SELECT cron_on IS NOT NULL AS stamped FROM pgboss.version',
    );
    expect(version).toEqual([{ stamped: true }]);
  }, 150_000);
});
