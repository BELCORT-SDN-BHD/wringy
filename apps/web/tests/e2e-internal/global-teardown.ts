/**
 * Global teardown of the internal suite (playwright.internal.config.ts).
 *
 * Playwright runs this before it stops the webServer entries. It asks the two
 * processes that own state of their own to stop themselves, through the control
 * addresses they announced:
 *
 * - the database process (database-server.mts, WRINGY_E2E_DB_CONTROL): drop the
 *   suite's databases and stop its embedded cluster;
 * - the simulated auth server (fake-auth/start.mts, WRINGY_E2E_AUTH_CONTROL):
 *   exit, forgetting its in-memory sessions and its signing key.
 *
 * Playwright cannot send a signal on Windows, where it force-kills the process
 * tree, so these requests are the portable way to leave no database and no data
 * directory behind. Both are attempted even when the first fails, and the
 * database failure is the one that is reported: it is the only one that can
 * leave something on disk.
 */
export default async function globalTeardown(): Promise<void> {
  const shutdown = async (control: string | undefined, what: string): Promise<Error | undefined> => {
    if (!control) return undefined;
    try {
      const response = await fetch(`${control}/shutdown`, { method: 'POST', signal: AbortSignal.timeout(60_000) });
      if (response.ok) return undefined;
      return new Error(`the internal suite ${what} did not shut down cleanly (HTTP ${response.status})`);
    } catch (error) {
      return new Error(`the internal suite ${what} could not be asked to shut down: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const authFailure = await shutdown(process.env.WRINGY_E2E_AUTH_CONTROL, 'simulated auth server');
  const databaseFailure = await shutdown(process.env.WRINGY_E2E_DB_CONTROL, 'database');
  if (databaseFailure) throw databaseFailure;
  if (authFailure) throw authFailure;
}
