/**
 * Global setup of the internal suite (playwright.internal.config.ts).
 *
 * Playwright runs this AFTER every webServer entry is up, so the database was
 * already made by the first entry (database-server.mts: a PostgreSQL 17
 * cluster, a template migrated from zero, a clone seeded with the fixtures,
 * all through `@wringy/db/testing/cluster`). This setup checks that database
 * through the harness connection before any test runs, and exports what the
 * tests rely on into process.env, which the test workers inherit:
 *
 * - WRINGY_ENV=ci, the environment the database is marked as;
 * - WRINGY_E2E_PG_HOST/PORT/DATABASE are already there (captured by
 *   Playwright from the database entry's ready line); e2eDatabase() in
 *   support.ts turns them into the migrator, api and worker login URLs.
 *
 * Nothing is written to the repository.
 */
import { withClientAt } from '@wringy/db/testing/connect';

import { e2eDatabase } from './support';

export default async function globalSetup(): Promise<void> {
  const urls = e2eDatabase();

  const { environment, campaigns } = await withClientAt(urls.migrator, async (client) => {
    const marker = await client.query<{ name: string }>('SELECT name FROM ops.environment');
    const seeded = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM app.campaigns WHERE data_origin = 'fixture'",
    );
    return { environment: marker.rows[0]?.name, campaigns: Number(seeded.rows[0]?.count ?? 0) };
  });

  if (environment !== 'ci') throw new Error(`the internal suite database is marked "${environment}", not "ci"`);
  if (campaigns !== 3) throw new Error(`the internal suite database holds ${campaigns} fixture campaigns, not 3`);

  process.env.WRINGY_ENV = 'ci';
}
