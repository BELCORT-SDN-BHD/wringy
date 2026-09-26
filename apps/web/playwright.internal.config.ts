import { defineConfig, devices } from '@playwright/test';

/**
 * The M2 internal-build suite (M2-AC01, M2-AC02; kickoff-package.md §6.1, §8.8):
 * `pnpm e2e:internal` from the repository root.
 *
 * Nothing is mocked except the identity provider, and that one is simulated
 * rather than stubbed: a local server speaking the GoTrue subset the vendor
 * client actually calls, signing ES256 tokens against its own JWKS (M2-02 R15).
 * Every row driven through it is labelled **simulated** in the evidence record
 * and cannot close M2-02 on its own; the `Real` rows of §4.9 stay human steps,
 * because no verified way exists to drive a real Google consent screen from
 * Playwright.
 *
 * The `webServer` array starts, IN ORDER (each entry is up before the next
 * starts, and all of them before globalSetup):
 *
 * 1. fake-auth: the simulated Supabase Auth server on an ephemeral loopback
 *    port (tests/e2e-internal/fake-auth/start.mts). Its ready line names the
 *    project URL, the publishable key and the control address, which Playwright
 *    stores in the environment (`wait.stdout` named groups, uppercased) for the
 *    entries below and the test workers — so SUPABASE_URL and
 *    SUPABASE_PUBLISHABLE_KEY are INHERITED by every later entry and are
 *    deliberately not repeated in their `env`: this config file is evaluated
 *    before any server runs, so it cannot read them itself.
 * 2. database: a PostgreSQL 17 cluster (TEST_DATABASE_URL's, or a throwaway
 *    embedded one), a database migrated from zero as the migrator, marked
 *    `ci`, seeded with the fixture campaigns and with the allow-listed testers
 *    on `app.sign_in_allowlist`, through @wringy/db's test harness
 *    (tests/e2e-internal/database-server.mts). Its ready line names the host,
 *    port and database the same way.
 * 3. api: apps/api on 127.0.0.1:3200 as wringy_api_login, with
 *    SESSION_LIVENESS=auth_server (M2-02 R2: the app database here is the
 *    embedded cluster, not the Supabase project's, so only the auth-server
 *    adapter can answer "is this session live?"). Ready once GET /health
 *    answers 200.
 * 4. worker: apps/worker as wringy_worker_login, WORKER_ID e2e-worker-1,
 *    ready once it logs "worker started" (first beat written, queue scheduled).
 * 5. web: `next build` then `next start` on WEB_PORT (default 3100) in
 *    WRINGY_APP_MODE=internal with APP_ORIGIN pointing at itself.
 * 6. web-outage: a second `next start` of the same build on WEB_PORT+1 whose
 *    API_INTERNAL_URL points at a closed port, for the "API unreachable" state.
 *    Its own APP_ORIGIN names its own port; session cookies are host-scoped,
 *    not port-scoped, so a context signed in against the healthy instance is
 *    signed in here too (tests/e2e-internal/fixtures.ts).
 *
 * Readiness is probed on `/internal/sign-in`, not `/internal`: signed out,
 * `proxy.ts` answers 307 there (which Playwright would also accept), while the
 * sign-in page is the one public page of the internal build.
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
/** What both `next start` instances need beyond SUITE_ENV; the Supabase values are inherited (see above). */
const WEB_ENV = { ...SUITE_ENV, WRINGY_APP_MODE: 'internal' };

/** The fake-auth entry's ready line (tests/e2e-internal/fake-auth/start.mts). */
const AUTH_READY =
  'wringy-e2e-fake-auth ready supabase_url=(?<SUPABASE_URL>\\S+) ' +
  'publishable_key=(?<SUPABASE_PUBLISHABLE_KEY>\\S+) control=(?<WRINGY_E2E_AUTH_CONTROL>\\S+)';

/** The database entry's ready line (tests/e2e-internal/database-server.mts). */
const DATABASE_READY =
  'wringy-e2e-database ready host=(?<wringy_e2e_pg_host>\\S+) port=(?<wringy_e2e_pg_port>\\d+) ' +
  'database=(?<wringy_e2e_pg_database>\\w+) control=(?<wringy_e2e_db_control>\\S+)';

/** Every project that reads through the API, and therefore must finish before the outage projects run. */
const READING_PROJECTS = ['mobile', 'desktop', 'small', 'outage'];

export default defineConfig({
  testDir: 'tests/e2e-internal',
  outputDir: 'tests/e2e-internal/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A test that fails and then passes on its retry fails the required `e2e` job instead of
  // turning it green: the retry keeps its trace for diagnosis, not to hide timing flakes.
  failOnFlakyTests: !!process.env.CI,
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
      // M2-AC02. Three of its rows change state that is shared by construction —
      // Alice's profile row, and every live session of hers — because a Supabase
      // subject is a fixed uuid and `app.profiles.id` is that uuid. So this
      // project runs its file in order in one worker (`fullyParallel: false`)
      // and only after every project that signs Alice in has finished. A failure
      // still does not skip the rows after it, which `test.describe.serial`
      // would.
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      fullyParallel: false,
      dependencies: READING_PROJECTS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // M2-AC03 (docs/m2-internal/m2-03-code-review.md R13). Its rows create
      // organisations, invite and remove people, so they run in order in one
      // worker (`fullyParallel: false`); every row arranges its own orgs under a
      // unique name. It signs in only Carol, Dave, Erin and Mallory, identities
      // the `auth` project never touches, so it runs BESIDE `auth` rather than
      // after it. The 390 and 320 rows re-run through `test.use({ viewport })`,
      // which `openDevice` honours for the second person's browser too.
      name: 'orgs',
      testMatch: /orgs\.spec\.ts$/,
      fullyParallel: false,
      dependencies: READING_PROJECTS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Takes the API's database access away and gives it back, so it runs
      // only after every project that reads through the API has finished.
      name: 'database-outage',
      testMatch: /database-outage\.spec\.ts/,
      dependencies: [...READING_PROJECTS, 'auth', 'orgs'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      name: 'fake-auth',
      command: 'pnpm exec tsx tests/e2e-internal/fake-auth/start.mts',
      // Named groups become SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and
      // WRINGY_E2E_AUTH_CONTROL in process.env, which every later entry and
      // every test worker inherits. Built from a string: the web tsconfig
      // targets ES2017, which has no named-group literals.
      wait: { stdout: new RegExp(AUTH_READY) },
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      name: 'database',
      command: 'pnpm exec tsx tests/e2e-internal/database-server.mts',
      // Named groups become WRINGY_E2E_PG_HOST, _PG_PORT, _PG_DATABASE and _DB_CONTROL in process.env.
      wait: { stdout: new RegExp(DATABASE_READY) },
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      name: 'api',
      command: 'pnpm exec tsx tests/e2e-internal/run-with-database.mts api',
      url: `${API_URL}/health`,
      env: { ...SUITE_ENV, HOST: '127.0.0.1', PORT: String(API_PORT), LOG_LEVEL: 'info', SESSION_LIVENESS: 'auth_server' },
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
      url: `${BASE_URL}/internal/sign-in`,
      env: { ...WEB_ENV, API_INTERNAL_URL: API_URL, APP_ORIGIN: BASE_URL },
      timeout: 360_000,
      reuseExistingServer: false,
    },
    {
      name: 'web-outage',
      command: `pnpm exec next start --hostname 127.0.0.1 --port ${OUTAGE_PORT}`,
      url: `${OUTAGE_URL}/internal/sign-in`,
      env: { ...WEB_ENV, API_INTERNAL_URL: CLOSED_API_URL, APP_ORIGIN: OUTAGE_URL },
      timeout: 90_000,
      reuseExistingServer: false,
    },
  ],
});
