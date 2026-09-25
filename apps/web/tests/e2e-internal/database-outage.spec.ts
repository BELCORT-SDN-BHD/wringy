/**
 * M2-AC01: the "database unavailable" page state (the API answers 503
 * `database_unavailable`), on the real API and database (project
 * `database-outage`, which runs after every other project because it takes the
 * API's database access away for a while).
 *
 * The API's runtime login may connect only through its group's CONNECT
 * privilege (packages/db bootstrap: PUBLIC has none). Revoking it from the
 * group `wringy_api` refuses every NEW connection of `wringy_api_login`; the
 * API's pool closes an idle connection after POOL_IDLE_TIMEOUT_MS (createPool in
 * @wringy/db sets it explicitly), after which the API has to reconnect and
 * cannot. The privilege is given back at the end and the page recovers. The
 * worker's login is not touched.
 *
 * Since M2-02 the page is private, so the test starts from the `signedIn`
 * fixture. The fixture runs BEFORE the test body, so the sign-in (which reaches
 * `POST /identity/sign-in`, and therefore the database) completes while the API
 * still has its access; only the reads under test happen during the outage. The
 * refresh path is untouched either way: the proxy verifies the token against the
 * auth server's JWKS, never against this database.
 */
import { POOL_IDLE_TIMEOUT_MS, withClientAt } from '@wringy/db/testing/connect';

import { expect, test } from './fixtures';
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
  signedIn,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const { page } = signedIn;
  await setLocaleCookie(page, 'en-MY', baseURL);

  await setApiConnect(false);
  try {
    const unavailable = page.locator('[data-app-state="api-unavailable"]');
    // Each attempt waits past the pool's idle timeout, so no warm connection is reused.
    await expect
      .poll(
        async () => {
          await page.goto('/internal');
          return unavailable.count();
        },
        { timeout: 60_000, intervals: [POOL_IDLE_TIMEOUT_MS + 1_000] },
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
