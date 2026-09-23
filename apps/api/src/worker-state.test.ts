import { HEARTBEAT_INTERVAL_MS, QUEUE_OVERDUE_AFTER_MS, STALE_AFTER_MS } from '@wringy/db';
import { describe, expect, it } from 'vitest';

import { computeQueueState, computeWorkerState } from './worker-state';

const dbNow = new Date('2026-09-23T04:00:00.000Z');
const msBefore = (ms: number) => new Date(dbNow.getTime() - ms);
const secondsBefore = (seconds: number) => msBefore(seconds * 1000);

describe('M2-AC01 computeWorkerState (process liveness, judged on the database clock passed in)', () => {
  it('M2-AC01 is healthy while the last beat is at most the stale threshold old', () => {
    expect(computeWorkerState({ lastBeatAt: dbNow, stoppedAt: null }, dbNow)).toBe('healthy');
    expect(computeWorkerState({ lastBeatAt: msBefore(HEARTBEAT_INTERVAL_MS), stoppedAt: null }, dbNow)).toBe('healthy');
    expect(computeWorkerState({ lastBeatAt: msBefore(STALE_AFTER_MS), stoppedAt: null }, dbNow)).toBe('healthy');
  });

  it('M2-AC01 is stale one millisecond past the threshold', () => {
    expect(computeWorkerState({ lastBeatAt: msBefore(STALE_AFTER_MS + 1), stoppedAt: null }, dbNow)).toBe('stale');
  });

  it('M2-AC01 is stopped when a graceful stop was recorded at or after the last beat, however old', () => {
    const lastBeatAt = secondsBefore(600);
    expect(computeWorkerState({ lastBeatAt, stoppedAt: lastBeatAt }, dbNow)).toBe('stopped');
    expect(computeWorkerState({ lastBeatAt, stoppedAt: secondsBefore(599) }, dbNow)).toBe('stopped');
  });

  it('M2-AC01 ignores a stop recorded before the latest beat (the worker restarted)', () => {
    expect(computeWorkerState({ lastBeatAt: secondsBefore(5), stoppedAt: secondsBefore(60) }, dbNow)).toBe('healthy');
    expect(computeWorkerState({ lastBeatAt: secondsBefore(90), stoppedAt: secondsBefore(120) }, dbNow)).toBe('stale');
  });

  it('M2-AC01 is never_seen without a beat', () => {
    expect(computeWorkerState({ lastBeatAt: null, stoppedAt: null }, dbNow)).toBe('never_seen');
  });

  it('M2-AC01 uses the shared operational threshold of three missed beats', () => {
    expect(STALE_AFTER_MS).toBe(3 * HEARTBEAT_INTERVAL_MS);
  });
});

describe('M2-AC01 computeQueueState (queue-path liveness, judged on the database clock passed in)', () => {
  it('M2-AC01 is never before the first round trip', () => {
    expect(computeQueueState(null, dbNow)).toBe('never');
  });

  it('M2-AC01 is ok while the last round trip is at most the overdue threshold old', () => {
    expect(computeQueueState(dbNow, dbNow)).toBe('ok');
    expect(computeQueueState(secondsBefore(61), dbNow)).toBe('ok');
    expect(computeQueueState(msBefore(QUEUE_OVERDUE_AFTER_MS), dbNow)).toBe('ok');
  });

  it('M2-AC01 is overdue one millisecond past the threshold', () => {
    expect(computeQueueState(msBefore(QUEUE_OVERDUE_AFTER_MS + 1), dbNow)).toBe('overdue');
    expect(computeQueueState(secondsBefore(3600), dbNow)).toBe('overdue');
  });
});
