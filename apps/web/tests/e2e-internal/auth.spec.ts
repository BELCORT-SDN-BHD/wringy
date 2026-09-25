/**
 * M2-AC02: sign-in, refresh and sign-out of the internal build, end to end
 * (kickoff-package.md §4.9; M2-02 kickoff code review, rulings D12–D14, D33).
 *
 * ── WHY EVERY TITLE HERE SAYS "simulated" ──────────────────────────────────
 * The identity provider in this file is a local stand-in
 * (tests/e2e-internal/fake-auth/), not Google and not a Supabase project. It
 * speaks the GoTrue subset `@supabase/ssr` 0.12.7 and `@supabase/auth-js`
 * 2.117.2 actually call, signs ES256 tokens against its own JWKS and is held to
 * that contract by its own self-test (tests/unit/fake-auth-contract.test.ts),
 * which drives the real vendor client through the whole flow. It exists because
 * no verified way exists to drive a real Google consent screen from Playwright
 * (§4.9's closing note).
 *
 * That makes these rows strong evidence about **Wringy's** code — the Origin
 * rule, the redirect allow-listing, the cache headers, the liveness guard, the
 * localized outcomes, the isolation between two signed-in people — and no
 * evidence at all about Google's or Supabase's. So each row is labelled
 * `simulated` in its title and in the M2 evidence record, and **a green run of
 * this file cannot close M2-02** (`m2-spec.md` L59). The `Real` rows of §4.9 are
 * recorded separately, marked NOT EXECUTED until the founder walks them.
 *
 * Everything else is real: the two `next start` instances, the Fastify API with
 * `SESSION_LIVENESS=auth_server`, the PostgreSQL 17 database migrated from zero,
 * the allow-list the api reads, and the profile row it writes.
 *
 * ── HOW IT RUNS ────────────────────────────────────────────────────────────
 * The `auth` project runs this file in order in one worker and only after every
 * project that signs Alice in has finished (playwright.internal.config.ts):
 * three rows below change state that is shared by construction — Alice's
 * `app.profiles` row, and every live session of hers — because a Supabase
 * subject is a fixed uuid and `app.profiles.id` is that uuid.
 */
import { request as apiRequest, type BrowserContext, type Page } from '@playwright/test';

import {
  FAKE_USERS,
  HEALTHY_WEB_ORIGIN,
  OUTAGE_WEB_ORIGIN,
  SIGN_IN_ROOT,
  TESTIDS,
  TEST_TAG_HEADER,
  WEB_PORT,
  WEB_ROUTES,
  cancelSignIn,
  consentAs,
  expect,
  onlySessionOf,
  parseConsentPage,
  sessionCookieFingerprint,
  sessionCookieNames,
  signInAs,
  startCachingProxy,
  startSignIn,
  storableInSharedCache,
  supabaseUrl,
  test,
} from './fixtures';
import { LOCALES, internalCopy, internalShot, setLocaleCookie, sql, watchConsole } from './support';

const ALICE = FAKE_USERS.alice;
const BOB = FAKE_USERS.bob;
const MALLORY = FAKE_USERS.mallory;

/** The demo store's localStorage key (src/store/persistence.ts); the internal build must never write it. */
const DEMO_STORAGE_KEY = 'wringy-demo-v1';

/** The path and query the browser ended on, which is what a `next` row asserts. */
const pathAndQuery = (url: string): string => {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
};

/** The `outcome` the sign-in page was reached with, from the URL and from the DOM. */
async function expectOutcome(page: Page, outcome: string, locale: 'en-MY' | 'ms-MY' | 'zh-Hans-MY' = 'en-MY'): Promise<void> {
  const url = new URL(page.url());
  expect(url.pathname, 'the visitor is on the sign-in page').toBe(WEB_ROUTES.signInPage);
  expect(url.searchParams.get('outcome')).toBe(outcome);
  await expect(page.locator(SIGN_IN_ROOT)).toHaveAttribute('data-outcome', outcome);
  const alert = page.getByTestId(TESTIDS.signInOutcome);
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(internalCopy(locale, `signIn.outcomes.${outcome}.title`));
  // The description may be rendered beside the title rather than inside the same
  // element, so it is asserted on the page; what matters is that the person is
  // told what happened, in their own language.
  await expect(page.locator('body')).toContainText(internalCopy(locale, `signIn.outcomes.${outcome}.description`));
}

/** No session cookie survives: what a refusal and a sign-out both have to leave behind. */
async function expectNoSessionCookie(context: BrowserContext): Promise<void> {
  expect(await sessionCookieNames(context), 'no sb-* session cookie may survive').toEqual([]);
}

test.describe('M2-AC02 internal build identity: sign-in, refresh and sign-out against a simulated provider', () => {
  // --- M2-AC02/1: the login, refresh and logout flow ------------------------

  for (const locale of LOCALES) {
    test(`M2-AC02/1 simulated sign-in page: a signed-out visitor is sent to a localized sign-in page (${locale})`, async ({
      tagged,
    }) => {
      const { page, context } = tagged;
      const problems = watchConsole(page);
      await setLocaleCookie(page, locale, HEALTHY_WEB_ORIGIN);

      const response = await page.goto(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}`);
      expect(response?.status(), 'the sign-in page itself answers 200').toBe(200);
      const landing = new URL(page.url());
      expect(landing.pathname).toBe(WEB_ROUTES.signInPage);
      expect(landing.searchParams.get('next'), 'the page the visitor asked for is carried along').toBe('/internal');

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      const root = page.locator(SIGN_IN_ROOT);
      await expect(root).toBeVisible();
      // Reached without an outcome, the attribute is present and empty.
      await expect(root).toHaveAttribute('data-outcome', '');
      await expect(page.getByTestId(TESTIDS.signInOutcome)).toHaveCount(0);
      await expect(root).toContainText(internalCopy(locale, 'signIn.title'));
      await expect(root).toContainText(internalCopy(locale, 'signIn.description'));
      await expect(root).toContainText(internalCopy(locale, 'signIn.returnHint'));

      // The button is the submit of a POST form to /auth/sign-in carrying `next`.
      const button = page.getByTestId(TESTIDS.signInGoogle);
      await expect(button).toContainText(internalCopy(locale, 'signIn.google'));
      const form = page.locator(`form[action="${WEB_ROUTES.signIn}"][method="post" i]`);
      await expect(form).toHaveCount(1);
      await expect(form.locator(`[data-testid="${TESTIDS.signInGoogle}"]`)).toHaveCount(1);
      await expect(form.locator('input[name="next"]')).toHaveValue('/internal');

      await expectNoSessionCookie(context);
      await internalShot(page, `sign-in-${locale}`);
      expect(problems).toEqual([]);
    });
  }

  test('M2-AC02/1 simulated login: the visitor comes back to the page they asked for, and the authorize request asks for no extra scopes', async ({
    tagged,
    tag,
    control,
  }) => {
    const { page } = tagged;

    const landed = await signInAs(page, 'alice', { start: `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}?x=1` });
    expect(pathAndQuery(landed), 'the visitor is back where they started').toBe('/internal?x=1');
    await expect(page.getByTestId(TESTIDS.signedInAs)).toContainText(ALICE.email);
    await expect(page.getByTestId(TESTIDS.signedInAs)).toContainText(
      internalCopy('en-MY', 'session.signedInAs').replace('{email}', ALICE.email),
    );
    await expect(page.locator('[data-app-banner="internal-build"]')).toBeVisible();

    const report = await control.calls(tag);
    expect(report.authorize, 'exactly one authorize request').toHaveLength(1);
    const authorize = report.authorize[0];
    expect(authorize?.provider).toBe('google');
    // No `scopes` at all: no YouTube grant is possible (M2-AC02/1).
    expect(authorize?.scopes, 'the authorize request must ask for no extra scopes').toBeNull();
    // A constant callback, so an exact redirect allow-list entry matches (R10).
    expect(authorize?.redirectTo).toBe(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.callback}`);
    expect(authorize?.codeChallengeMethod).toBe('s256');
    expect(report.sessions.filter((session) => session.active)).toHaveLength(1);

    // The profile the first sign-in wrote is Alice's, keyed by the token subject.
    const profiles = await sql<{ id: string; contact_email: string; display_name: string | null; status: string }>(
      'migrator',
      'SELECT id, contact_email, display_name, status FROM app.profiles WHERE id = $1',
      [ALICE.id],
    );
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ contact_email: ALICE.email, display_name: ALICE.fullName, status: 'active' });

    await internalShot(page, 'signed-in-header');
  });

  test('M2-AC02/1 simulated cancel: cancelling at the provider shows the cancelled outcome in the current locale', async ({
    tagged,
  }) => {
    const { page, context } = tagged;
    await setLocaleCookie(page, 'zh-Hans-MY', HEALTHY_WEB_ORIGIN);

    await cancelSignIn(page);
    await expectOutcome(page, 'cancelled', 'zh-Hans-MY');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans-MY');
    await expectNoSessionCookie(context);
  });

  test('M2-AC02/1 simulated not_allowed: a verified address that nobody invited is refused and leaves no session cookie', async ({
    tagged,
  }) => {
    const { page, context } = tagged;

    await signInAs(page, 'mallory');
    await expectOutcome(page, 'not_allowed');
    // Neither her address nor her name may appear: the page is neutral (R5).
    const body = await page.locator('body').innerText();
    expect(body).not.toContain(MALLORY.email);
    expect(body).not.toContain(MALLORY.fullName);
    await expectNoSessionCookie(context);

    // She got no profile either: the gate runs before the upsert.
    const profiles = await sql<{ id: string }>('migrator', 'SELECT id FROM app.profiles WHERE id = $1', [MALLORY.id]);
    expect(profiles, 'a refused first sign-in writes no profile').toHaveLength(0);
  });

  test('M2-AC02/1 simulated expired: a flow state that expired before the exchange shows the expired outcome', async ({
    tagged,
  }) => {
    const { page, context, tag, control } = tagged;
    await control.expireNextFlow(tag);

    await signInAs(page, 'alice');
    await expectOutcome(page, 'expired');
    await expectNoSessionCookie(context);
  });

  test('M2-AC02/1 simulated wrong_browser: a consent completed in another browser shows the wrong-browser outcome', async ({
    tagged,
    openDevice,
  }) => {
    // This browser starts the flow, so it is the one holding the PKCE verifier.
    const consentUrl = await startSignIn(tagged.page);

    // A second browser finishes it. It has no verifier, which is what PKCE is for.
    const elsewhere = await openDevice('elsewhere');
    await elsewhere.page.goto(consentUrl);
    await consentAs(elsewhere.page, 'alice', HEALTHY_WEB_ORIGIN);

    await expectOutcome(elsewhere.page, 'wrong_browser');
    await expectNoSessionCookie(elsewhere.context);
    // The browser that started it never got a session either.
    await expectNoSessionCookie(tagged.context);
  });

  test('M2-AC02/1 simulated refresh: an expired access token is refreshed in place, without a call to the provider about the user', async ({
    tagged,
  }) => {
    test.setTimeout(90_000);
    const { page, context, tag, control } = tagged;
    await control.tokenLifetime(tag, 2);
    await signInAs(page, 'alice');
    await expect(page.getByTestId(TESTIDS.signedInAs)).toContainText(ALICE.email);

    const before = await control.calls(tag);
    const cookiesBefore = await sessionCookieFingerprint(context);
    expect(cookiesBefore, 'the context holds session cookies to begin with').not.toBe('');

    // Past the two-second lifetime, so the stored token is genuinely expired.
    await page.waitForTimeout(3_000);
    await page.reload();

    await expect(page.getByTestId(TESTIDS.signedInAs), 'the visitor is still signed in').toContainText(ALICE.email);
    await expect(page.locator(SIGN_IN_ROOT)).toHaveCount(0);
    expect(await sessionCookieFingerprint(context), 'the rotated session was written back').not.toBe(cookiesBefore);

    const after = await control.calls(tag);
    expect(after.calls.token_refresh, 'the refresh happened').toBeGreaterThan(before.calls.token_refresh);
    // getClaims() verifies ES256 locally against the JWKS, so the refresh path
    // never asks the auth server who the caller is (§4.3). Counted as a delta:
    // the first sign-in legitimately asked once, through requireLiveSession.
    expect(after.calls.user, 'the refresh must not call the auth server about the user').toBe(before.calls.user);
  });

  test('M2-AC02/1 simulated sign-out: this device is signed out, the other devices are named, and the back button shows no private data', async ({
    signedIn,
  }) => {
    const { page, context } = signedIn;

    // The page states the scope before the visitor commits to it (§4.6, D14).
    await expect(page.locator('body')).toContainText(internalCopy('en-MY', 'session.otherDevicesNote'));
    const signOutForm = page.locator(`form[action="${WEB_ROUTES.signOut}"][method="post" i]`);
    await expect(signOutForm).toHaveCount(1);
    await expect(signOutForm.locator(`[data-testid="${TESTIDS.signOut}"]`)).toHaveCount(1);

    await page.getByTestId(TESTIDS.signOut).click();
    await page.waitForURL((url) => url.pathname === WEB_ROUTES.signInPage);
    await expectOutcome(page, 'signed_out');
    await expectNoSessionCookie(context);
    await internalShot(page, 'signed-out');

    // The back button must not serve a cached private page (§4.7).
    await page.goBack();
    await page.waitForURL((url) => url.pathname === WEB_ROUTES.signInPage);
    await expect(page.getByTestId(TESTIDS.signedInAs)).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain(ALICE.email);
  });

  test('M2-AC02/1 simulated signed_out_unconfirmed: a sign-out the provider refused still clears this device and says so', async ({
    signedIn,
  }) => {
    const { page, context, tag, control } = signedIn;

    // `signOut()` can come back with an error and no cookies cleared (a
    // retryable auth-server failure). R10 says Wringy expires every sb-* cookie
    // itself and tells the person it could not confirm the other end.
    await control.failNext(tag, 'logout', 500, 'internal_error');
    await page.getByTestId(TESTIDS.signOut).click();
    await page.waitForURL((url) => url.pathname === WEB_ROUTES.signInPage);

    await expectOutcome(page, 'signed_out_unconfirmed');
    await expectNoSessionCookie(context);
    const calls = await control.calls(tag);
    expect(calls.calls.logout, 'the failed logout was attempted').toBeGreaterThanOrEqual(1);
  });

  test('M2-AC02/1 simulated unexpected: a callback that cannot reach the api shows the unexpected outcome and keeps no session', async ({
    tagged,
  }) => {
    test.setTimeout(120_000);
    const { page, context } = tagged;

    // The whole flow against the instance whose API address is closed: the
    // callback gets its tokens, cannot reach `POST /identity/sign-in`, and must
    // refuse rather than let a half-made session stand (R10, step 3).
    await signInAs(page, 'alice', { start: `${OUTAGE_WEB_ORIGIN}${WEB_ROUTES.internal}` });

    await expectOutcome(page, 'unexpected');
    expect(new URL(page.url()).origin, 'the outage instance answered for itself').toBe(OUTAGE_WEB_ORIGIN);
    await expectNoSessionCookie(context);
    // Nothing of the failure reaches the person: no address, no port, no stack.
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('ECONNREFUSED');
    expect(body).not.toMatch(/https?:\/\//);
  });

  // --- M2-AC02/2: what a live session is, and what ends it -----------------

  test('M2-AC02/2 simulated isolation: two signed-in contexts reloading at once never swap identities', async ({
    tagged,
    openDevice,
  }) => {
    test.setTimeout(180_000);
    const alicePage = tagged.page;
    const bobPage = (await openDevice('bob')).page;
    await signInAs(alicePage, 'alice');
    await signInAs(bobPage, 'bob');

    for (let round = 1; round <= 10; round += 1) {
      await Promise.all([alicePage.reload(), bobPage.reload()]);
      const [aliceHeader, bobHeader] = await Promise.all([
        alicePage.getByTestId(TESTIDS.signedInAs).innerText(),
        bobPage.getByTestId(TESTIDS.signedInAs).innerText(),
      ]);
      expect(aliceHeader, `round ${round}: Alice's page`).toContain(ALICE.email);
      expect(aliceHeader, `round ${round}: Alice's page`).not.toContain(BOB.email);
      expect(bobHeader, `round ${round}: Bob's page`).toContain(BOB.email);
      expect(bobHeader, `round ${round}: Bob's page`).not.toContain(ALICE.email);
      const [aliceBody, bobBody] = await Promise.all([
        alicePage.locator('body').innerText(),
        bobPage.locator('body').innerText(),
      ]);
      expect(aliceBody, `round ${round}: nothing of Bob on Alice's page`).not.toContain(BOB.email);
      expect(bobBody, `round ${round}: nothing of Alice on Bob's page`).not.toContain(ALICE.email);
    }
  });

  test('M2-AC02/2 simulated session_ended: a session revoked at the provider cannot be refreshed and lands on sign-in', async ({
    tagged,
  }) => {
    test.setTimeout(90_000);
    const { page, tag, control } = tagged;
    await control.tokenLifetime(tag, 2);
    await signInAs(page, 'alice');
    await expect(page.getByTestId(TESTIDS.signedInAs)).toContainText(ALICE.email);

    await control.revokeSession(await onlySessionOf(tag));
    // Past the lifetime, so the stored token has to be refreshed, and cannot be.
    await page.waitForTimeout(3_000);
    await page.goto(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}`);

    await expectOutcome(page, 'session_ended');
    expect(await page.locator('body').innerText()).not.toContain(ALICE.email);
  });

  test('M2-AC02/2 simulated probe: the reserved command answers ok while the session is live and revoked once it is gone', async ({
    signedIn,
  }) => {
    const { page, tag, control } = signedIn;

    const probeForm = page.locator(`form[action="${WEB_ROUTES.probe}"][method="post" i]`);
    await expect(probeForm).toHaveCount(1);
    await expect(page.locator('body')).toContainText(internalCopy('en-MY', 'probe.title'));
    await expect(page.getByTestId(TESTIDS.sessionProbe)).toContainText(internalCopy('en-MY', 'probe.button'));

    await page.getByTestId(TESTIDS.sessionProbe).click();
    await page.waitForURL((url) => url.searchParams.get('probe') !== null);
    const live = page.getByTestId(TESTIDS.probeResult);
    await expect(live).toHaveAttribute('data-probe', 'ok');
    await expect(live).toContainText(internalCopy('en-MY', 'probe.results.ok'));

    // Revoked at the provider, while the cookie still holds an UNEXPIRED token
    // (the default one-hour lifetime): the JWT alone would still let the read
    // through, so only the liveness guard inside the command can catch this.
    await control.revokeSession(await onlySessionOf(tag));
    await page.getByTestId(TESTIDS.sessionProbe).click();
    await page.waitForURL((url) => url.searchParams.get('probe') === 'revoked');
    const revoked = page.getByTestId(TESTIDS.probeResult);
    await expect(revoked).toHaveAttribute('data-probe', 'revoked');
    await expect(revoked).toContainText(internalCopy('en-MY', 'probe.results.revoked'));
  });

  test('M2-AC02/2 simulated scope: signing out of one device leaves the other device signed in and able to run the command', async ({
    tagged,
    openDevice,
  }) => {
    test.setTimeout(120_000);
    const firstPage = tagged.page;
    const second = await openDevice('second');
    const secondPage = second.page;
    await signInAs(firstPage, 'alice');
    await signInAs(secondPage, 'alice');

    await firstPage.getByTestId(TESTIDS.signOut).click();
    await firstPage.waitForURL((url) => url.pathname === WEB_ROUTES.signInPage);
    await expectOutcome(firstPage, 'signed_out');
    await expectNoSessionCookie(tagged.context);

    // The second device is a different session, so `scope: 'local'` left it alone.
    await secondPage.reload();
    await expect(secondPage.getByTestId(TESTIDS.signedInAs)).toContainText(ALICE.email);
    await secondPage.getByTestId(TESTIDS.sessionProbe).click();
    await secondPage.waitForURL((url) => url.searchParams.get('probe') !== null);
    await expect(secondPage.getByTestId(TESTIDS.probeResult)).toHaveAttribute('data-probe', 'ok');
  });

  test('M2-AC02/2 simulated disabled: a disabled profile is refused, shown the disabled outcome and left with no session cookie', async ({
    signedIn,
  }) => {
    const { page, context } = signedIn;
    const setStatus = (status: 'active' | 'disabled') =>
      sql('migrator', 'UPDATE app.profiles SET status = $2 WHERE id = $1', [ALICE.id, status]);

    await setStatus('disabled');
    try {
      await page.goto(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}`);
      await expectOutcome(page, 'disabled');
      expect(await page.locator('body').innerText()).not.toContain(ALICE.email);
      await expectNoSessionCookie(context);
    } finally {
      // Alice's uuid is fixed, so every later row would fail on a row left disabled.
      await setStatus('active');
    }
  });

  // --- M2-AC02/3: the forgeries, the redirects and the caches ---------------

  test('M2-AC02/3 simulated origin: a cross-site POST is refused before the provider is called, and GET sign-out is 405', async ({
    signedIn,
  }) => {
    const { page, context, tag, control } = signedIn;
    const before = await control.calls(tag);

    const crossSiteSignOut = await context.request.post(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.signOut}`, {
      headers: { origin: 'https://evil.example' },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(crossSiteSignOut.status(), 'a cross-site sign-out is refused').toBe(403);

    const crossSiteSignIn = await context.request.post(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.signIn}`, {
      headers: { origin: 'https://evil.example' },
      form: { next: WEB_ROUTES.internal },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(crossSiteSignIn.status(), 'a cross-site sign-in is refused').toBe(403);

    // No Origin at all, declared cross-site: refused too (§4.5 rule 2).
    const noOrigin = await context.request.post(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.signOut}`, {
      headers: { 'sec-fetch-site': 'cross-site' },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(noOrigin.status()).toBe(403);

    const getSignOut = await context.request.get(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.signOut}`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(getSignOut.status(), 'sign-out is a POST-only route').toBe(405);

    const after = await control.calls(tag);
    expect(after.calls.logout, 'a refused sign-out never reached the provider').toBe(before.calls.logout);
    expect(after.calls.authorize, 'a refused sign-in never reached the provider').toBe(before.calls.authorize);

    // And the session the forgery aimed at is untouched.
    await page.reload();
    await expect(page.getByTestId(TESTIDS.signedInAs)).toContainText(ALICE.email);
  });

  test('M2-AC02/3 simulated callback: a next parameter or a forwarded host pointing elsewhere never leaves the app origin', async ({
    tag,
  }) => {
    test.setTimeout(120_000);
    for (const next of ['//evil.example', 'https://evil.example', '/internal?ok=1']) {
      const api = await apiRequest.newContext({
        baseURL: HEALTHY_WEB_ORIGIN,
        extraHTTPHeaders: { [TEST_TAG_HEADER]: `${tag}-${encodeURIComponent(next)}` },
      });
      try {
        const started = await api.post(WEB_ROUTES.signIn, {
          // A browser sends this; a request context does not, and the Origin
          // rule refuses a POST that carries neither (§4.5). The cross-site
          // case is the origin row's job, not this one's.
          headers: { origin: HEALTHY_WEB_ORIGIN },
          form: { next },
          maxRedirects: 0,
          failOnStatusCode: false,
        });
        expect(started.status(), `POST sign-in with next=${next}`).toBe(303);
        const authorizeUrl = started.headers()['location'];
        expect(authorizeUrl, 'the 303 names the authorize URL').toBeTruthy();
        expect(new URL(authorizeUrl!).origin, 'sign-in redirects to the provider').toBe(supabaseUrl());

        const consentPage = await api.get(authorizeUrl!, { maxRedirects: 0, failOnStatusCode: false });
        expect(consentPage.status()).toBe(200);
        const form = parseConsentPage(await consentPage.text());
        const consented = await api.post(form.action, {
          form: { state: form.state, user: 'alice' },
          maxRedirects: 0,
          failOnStatusCode: false,
        });
        expect(consented.status()).toBe(302);
        const callbackUrl = new URL(consented.headers()['location'] ?? '');
        expect(callbackUrl.origin, 'the provider comes back to the app origin only').toBe(HEALTHY_WEB_ORIGIN);

        const callback = await api.get(callbackUrl.toString(), { maxRedirects: 0, failOnStatusCode: false });
        expect([303, 307, 302], `the callback answers a redirect for next=${next}`).toContain(callback.status());
        const landing = new URL(callback.headers()['location'] ?? '', HEALTHY_WEB_ORIGIN);
        expect(landing.origin, `next=${next} must not leave the app origin`).toBe(HEALTHY_WEB_ORIGIN);
        expect(landing.host).toBe(`127.0.0.1:${WEB_PORT}`);
        if (next === '/internal?ok=1') {
          // The one safe value is honoured, so the rule refuses rather than ignores.
          expect(`${landing.pathname}${landing.search}`).toBe('/internal?ok=1');
        }
      } finally {
        await api.dispose();
      }
    }

    // A forged forwarding header must not steer a redirect either (R12).
    const anonymous = await apiRequest.newContext({ baseURL: HEALTHY_WEB_ORIGIN });
    try {
      const forwarded = await anonymous.get(WEB_ROUTES.internal, {
        headers: { 'x-forwarded-host': 'evil.example' },
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      expect(forwarded.status(), 'a signed-out visitor is redirected').toBe(307);
      const location = new URL(forwarded.headers()['location'] ?? '', HEALTHY_WEB_ORIGIN);
      expect(location.host, 'the redirect is built from APP_ORIGIN, never from a header').toBe(`127.0.0.1:${WEB_PORT}`);
      expect(location.pathname).toBe(WEB_ROUTES.signInPage);
    } finally {
      await anonymous.dispose();
    }
  });

  test('M2-AC02/3 simulated cache: every response that sets a cookie is private, no-store and unstorable in a shared cache', async ({
    tag,
    control,
  }) => {
    test.setTimeout(120_000);
    await control.tokenLifetime(tag, 2);
    const api = await apiRequest.newContext({
      baseURL: HEALTHY_WEB_ORIGIN,
      extraHTTPHeaders: { [TEST_TAG_HEADER]: tag },
    });
    const withCookies: { label: string; cacheControl: string }[] = [];

    /** Records one hop, and holds it to §4.7 when it wrote a cookie. */
    const inspect = (label: string, method: string, url: string, status: number, headers: Record<string, string>): void => {
      if (headers['set-cookie'] === undefined) return;
      const cacheControl = headers['cache-control'] ?? '';
      expect(cacheControl, `${label} sets a cookie, so it must be private`).toContain('private');
      expect(cacheControl, `${label} sets a cookie, so it must be no-store`).toContain('no-store');
      expect(
        storableInSharedCache({ method, url, headers: {} }, { status, headers }),
        `${label} sets a cookie, so a shared cache must refuse to store it`,
      ).toBe(false);
      withCookies.push({ label, cacheControl });
    };

    try {
      const signIn = await api.post(WEB_ROUTES.signIn, {
        headers: { origin: HEALTHY_WEB_ORIGIN },
        form: { next: WEB_ROUTES.internal },
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      inspect('POST /auth/sign-in', 'POST', `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.signIn}`, signIn.status(), signIn.headers());

      const authorizeUrl = signIn.headers()['location'] ?? '';
      const consentPage = await api.get(authorizeUrl, { maxRedirects: 0, failOnStatusCode: false });
      const form = parseConsentPage(await consentPage.text());
      const consented = await api.post(form.action, {
        form: { state: form.state, user: 'alice' },
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      const callbackUrl = consented.headers()['location'] ?? '';
      const callback = await api.get(callbackUrl, { maxRedirects: 0, failOnStatusCode: false });
      inspect('GET /auth/callback', 'GET', callbackUrl, callback.status(), callback.headers());

      // Past the two-second lifetime, so this GET has to write a rotated session.
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      const refreshed = await api.get(WEB_ROUTES.internal, { maxRedirects: 0, failOnStatusCode: false });
      inspect(
        'GET /internal (refresh)',
        'GET',
        `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}`,
        refreshed.status(),
        refreshed.headers(),
      );

      const signOut = await api.post(WEB_ROUTES.signOut, {
        headers: { origin: HEALTHY_WEB_ORIGIN },
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      inspect(
        'POST /auth/sign-out',
        'POST',
        `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.signOut}`,
        signOut.status(),
        signOut.headers(),
      );

      // The four cookie-writing hops of the flow were actually seen, so the
      // assertions above are not vacuous.
      expect(withCookies.map((entry) => entry.label)).toEqual(
        expect.arrayContaining([
          'POST /auth/sign-in',
          'GET /auth/callback',
          'GET /internal (refresh)',
          'POST /auth/sign-out',
        ]),
      );
    } finally {
      await api.dispose();
    }
  });

  test('M2-AC02/3 simulated shared cache: an RFC 9111 shared cache between two signed-in people never hands one the other page', async ({
    tagged,
    openDevice,
  }) => {
    test.setTimeout(120_000);
    const proxy = await startCachingProxy(HEALTHY_WEB_ORIGIN);
    try {
      const aliceContext = tagged.context;
      const bob = await openDevice('bob');
      const bobContext = bob.context;
      await signInAs(tagged.page, 'alice');
      await signInAs(bob.page, 'bob');

      // Cookies are host-scoped, so each context sends its own session to the
      // proxy's port as it would to the app's.
      const alicePath = `/internal?visitor=alice-${Date.now()}`;
      const aliceThroughProxy = await aliceContext.request.get(`${proxy.origin}${alicePath}`);
      expect(aliceThroughProxy.status()).toBe(200);
      expect(await aliceThroughProxy.text()).toContain(ALICE.email);

      // Bob asks for the SAME url a shared cache could have stored for Alice.
      const bobThroughProxy = await bobContext.request.get(`${proxy.origin}${alicePath}`);
      expect(bobThroughProxy.status()).toBe(200);
      const bobBody = await bobThroughProxy.text();
      expect(bobBody, "a shared cache must not hand Bob Alice's page").not.toContain(ALICE.email);
      expect(bobBody).toContain(BOB.email);
      expect(bobThroughProxy.headers()['x-wringy-proxy'], 'the answer came from the app, not the cache').toBe('pass');
      expect(proxy.storedKeys(), 'a private page is not storable in a shared cache').not.toContain(`GET ${alicePath}`);
      expect(proxy.hits(), 'nothing was served out of the shared cache').toBe(0);

      // A signed-out read of the public page writes no cookie at all, so there
      // is nothing for a cache to leak in the first place.
      const anonymous = await apiRequest.newContext();
      try {
        const publicPage = await anonymous.get(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.signInPage}`);
        expect(publicPage.status()).toBe(200);
        expect(publicPage.headers()['set-cookie'], 'the signed-out sign-in page sets no cookie').toBeUndefined();
        expect(await publicPage.text()).not.toContain(ALICE.email);
      } finally {
        await anonymous.dispose();
      }
    } finally {
      await proxy.stop();
    }
  });

  test('M2-AC02/3 simulated no-demo: the signed-in internal build mounts no demo store and no demo toolbar', async ({
    signedIn,
  }) => {
    const { page } = signedIn;
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate((key) => window.localStorage.getItem(key), DEMO_STORAGE_KEY)).toBeNull();
    expect(await page.evaluate(() => window.localStorage.length), 'the internal build writes no browser storage').toBe(0);
    await expect(page.getByTestId('demo-toolbar-trigger')).toHaveCount(0);
    await expect(page.getByTestId('demo-badge')).toHaveCount(0);
    await expect(page.getByTestId('locale-prompt')).toHaveCount(0);
  });
});
