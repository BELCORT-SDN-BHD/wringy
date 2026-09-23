import { createRequire } from 'node:module';

import { defineConfig } from 'vitest/config';

// Worker integration tests on a real PostgreSQL 17 through the @wringy/db
// harness (kickoff-package.md §6.1-§6.3). The harness's global setup starts the
// cluster (TEST_DATABASE_URL when set, otherwise a throwaway embedded one),
// bootstraps the roles and migrates a template from zero as the migrator
// (pg-boss schema, then every SQL migration). Each test file clones the
// template: the worker commits rows over its own connections, so a rollback
// cannot isolate it (§6.3).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.int.test.ts'],
    globalSetup: [createRequire(import.meta.url).resolve('@wringy/db/testing/global-setup')],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
