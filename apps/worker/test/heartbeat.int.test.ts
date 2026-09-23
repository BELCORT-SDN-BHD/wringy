import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Pool } from '@wringy/db';
import { cluster, withClientAt } from '@wringy/db/testing';

import { WORKER_APPLICATION_NAME, WORKER_QUERY_TIMEOUT_MS, WORKER_STATEMENT_TIMEOUT_MS } from '../src/connections';
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
describe('M2-AC01 worker heartbeats, the worker leg of the narrow loop (kickoff-package.md §8.3)', () => {
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

  it('M2-AC01 a beat held up by a lock gives up at the worker pool statement limit (57014)', async () => {
    subject = buildWorker(db, { workerId: 'bounded-1' });
    const holder = await migrator.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('LOCK TABLE ops.worker_heartbeat IN ACCESS EXCLUSIVE MODE');
      const t0 = Date.now();
      const failure = await subject.worker.beatOnce().then(
        () => undefined,
        (error: { code?: string }) => error,
      );
      const elapsed = Date.now() - t0;
      expect(failure?.code).toBe('57014');
      expect(elapsed).toBeGreaterThanOrEqual(WORKER_STATEMENT_TIMEOUT_MS - 250);
      expect(elapsed).toBeLessThan(WORKER_QUERY_TIMEOUT_MS + 1_000);
      expect(await lockWaiters(db.name)).toBe(0);
    } finally {
      await holder.query('ROLLBACK').catch(() => {});
      holder.release();
    }
  });

  it('M2-AC01 graceful stop starts the pg-boss drain at once while a beat is stuck on a lock, then marks stopped_at', async () => {
    subject = buildWorker(db, { workerId: 'stuck-1', beatIntervalMs: 250, pollingIntervalSeconds: 0.5 });
    const { worker, boss } = subject;
    await worker.start();
    let bossStoppedAt: number | undefined;
    boss.on('stopped', () => {
      bossStoppedAt = Date.now();
    });

    const holder = await migrator.connect();
    let t0 = 0;
    let stopping: Promise<void> | undefined;
    try {
      await holder.query('BEGIN');
      await holder.query('LOCK TABLE ops.worker_heartbeat IN ACCESS EXCLUSIVE MODE');
      // A beat is now in flight, waiting on the lock.
      expect(await waitFor(() => lockWaiters(db.name), (n) => n >= 1, 3_000)).toBeGreaterThanOrEqual(1);

      t0 = Date.now();
      stopping = worker.stop();
      // pg-boss drains and stops while the beat still waits: the drain does not queue behind it.
      await waitFor(async () => bossStoppedAt, (at) => at !== undefined, 3_000);
      expect(bossStoppedAt).toBeDefined();
      expect(bossStoppedAt! - t0).toBeLessThan(3_000);
      expect(await lockWaiters(db.name)).toBeGreaterThanOrEqual(1);
      expect(worker.status).toBe('stopping');
    } finally {
      await holder.query('ROLLBACK').catch(() => {});
      holder.release();
    }

    // With the lock gone the beat settles and stop() records stopped_at after it.
    await stopping;
    expect(worker.status).toBe('stopped');
    const row = await heartbeatRow(migrator, 'stuck-1');
    expect(row!.stopped_at).not.toBeNull();
    expect(row!.stopped_at!.getTime()).toBeGreaterThanOrEqual(row!.last_beat_at.getTime());
  });
});

/** Worker-pool sessions of `database` waiting on a lock (read as the cluster admin: wait events of other roles are hidden). */
async function lockWaiters(database: string): Promise<number> {
  return withClientAt(cluster().adminUrl, async (admin) => {
    const { rows } = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_catalog.pg_stat_activity
        WHERE datname = $1 AND application_name = $2 AND wait_event_type = 'Lock'`,
      [database, WORKER_APPLICATION_NAME],
    );
    return rows[0]!.n;
  });
}

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
