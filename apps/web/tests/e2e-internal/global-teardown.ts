/**
 * Global teardown of the internal suite (playwright.internal.config.ts).
 *
 * Playwright runs this before it stops the webServer entries. It asks the
 * database process (database-server.mts) to drop the suite's databases and
 * stop its embedded cluster, through the control address that process
 * announced (WRINGY_E2E_DB_CONTROL). Playwright cannot send a signal on
 * Windows, where it force-kills the process tree, so this request is the
 * portable way to leave no database and no data directory behind.
 */
export default async function globalTeardown(): Promise<void> {
  const control = process.env.WRINGY_E2E_DB_CONTROL;
  if (!control) return;
  const response = await fetch(`${control}/shutdown`, { method: 'POST', signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`the internal suite database did not shut down cleanly (HTTP ${response.status})`);
}
