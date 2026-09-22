import { defineConfig, devices } from '@playwright/test';

/**
 * The M2 internal-build suite (M2-AC01; kickoff-package.md §6.1, §8.8):
 * `pnpm e2e:internal` from the repository root.
 *
 * Nothing is mocked. The `webServer` array starts, IN ORDER (each entry is up
 * before the next starts, and all of them before globalSetup):
 *
 * 1. database: a PostgreSQL 17 cluster (TEST_DATABASE_URL's, or a throwaway
 *    embedded one), a database migrated from zero as the migrator, marked
 *    `ci` and seeded with the fixture campaigns, through @wringy/db's test
 *    harness (tests/e2e-internal/database-server.mts). Its ready line names
 *    the host, port and database, which Playwright stores in the environment
 *    (`wait.stdout` named groups) for the entries below and the tests.
 * 2. api: apps/api on 127.0.0.1:3200 as wringy_api_login, ready once
 *    GET /health answers 200 (database, migration head and pg-boss schema ok).
 * 3. worker: apps/worker as wringy_worker_login, WORKER_ID e2e-worker-1,
 *    ready once it logs "worker started" (first beat written, queue scheduled).
 * 4. web: `next build` then `next start` on WEB_PORT (default 3100) with
 *    API_INTERNAL_URL pointing at the api.
 * 5. web-outage: a second `next start` of the same build on WEB_PORT+1 whose
 *    API_INTERNAL_URL points at a closed port, for the "API unreachable" state.
 *
 * reuseExistingServer is false everywhere: the suite never tests against a
 * server it did not start. Evidence frames go to docs/m2-internal/screenshots
 * only with WRINGY_EVIDENCE_SHOTS=1 (tests/e2e/evidence.ts).
 */
const WEB_PORT = Number(process.env.WEB_PORT ?? 3100);
const OUTAGE_PORT = WEB_PORT + 1;
const API_PORT = 3200;
/** Nothing listens here: the outage instance's API address. */
const CLOSED_API_URL = 'http://127.0.0.1:3299';

const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;
const OUTAGE_URL = `http://127.0.0.1:${OUTAGE_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;

const SUITE_ENV = { WRINGY_ENV: 'ci', NEXT_TELEMETRY_DISABLED: '1' };

/** The database entry's ready line (tests/e2e-internal/database-server.mts). */
const DATABASE_READY =
  'wringy-e2e-database ready host=(?<wringy_e2e_pg_host>\\S+) port=(?<wringy_e2e_pg_port>\\d+) ' +
  'database=(?<wringy_e2e_pg_database>\\w+) control=(?<wringy_e2e_db_control>\\S+)';

export default defineConfig({
  testDir: 'tests/e2e-internal',
  outputDir: 'tests/e2e-internal/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { outputFolder: 'playwright-report-internal' }], ['list']] : 'list',
  globalSetup: './tests/e2e-internal/global-setup.ts',
  globalTeardown: './tests/e2e-internal/global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      testMatch: /internal\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop',
      testMatch: /internal\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'small',
      testMatch: /internal\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 } },
    },
    {
      // The second web instance, whose API address is closed.
      name: 'outage',
      // Anchored at a path separator, so database-outage.spec.ts does not match.
      testMatch: /[\\/]outage\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: OUTAGE_URL, viewport: { width: 1440, height: 900 } },
    },
    {
      // Takes the API's database access away and gives it back, so it runs
      // only after every project that reads through the API has finished.
      name: 'database-outage',
      testMatch: /database-outage\.spec\.ts/,
      dependencies: ['mobile', 'desktop', 'small', 'outage'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      name: 'database',
      command: 'pnpm exec tsx tests/e2e-internal/database-server.mts',
      // Named groups become WRINGY_E2E_PG_HOST, _PG_PORT, _PG_DATABASE and _DB_CONTROL in process.env.
      // Built from a string: the web tsconfig targets ES2017, which has no named-group literals.
      wait: { stdout: new RegExp(DATABASE_READY) },
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      name: 'api',
      command: 'pnpm exec tsx tests/e2e-internal/run-with-database.mts api',
      url: `${API_URL}/health`,
      env: { ...SUITE_ENV, HOST: '127.0.0.1', PORT: String(API_PORT), LOG_LEVEL: 'info' },
      timeout: 90_000,
      reuseExistingServer: false,
    },
    {
      name: 'worker',
      command: 'pnpm exec tsx tests/e2e-internal/run-with-database.mts worker',
      wait: { stdout: /"msg":"worker started"/ },
      env: { ...SUITE_ENV, WORKER_ID: 'e2e-worker-1', IMAGE_REF: 'local/e2e', LOG_LEVEL: 'info' },
      timeout: 90_000,
      reuseExistingServer: false,
    },
    {
      name: 'web',
      command: `pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${WEB_PORT}`,
      url: `${BASE_URL}/internal`,
      env: { ...SUITE_ENV, API_INTERNAL_URL: API_URL },
      timeout: 360_000,
      reuseExistingServer: false,
    },
    {
      name: 'web-outage',
      command: `pnpm exec next start --hostname 127.0.0.1 --port ${OUTAGE_PORT}`,
      url: `${OUTAGE_URL}/internal`,
      env: { ...SUITE_ENV, API_INTERNAL_URL: CLOSED_API_URL },
      timeout: 90_000,
      reuseExistingServer: false,
    },
  ],
});
