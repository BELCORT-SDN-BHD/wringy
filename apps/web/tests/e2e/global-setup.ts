import type { FullConfig } from '@playwright/test';

/**
 * The M1 suite checks which build it is actually talking to, before it runs.
 *
 * `webServer` pins `WRINGY_APP_MODE=demo` on the server it starts — but
 * `reuseExistingServer` is true, so when something is already listening on the
 * port that pin is never applied: Playwright skips the launch entirely. The one
 * case that matters is the one the pin was written for. A developer following
 * `docs/m2-internal/m2-02-real-login-runbook.md` leaves `pnpm --filter web start`
 * running on 127.0.0.1:3100 with `WRINGY_APP_MODE=internal` in
 * `apps/web/.env.local`; `pnpm e2e` then reuses that server, `proxy.ts` rewrites
 * every demo path to the internal not-found page, and the whole suite fails with
 * 404s that look like an M1 regression.
 *
 * So the suite asks the server what it is. In demo mode `/` renders the demo home
 * (200); in internal mode it redirects to `/internal` (R12). The redirect is the
 * tell, and naming it here costs one request and turns a confusing failure into a
 * sentence that says what to do.
 *
 * Playwright starts every `webServer` entry before `globalSetup`, so this runs
 * against the server the tests will use, whether Playwright started it or reused
 * one.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? `http://127.0.0.1:${process.env.WEB_PORT ?? 3100}`;

  let response: Response;
  try {
    response = await fetch(new URL('/', baseURL), { redirect: 'manual' });
  } catch (error) {
    // Not this check's business: Playwright's own webServer wait reports an
    // unreachable server far better than a fetch error would.
    void error;
    return;
  }

  const location = response.headers.get('location') ?? '';
  const redirectsToInternal = response.status >= 300 && response.status < 400 && location.includes('/internal');
  if (!redirectsToInternal) return;

  throw new Error(
    `The server at ${baseURL} is running in internal mode (GET / redirected to ${location}), not the demo mode ` +
      'this suite tests. Playwright reused a server it did not start, so its WRINGY_APP_MODE=demo was never ' +
      'applied. Stop that server (or run `pnpm e2e` on a free WEB_PORT); the internal build has its own suite, ' +
      '`pnpm e2e:internal`.',
  );
}
