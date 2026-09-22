import { describe, expect, it, vi } from 'vitest';

import type { Pool } from '@wringy/db';

import { createLogger } from './logger';
import { backoffDelayMs, isTransientConnectionError, waitForDatabase } from './wait-for-database';

const silent = createLogger({ level: 'silent', destination: { write: () => {} } });

const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:54329'), { code: 'ECONNREFUSED' });
const badPassword = Object.assign(new Error('password authentication failed for user "wringy_worker_login"'), {
  code: '28P01',
});

function poolFailing(failures: unknown[]): { pool: Pool; calls: () => number } {
  let calls = 0;
  const pool = {
    query: vi.fn(async () => {
      const failure = failures[calls];
      calls += 1;
      if (failure !== undefined) throw failure;
      return { rows: [{ '?column?': 1 }] };
    }),
  } as unknown as Pool;
  return { pool, calls: () => calls };
}

describe('waiting for the database', () => {
  it('backs off from 0.5 s, doubling, capped at 8 s', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffDelayMs)).toEqual([500, 1000, 2000, 4000, 8000, 8000, 8000]);
  });

  it('retries only connection-level failures', () => {
    expect(isTransientConnectionError(refused)).toBe(true);
    expect(isTransientConnectionError({ code: '57P03' })).toBe(true);
    expect(isTransientConnectionError(new Error('timeout exceeded when trying to connect'))).toBe(true);
    expect(isTransientConnectionError(badPassword)).toBe(false);
    expect(isTransientConnectionError({ code: '42501' })).toBe(false);
    expect(isTransientConnectionError('ECONNREFUSED')).toBe(false);
  });

  it('retries until the database answers', async () => {
    const sleeps: number[] = [];
    const { pool, calls } = poolFailing([refused, refused]);
    await waitForDatabase(pool, { logger: silent, sleep: async (ms) => void sleeps.push(ms) });
    expect(calls()).toBe(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('fails at once on a refused login, and after the last attempt when unreachable', async () => {
    const wrongLogin = poolFailing([badPassword]);
    await expect(waitForDatabase(wrongLogin.pool, { logger: silent, sleep: async () => {} })).rejects.toBe(badPassword);
    expect(wrongLogin.calls()).toBe(1);

    const down = poolFailing([refused, refused, refused]);
    await expect(waitForDatabase(down.pool, { logger: silent, attempts: 3, sleep: async () => {} })).rejects.toBe(refused);
    expect(down.calls()).toBe(3);
  });
});
