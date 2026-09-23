import { createRequire } from 'node:module';

import { defineConfig } from 'vitest/config';

// Integration tests on a real PostgreSQL 17 through the @wringy/db harness
// (kickoff-package.md §6.1-§6.3). Its global setup uses TEST_DATABASE_URL's
// cluster or starts a throwaway embedded one, bootstraps the roles and migrates
// a template from zero as the migrator; each test file clones the template and
// talks to it as wringy_api_login. The database is never mocked.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.int.test.ts'],
    // The harness's global setup, resolved through @wringy/db's `./testing/global-setup` export; it also
    // keeps a failing run's exit code (packages/db/test/exit-code-guard.ts).
    globalSetup: [createRequire(import.meta.url).resolve('@wringy/db/testing/global-setup')],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
