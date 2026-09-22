import { describe, expect, it } from 'vitest';

import { DatabaseUnavailableError, isDatabaseUnavailable } from './database';

const withCode = (code: string, message = 'x') => Object.assign(new Error(message), { code });

describe('isDatabaseUnavailable: 503 versus 500', () => {
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
