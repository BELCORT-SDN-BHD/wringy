/**
 * The harness's own self-test (M2-02 R15).
 *
 * The internal Playwright suite signs in against a simulated Supabase Auth
 * server (tests/e2e-internal/fake-auth/server.mts). A fake that drifts from the
 * vendor would make the whole M2-AC02 evidence meaningless — green tests
 * agreeing with a stand-in nobody checked. So this file starts the fake
 * in-process and drives the REAL client, `@supabase/ssr` 0.12.7's
 * `createServerClient` over an in-memory cookie adapter, through the whole
 * flow: `signInWithOAuth` → the consent page's own form → `exchangeCodeForSession`
 * → `getClaims()` (which must verify the ES256 signature locally, with no call
 * to `/user`) → a refresh, including the 10-second reuse interval → `signOut`
 * → `/user` answering 403 `session_not_found`. It also walks the cancel, the two
 * expired-flow shapes (the token exchange's 422, and the Site-URL redirect the
 * founder's real walk found) and the bad-verifier path, because those are the
 * ones the sign-in page's outcome copy is keyed on (R11 rev 4).
 *
 * No browser, no database and no network beyond loopback: this runs in
 * `pnpm --filter web test`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServerClient } from '@supabase/ssr';

import {
  FAKE_PUBLISHABLE_KEY,
  FAKE_USERS,
  TEST_TAG_HEADER,
  allowlistedEmails,
  type FakeUserName,
} from '../e2e-internal/fake-auth/users';
import { startFakeAuthServer, type CallReport, type FakeAuthServer } from '../e2e-internal/fake-auth/server.mjs';

/** Where the web would send the browser back; the fake only echoes it. */
const APP_ORIGIN = 'http://127.0.0.1:3100';
const REDIRECT_TO = `${APP_ORIGIN}/auth/callback`;

/**
 * The query the **real** Supabase dev project put on the Site URL root when the
 * PKCE flow state had expired, copied verbatim from the browser's network log of
 * the founder's walk (2026-09-26, 14:14):
 *
 *     GET http://127.0.0.1:3100/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired
 *
 * The fake has a literal of its own; this one is the observation, so the two
 * disagreeing is a failing test rather than a fake that quietly drifted.
 */
const SITE_URL_QUERY = 'error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired';

let server: FakeAuthServer;

beforeAll(async () => {
  server = await startFakeAuthServer({ log: false });
});

afterAll(async () => {
  await server.stop();
});

/**
 * The cookie adapter `createServerClient` writes its session and PKCE verifier
 * through. A route handler passes `cookies()` from `next/headers`; here it is a
 * Map, which is all the library needs (`getAll`/`setAll`).
 */
function memoryCookieJar() {
  const jar = new Map<string, string>();
  return {
    jar,
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (cookies: { name: string; value: string }[]) => {
      for (const cookie of cookies) {
        // The library clears a cookie by writing an empty value with maxAge 0.
        if (cookie.value === '') jar.delete(cookie.name);
        else jar.set(cookie.name, cookie.value);
      }
    },
  };
}

/**
 * The client, with this test's tag on every request it makes. The real web
 * sends no such header; it is here so the control API can count the client's
 * own calls (the JWKS fetch, the token requests, the logout) alongside the
 * server-attributed ones.
 */
function newClient(jar: ReturnType<typeof memoryCookieJar>, tag: string) {
  return createServerClient(server.url, FAKE_PUBLISHABLE_KEY, {
    cookies: { getAll: jar.getAll, setAll: jar.setAll },
    cookieOptions: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    global: { headers: { [TEST_TAG_HEADER]: tag } },
  });
}

async function callsFor(tag: string): Promise<CallReport> {
  const response = await fetch(`${server.controlUrl}/calls?tag=${encodeURIComponent(tag)}`);
  expect(response.status).toBe(200);
  return (await response.json()) as CallReport;
}

async function control(path: string, body?: unknown): Promise<void> {
  const response = await fetch(`${server.controlUrl}${path}`, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.status, `control ${path}`).toBe(200);
}

/** The consent page, fetched the way a browser would, with this test's tag on it. */
async function openConsent(authorizeUrl: string, tag: string): Promise<{ action: string; state: string; cancel: string }> {
  const response = await fetch(authorizeUrl, { headers: { [TEST_TAG_HEADER]: tag } });
  expect(response.status, 'the consent page').toBe(200);
  const html = await response.text();
  // The page exposes its own form action and state; nothing is hard-coded here.
  const action = /<form[^>]*action="([^"]+)"/.exec(html)?.[1];
  const state = /name="state" value="([^"]+)"/.exec(html)?.[1];
  // A browser decodes the entities in an href before it follows it; fetch does not.
  const cancel = /href="([^"]+)"[^>]*data-testid="fake-cancel"/.exec(html)?.[1]?.replace(/&amp;/g, '&');
  expect(action, 'the consent page exposes a form action').toBeDefined();
  expect(state, 'the consent page exposes its state').toBeDefined();
  expect(cancel, 'the consent page exposes a cancel link').toBeDefined();
  expect(html, 'the consent page offers one button per fake user').toContain('data-testid="fake-user-alice"');
  expect(html).toContain('data-testid="fake-user-bob"');
  expect(html).toContain('data-testid="fake-user-mallory"');
  // The M2-03 organisation testers (m2-03-code-review.md R13).
  expect(html).toContain('data-testid="fake-user-carol"');
  expect(html).toContain('data-testid="fake-user-dave"');
  expect(html).toContain('data-testid="fake-user-erin"');
  return { action: action!, state: state!, cancel: cancel! };
}

/** Submits the consent form exactly as the browser's button would, and returns the 302 Location. */
async function submitConsent(
  form: { action: string; state: string },
  fields: Record<string, string>,
  tag: string,
): Promise<string> {
  const response = await fetch(new URL(form.action, server.url), {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', [TEST_TAG_HEADER]: tag },
    body: new URLSearchParams({ state: form.state, ...fields }).toString(),
  });
  expect(response.status, 'a completed consent answers 302').toBe(302);
  const location = response.headers.get('location');
  expect(location, 'the consent redirect names a location').toBeTruthy();
  return location!;
}

/** Starts a flow through the real client and walks it to the code the callback would see. */
async function walkToCode(
  tag: string,
  user: FakeUserName = 'alice',
): Promise<{ client: ReturnType<typeof newClient>; jar: ReturnType<typeof memoryCookieJar>; code: string }> {
  const jar = memoryCookieJar();
  const client = newClient(jar, tag);
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
  });
  expect(error).toBeNull();
  expect(data.url, 'signInWithOAuth returns the authorize URL').toContain('/auth/v1/authorize');
  const form = await openConsent(data.url!, tag);
  const location = await submitConsent(form, { user }, tag);
  const code = new URL(location).searchParams.get('code');
  expect(code, 'the consent redirect carries a code').toBeTruthy();
  return { client, jar, code: code! };
}

describe('M2-AC02/3 the simulated auth harness matches the vendor client it stands in for', () => {
  it('M2-AC02/3 simulated harness self-test: the fake auth server speaks the auth-js contract', async () => {
    const tag = `self-test-${Date.now()}`;
    const { client, jar, code } = await walkToCode(tag);

    // The authorize request asked for exactly what M2-AC02/1 requires.
    const afterAuthorize = await callsFor(tag);
    expect(afterAuthorize.calls.authorize).toBe(1);
    expect(afterAuthorize.authorize).toHaveLength(1);
    expect(afterAuthorize.authorize[0]).toMatchObject({
      provider: 'google',
      redirectTo: REDIRECT_TO,
      // No extra scopes: no YouTube grant is possible.
      scopes: null,
      codeChallengeMethod: 's256',
      // auth-js does NOT forward `skipBrowserRedirect` into the authorize URL
      // (GoTrueClient `_handleProviderSignIn` drops it before
      // `_getUrlForProvider`), so a real Supabase would still 302 to the
      // provider. This assertion pins that reading of the vendor source.
      skipHttpRedirect: false,
    });
    expect(afterAuthorize.authorize[0]?.codeChallenge).toMatch(/^[\w-]{43}$/);
    // The PKCE verifier went into the cookie jar, not into the URL.
    expect([...jar.jar.keys()].some((name) => name.includes('code-verifier'))).toBe(true);

    // The exchange: a real PKCE token request, verified against the challenge.
    const exchanged = await client.auth.exchangeCodeForSession(code);
    expect(exchanged.error).toBeNull();
    const session = exchanged.data.session;
    expect(session, 'the exchange returns a session').toBeTruthy();
    expect(session!.token_type).toBe('bearer');
    expect(session!.expires_in).toBe(3600);
    expect(session!.user.email).toBe(FAKE_USERS.alice.email);
    expect(session!.user.id).toBe(FAKE_USERS.alice.id);
    expect(session!.user.user_metadata['full_name']).toBe(FAKE_USERS.alice.fullName);
    const firstAccessToken = session!.access_token;
    const firstRefreshToken = session!.refresh_token;

    // getClaims() verifies the ES256 signature locally against the JWKS. The
    // proof that it did is that /user was never called (§4.3).
    const claims = await client.auth.getClaims();
    expect(claims.error).toBeNull();
    expect(claims.data?.claims['sub']).toBe(FAKE_USERS.alice.id);
    expect(claims.data?.claims['session_id']).toEqual(expect.any(String));
    expect(claims.data?.claims['iss']).toBe(`${server.url}/auth/v1`);
    expect(claims.data?.claims['aud']).toBe('authenticated');
    expect(claims.data?.claims['role']).toBe('authenticated');
    expect(claims.data?.claims['aal']).toBe('aal1');
    expect(claims.data?.claims['is_anonymous']).toBe(false);
    expect(claims.data?.claims['email']).toBe(FAKE_USERS.alice.email);
    expect(claims.data?.header.alg).toBe('ES256');
    const afterClaims = await callsFor(tag);
    expect(afterClaims.calls.token_pkce).toBe(1);
    expect(afterClaims.calls.jwks, 'the JWKS was fetched once and cached').toBe(1);
    expect(afterClaims.calls.user, 'getClaims must not fall back to GET /user for an ES256 token').toBe(0);
    expect(afterClaims.sessions.filter((entry) => entry.active)).toHaveLength(1);
    const sessionId = afterClaims.sessions[0]?.id;
    expect(sessionId).toBeTruthy();

    // A refresh through the real client rotates both tokens.
    const rotated = await client.auth.refreshSession();
    expect(rotated.error).toBeNull();
    expect(rotated.data.session?.access_token).not.toBe(firstAccessToken);
    expect(rotated.data.session?.refresh_token).not.toBe(firstRefreshToken);
    const currentRefreshToken = rotated.data.session!.refresh_token;

    // The rotated-away token still works inside the 10 s reuse interval, so two
    // tabs refreshing together both stay signed in (§4.3). This one goes over
    // raw HTTP: the client would first refresh its own stored session, which is
    // the behaviour of `getSession()` inside the 90 s expiry margin, not the
    // server rule under test.
    const reused = await fetch(`${server.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: FAKE_PUBLISHABLE_KEY, [TEST_TAG_HEADER]: tag },
      body: JSON.stringify({ refresh_token: firstRefreshToken }),
    });
    expect(reused.status, 'a token reused inside the interval still works').toBe(200);
    const reusedBody = (await reused.json()) as { refresh_token?: string };
    expect(reusedBody.refresh_token, 'a reuse inside the interval does not rotate again').toBe(currentRefreshToken);

    // The next token the control API hands out carries the lifetime it was
    // given, which is what the E2E refresh and session_ended rows rely on.
    await control('/token-lifetime', { seconds: 2, tag });
    const shortLived = await client.auth.refreshSession();
    expect(shortLived.error).toBeNull();
    expect(shortLived.data.session?.expires_in).toBe(2);
    const shortLivedAccessToken = shortLived.data.session!.access_token;
    const afterRefresh = await callsFor(tag);
    expect(afterRefresh.calls.token_refresh).toBeGreaterThanOrEqual(3);

    // Local sign-out: the session stops existing. The client refreshes its
    // 2-second token first (the expiry margin again), so only the logout count
    // is pinned here.
    const signedOut = await client.auth.signOut({ scope: 'local' });
    expect(signedOut.error).toBeNull();
    const afterSignOut = await callsFor(tag);
    expect(afterSignOut.calls.logout).toBe(1);
    expect(afterSignOut.sessions.every((entry) => !entry.active)).toBe(true);

    // The access token of a signed-out session is exactly what the api's
    // `auth_server` liveness adapter asks about (R2).
    const probe = await fetch(`${server.url}/auth/v1/user`, {
      headers: { authorization: `Bearer ${shortLivedAccessToken}`, apikey: FAKE_PUBLISHABLE_KEY },
    });
    expect(probe.status).toBe(403);
    expect(probe.headers.get('x-supabase-api-version')).toBe('2024-01-01');
    const probeBody = (await probe.json()) as { code?: string; error_code?: string };
    expect(probeBody.code).toBe('session_not_found');
    expect(probeBody.error_code).toBe('session_not_found');

    // A refresh after the session ended fails, which is what `proxy.ts` turns
    // into `/internal/sign-in?outcome=session_ended` (R12).
    const deadRefresh = await fetch(`${server.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: FAKE_PUBLISHABLE_KEY, [TEST_TAG_HEADER]: tag },
      body: JSON.stringify({ refresh_token: shortLived.data.session!.refresh_token }),
    });
    expect(deadRefresh.status).toBe(400);
    expect(((await deadRefresh.json()) as { code?: string }).code).toBe('refresh_token_not_found');
  });

  it('M2-AC02/2 simulated harness self-test: the token, logout and user endpoints require the publishable key', async () => {
    // GoTrue refuses these three without the project's API key, and the web's
    // Supabase client sends it on every one of them. Nothing else asserts the web
    // side of that wiring, so a renamed variable or a stale key would leave every
    // simulated row green and fail at the first real sign-in.
    const cases: { path: string; init: RequestInit }[] = [
      { path: '/auth/v1/token?grant_type=refresh_token', init: { method: 'POST', body: '{}' } },
      { path: '/auth/v1/logout?scope=local', init: { method: 'POST' } },
      { path: '/auth/v1/user', init: {} },
    ];

    for (const { path, init } of cases) {
      const missing = await fetch(`${server.url}${path}`, init);
      expect(missing.status, `${path} with no apikey`).toBe(401);
      expect(((await missing.json()) as { code?: string }).code).toBe('no_api_key');

      const wrong = await fetch(`${server.url}${path}`, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), apikey: 'sb_publishable_not_this_project_key' },
      });
      expect(wrong.status, `${path} with the wrong apikey`).toBe(401);
      expect(((await wrong.json()) as { code?: string }).code).toBe('invalid_api_key');
    }

    // The browser-facing endpoints carry no key, because a navigation cannot send
    // one, so the rule must not reach them.
    const jwks = await fetch(`${server.url}/auth/v1/.well-known/jwks.json`);
    expect(jwks.status).toBe(200);
  });

  it('M2-AC02/3 simulated harness self-test: cancelling answers access_denied on the callback URL', async () => {
    const tag = `self-test-cancel-${Date.now()}`;
    const jar = memoryCookieJar();
    const client = newClient(jar, tag);
    const { data } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
    });
    const form = await openConsent(data.url!, tag);
    const response = await fetch(new URL(form.cancel, server.url), {
      redirect: 'manual',
      headers: { [TEST_TAG_HEADER]: tag },
    });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.origin + location.pathname).toBe(REDIRECT_TO);
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('error_description')).toBeTruthy();
    expect(location.searchParams.get('code')).toBeNull();
  });

  it('M2-AC02/1 simulated harness self-test: a flow state gone at consent time comes back on the SITE URL root', async () => {
    // The behaviour the founder's real walk found (2026-09-26, Supabase dev
    // project): once the PKCE flow state has expired GoTrue no longer holds the
    // flow, so it cannot honour its `redirect_to` and puts the provider error on
    // the project's Site URL instead. The whole fix rests on this being what the
    // vendor does, so the fake reproduces the captured request exactly and this
    // row pins it against the string copied from the browser's network log.
    const CAPTURED = `${APP_ORIGIN}/?${SITE_URL_QUERY}`;

    const tag = `self-test-site-url-${Date.now()}`;
    await control('/flows/expire-to-site-url', { tag });

    const jar = memoryCookieJar();
    const client = newClient(jar, tag);
    const { data } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
    });
    const form = await openConsent(data.url!, tag);

    // Consent is COMPLETED, not cancelled: the person picked their account and
    // only then discovered the flow was gone.
    const location = await submitConsent(form, { user: 'alice' }, tag);
    expect(location, 'character for character, the request the real project sent').toBe(CAPTURED);

    const landed = new URL(location);
    // The Site URL root, derived from the flow's own redirect_to origin — not
    // `/auth/callback`, which is the whole point.
    expect(landed.pathname).toBe('/');
    expect(landed.pathname).not.toBe(new URL(REDIRECT_TO).pathname);
    expect(landed.searchParams.get('error')).toBe('invalid_request');
    expect(landed.searchParams.get('error_code')).toBe('bad_oauth_state');
    expect(landed.searchParams.get('error_description')).toBe('OAuth state has expired');
    // No code was minted, so nothing could be exchanged and no session exists.
    expect(landed.searchParams.get('code')).toBeNull();
    expect((await callsFor(tag)).sessions).toHaveLength(0);

    // One-shot, per tag, like every other knob: the next flow of the same tag is
    // ordinary again, so one armed row cannot leak into the next.
    const again = await walkToCode(tag);
    const exchanged = await again.client.auth.exchangeCodeForSession(again.code);
    expect(exchanged.error, 'the control is armed once, not for ever').toBeNull();

    // A named site_url is honoured too, which is what a project whose Site URL is
    // not the callback's own origin would do.
    const namedTag = `self-test-site-url-named-${Date.now()}`;
    await control('/flows/expire-to-site-url', { tag: namedTag, site_url: 'http://127.0.0.1:3199/somewhere' });
    const namedJar = memoryCookieJar();
    const namedClient = newClient(namedJar, namedTag);
    const named = await namedClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
    });
    const namedForm = await openConsent(named.data.url!, namedTag);
    const namedLocation = await submitConsent(namedForm, { user: 'alice' }, namedTag);
    expect(namedLocation, 'a named Site URL keeps its own path').toBe(`http://127.0.0.1:3199/somewhere?${SITE_URL_QUERY}`);
  });

  it('M2-AC03/1 simulated harness self-test: Carol, Dave and Erin each have a consent button and sign in as themselves', async () => {
    // The M2-03 organisation testers (m2-03-code-review.md R13). Each is a distinct
    // subject with its own verified address, so an org row keyed by `sub` and an
    // invitation matched on the verified `email` claim see three different people.
    for (const name of ['carol', 'dave', 'erin'] as const) {
      const user = FAKE_USERS[name];
      const { client, code } = await walkToCode(`self-test-${name}-${Date.now()}`, name);

      const exchanged = await client.auth.exchangeCodeForSession(code);
      expect(exchanged.error, name).toBeNull();
      const claims = await client.auth.getClaims();
      expect(claims.error, name).toBeNull();
      expect(claims.data?.claims['sub'], name).toBe(user.id);
      expect(claims.data?.claims['email'], name).toBe(user.email);
      expect(exchanged.data.session?.user.user_metadata['full_name'], name).toBe(user.fullName);
    }

    // All three are on the suite's allow-list; Mallory stays the one refused identity.
    expect(allowlistedEmails()).toEqual(
      expect.arrayContaining([FAKE_USERS.carol.email, FAKE_USERS.dave.email, FAKE_USERS.erin.email]),
    );
    expect(allowlistedEmails()).not.toContain(FAKE_USERS.mallory.email);
    // Six distinct subjects and six distinct addresses.
    const users = Object.values(FAKE_USERS);
    expect(new Set(users.map((user) => user.id)).size).toBe(users.length);
    expect(new Set(users.map((user) => user.email)).size).toBe(users.length);
  });

  it('M2-AC02/3 simulated harness self-test: an expired flow state and a wrong verifier answer the GoTrue codes', async () => {
    const expiredTag = `self-test-expired-${Date.now()}`;
    await control('/flows/expire-next', { tag: expiredTag });
    const expired = await walkToCode(expiredTag);
    const expiredResult = await expired.client.auth.exchangeCodeForSession(expired.code);
    expect(expiredResult.error?.code).toBe('flow_state_expired');
    expect(expiredResult.error?.status).toBe(422);

    // A verifier from another flow: what a second browser or a second sign-in
    // produces, and what the `wrong_browser` copy explains (R11). One client
    // completes the OTHER client's code, so each holds the wrong verifier —
    // exactly the cross-browser case, with no cookie surgery.
    const wrongTag = `self-test-verifier-${Date.now()}`;
    const started = await walkToCode(wrongTag);
    const elsewhere = await walkToCode(`${wrongTag}-other`);
    const mismatch = await elsewhere.client.auth.exchangeCodeForSession(started.code);
    expect(mismatch.error?.code).toBe('bad_code_verifier');
    expect(mismatch.error?.status).toBe(400);

    // An unknown code is flow_state_not_found, which the callback maps to
    // `expired`. The client used here still holds its own verifier, so the
    // request reaches the server instead of failing locally.
    const unknown = await started.client.auth.exchangeCodeForSession('00000000-0000-4000-8000-00000000dead');
    expect(unknown.error?.code).toBe('flow_state_not_found');
    expect(unknown.error?.status).toBe(404);
  });
});
