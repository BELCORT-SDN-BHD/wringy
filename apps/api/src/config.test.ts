import { readFileSync } from 'node:fs';

import { apiEnvSchema, EnvError, loadApiEnv } from '@wringy/config';
import { describe, expect, it } from 'vitest';

const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const assignments = example
  .split(/\r?\n/)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => line.split('=', 2) as [string, string]);

describe('api configuration', () => {
  it('.env.example names exactly the variables the API reads, and no value', () => {
    expect(assignments.map(([name]) => name).sort()).toEqual(Object.keys(apiEnvSchema.shape).sort());
    for (const [name, value] of assignments) expect(value, name).toBe('');
  });

  it('fails fast on a missing DATABASE_URL and never echoes a value', () => {
    const secret = 'hunter2-DO-NOT-LEAK';
    let caught: unknown;
    try {
      loadApiEnv({ WRINGY_ENV: 'local', HOST: `h-${secret}`, LOG_LEVEL: `loud-${secret}` });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EnvError);
    expect((caught as EnvError).message).toContain('DATABASE_URL is missing');
    expect((caught as EnvError).message).not.toContain(secret);
  });

  it('defaults to 127.0.0.1:3200 at level info', () => {
    const env = loadApiEnv({ WRINGY_ENV: 'local', DATABASE_URL: 'postgres://u:p@127.0.0.1:54329/wringy' });
    expect({ host: env.HOST, port: env.PORT, level: env.LOG_LEVEL }).toEqual({ host: '127.0.0.1', port: 3200, level: 'info' });
  });
});
