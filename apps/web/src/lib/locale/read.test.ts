import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@/lib/auth/api-client';
import { ACCESS_TOKEN_HEADER } from '@/lib/auth/wire';
import type { MeResponse } from '@wringy/contracts';

/**
 * The account read's own bound (M2-04; m2-04-code-review.md R3 rev 2, R13
 * "/1 API stalled"): the language never waits more than 1.5 s for `GET /me`,
 * and on timeout the order continues without the account. `control.failNext`
 * cannot stall the API and the outage instance's closed port answers at once,
 * so the stall is proven here: once with fake timers, once against a real
 * server that sleeps, and once through `resolveInternalLocale()` itself.
 *
 * The bound is the language's only. `/internal`'s page awaits the same `/me`
 * read for its own content under `apiFetch`'s 5 s, so a slow `/me` delays that
 * page's render past 1.5 s; the last row pins exactly that.
 */

/** What `next/headers` hands the code under test: the request's cookies and headers. */
const request = vi.hoisted(() => ({ cookies: new Map<string, string>(), headers: new Headers() }));

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (request.cookies.has(name) ? { name, value: request.cookies.get(name) } : undefined),
      getAll: () => [...request.cookies].map(([name, value]) => ({ name, value })),
    }),
  headers: () => Promise.resolve(request.headers),
}));

const { ACCOUNT_READ_BUDGET_MS, UNKNOWN_ACCOUNT, accountLanguageOf, accountLanguageWithin, readMe, resolveInternalLocale } =
  await import('./read');

const PROFILE = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Fiona Chen',
  contactEmail: 'fiona@example.test',
  status: 'active',
  lastSignInAt: '2026-09-25T01:00:00.000Z',
  createdAt: '2026-09-20T01:00:00.000Z',
  localePref: 'ms-MY',
  localePrefSetAt: '2026-09-26T01:00:00.000Z',
};
const ME = { profile: PROFILE, session: { expiresAt: '2026-09-27T02:00:00.000Z' } };

let server: Server | null = null;

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  request.cookies.clear();
  request.headers = new Headers();
  if (server !== null) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  }
});

/** A local API whose `/me` answers after `delayMs`. */
async function sleepyApi(delayMs: number): Promise<string> {
  server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(ME));
    }, delayMs);
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Internal mode with every variable the sign-in flow needs, against the API at `apiUrl`. */
function stubInternalEnv(apiUrl: string): void {
  vi.stubEnv('WRINGY_APP_MODE', 'internal');
  vi.stubEnv('WRINGY_ENV', 'ci');
  vi.stubEnv('API_INTERNAL_URL', apiUrl);
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fake_0123456789abcdef');
  vi.stubEnv('APP_ORIGIN', 'http://127.0.0.1:3100');
}

describe('M2-AC04/1 API stalled: the language does not wait for a slow account read', () => {
  it('M2-AC04/1 API stalled: a read that never answers is unknown at 1.5 s, and not before', async () => {
    vi.useFakeTimers();
    const never = new Promise<ApiResult<MeResponse>>(() => {});
    let settled: unknown = 'pending';
    void accountLanguageWithin(never).then((value) => {
      settled = value;
    });

    await vi.advanceTimersByTimeAsync(ACCOUNT_READ_BUDGET_MS - 1);
    expect(settled).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual({ preference: 'unknown', setAt: null });
    expect(ACCOUNT_READ_BUDGET_MS).toBe(1_500);
  });

  it('M2-AC04/1 API stalled: an answer inside the budget is the account’s preference and its instant, a refusal or a failure is unknown', async () => {
    const ok = (localePref: string | null, localePrefSetAt: string | null) =>
      Promise.resolve({ kind: 'ok', data: { ...ME, profile: { ...PROFILE, localePref, localePrefSetAt } } } as ApiResult<MeResponse>);
    expect(await accountLanguageWithin(ok('ms-MY', PROFILE.localePrefSetAt))).toEqual({ preference: 'ms-MY', setAt: PROFILE.localePrefSetAt });
    expect(await accountLanguageWithin(ok(null, null))).toEqual({ preference: null, setAt: null });

    expect(accountLanguageOf({ kind: 'error', status: 401, code: 'auth.expired' })).toEqual(UNKNOWN_ACCOUNT);
    expect(accountLanguageOf({ kind: 'error', status: 403, code: 'account.disabled' })).toEqual(UNKNOWN_ACCOUNT);
    for (const failure of ['api-unavailable', 'api-unreachable', 'unexpected'] as const) {
      expect(accountLanguageOf({ kind: 'failure', failure }), failure).toEqual({ preference: 'unknown', setAt: null });
    }
  });

  it('M2-AC04/1 API stalled: against an API that sleeps 3 s, the preference is unknown within the budget and the read still completes for the page', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = await sleepyApi(3_000);
    const read = readMe('token-for-the-simulated-caller', base);

    const started = performance.now();
    const account = await accountLanguageWithin(read);
    const waited = performance.now() - started;

    expect(account).toEqual(UNKNOWN_ACCOUNT);
    expect(waited).toBeGreaterThanOrEqual(ACCOUNT_READ_BUDGET_MS - 50);
    expect(waited).toBeLessThan(ACCOUNT_READ_BUDGET_MS + 1_000);

    // The race did not cancel the read: the page that awaits it gets the answer.
    const result = await read;
    expect(result.kind).toBe('ok');
    expect(accountLanguageOf(result).preference).toBe('ms-MY');
  }, 15_000);

  it('M2-AC04/1 API stalled: against a prompt API, the preference arrives well inside the budget', async () => {
    const base = await sleepyApi(0);
    const started = performance.now();
    expect(await accountLanguageWithin(readMe('token-for-the-simulated-caller', base))).toEqual({
      preference: 'ms-MY',
      setAt: PROFILE.localePrefSetAt,
    });
    expect(performance.now() - started).toBeLessThan(ACCOUNT_READ_BUDGET_MS);
  });

  it('M2-AC04/1 API stalled: with /me answering at 3 s, the language is resolved at 1.5 s without the account, and the page’s own read still completes with the profile', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = await sleepyApi(3_000);
    const token = 'token-for-the-simulated-caller';
    stubInternalEnv(base);
    // A signed-in render (the proxy's token header) in a browser that holds a guest choice.
    request.headers = new Headers({ [ACCESS_TOKEN_HEADER]: token, 'accept-language': 'ms' });
    request.cookies.set('wringy-locale', 'zh-Hans-MY');

    const started = performance.now();
    // `/internal`'s page starts its `/me` read before it awaits its translations
    // (page.tsx). Outside a React request `cache()` does not memoise, so this is a
    // second call of the same reader rather than the shared promise.
    const pageRead = readMe(token, base);
    const resolved = await resolveInternalLocale();
    const resolvedAfter = performance.now() - started;

    expect(resolved).toMatchObject({
      locale: 'zh-Hans-MY',
      source: 'guest',
      accountPreference: 'unknown',
      unsaved: null,
      showPrompt: false,
    });
    expect(resolvedAfter).toBeGreaterThanOrEqual(ACCOUNT_READ_BUDGET_MS - 50);
    expect(resolvedAfter).toBeLessThan(ACCOUNT_READ_BUDGET_MS + 1_000);

    // The bound is the language's only: the page's read keeps apiFetch's 5 s and
    // answers when `/me` does, with the preference the language went without.
    const page = await pageRead;
    const pageAfter = performance.now() - started;
    expect(page.kind).toBe('ok');
    expect(accountLanguageOf(page).preference).toBe('ms-MY');
    expect(pageAfter).toBeGreaterThanOrEqual(3_000 - 50);
  }, 15_000);
});

describe('M2-AC04/2 account: the account read carries the instant the preference was set, so an older unsaved choice does not decide', () => {
  it('M2-AC04/2 account: a stamped session choice older than the account’s localePrefSetAt yields to the account; a newer one decides', async () => {
    const base = await sleepyApi(0);
    stubInternalEnv(base);
    request.headers = new Headers({ [ACCESS_TOKEN_HEADER]: 'token-for-the-simulated-caller' });
    const accountSetAt = Date.parse(PROFILE.localePrefSetAt); // the account holds ms-MY since then

    request.cookies.set('wringy-locale-session', `zh-Hans-MY.${accountSetAt - 1}`);
    expect(await resolveInternalLocale()).toMatchObject({ locale: 'ms-MY', source: 'account', unsaved: null });

    request.cookies.set('wringy-locale-session', `zh-Hans-MY.${accountSetAt + 1}`);
    expect(await resolveInternalLocale()).toMatchObject({ locale: 'zh-Hans-MY', source: 'session', unsaved: 'zh-Hans-MY' });
  });
});

describe('M2-AC04/1 prompt: the sign-in and not-found pages do not ask a browser that holds a session', () => {
  /**
   * spec-7: the proxy renders those two pages without a token whatever the jar
   * holds, so the render cannot read the account. A session cookie there means
   * somebody may be signed in with a saved preference nobody read, which is the
   * prompt's `'unknown'`: not asked. The cookie's name is the one `@supabase/ssr`
   * writes for `SUPABASE_URL` (`sb-<project ref>-auth-token`, or its chunks).
   */
  it('M2-AC04/1 prompt: no token and a session cookie, whole or chunked, is not asked; the PKCE verifier alone or no sb- cookie is a guest, who is', async () => {
    stubInternalEnv('http://127.0.0.1:9');
    request.headers = new Headers({ 'accept-language': 'ms' });

    const guest = await resolveInternalLocale();
    expect(guest).toMatchObject({ locale: 'ms-MY', source: 'browser', accountPreference: 'unknown', showPrompt: true });

    for (const name of ['sb-project-auth-token', 'sb-project-auth-token.0']) {
      request.cookies.clear();
      request.cookies.set(name, 'base64-eyJhY2Nlc3NfdG9rZW4iOiJzdGFsZSJ9');
      const unverified = await resolveInternalLocale();
      expect(unverified, name).toMatchObject({ locale: 'ms-MY', source: 'browser', accountPreference: 'unknown', showPrompt: false });
    }

    // A sign-in that was started and never finished leaves only the verifier: nobody is signed in.
    request.cookies.clear();
    request.cookies.set('sb-project-auth-token-code-verifier', 'verifier');
    expect((await resolveInternalLocale()).showPrompt).toBe(true);
  });
});
