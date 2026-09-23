import { defineConfig } from 'vitest/config';

// Integration tests on a real PostgreSQL 17 (kickoff-package.md §6.2-§6.3):
// TEST_DATABASE_URL when set (CI's postgres:17 service), otherwise a throwaway
// embedded cluster that the global setup starts, migrates and removes.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.int.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
