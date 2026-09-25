/**
 * The simulated Supabase Auth server as the FIRST entry of the Playwright
 * `webServer` array (playwright.internal.config.ts; M2-02 R15). Run with tsx.
 *
 * Playwright starts every webServer entry in order, and captures the named
 * groups of the entry's `wait.stdout` regex into `process.env` (uppercased) for
 * the entries that follow and for the test workers — the pattern
 * database-server.mts already uses for the database. This process therefore
 * prints one line naming:
 *
 * - `supabase_url` → SUPABASE_URL, the origin the api and the web verify tokens
 *   against and redirect the browser to;
 * - `publishable_key` → SUPABASE_PUBLISHABLE_KEY, a fixed literal (no secret
 *   key exists anywhere in this suite);
 * - `control` → WRINGY_E2E_AUTH_CONTROL, the `/_control` base the tests and
 *   global-teardown.ts use.
 *
 * The port is ephemeral so parallel worktrees do not collide; FAKE_AUTH_PORT
 * pins one for a human debugging session. It stays up for the run:
 * globalTeardown POSTs `/_control/shutdown`, and SIGINT/SIGTERM do the same
 * (Playwright cannot signal on Windows, so the HTTP route is the portable one).
 * Nothing is written to the repository.
 */
import { startFakeAuthServer } from './server.mjs';

const port = Number(process.env['FAKE_AUTH_PORT'] ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  console.error(`wringy-e2e-fake-auth: FAKE_AUTH_PORT must be a port number, not ${JSON.stringify(process.env['FAKE_AUTH_PORT'])}`);
  process.exit(2);
}

try {
  const server = await startFakeAuthServer({ port });
  console.log(
    `wringy-e2e-fake-auth ready supabase_url=${server.url} publishable_key=${server.publishableKey} ` +
      `control=${server.controlUrl}`,
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      server.stop().finally(() => process.exit(0));
    });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`wringy-e2e-fake-auth: setup failed: ${message}`);
  process.exit(1);
}
