import { defineConfig, devices } from '@playwright/test';

// WEB_PORT lets parallel checkouts (git worktrees) run their own dev server.
const PORT = Number(process.env.WEB_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Three viewports because acceptance P10 checks 390 px, 1440 px and a 320 px
// spot check (see docs/m1-prototype/kickoff.md).
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'tests/e2e/test-results',
  // Asks the server which build it is, before any test runs (M2-02 R13). The
  // `env` below cannot answer that on its own: see the webServer comment.
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'small',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 } },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    // The M1 suite is the demo build, and says so rather than hoping (M2-02 R13).
    // `next dev` reads apps/web/.env.local, and a developer signing in against the
    // real Supabase project has `WRINGY_APP_MODE=internal` there — which would put
    // `proxy.ts` in internal mode and rewrite every demo path to the internal
    // not-found page. An explicit value wins, because `@next/env` never overwrites
    // a variable the process already has.
    //
    // It is only half the answer, because `reuseExistingServer` skips the launch —
    // and this `env` with it — whenever something already listens on the port,
    // which is exactly the case the pin is for. `globalSetup` above asks the
    // server which build it is, so a reused internal server fails with a sentence
    // instead of a suite full of 404s. The reuse itself stays: `pnpm e2e` beside a
    // running `pnpm dev` is the ordinary way to work on M1.
    env: { WRINGY_APP_MODE: 'demo' },
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
