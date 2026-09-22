import { defineConfig, devices } from '@playwright/test';

// WEB_PORT lets parallel checkouts (git worktrees) run their own dev server.
const PORT = Number(process.env.WEB_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Three viewports because acceptance P10 checks 390 px, 1440 px and a 320 px
// spot check (see docs/m1-prototype/kickoff.md).
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'tests/e2e/test-results',
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
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
