/**
 * The internal suite's database, as the first entry of the Playwright
 * `webServer` array (playwright.internal.config.ts). Run with tsx.
 *
 * Playwright starts every webServer entry, in order, BEFORE globalSetup runs
 * (playwright/lib/runner: createGlobalSetupTasks puts the plugin setup before
 * the global setups), so the api and worker entries cannot wait for a
 * database made in globalSetup. This process makes it first, through the
 * @wringy/db harness (`@wringy/db/testing/cluster`):
 *
 * 1. a real PostgreSQL 17 cluster: TEST_DATABASE_URL's when set, otherwise a
 *    throwaway embedded one; roles bootstrapped; a template migrated from zero
 *    as the migrator and marked environment `ci`;
 * 2. a fresh clone of the template, seeded with the fixture campaigns as
 *    `pnpm db:seed:fixtures` does.
 *
 * It then prints one line that Playwright's `wait.stdout` matches; the named
 * groups become WRINGY_E2E_PG_HOST, WRINGY_E2E_PG_PORT, WRINGY_E2E_PG_DATABASE
 * and WRINGY_E2E_DB_CONTROL in the runner's environment, which the later
 * webServer entries and the test workers inherit. No password is printed: the
 * test cluster's login roles use the fixed development passwords
 * (`loginUrlsAt`, `@wringy/db/testing/connect`).
 *
 * It stays up for the run. globalTeardown POSTs /shutdown to the control
 * address, which drops the databases, stops an embedded cluster and exits;
 * SIGINT/SIGTERM do the same (Playwright cannot signal on Windows, so the HTTP
 * route is the portable path). Nothing is written to the repository.
 */
import { createServer } from 'node:http';

import { createDatabaseIn, seedFixturesIn, startTestCluster } from '@wringy/db/testing/cluster';

const running = await startTestCluster();
let stopping: Promise<void> | undefined;
const stop = (): Promise<void> => (stopping ??= running.stop());

try {
  const database = await createDatabaseIn(running.info);
  const seeded = await seedFixturesIn(database);

  const control = createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/shutdown') {
      stop().then(
        () => {
          response.end('stopped');
          setTimeout(() => process.exit(0), 50);
        },
        (error: unknown) => {
          console.error(`wringy-e2e-database: shutdown failed: ${error instanceof Error ? error.name : 'error'}`);
          response.statusCode = 500;
          response.end('failed');
          setTimeout(() => process.exit(1), 50);
        },
      );
      return;
    }
    response.statusCode = 404;
    response.end();
  });

  control.listen(0, '127.0.0.1', () => {
    const address = control.address();
    const controlPort = address && typeof address === 'object' ? address.port : 0;
    console.log(
      `wringy-e2e-database ready host=${running.info.host} port=${running.info.port} database=${database.name} ` +
        `control=http://127.0.0.1:${controlPort} campaigns=${seeded.campaigns} orgs=${seeded.orgs}`,
    );
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      stop().finally(() => process.exit(0));
    });
  }
} catch (error) {
  // Connection-string credentials are masked: the message may quote a URL.
  const message = (error instanceof Error ? error.message : String(error)).replace(/\/\/[^@\s/]+@/g, '//***@');
  console.error(`wringy-e2e-database: setup failed: ${message}`);
  await stop().catch(() => {});
  process.exit(1);
}
