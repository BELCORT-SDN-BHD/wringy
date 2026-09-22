import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { EXPECTED_MIGRATION_HEAD, EXPECTED_PGBOSS_VERSION } from './expected-head';
import { listMigrations } from './migrate';
import { installedPgBoss } from './pgboss';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>;
};

describe('expected heads (drift guards for GET /health)', () => {
  it('EXPECTED_MIGRATION_HEAD is the newest migration file', () => {
    expect(EXPECTED_MIGRATION_HEAD).toBe(listMigrations().at(-1));
  });

  it('EXPECTED_PGBOSS_VERSION is the schema version of the installed pg-boss', () => {
    expect(EXPECTED_PGBOSS_VERSION).toBe(installedPgBoss().schemaVersion);
  });

  it('the installed pg-boss is the exact version package.json pins', () => {
    const pinned = manifest.dependencies['pg-boss'];
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    expect(installedPgBoss().version).toBe(pinned);
  });
});
