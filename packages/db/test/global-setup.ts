/**
 * Vitest global setup for `pnpm test:int` (kickoff-package.md §6.2–§6.3),
 * exported as `@wringy/db/testing/global-setup` so apps/api and apps/worker
 * run the same one.
 *
 * startTestCluster() (cluster.ts) does the work:
 * 1. Cluster: TEST_DATABASE_URL (an admin URL, e.g. CI's postgres:17 service)
 *    when set; otherwise a throwaway embedded PostgreSQL 17 on a free port in a
 *    temporary directory, TimeZone=UTC, removed at teardown.
 * 2. Roles: the same idempotent bootstrap `pnpm db:bootstrap` runs.
 * 3. Template: an empty database owned by the migrator, migrated from zero as
 *    the migrator by `pnpm db:migrate`'s own code (the pg-boss CLI, then the
 *    real versioned migrations; never a hand-kept dump), then marked as
 *    environment TEST_WRINGY_ENV the way `pnpm db:env` marks it.
 * The cluster is provided to the test files, which clone the template with
 * `createTestDatabase()` (harness.ts). Teardown drops this run's databases and
 * stops an embedded cluster.
 */
import type { TestProject } from 'vitest/node';

import { startTestCluster } from './cluster';
import { installExitCodeGuard } from './exit-code-guard';
// The ProvidedContext augmentation for `wringyCluster` lives in harness.ts.
import type {} from './harness';

// embedded-postgres (imported by cluster.ts) would turn a failed run into exit 0; see exit-code-guard.ts.
installExitCodeGuard();

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const running = await startTestCluster();
  project.provide('wringyCluster', running.info);
  return () => running.stop();
}
