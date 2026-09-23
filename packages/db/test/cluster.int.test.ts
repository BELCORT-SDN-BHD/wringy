import { describe, expect, it } from 'vitest';

import { bootstrapTestRoles, withClientAt } from './cluster';
import { cluster } from './harness';

/**
 * CI points every integration suite at one postgres:17 service
 * (TEST_DATABASE_URL, .github/workflows/app.yml `integration`), and
 * `pnpm test:int` runs the apps/api and apps/worker suites at the same time, so
 * their global setups bootstrap the same cluster-wide roles concurrently.
 */
describe('M2-AC01 test harness on a shared cluster', () => {
  it('M2-AC01/3 concurrent test runs bootstrap the login roles without a catalog conflict', async () => {
    const info = cluster();
    await Promise.all(Array.from({ length: 6 }, () => bootstrapTestRoles(info)));

    const { rows } = await withClientAt(info.adminUrl, (admin) =>
      admin.query<{ rolname: string }>(
        `SELECT rolname FROM pg_catalog.pg_roles
          WHERE rolname IN ('wringy_migrator', 'wringy_api', 'wringy_worker', 'wringy_api_login', 'wringy_worker_login')
          ORDER BY rolname`,
      ),
    );
    expect(rows.map((row) => row.rolname)).toEqual([
      'wringy_api',
      'wringy_api_login',
      'wringy_migrator',
      'wringy_worker',
      'wringy_worker_login',
    ]);
  });
});
