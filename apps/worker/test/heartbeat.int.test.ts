import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Pool } from '@wringy/db';

import { HEARTBEAT_QUEUE } from '../src/jobs/heartbeat';
import {
  buildWorker,
  createTestDatabase,
  dbNow,
  heartbeatRow,
  migratorPool,
  sleep,
  waitFor,
  type TestDatabase,
  type TestWorker,
} from './support';

/**
 * The worker's two beats and its drain, on a fresh clone per test (a worker
 * commits over its own connections, so a rollback cannot isolate it; §6.3).
 */
describe('worker heartbeats (kickoff-package.md §8.3)', () => {
  let db: TestDatabase;
  let migrator: Pool;
  let subject: TestWorker | undefined;

  beforeEach(async () => {
    db = await createTestDatabase();
    migrator = migratorPool(db);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await subject?.dispose();
    subject = undefined;
    await migrator.end();
    await db.drop();
  });

  it('worker heartbeat row appears within one beat and uses the database clock', async () => {
    const beatIntervalMs = 1_000;
    subject = buildWorker(db, { workerId: 'beat-1', beatIntervalMs });
    const { worker } = subject;

    // 1. The database clock, not the process clock: with the process clock
    //    moved to 2001, the beat still records the database's time.
    const before = await dbNow(migrator);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2001-01-01T00:00:00Z'));
    const returned = await worker.beatOnce();
    vi.useRealTimers();
    const after = await dbNow(migrator);

    const first = await heartbeatRow(migrator, 'beat-1');
    expect(first).toBeDefined();
    expect(first!.last_beat_at.getTime()).toBe(returned.getTime());
    expect(first!.last_beat_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(first!.last_beat_at.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(first!.last_beat_at.getUTCFullYear()).not.toBe(2001);
    expect(first!.started_at.getTime()).toBe(first!.last_beat_at.getTime());
    expect(first!.image_ref).toBe('ghcr.io/belcort-sdn-bhd/wringy-worker:test');
    expect(first!.stopped_at).toBeNull();

    // 2. Running: the row advances within one beat interval, and started_at stays.
    await worker.start();
    const started = await heartbeatRow(migrator, 'beat-1');
    const advanced = await waitFor(
      () => heartbeatRow(migrator, 'beat-1'),
      (row) => row!.last_beat_at.getTime() > started!.last_beat_at.getTime(),
      beatIntervalMs * 2,
    );
    expect(advanced!.last_beat_at.getTime()).toBeGreaterThan(started!.last_beat_at.getTime());
    expect(advanced!.last_beat_at.getTime() - started!.last_beat_at.getTime()).toBeLessThan(beatIntervalMs * 2);
    expect(advanced!.started_at.getTime()).toBe(started!.started_at.getTime());
    expect(worker.beatState.consecutiveFailures).toBe(0);
    expect(worker.beatState.beats).toBeGreaterThanOrEqual(3);
  });

  it('queue round trip: a sent system.heartbeat job updates last_queue_round_trip_at', async () => {
    subject = buildWorker(db, { workerId: 'trip-1', pollingIntervalSeconds: 0.5 });
    await subject.worker.start();

    const before = await dbNow(migrator);
    const at = await subject.worker.triggerRoundTrip();
    const after = await dbNow(migrator);

    expect(at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(at.getTime()).toBeLessThanOrEqual(after.getTime());
    const row = await heartbeatRow(migrator, 'trip-1');
    expect(row!.last_queue_round_trip_at!.getTime()).toBeGreaterThanOrEqual(at.getTime());

    // pg-boss settles the probe job as completed once the handler returns.
    const state = await waitFor(
      async () => {
        const { rows } = await migrator.query<{ state: string }>(
          `SELECT state::text FROM pgboss.job WHERE name = $1 AND data->>'probe' IS NOT NULL`,
          [HEARTBEAT_QUEUE],
        );
        return rows.map((r) => r.state);
      },
      (states) => states.length === 1 && states[0] === 'completed',
    );
    expect(state).toEqual(['completed']);
  });

  it('graceful stop drains and sets stopped_at', async () => {
    subject = buildWorker(db, { workerId: 'drain-1', pollingIntervalSeconds: 0.5, drainTimeoutMs: 15_000 });
    const { worker } = subject;
    await worker.start();

    // Hold the worker's row so the round-trip handler blocks mid-job.
    const holder = await migrator.connect();
    let jobId: string | null = null;
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT 1 FROM ops.worker_heartbeat WHERE worker_id = 'drain-1' FOR UPDATE`);

      jobId = await sendHeartbeatJob(subject);

      const active = await waitFor(
        () => jobState(migrator, jobId!),
        (state) => state === 'active',
      );
      expect(active).toBe('active');

      let stopped = false;
      const t0 = Date.now();
      const stopping = worker.stop().then(() => {
        stopped = true;
      });
      await sleep(1_500);
      // Still draining: the running job has not finished, so stop() has not returned.
      expect(stopped).toBe(false);
      expect(worker.status).toBe('stopping');

      await holder.query('COMMIT');
      await stopping;
      expect(Date.now() - t0).toBeGreaterThanOrEqual(1_500);
    } finally {
      await holder.query('ROLLBACK').catch(() => {});
      holder.release();
    }

    // The job the drain waited for completed rather than being failed by the shutdown.
    expect(await jobState(migrator, jobId!)).toBe('completed');
    const row = await heartbeatRow(migrator, 'drain-1');
    expect(row!.last_queue_round_trip_at).not.toBeNull();
    expect(row!.stopped_at).not.toBeNull();
    expect(row!.stopped_at!.getTime()).toBeGreaterThanOrEqual(row!.last_beat_at.getTime());
    expect(row!.stopped_at!.getTime()).toBeGreaterThanOrEqual(row!.last_queue_round_trip_at!.getTime());
    expect(worker.status).toBe('stopped');

    // pg-boss closed its own pool: no session of it is left on the clone.
    const { rows: left } = await migrator.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_catalog.pg_stat_activity WHERE datname = $1 AND application_name = 'wringy-worker-pgboss'`,
      [db.name],
    );
    expect(left[0]!.n).toBe(0);
  });
});

async function jobState(pool: Pool, id: string): Promise<string | undefined> {
  const { rows } = await pool.query<{ state: string }>('SELECT state::text FROM pgboss.job WHERE id = $1', [id]);
  return rows[0]?.state;
}

/** Sends a plain system.heartbeat job (no probe) through the worker's own pg-boss, as the cron would. */
async function sendHeartbeatJob(subject: TestWorker): Promise<string> {
  const id = await subject.boss.send(HEARTBEAT_QUEUE, {});
  if (id === null) throw new Error('pg-boss did not create the job');
  return id;
}
