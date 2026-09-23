import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isPgBossSchemaRefusal } from './connections';

const require = createRequire(import.meta.url);

describe('M2-AC01 pg-boss schema refusal', () => {
  it('matches the errors the installed pg-boss throws from start() with migrate: false', () => {
    // Drift guard: a pg-boss bump that rewords these messages fails here, not in production.
    const contractor = readFileSync(
      path.join(path.dirname(require.resolve('pg-boss/package.json')), 'dist', 'contractor.js'),
      'utf8',
    );
    expect(contractor).toContain("throw new Error('pg-boss is not installed')");
    expect(contractor).toContain("throw new Error('pg-boss database requires migrations')");

    expect(isPgBossSchemaRefusal(new Error('pg-boss is not installed'))).toBe(true);
    expect(isPgBossSchemaRefusal(new Error('pg-boss database requires migrations'))).toBe(true);
    expect(isPgBossSchemaRefusal(new Error('connect ECONNREFUSED'))).toBe(false);
    expect(isPgBossSchemaRefusal('pg-boss is not installed')).toBe(false);
  });

  it('M2-AC01/2 runs the pinned pg-boss', () => {
    const manifest = JSON.parse(readFileSync(require.resolve('pg-boss/package.json'), 'utf8')) as { version: string };
    const own = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(own.dependencies['pg-boss']).toBe('12.33.5');
    expect(manifest.version).toBe('12.33.5');
  });
});
