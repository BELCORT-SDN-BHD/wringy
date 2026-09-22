import { readFileSync } from 'node:fs';

import { workerEnvSchema } from '@wringy/config/worker';
import { describe, expect, it } from 'vitest';

// apps/worker/.env.example is this process's own names-only example (the API
// keeps its own; both read a DATABASE_URL with a different login). This keeps
// it in step with the schema the worker validates at startup.
const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const assignments = example
  .split(/\r?\n/)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => line.split('=', 2) as [string, string]);

describe('M2-AC01 worker configuration', () => {
  it('.env.example names exactly the variables the worker reads, and no value', () => {
    expect(assignments.map(([name]) => name).sort()).toEqual(Object.keys(workerEnvSchema.shape).sort());
    for (const [name, value] of assignments) expect(value, name).toBe('');
  });
});
