import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { webEnvSchema } from './index';

/**
 * The repository-root `.env.example` is the one place a developer or an operator
 * reads to learn which variables exist (kickoff-package.md §8.5). This mirrors
 * `apps/api/src/config.test.ts` for the web server, whose variables live in that
 * root file rather than in an app-local example: the web section must name
 * exactly `webEnvSchema`'s keys minus `WRINGY_ENV`, which is in the shared
 * section because every process reads it, and it must carry no value.
 */
const example = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
const lines = example.split(/\r?\n/);

/** `NAME=value` assignments between the `# --- <name> ---` header of `section` and the next header. */
function sectionAssignments(section: string): Array<[string, string]> {
  const header = lines.findIndex((line) => new RegExp(`^# --- ${section}\\b`).test(line));
  expect(header, `the "${section}" section header is missing from .env.example`).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(header + 1);
  const next = rest.findIndex((line) => /^# --- /.test(line));
  return rest
    .slice(0, next === -1 ? undefined : next)
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.split('=', 2) as [string, string]);
}

describe('M2-AC01/2 root .env.example', () => {
  it('M2-AC01/2 the web section names exactly the variables the web server reads, minus the shared WRINGY_ENV, and no value', () => {
    const assignments = sectionAssignments('web');
    const expected = Object.keys(webEnvSchema.shape).filter((name) => name !== 'WRINGY_ENV');
    expect(assignments.map(([name]) => name).sort()).toEqual([...expected].sort());
    for (const [name, value] of assignments) expect(value, name).toBe('');
  });

  it('M2-AC01/2 WRINGY_ENV is declared once, in the shared section', () => {
    expect(sectionAssignments('Shared by every process').map(([name]) => name)).toEqual(['WRINGY_ENV']);
    expect(lines.filter((line) => line.startsWith('WRINGY_ENV='))).toHaveLength(1);
  });

  it('M2-AC01/2 no line in the file carries a value', () => {
    for (const line of lines.filter((candidate) => /^[A-Z][A-Z0-9_]*=/.test(candidate))) {
      expect(line, line.split('=', 1)[0]).toMatch(/^[A-Z][A-Z0-9_]*=$/);
    }
  });
});
