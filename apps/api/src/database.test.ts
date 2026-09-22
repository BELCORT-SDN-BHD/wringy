import { describe, expect, it } from 'vitest';

import {
  API_APPLICATION_NAME,
  API_QUERY_TIMEOUT_MS,
  DatabaseUnavailableError,
  createApiPool,
  isDatabaseUnavailable,
} from './database';

const withCode = (code: string, message = 'x') => Object.assign(new Error(message), { code });

describe('M2-AC01 isDatabaseUnavailable: 503 versus 500', () => {
  it.each([
    ['connection refused', withCode('ECONNREFUSED')],
    ['host not found', withCode('ENOTFOUND')],
    ['SQLSTATE class 08', withCode('08006')],
    ['admin shutdown', withCode('57P01')],
    ['starting up', withCode('57P03')],
    ['too many connections', withCode('53300')],
    ['login refused', withCode('28P01')],
    ['database missing', withCode('3D000')],
    ['pool connect timeout', new Error('timeout exceeded when trying to connect')],
    ['connection lost mid-query', new Error('Connection terminated unexpectedly')],
    ['pool already ended', new Error('Cannot use a pool after calling end on the pool')],
    ['query timed out (query_timeout)', new Error('Query read timeout')],
    ['dual-stack refusal', new AggregateError([withCode('ECONNREFUSED'), withCode('ECONNREFUSED')], 'connect')],
    ['already classified', new DatabaseUnavailableError(new Error('x'))],
  ])('%s is unavailable', (_name, error) => {
    expect(isDatabaseUnavailable(error)).toBe(true);
  });

  it.each([
    ['permission denied', withCode('42501')],
    ['undefined table', withCode('42P01')],
    ['syntax error', withCode('42601')],
    ['a plain bug', new TypeError('cannot read properties of undefined')],
    ['not an error', 'boom'],
  ])('%s is not', (_name, error) => {
    expect(isDatabaseUnavailable(error)).toBe(false);
  });
});

describe('M2-AC01 createApiPool: a hung database cannot stall /health', () => {
  it('sets pg query_timeout to the 5 s operational limit on the runtime pool', async () => {
    // No connection is made: the pool is created and ended without a checkout.
    const pool = createApiPool('postgres://wringy_api_login:placeholder@127.0.0.1:1/wringy', () => {});
    try {
      expect(API_QUERY_TIMEOUT_MS).toBe(5_000);
      expect(pool.options.query_timeout).toBe(API_QUERY_TIMEOUT_MS);
      expect(pool.options.application_name).toBe(API_APPLICATION_NAME);
    } finally {
      await pool.end();
    }
  });
});
