/**
 * M2-AC01: the "API unreachable" page state, on the second `next start`
 * instance of playwright.internal.config.ts (project `outage`), whose
 * API_INTERNAL_URL points at a port nothing listens on. The page is the real
 * build; only the address it was given is dead.
 *
 * Since M2-02 the page is private, and signing in on THIS instance is
 * impossible: the callback has to reach `POST /identity/sign-in`, and its API is
 * the dead one. The `signedIn` fixture therefore signs in against the healthy
 * instance and reuses that context here — session cookies are host-scoped, not
 * port-scoped, so the second port on 127.0.0.1 sees them. The identity read
 * (`GET /me`) fails the same way as the data reads, so the page shows
 * `api-unreachable` once and no "signed in as" header (M2-02 R19).
 */
import { expect, test } from './fixtures';

import { internalShot, setLocaleCookie, watchConsole, type Locale } from './support';

const UNREACHABLE: Record<Locale, string> = {
  'en-MY': 'The API could not be reached',
  'ms-MY': 'API tidak dapat dihubungi',
  'zh-Hans-MY': '无法连接 API',
};

/** What must never reach the page: the dead address, the socket error, a stack. */
const LEAKS = ['127.0.0.1:3299', ':3299', 'ECONNREFUSED', 'fetch failed', 'TypeError', 'node:internal', '    at '];

test('M2-AC01 the API being unreachable shows the api-unreachable state and no stack or URL', async ({ signedIn, baseURL }) => {
  const { page } = signedIn;
  const problems = watchConsole(page);

  for (const locale of Object.keys(UNREACHABLE) as Locale[]) {
    await setLocaleCookie(page, locale, baseURL);
    const response = await page.goto('/internal');
    expect(response?.status()).toBe(200);

    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('[data-app-banner="internal-build"]')).toBeVisible();
    // Both reads failed the same way, so the state is shown once, and no data or empty list stands in for it.
    const alert = page.locator('[data-app-state="api-unreachable"]');
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText(UNREACHABLE[locale]);
    await expect(page.locator('[data-internal-section]')).toHaveCount(0);
    await expect(page.locator('tr[data-campaign-id], [data-worker-id], [data-app-state="empty"], [data-app-state="no-workers"]')).toHaveCount(0);
    // The identity read failed too, so nothing claims who is signed in (R19).
    await expect(page.getByTestId('signed-in-as')).toHaveCount(0);

    const html = await page.content();
    for (const leak of LEAKS) expect(html, `the page shows "${leak}"`).not.toContain(leak);
    expect(await page.locator('body').innerText()).not.toMatch(/https?:\/\//);

    if (locale === 'en-MY') {
      await internalShot(page, 'api-unreachable');
      await page.setViewportSize({ width: 390, height: 844 });
      await internalShot(page, 'api-unreachable');
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }

  expect(problems).toEqual([]);
});
