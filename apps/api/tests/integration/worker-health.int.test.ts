import { workerHealthResponseSchema, type WorkerHealthResponse } from '@wringy/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { CACHE_CONTROL } from '../../src/app';
import { asMigrator, asWorker, buildTestApi, createTestDatabase, type TestApi, type TestDatabase } from './support';

const IMAGE = 'ghcr.io/belcort-sdn-bhd/wringy-worker:0123abc';

/** Upserts one heartbeat row as the worker login, with instants relative to the database clock. */
async function beat(
  db: TestDatabase,
  workerId: string,
  { lastBeatAgo, stoppedAgo = null, roundTripAgo = null }: { lastBeatAgo: string; stoppedAgo?: string | null; roundTripAgo?: string | null },
) {
  await asWorker(
    db,
    `INSERT INTO ops.worker_heartbeat (worker_id, started_at, last_beat_at, last_queue_round_trip_at, image_ref, stopped_at)
     VALUES ($1, now() - interval '10 minutes', now() - $2::interval,
             now() - $3::interval, $4, now() - $5::interval)
     ON CONFLICT (worker_id) DO UPDATE
       SET last_beat_at = EXCLUDED.last_beat_at,
           last_queue_round_trip_at = EXCLUDED.last_queue_round_trip_at,
           stopped_at = EXCLUDED.stopped_at`,
    [workerId, lastBeatAgo, roundTripAgo, IMAGE, stoppedAgo],
  );
}

function statesOf(body: WorkerHealthResponse): Record<string, string> {
  return Object.fromEntries(body.workers.map((worker) => [worker.workerId, worker.state]));
}

function queueStatesOf(body: WorkerHealthResponse): Record<string, string> {
  return Object.fromEntries(body.workers.map((worker) => [worker.workerId, worker.queueState]));
}

describe('M2-AC01 GET /internal/worker-health', () => {
  let db: TestDatabase;
  let api: TestApi;

  beforeAll(async () => {
    db = await createTestDatabase();
    api = await buildTestApi(db.urls.api);
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('M2-AC01/2 page→Fastify→PostgreSQL read: /internal/worker-health computes healthy/stale/stopped/never_seen on the database clock', async () => {
    // never_seen: no worker has ever written a row. The list is empty, never a count of 0 healthy.
    const empty = await api.app.inject({ method: 'GET', url: '/internal/worker-health' });
    expect(empty.statusCode).toBe(200);
    expect(empty.headers['cache-control']).toBe(CACHE_CONTROL);
    const emptyBody = workerHealthResponseSchema.parse(empty.json());
    expect(emptyBody.workers).toEqual([]);
    expect(Number.isNaN(Date.parse(emptyBody.dbNow))).toBe(false);

    await beat(db, 'w-healthy', { lastBeatAgo: '5 seconds', roundTripAgo: '20 seconds' });
    await beat(db, 'w-stale', { lastBeatAgo: '60 seconds' });
    await beat(db, 'w-stopped', { lastBeatAgo: '120 seconds', stoppedAgo: '110 seconds' });
    await beat(db, 'w-restarted', { lastBeatAgo: '3 seconds', stoppedAgo: '300 seconds' });

    const [clock] = await asMigrator<{ now: Date }>(db, 'SELECT now() AS now');
    const response = await api.app.inject({ method: 'GET', url: '/internal/worker-health' });
    expect(response.statusCode).toBe(200);
    const body = workerHealthResponseSchema.parse(response.json());

    expect(statesOf(body)).toEqual({
      'w-healthy': 'healthy',
      'w-restarted': 'healthy',
      'w-stale': 'stale',
      'w-stopped': 'stopped',
    });
    const healthy = body.workers.find((worker) => worker.workerId === 'w-healthy');
    expect(healthy?.imageRef).toBe(IMAGE);
    expect(healthy?.lastQueueRoundTripAt).not.toBeNull();
    expect(body.workers.find((worker) => worker.workerId === 'w-stale')?.lastQueueRoundTripAt).toBeNull();
    expect(Math.abs(Date.parse(body.dbNow) - clock!.now.getTime())).toBeLessThan(10_000);

    // The judgement uses the database clock, not the API host's: move the host
    // clock two hours ahead and nothing changes, and dbNow stays the database's.
    const hostShift = 2 * 60 * 60 * 1000;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + hostShift);
    const shifted = workerHealthResponseSchema.parse(
      (await api.app.inject({ method: 'GET', url: '/internal/worker-health' })).json(),
    );
    vi.useRealTimers();
    expect(statesOf(shifted)).toEqual(statesOf(body));
    expect(Math.abs(Date.parse(shifted.dbNow) - clock!.now.getTime())).toBeLessThan(10_000);
  });

  it('M2-AC01/2 page→Fastify→PostgreSQL read: /internal/worker-health computes queueState ok/overdue/never on the database clock, independent of the process state', async () => {
    await beat(db, 'q-ok', { lastBeatAgo: '2 seconds', roundTripAgo: '50 seconds' });
    await beat(db, 'q-edge', { lastBeatAgo: '2 seconds', roundTripAgo: '170 seconds' });
    await beat(db, 'q-overdue', { lastBeatAgo: '2 seconds', roundTripAgo: '4 minutes' });
    await beat(db, 'q-never', { lastBeatAgo: '2 seconds' });
    await beat(db, 'q-stopped-overdue', { lastBeatAgo: '20 minutes', stoppedAgo: '19 minutes', roundTripAgo: '21 minutes' });

    const response = await api.app.inject({ method: 'GET', url: '/internal/worker-health' });
    expect(response.statusCode).toBe(200);
    const body = workerHealthResponseSchema.parse(response.json());
    const queue = queueStatesOf(body);
    const processStates = statesOf(body);

    expect({
      ok: queue['q-ok'],
      edge: queue['q-edge'],
      overdue: queue['q-overdue'],
      never: queue['q-never'],
      stoppedOverdue: queue['q-stopped-overdue'],
    }).toEqual({ ok: 'ok', edge: 'ok', overdue: 'overdue', never: 'never', stoppedOverdue: 'overdue' });
    // The process beat is recent for every q-* row except the stopped one: queueState never changes `state`.
    expect(processStates['q-overdue']).toBe('healthy');
    expect(processStates['q-never']).toBe('healthy');
    expect(processStates['q-stopped-overdue']).toBe('stopped');
    expect(body.workers.find((worker) => worker.workerId === 'q-never')?.lastQueueRoundTripAt).toBeNull();

    // Judged on the database clock: shifting the API host's clock changes nothing.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 60 * 60 * 1000);
    const shifted = workerHealthResponseSchema.parse(
      (await api.app.inject({ method: 'GET', url: '/internal/worker-health' })).json(),
    );
    vi.useRealTimers();
    expect(queueStatesOf(shifted)).toEqual(queue);
  });

  it('a worker that beats again after being stale is healthy again', async () => {
    await beat(db, 'w-stale', { lastBeatAgo: '0 seconds' });
    const body = (await api.app.inject({ method: 'GET', url: '/internal/worker-health' })).json() as WorkerHealthResponse;
    expect(statesOf(body)['w-stale']).toBe('healthy');
  });
});
