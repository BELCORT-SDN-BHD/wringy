import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MIGRATIONS_DIR, listMigrations } from './migrate';

const files = readdirSync(MIGRATIONS_DIR);

/** The statements of the Up section, without `--` comments. */
function upSection(file: string): string {
  const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  const start = sql.search(/^-- Up Migration$/m);
  const end = sql.search(/^-- Down Migration$/m);
  return sql.slice(start, end === -1 ? undefined : end).replace(/--.*$/gm, '');
}

describe('migration files (kickoff-package.md §4.10)', () => {
  it('are SQL files only, named NNNN_snake_case.sql and numbered from 0001 without gaps', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
    expect(listMigrations().map((id) => Number(id.slice(0, 4)))).toEqual(files.map((_, index) => index + 1));
  });

  it.each(files)('%s has an Up section, and any Down section comes after it', (file) => {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const up = sql.search(/^-- Up Migration$/m);
    const down = sql.search(/^-- Down Migration$/m);
    expect(up).toBeGreaterThanOrEqual(0);
    expect(down === -1 || down > up).toBe(true);
  });

  it.each(files)('%s creates nothing in public and grants nothing to PUBLIC or the Supabase API roles', (file) => {
    const sql = upSection(file);
    expect(sql).not.toMatch(/\bpublic\s*\./i);
    expect(sql).not.toMatch(/\bTO\s+PUBLIC\b/i);
    expect(sql).not.toMatch(/\b(anon|authenticated|service_role)\b/i);
  });

  it.each(files)('%s never creates a login role or carries a password', (file) => {
    const sql = upSection(file);
    // `\bLOGIN\b` does not match inside NOLOGIN.
    expect(sql).not.toMatch(/\bLOGIN\b/i);
    expect(sql).not.toMatch(/\bPASSWORD\b/i);
  });
});
