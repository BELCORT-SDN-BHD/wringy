/**
 * M2-AC01: the "database unavailable" page state (the API answers 503
 * `database_unavailable`), on the real API and database (project
 * `database-outage`, which runs after every other project because it takes the
 * API's database access away for a while).
 *
 * The API's runtime login may connect only through its group's CONNECT
 * privilege (packages/db bootstrap: PUBLIC has none). Revoking it from the
 * group `wringy_api` refuses every NEW connection of `wringy_api_login`; pg's
 * pool closes an idle connection after 10 s (pg-pool's idleTimeoutMillis
 * default), after which the API has to reconnect and cannot. The privilege is
 * given back at the end and the page recovers. The worker's login is not touched.
 */
import { expect, test } from '@playwright/test';

import { withClientAt } from '@wringy/db/testing/connect';

import { e2eDatabase, internalShot, setLocaleCookie } from './support';

async function setApiConnect(allowed: boolean): Promise<void> {
  const database = process.env.WRINGY_E2E_PG_DATABASE;
  if (!database) throw new Error('the internal suite database is not announced');
  await withClientAt(e2eDatabase().migrator, async (client) => {
    const target = client.escapeIdentifier(database);
    await client.query(allowed ? `GRANT CONNECT ON DATABASE ${target} TO wringy_api` : `REVOKE CONNECT ON DATABASE ${target} FROM wringy_api`);
  });
}

test('M2-AC01 the database being unavailable to the API shows the api-unavailable state, never an empty list', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await setLocaleCookie(page, 'en-MY', baseURL);

  await setApiConnect(false);
  try {
    const unavailable = page.locator('[data-app-state="api-unavailable"]');
    // Each attempt waits past the pool's 10 s idle timeout, so no warm connection is reused.
    await expect
      .poll(
        async () => {
          await page.goto('/internal');
          return unavailable.count();
        },
        { timeout: 60_000, intervals: [11_000] },
      )
      .toBe(1);

    await expect(unavailable).toContainText('The database is unavailable');
    await expect(page.locator('tr[data-campaign-id], [data-worker-id], [data-app-state="empty"], [data-app-state="no-workers"]')).toHaveCount(0);
    await internalShot(page, 'api-unavailable');
  } finally {
    await setApiConnect(true);
  }

  // Access restored: the next read reconnects and the campaigns are back.
  await expect
    .poll(
      async () => {
        await page.goto('/internal');
        return page.locator('tr[data-campaign-id]').count();
      },
      { timeout: 30_000, intervals: [1_000, 2_000] },
    )
    .toBe(3);
});
