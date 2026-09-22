import { fileURLToPath } from 'node:url';

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
    globalSetup: [
      // Restores a failing exit code that embedded-postgres's exit hook would reset to 0.
      'tests/integration/exit-code-guard.ts',
      fileURLToPath(new URL('../../packages/db/test/global-setup.ts', import.meta.url)),
    ],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
