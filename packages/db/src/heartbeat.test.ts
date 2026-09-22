import { describe, expect, it } from 'vitest';

import { HEARTBEAT_INTERVAL_MS, QUEUE_OVERDUE_AFTER_MS, STALE_AFTER_MS } from './heartbeat';

describe('M2-AC01 heartbeat protocol constants (operational, shared by api and worker)', () => {
  it('beats every 15 s and calls a worker stale after three missed beats', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(15_000);
    expect(STALE_AFTER_MS).toBe(3 * HEARTBEAT_INTERVAL_MS);
  });

  it('calls the queue round trip overdue after three missed one-minute schedules', () => {
    expect(QUEUE_OVERDUE_AFTER_MS).toBe(3 * 60_000);
  });
});
