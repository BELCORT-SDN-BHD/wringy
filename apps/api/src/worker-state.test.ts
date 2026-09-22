import { describe, expect, it } from 'vitest';

import { computeWorkerState, WORKER_BEAT_INTERVAL_SECONDS, WORKER_STALE_AFTER_SECONDS } from './worker-state';

const dbNow = new Date('2026-09-23T04:00:00.000Z');
const secondsBefore = (seconds: number) => new Date(dbNow.getTime() - seconds * 1000);

describe('M2-AC01 computeWorkerState (judged on the database clock passed in)', () => {
  it('is healthy while the last beat is at most the stale threshold old', () => {
    expect(computeWorkerState({ lastBeatAt: dbNow, stoppedAt: null }, dbNow)).toBe('healthy');
    expect(computeWorkerState({ lastBeatAt: secondsBefore(WORKER_BEAT_INTERVAL_SECONDS), stoppedAt: null }, dbNow)).toBe(
      'healthy',
    );
    expect(computeWorkerState({ lastBeatAt: secondsBefore(WORKER_STALE_AFTER_SECONDS), stoppedAt: null }, dbNow)).toBe(
      'healthy',
    );
  });

  it('is stale one millisecond past the threshold', () => {
    const lastBeatAt = new Date(secondsBefore(WORKER_STALE_AFTER_SECONDS).getTime() - 1);
    expect(computeWorkerState({ lastBeatAt, stoppedAt: null }, dbNow)).toBe('stale');
  });

  it('is stopped when a graceful stop was recorded at or after the last beat, however old', () => {
    const lastBeatAt = secondsBefore(600);
    expect(computeWorkerState({ lastBeatAt, stoppedAt: lastBeatAt }, dbNow)).toBe('stopped');
    expect(computeWorkerState({ lastBeatAt, stoppedAt: secondsBefore(599) }, dbNow)).toBe('stopped');
  });

  it('ignores a stop recorded before the latest beat (the worker restarted)', () => {
    expect(computeWorkerState({ lastBeatAt: secondsBefore(5), stoppedAt: secondsBefore(60) }, dbNow)).toBe('healthy');
    expect(computeWorkerState({ lastBeatAt: secondsBefore(90), stoppedAt: secondsBefore(120) }, dbNow)).toBe('stale');
  });

  it('is never_seen without a beat', () => {
    expect(computeWorkerState({ lastBeatAt: null, stoppedAt: null }, dbNow)).toBe('never_seen');
  });

  it('keeps the threshold at three missed beats', () => {
    expect(WORKER_STALE_AFTER_SECONDS).toBe(3 * WORKER_BEAT_INTERVAL_SECONDS);
  });
});
