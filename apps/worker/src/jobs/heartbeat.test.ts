import { describe, expect, it } from 'vitest';

import { HEARTBEAT_INTERVAL_MS, STALE_AFTER_MS } from '@wringy/db';

import { HEARTBEAT_CRON, HEARTBEAT_QUEUE, beatStatement, roundTripStatement, stoppedStatement } from './heartbeat';

const identity = { workerId: 'worker-local-1', imageRef: 'ghcr.io/belcort-sdn-bhd/wringy-worker:0123abc' };

describe('M2-AC01 heartbeat statements', () => {
  it('M2-AC01 upserts the process beat with the database clock and only id and image as parameters', () => {
    const { text, values } = beatStatement(identity, { first: false });
    expect(values).toEqual([identity.workerId, identity.imageRef]);
    expect(text).toContain('INSERT INTO ops.worker_heartbeat');
    expect(text).toContain('VALUES ($1, now(), now(), $2, NULL)');
    expect(text).toContain('ON CONFLICT (worker_id) DO UPDATE SET last_beat_at = now()');
    expect(text).toContain('stopped_at = NULL');
    // A later beat keeps the started_at of this process's first beat.
    expect(text).not.toMatch(/SET[^;]*started_at/);
  });

  it('M2-AC01 resets started_at on the first beat of a process, so a restart shows the new start', () => {
    const { text, values } = beatStatement(identity, { first: true });
    expect(values).toEqual([identity.workerId, identity.imageRef]);
    expect(text).toContain('DO UPDATE SET started_at = now(), last_beat_at = now()');
  });

  it('M2-AC01 never passes a process timestamp to the database', () => {
    for (const statement of [
      beatStatement(identity, { first: true }),
      beatStatement(identity, { first: false }),
      roundTripStatement(identity.workerId),
      stoppedStatement(identity.workerId),
    ]) {
      // The only parameters are the worker's id and image; every time is written as now() in SQL.
      for (const value of statement.values) {
        expect([identity.workerId, identity.imageRef]).toContain(value);
      }
      expect(statement.text).toMatch(/now\(\)/);
    }
  });

  it('M2-AC01 stamps the round trip and the stop on this worker row only, with now()', () => {
    expect(roundTripStatement('w1')).toEqual({
      text:
        'UPDATE ops.worker_heartbeat SET last_queue_round_trip_at = now() ' +
        'WHERE worker_id = $1 RETURNING last_queue_round_trip_at',
      values: ['w1'],
    });
    expect(stoppedStatement('w1')).toEqual({
      text: 'UPDATE ops.worker_heartbeat SET stopped_at = now() WHERE worker_id = $1 RETURNING stopped_at',
      values: ['w1'],
    });
  });

  it('M2-AC01 beats on the shared cadence, three times inside the API staleness window', () => {
    expect(HEARTBEAT_INTERVAL_MS * 3).toBe(STALE_AFTER_MS);
    expect(HEARTBEAT_QUEUE).toBe('system.heartbeat');
    expect(HEARTBEAT_CRON).toBe('* * * * *');
  });
});
