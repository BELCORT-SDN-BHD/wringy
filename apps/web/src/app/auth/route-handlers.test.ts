import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateRequestSupabaseOptions } from '@/lib/auth/supabase-server';

/**
 * The four M2-02 route handlers, driven as what they are: plain functions of a
 * `Request`. Three things are mocked and nothing else — the cookie store
 * (`next/headers` only works inside a real request), the Supabase client, and
 * `fetch` to the API. The guards, the cookie options, the redirects and the
 * outcome mapping are all the real code.
 */

// --- The cookie store the handlers read -------------------------------------
const incoming = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [...incoming].map(([name, value]) => ({ name, value })),
      get: (name: string) => (incoming.has(name) ? { name, value: incoming.get(name) } : undefined),
    }),
  headers: () => Promise.resolve(new Headers()),
}));

// --- The Supabase client ----------------------------------------------------
interface AuthCalls {
  signInWithOAuth: number;
  exchangeCodeForSession: number;
  signOut: { scope?: string }[];
}
const calls: AuthCalls = { signInWithOAuth: 0, exchangeCodeForSession: 0, signOut: [] };

let authBehaviour: {
  signInWithOAuth?: (options: CreateRequestSupabaseOptions) => unknown;
  exchangeCodeForSession?: (options: CreateRequestSupabaseOptions) => unknown;
  signOut?: () => unknown;
};

vi.mock('@/lib/auth/supabase-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/supabase-server')>();
  return {
    ...actual,
    createRequestSupabase: (options: CreateRequestSupabaseOptions) => ({
      auth: {
        signInWithOAuth: () => {
          calls.signInWithOAuth += 1;
          return Promise.resolve(authBehaviour.signInWithOAuth?.(options) ?? { data: null, error: null });
        },
        exchangeCodeForSession: () => {
          calls.exchangeCodeForSession += 1;
          return Promise.resolve(authBehaviour.exchangeCodeForSession?.(options) ?? { data: null, error: null });
        },
        signOut: (options_: { scope?: string }) => {
          calls.signOut.push(options_);
          return Promise.resolve(authBehaviour.signOut?.() ?? { error: null });
        },
      },
    }),
  };
});

const { POST: signIn } = await import('./sign-in/route');
const { GET: callback } = await import('./callback/route');
const { POST: signOut } = await import('./sign-out/route');
const { POST: probe, probeResultOf } = await import('../(internal)/internal/session-probe/route');
const { GET: endSession, endingOutcome } = await import('./end-session/route');

const APP_ORIGIN = 'http://127.0.0.1:3100';
const SUPABASE_URL = 'https://project.supabase.co';
const SESSION_COOKIE = 'sb-project-auth-token';
const AUTHORIZE_URL = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${APP_ORIGIN}/auth/callback`)}`;
const NO_STORE = 'private, no-cache, no-store, must-revalidate, max-age=0';

const PROFILE = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Alice Tan',
  contactEmail: 'alice@example.test',
  status: 'active',
  lastSignInAt: '2026-09-25T01:00:00.000Z',
  createdAt: '2026-09-20T01:00:00.000Z',
  localePref: null,
  localePrefSetAt: null,
};

function internalEnv(): void {
  vi.stubEnv('WRINGY_APP_MODE', 'internal');
  vi.stubEnv('WRINGY_ENV', 'ci');
  vi.stubEnv('API_INTERNAL_URL', 'http://127.0.0.1:3200');
  vi.stubEnv('SUPABASE_URL', SUPABASE_URL);
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fake_0123456789abcdef');
  vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
}

/** A same-origin browser form post. */
function post(path: string, { form, headers }: { form?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const body = form === undefined ? undefined : new URLSearchParams(form);
  return new Request(`${APP_ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: APP_ORIGIN, ...headers },
    body,
  });
}

/** A top-level navigation from the provider: no Origin, which is expected on the callback. */
const get = (path: string) => new Request(`${APP_ORIGIN}${path}`, { method: 'GET' });

/** Stub the API. Returns the calls so a test can prove none happened. */
function stubApi(handler: (url: string, init: RequestInit) => Response) {
  const apiCalls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', (input: string | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    apiCalls.push({ url, init });
    return Promise.resolve(handler(url, init));
  });
  return apiCalls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The session cookies `exchangeCodeForSession` writes through the jar. */
const writesSession = (options: CreateRequestSupabaseOptions) => {
  options.cookies.setAll([{ name: SESSION_COOKIE, value: 'new-session', options: { path: '/' } }], {});
  return { data: { session: { access_token: 'token-abc' } }, error: null };
};

function expectNoStore(response: Response, label = ''): void {
  expect(response.headers.get('cache-control'), label).toBe(NO_STORE);
  expect(response.headers.get('expires'), label).toBe('0');
  expect(response.headers.get('pragma'), label).toBe('no-cache');
}

beforeEach(() => {
  incoming.clear();
  calls.signInWithOAuth = 0;
  calls.exchangeCodeForSession = 0;
  calls.signOut = [];
  authBehaviour = {};
  internalEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('M2-AC02/3 origin: the demo build exposes none of these endpoints', () => {
  it('M2-AC02/3 origin: all four handlers answer 404 in demo mode, before any other work', async () => {
    vi.stubEnv('WRINGY_APP_MODE', 'demo');
    const apiCalls = stubApi(() => json(200, {}));

    const responses = {
      'sign-in': await signIn(post('/auth/sign-in', { form: { next: '/internal' } })),
      callback: await callback(get('/auth/callback?code=abc')),
      'sign-out': await signOut(post('/auth/sign-out')),
      probe: await probe(post('/internal/session-probe')),
    };

    for (const [name, response] of Object.entries(responses)) {
      expect(response.status, name).toBe(404);
      expectNoStore(response, name);
      expect(await response.json(), name).toEqual({
        error: { code: 'not_found', message: 'This endpoint does not exist in this build.' },
      });
    }
    // Nothing upstream was touched: no Supabase call, no API call, no cookie written.
    expect(calls).toEqual({ signInWithOAuth: 0, exchangeCodeForSession: 0, signOut: [] });
    expect(apiCalls).toHaveLength(0);
  });
});

describe('M2-AC02/3 origin: a cross-site post is refused before anything upstream is called', () => {
  it('M2-AC02/3 origin: Origin: https://evil.example is 403 with no upstream call', async () => {
    const apiCalls = stubApi(() => json(200, {}));
    incoming.set(SESSION_COOKIE, 'good');

    const cases = [
      { name: 'sign-in', response: await signIn(post('/auth/sign-in', { headers: { origin: 'https://evil.example' } })) },
      { name: 'sign-out', response: await signOut(post('/auth/sign-out', { headers: { origin: 'https://evil.example' } })) },
      { name: 'probe', response: await probe(post('/internal/session-probe', { headers: { origin: 'https://evil.example' } })) },
    ];

    for (const { name, response } of cases) {
      expect(response.status, name).toBe(403);
      expect((await response.json()).error.code, name).toBe('forbidden');
      // A refusal writes no cookie at all.
      expect(response.headers.getSetCookie(), name).toEqual([]);
    }
    // The mocked upstreams were never reached: §4.5 rule 4.
    expect(calls.signInWithOAuth).toBe(0);
    expect(calls.signOut).toEqual([]);
    expect(apiCalls).toHaveLength(0);
  });

  it('M2-AC02/3 origin: no Origin plus Sec-Fetch-Site: cross-site is 403 with no upstream call', async () => {
    const apiCalls = stubApi(() => json(200, {}));
    const request = new Request(`${APP_ORIGIN}/auth/sign-out`, {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site' },
    });

    const response = await signOut(request);

    expect(response.status).toBe(403);
    expect(calls.signOut).toEqual([]);
    expect(apiCalls).toHaveLength(0);
  });
});

describe('M2-AC02/1 sign-in: starting sign-in writes the return path and sends the browser to Google', () => {
  it('M2-AC02/1 sign-in: answers 303 to the authorize URL and stores next in a scoped cookie', async () => {
    authBehaviour.signInWithOAuth = (options) => {
      // The PKCE verifier lands in a cookie through setAll, as the library does.
      options.cookies.setAll([{ name: `${SESSION_COOKIE}-code-verifier`, value: 'verifier', options: { path: '/' } }], {});
      return { data: { url: AUTHORIZE_URL, provider: 'google' }, error: null };
    };

    const response = await signIn(post('/auth/sign-in', { form: { next: '/internal/campaigns?tab=rules' } }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(AUTHORIZE_URL);
    expect(calls.signInWithOAuth).toBe(1);

    const next = response.cookies.get('wringy-auth-next');
    expect(next?.value).toBe('/internal/campaigns?tab=rules');
    expect(next?.httpOnly).toBe(true);
    expect(next?.sameSite).toBe('lax');
    expect(next?.path).toBe('/auth');
    expect(next?.maxAge).toBe(600);
    // A loopback APP_ORIGIN cannot set Secure, or the browser would store nothing.
    expect(next?.secure).toBe(false);

    // The PKCE verifier the library wrote travels on this same 303, so the browser
    // that starts sign-in is the only one that can finish it. (That it is httpOnly
    // is a property of createRequestSupabase, which is mocked here and is covered
    // directly by withSessionCookieOptions in supabase-server.test.ts.)
    expect(response.cookies.get(`${SESSION_COOKIE}-code-verifier`)?.value).toBe('verifier');
  });

  it('M2-AC02/3 cache: the response that writes those cookies is never cacheable', async () => {
    authBehaviour.signInWithOAuth = () => ({ data: { url: AUTHORIZE_URL }, error: null });

    const response = await signIn(post('/auth/sign-in', { form: { next: '/internal' } }));

    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
    expectNoStore(response);
  });

  it('M2-AC02/1 sign-in: a form with no next still starts sign-in, and writes no next cookie', async () => {
    authBehaviour.signInWithOAuth = () => ({ data: { url: AUTHORIZE_URL }, error: null });

    const response = await signIn(post('/auth/sign-in', { form: {} }));

    expect(response.status).toBe(303);
    expect(response.cookies.get('wringy-auth-next')).toBeUndefined();
  });

  it('M2-AC02/1 sign-in: a provider error shows the unexpected outcome instead of redirecting nowhere', async () => {
    authBehaviour.signInWithOAuth = () => ({ data: null, error: { name: 'AuthApiError', code: 'validation_failed' } });

    const response = await signIn(post('/auth/sign-in', { form: { next: '/internal' } }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in?outcome=unexpected`);
    expectNoStore(response);
  });
});

describe('M2-AC02/1 callback: each way the provider leg can end shows its own localized page', () => {
  it('M2-AC02/1 cancel: error=access_denied shows the cancelled outcome and exchanges nothing', async () => {
    const response = await callback(get('/auth/callback?error=access_denied&error_description=denied'));

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get('location') as string).searchParams.get('outcome')).toBe('cancelled');
    expect(calls.exchangeCodeForSession).toBe(0);
    expectNoStore(response);
  });

  it('M2-AC02/1 expired: flow_state_not_found in the query shows the expired outcome', async () => {
    const response = await callback(get('/auth/callback?error=server_error&error_code=flow_state_not_found'));

    expect(new URL(response.headers.get('location') as string).searchParams.get('outcome')).toBe('expired');
    expect(calls.exchangeCodeForSession).toBe(0);
  });

  it('M2-AC02/1 expired: flow_state_expired from the exchange shows the expired outcome', async () => {
    authBehaviour.exchangeCodeForSession = () => ({
      data: null,
      error: { name: 'AuthApiError', code: 'flow_state_expired', status: 422 },
    });

    const response = await callback(get('/auth/callback?code=abc'));

    expect(new URL(response.headers.get('location') as string).searchParams.get('outcome')).toBe('expired');
    expect(calls.exchangeCodeForSession).toBe(1);
  });

  it('M2-AC02/1 wrong_browser: bad_code_verifier and a missing verifier both say wrong_browser', async () => {
    for (const error of [
      { name: 'AuthApiError', code: 'bad_code_verifier', status: 400 },
      { name: 'AuthPKCECodeVerifierMissingError' },
    ]) {
      authBehaviour.exchangeCodeForSession = () => ({ data: null, error });

      const response = await callback(get('/auth/callback?code=abc'));

      expect(new URL(response.headers.get('location') as string).searchParams.get('outcome'), error.name).toBe(
        'wrong_browser',
      );
    }
  });

  it('M2-AC02/1 callback: a missing code is unexpected, and nothing is exchanged', async () => {
    const response = await callback(get('/auth/callback'));

    expect(new URL(response.headers.get('location') as string).searchParams.get('outcome')).toBe('unexpected');
    expect(calls.exchangeCodeForSession).toBe(0);
  });

  it('M2-AC02/1 callback: a successful sign-in returns to the stored path and drops the next cookie', async () => {
    authBehaviour.exchangeCodeForSession = writesSession;
    incoming.set('wringy-auth-next', '/internal/campaigns?tab=rules');
    const apiCalls = stubApi(() => json(200, { profile: PROFILE }));

    const response = await callback(get('/auth/callback?code=abc'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/campaigns?tab=rules`);

    // Fastify owns the decision, and got the new token.
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0].url).toBe('http://127.0.0.1:3200/identity/sign-in');
    expect(apiCalls[0].init.method).toBe('POST');
    expect((apiCalls[0].init.headers as Record<string, string>).authorization).toBe('Bearer token-abc');

    // The session cookie stays; the one-shot next cookie is expired.
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe('new-session');
    expect(response.cookies.get('wringy-auth-next')?.maxAge).toBe(0);
    expectNoStore(response);
  });

  it('M2-AC02/3 callback: next=//evil.example and next=https://evil.example never leave APP_ORIGIN', async () => {
    for (const hostile of [
      '//evil.example',
      'https://evil.example/steal',
      '/\\evil.example',
      'javascript:alert(1)',
      '/internal\r\nSet-Cookie: a=b',
    ]) {
      authBehaviour.exchangeCodeForSession = writesSession;
      incoming.set('wringy-auth-next', hostile);
      stubApi(() => json(200, { profile: PROFILE }));

      const response = await callback(get('/auth/callback?code=abc'));

      const location = new URL(response.headers.get('location') as string);
      expect(location.origin, hostile).toBe(APP_ORIGIN);
      expect(location.pathname, hostile).toBe('/internal');
    }
  });

  it('M2-AC02/3 callback: a next whose dot segments resolve to //host still lands on APP_ORIGIN', async () => {
    // The callback resolves the stored path against APP_ORIGIN in one step and never
    // re-parses the pathname it gets, so the `//evil.example` a dot segment leaves is
    // a path on this origin, not a host (the locale handler's re-parse is the one that
    // needed a second safeNextPath).
    for (const hostile of ['/internal/..//evil.example', '/.//evil.example/x', '/%2e%2e//evil.example']) {
      authBehaviour.exchangeCodeForSession = writesSession;
      incoming.set('wringy-auth-next', hostile);
      stubApi(() => json(200, { profile: PROFILE }));

      const response = await callback(get('/auth/callback?code=abc'));

      const location = new URL(response.headers.get('location') as string);
      expect(location.origin, hostile).toBe(APP_ORIGIN);
      expect(location.host, hostile).toBe('127.0.0.1:3100');
    }
  });

  it('M2-AC02/1 callback: 403 sign_in.not_allowed signs the local session out and says not_allowed', async () => {
    authBehaviour.exchangeCodeForSession = writesSession;
    stubApi(() => json(403, { error: { code: 'sign_in.not_allowed', message: 'x' } }));

    const response = await callback(get('/auth/callback?code=abc'));

    expect(new URL(response.headers.get('location') as string).searchParams.get('outcome')).toBe('not_allowed');
    // Local scope only: a refused first sign-in must not sign other devices out.
    expect(calls.signOut).toEqual([{ scope: 'local' }]);
    // This response writes cookies twice (the session, then its removal), which is
    // exactly where @supabase/ssr's latched cache headers would go missing (R20).
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
    expectNoStore(response);
  });

  it('M2-AC02/1 callback: 403 account.disabled does the same and says disabled', async () => {
    authBehaviour.exchangeCodeForSession = writesSession;
    stubApi(() => json(403, { error: { code: 'account.disabled', message: 'x' } }));

    const response = await callback(get('/auth/callback?code=abc'));

    expect(new URL(response.headers.get('location') as string).searchParams.get('outcome')).toBe('disabled');
    expect(calls.signOut).toEqual([{ scope: 'local' }]);
  });

  it('M2-AC02/2 callback: when signOut fails, the refused session’s cookies are expired anyway', async () => {
    authBehaviour.exchangeCodeForSession = writesSession;
    authBehaviour.signOut = () => ({ error: { name: 'AuthRetryableFetchError' } });
    incoming.set(SESSION_COOKIE, 'the-refused-session');
    stubApi(() => json(403, { error: { code: 'sign_in.not_allowed', message: 'x' } }));

    const response = await callback(get('/auth/callback?code=abc'));

    // The browser must not keep a session the API will refuse.
    const expired = response.cookies.get(SESSION_COOKIE);
    expect(expired?.maxAge).toBe(0);
    expect(expired?.value).toBe('');
    expectNoStore(response);
  });

  it('M2-AC02/1 callback: an unreachable or failing API clears the session and says unexpected', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const answer of [() => json(500, {}), () => json(503, { error: { code: 'database_unavailable' } })]) {
      authBehaviour.exchangeCodeForSession = writesSession;
      incoming.set(SESSION_COOKIE, 'fresh-but-unusable');
      authBehaviour.signOut = () => ({ error: null });
      stubApi(answer);

      const response = await callback(get('/auth/callback?code=abc'));

      expect(new URL(response.headers.get('location') as string).searchParams.get('outcome')).toBe('unexpected');
      expect(calls.signOut.at(-1)).toEqual({ scope: 'local' });
    }
  });
});

describe('M2-AC02/2 logout: signing out ends this device’s session and says so', () => {
  it('M2-AC02/1 signed_out: a confirmed sign-out redirects to the signed_out outcome', async () => {
    incoming.set(SESSION_COOKIE, 'good');

    const response = await signOut(post('/auth/sign-out'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in?outcome=signed_out`);
    expect(calls.signOut).toEqual([{ scope: 'local' }]);
    expectNoStore(response);
  });

  it('M2-AC02/2 logout: when signOut errors, the sb-* cookies are expired here and the outcome says unconfirmed', async () => {
    // The library can return an error WITHOUT having cleared the cookies. A browser
    // left holding a session after being told it signed out is the worse failure.
    authBehaviour.signOut = () => ({ error: { name: 'AuthRetryableFetchError', status: 502 } });
    incoming.set(SESSION_COOKIE, 'good');
    incoming.set(`${SESSION_COOKIE}.1`, 'chunk');
    incoming.set('wringy-locale', 'en-MY');

    const response = await signOut(post('/auth/sign-out'));

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in?outcome=signed_out_unconfirmed`);
    for (const name of [SESSION_COOKIE, `${SESSION_COOKIE}.1`]) {
      expect(response.cookies.get(name)?.maxAge, name).toBe(0);
      expect(response.cookies.get(name)?.value, name).toBe('');
    }
    // Only Supabase's own cookies: the language choice is not part of the session.
    expect(response.cookies.get('wringy-locale')).toBeUndefined();
    expectNoStore(response);
  });

  it('M2-AC02/2 logout: a signOut that throws is treated exactly like one that errors', async () => {
    authBehaviour.signOut = () => {
      throw new Error('network down');
    };
    incoming.set(SESSION_COOKIE, 'good');

    const response = await signOut(post('/auth/sign-out'));

    expect(response.headers.get('location')).toContain('outcome=signed_out_unconfirmed');
    expect(response.cookies.get(SESSION_COOKIE)?.maxAge).toBe(0);
  });
});

describe('M2-AC02/2 revoked: the session probe proves a command re-checks liveness', () => {
  /** The session cookie as @supabase/ssr writes it. */
  const storedSession = (accessToken: string) =>
    `base64-${Buffer.from(JSON.stringify({ access_token: accessToken }), 'utf8').toString('base64url')}`;

  it('M2-AC02/2 revoked: forwards the cookie token and reports ok on a 200', async () => {
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));
    const apiCalls = stubApi(() => json(200, { ok: true, checkedAt: '2026-09-25T01:00:00.000Z' }));

    const response = await probe(post('/internal/session-probe'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal?probe=ok`);
    expect(apiCalls[0].url).toBe('http://127.0.0.1:3200/me/session/probe');
    expect(apiCalls[0].init.method).toBe('POST');
    expect((apiCalls[0].init.headers as Record<string, string>).authorization).toBe('Bearer token-abc');
    // The probe creates no client and writes no cookie, so it cannot refresh.
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('M2-AC02/2 revoked: a 401 session.revoked reports revoked', async () => {
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubApi(() => json(401, { error: { code: 'session.revoked', message: 'x' } }));

    const response = await probe(post('/internal/session-probe'));

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal?probe=revoked`);
  });

  it('M2-AC02/2 revoked: no session cookie reports unauthenticated without calling the API', async () => {
    const apiCalls = stubApi(() => json(200, {}));

    const response = await probe(post('/internal/session-probe'));

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal?probe=unauthenticated`);
    expect(apiCalls).toHaveLength(0);
  });

  it('M2-AC02/2 revoked: every 503 reports unavailable, never revoked', async () => {
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubApi(() => json(503, { error: { code: 'session_check_unavailable', message: 'x' } }));

    const response = await probe(post('/internal/session-probe'));

    // A transient blip must not tell someone their session ended (R9).
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal?probe=unavailable`);
  });

  it('M2-AC02/2 revoked: the whole result mapping, including what must never be revoked', () => {
    expect(probeResultOf({ kind: 'ok', data: {} })).toBe('ok');
    expect(probeResultOf({ kind: 'error', status: 401, code: 'session.revoked' })).toBe('revoked');
    expect(probeResultOf({ kind: 'error', status: 403, code: 'account.disabled' })).toBe('revoked');
    expect(probeResultOf({ kind: 'error', status: 401, code: 'auth.expired' })).toBe('unauthenticated');
    expect(probeResultOf({ kind: 'error', status: 401, code: 'unauthenticated' })).toBe('unauthenticated');
    expect(probeResultOf({ kind: 'error', status: 403, code: 'profile.missing' })).toBe('unauthenticated');
    for (const failure of ['api-unavailable', 'api-unreachable', 'unexpected'] as const) {
      expect(probeResultOf({ kind: 'failure', failure }), failure).toBe('unavailable');
    }
  });
});


describe('M2-AC02/2 disabled: GET /auth/end-session, the cookie write the /internal read cannot do', () => {
  /** The session cookie as `@supabase/ssr` writes it, which is what the handler reads without refreshing. */
  const storedSession = (accessToken: string) =>
    `base64-${Buffer.from(JSON.stringify({ access_token: accessToken }), 'utf8').toString('base64url')}`;

  const expired = (response: Response, name: string): boolean =>
    response.headers
      .getSetCookie()
      .some((header) => header.startsWith(`${name}=;`) && /Max-Age=0/i.test(header));

  it('M2-AC02/2 disabled: the demo build has no such endpoint, and nothing upstream is called', async () => {
    vi.stubEnv('WRINGY_APP_MODE', 'demo');
    const apiCalls = stubApi(() => json(200, {}));
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));

    const response = await endSession();

    expect(response.status).toBe(404);
    expectNoStore(response);
    expect(apiCalls).toHaveLength(0);
    expect(calls.signOut).toEqual([]);
  });

  it('M2-AC02/2 disabled: a 403 account.disabled signs this device out and names the disabled outcome', async () => {
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const apiCalls = stubApi(() => json(403, { error: { code: 'account.disabled', message: 'x' } }));

    const response = await endSession();

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in?outcome=disabled`);
    expectNoStore(response);
    // The API decided, from the session the browser already had: one read, with the
    // cookie's own token and no refresh.
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0]?.url).toBe('http://127.0.0.1:3200/me');
    expect((apiCalls[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer token-abc');
    // Local only: a refusal on this device must not sign the other devices out.
    expect(calls.signOut).toEqual([{ scope: 'local' }]);
  });

  it('M2-AC02/2 disabled: a sign-out the library could not confirm still clears the session cookie', async () => {
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubApi(() => json(403, { error: { code: 'account.disabled', message: 'x' } }));
    authBehaviour.signOut = () => ({ error: { message: 'the auth server is unwell' } });

    const response = await endSession();

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in?outcome=disabled`);
    expect(expired(response, SESSION_COOKIE), 'the fallback expires the session cookie itself').toBe(true);
  });

  it('M2-AC02/2 disabled: no session cookie means nothing to end, and nothing is called', async () => {
    const apiCalls = stubApi(() => json(200, {}));

    const response = await endSession();

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in`);
    expect(apiCalls).toHaveLength(0);
    expect(calls.signOut).toEqual([]);
  });

  it('M2-AC02/2 disabled: an answer that is not a refusal changes nothing, so a link here cannot sign anyone out', async () => {
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));
    // A body the contract accepts, so this really is the healthy 200 path: with
    // `checkedAt` instead of `expiresAt` the schema fails and the handler would see
    // `unexpected`, exercising a different branch than the name claims.
    const apiCalls = stubApi(() => json(200, { profile: PROFILE, session: { expiresAt: '2026-09-25T02:00:00.000Z' } }));

    const response = await endSession();

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal`);
    expect(apiCalls).toHaveLength(1);
    expect(calls.signOut, 'a live session is left alone').toEqual([]);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('M2-AC02/2 disabled: a 200 the contract refuses is not a refusal either, so nothing is ended', async () => {
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubApi(() => json(200, { profile: PROFILE, session: { checkedAt: '2026-09-25T01:00:00.000Z' } }));

    const response = await endSession();

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal`);
    expect(calls.signOut).toEqual([]);
  });

  it('M2-AC02/2 disabled: an expired access token is not a dead session, so a cross-site link cannot end one', async () => {
    // This handler reads the cookie's token WITHOUT refreshing, and a SameSite=Lax
    // cookie is sent on a top-level navigation from any site. So an idle tab's
    // `401 auth.expired` — the ordinary state after an hour — must leave the
    // session alone; only `403 account.disabled` ends it (R4).
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const code of ['auth.expired', 'session.revoked', 'unauthenticated']) {
      calls.signOut.length = 0;
      stubApi(() => json(401, { error: { code, message: 'x' } }));

      const response = await endSession();

      expect(response.headers.get('location'), code).toBe(`${APP_ORIGIN}/internal`);
      expect(calls.signOut, code).toEqual([]);
      expect(response.headers.getSetCookie(), code).toEqual([]);
    }
  });

  it('M2-AC02/2 disabled: a 503 leaves the session alone, because a blip says nothing about it', async () => {
    incoming.set(SESSION_COOKIE, storedSession('token-abc'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubApi(() => json(503, { error: { code: 'auth_unavailable', message: 'x' } }));

    const response = await endSession();

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal`);
    expect(calls.signOut).toEqual([]);
  });

  it('M2-AC02/2 disabled: the whole mapping — only the disabled account ends a session here', () => {
    expect(endingOutcome({ kind: 'error', status: 403, code: 'account.disabled' })).toBe('disabled');
    // Every 401 leaves it alone: the token was refused, which is not the same as
    // the session being over, and this endpoint takes no parameters and can be
    // reached by a cross-site navigation.
    for (const code of ['auth.expired', 'session.revoked', 'unauthenticated', null]) {
      expect(endingOutcome({ kind: 'error', status: 401, code }), String(code)).toBeNull();
    }
    expect(endingOutcome({ kind: 'ok', data: {} })).toBeNull();
    // The callback owns these two, with their own outcomes; re-answering them here
    // would show the wrong page.
    expect(endingOutcome({ kind: 'error', status: 403, code: 'sign_in.not_allowed' })).toBeNull();
    expect(endingOutcome({ kind: 'error', status: 403, code: 'profile.missing' })).toBeNull();
    for (const status of [500, 503]) {
      expect(endingOutcome({ kind: 'error', status, code: 'auth_unavailable' }), String(status)).toBeNull();
    }
    for (const failure of ['api-unavailable', 'api-unreachable', 'unexpected'] as const) {
      expect(endingOutcome({ kind: 'failure', failure }), failure).toBeNull();
    }
  });
});

// --- M2-04: the language chosen on the sign-in page, and the unsaved choice ------

/** The session cookie as `@supabase/ssr` writes it. */
const storedSessionOf = (accessToken: string) =>
  `base64-${Buffer.from(JSON.stringify({ access_token: accessToken }), 'utf8').toString('base64url')}`;

/** True when `response` expires `name` (an empty value with Max-Age=0). */
const expiresCookie = (response: Response, name: string): boolean =>
  response.headers.getSetCookie().some((header) => header.startsWith(`${name}=;`) && /Max-Age=0/i.test(header));

const setCookieOf = (response: Response, name: string) =>
  (response as unknown as { cookies: { get(name: string): Record<string, unknown> | undefined } }).cookies.get(name);

describe('M2-AC04/2 carry: the sign-in page’s choice is carried into the account by the sign-in it belongs to', () => {
  const CARRIED = { profile: { ...PROFILE, localePref: 'zh-Hans-MY', localePrefSetAt: '2026-09-27T01:00:05.000Z' } };

  /** Route the stub by path: the sign-in, then the locale command. */
  const stubSignIn = (signInAnswer: () => Response, localeAnswer: () => Response = () => json(200, CARRIED)) =>
    stubApi((url) => (url.endsWith('/me/locale') ? localeAnswer() : signInAnswer()));

  const landing = (response: Response) => new URL(response.headers.get('location') as string);

  it('M2-AC04/2 carry: a valid carry that differs is saved with the exchange’s token, and the landing says so with from', async () => {
    authBehaviour.exchangeCodeForSession = writesSession;
    incoming.set('wringy-auth-next', '/internal/invitations/accept?token=inviteToken_0123456789-abcdefghijklmnopqrst');
    incoming.set('wringy-locale-carry', 'zh-Hans-MY');
    const apiCalls = stubSignIn(() =>
      json(200, { profile: { ...PROFILE, localePref: 'ms-MY', localePrefSetAt: '2026-09-26T01:00:00.000Z' } }),
    );

    const response = await callback(get('/auth/callback?code=abc'));

    expect(apiCalls.map((call) => call.url)).toEqual([
      'http://127.0.0.1:3200/identity/sign-in',
      'http://127.0.0.1:3200/me/locale',
    ]);
    expect((apiCalls[1]?.init.headers as Record<string, string>).authorization).toBe('Bearer token-abc');
    expect(JSON.parse(String(apiCalls[1]?.init.body))).toEqual({ locale: 'zh-Hans-MY' });

    const url = landing(response);
    expect(url.origin).toBe(APP_ORIGIN);
    expect(url.pathname).toBe('/internal/invitations/accept');
    // The invitation's own query survives; the outcome and from are set, not concatenated.
    expect(url.searchParams.get('token')).toBe('inviteToken_0123456789-abcdefghijklmnopqrst');
    expect(url.searchParams.get('outcome')).toBe('locale_synced');
    expect(url.searchParams.get('from')).toBe('ms-MY');

    expect(expiresCookie(response, 'wringy-locale-carry'), 'the carry is used once').toBe(true);
    expect(setCookieOf(response, 'wringy-locale-carry')?.path).toBe('/auth');
    expect(expiresCookie(response, 'wringy-locale-session')).toBe(true);
    expect(setCookieOf(response, SESSION_COOKIE)?.value, 'the new session stays').toBe('new-session');
    expectNoStore(response);
  });

  it('M2-AC04/2 carry: an account with no preference lands with from=none', async () => {
    authBehaviour.exchangeCodeForSession = writesSession;
    incoming.set('wringy-locale-carry', 'ms-MY');
    stubSignIn(() => json(200, { profile: PROFILE }));

    const url = landing(await callback(get('/auth/callback?code=abc')));

    expect(url.pathname).toBe('/internal');
    expect(url.searchParams.get('outcome')).toBe('locale_synced');
    expect(url.searchParams.get('from')).toBe('none');
  });

  it('M2-AC04/1 shared device: the carry uses the new sign-in’s token, never the stale session the browser arrived with', async () => {
    // Somebody else's session is still in this browser; the exchange signs the new person in.
    incoming.set(SESSION_COOKIE, storedSessionOf('token-of-somebody-else'));
    incoming.set('wringy-locale-carry', 'zh-Hans-MY');
    authBehaviour.exchangeCodeForSession = writesSession;
    const apiCalls = stubSignIn(() => json(200, { profile: PROFILE }));

    await callback(get('/auth/callback?code=abc'));

    const authorizations = apiCalls.map((call) => (call.init.headers as Record<string, string>).authorization);
    expect(authorizations).toEqual(['Bearer token-abc', 'Bearer token-abc']);
  });

  it('M2-AC04/2 carry: a carry equal to the account’s preference, or none at all, calls nothing more and shows no notice', async () => {
    for (const carry of ['ms-MY', undefined]) {
      incoming.clear();
      authBehaviour.exchangeCodeForSession = writesSession;
      if (carry !== undefined) incoming.set('wringy-locale-carry', carry);
      // A guest preference from an earlier browsing session: never carried.
      incoming.set('wringy-locale', 'zh-Hans-MY');
      const apiCalls = stubSignIn(() =>
        json(200, { profile: { ...PROFILE, localePref: 'ms-MY', localePrefSetAt: '2026-09-26T01:00:00.000Z' } }),
      );

      const response = await callback(get('/auth/callback?code=abc'));

      expect(apiCalls.map((call) => call.url), String(carry)).toEqual(['http://127.0.0.1:3200/identity/sign-in']);
      expect(response.headers.get('location'), String(carry)).toBe(`${APP_ORIGIN}/internal`);
      expect(setCookieOf(response, 'wringy-locale'), 'the guest cookie is left as it is').toBeUndefined();
    }
  });

  it('M2-AC04/2 carry: an invalid carry is expired without calling the API', async () => {
    for (const carry of ['', 'en', 'zh-Hant-MY', '<script>']) {
      incoming.clear();
      authBehaviour.exchangeCodeForSession = writesSession;
      incoming.set('wringy-locale-carry', carry);
      const apiCalls = stubSignIn(() => json(200, { profile: PROFILE }));

      const response = await callback(get('/auth/callback?code=abc'));

      expect(apiCalls, JSON.stringify(carry)).toHaveLength(1);
      expect(expiresCookie(response, 'wringy-locale-carry'), JSON.stringify(carry)).toBe(true);
      expect(landing(response).searchParams.get('outcome'), JSON.stringify(carry)).toBeNull();
    }
  });

  it('M2-AC04/2 carry: a carry that could not be saved keeps the choice for this session and lands with locale_not_saved', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const answer of [
      () => json(401, { error: { code: 'auth.expired', message: 'x' } }),
      () => json(503, { error: { code: 'database_unavailable', message: 'x' } }),
      () => json(500, {}),
    ]) {
      incoming.clear();
      authBehaviour.exchangeCodeForSession = writesSession;
      incoming.set('wringy-locale-carry', 'zh-Hans-MY');
      stubSignIn(() => json(200, { profile: PROFILE }), answer);

      const response = await callback(get('/auth/callback?code=abc'));

      const url = landing(response);
      expect(url.searchParams.get('outcome')).toBe('locale_not_saved');
      expect(url.searchParams.get('from')).toBeNull();
      expect(setCookieOf(response, 'wringy-locale-session')).toMatchObject({ value: 'zh-Hans-MY', httpOnly: true, path: '/' });
      expect(expiresCookie(response, 'wringy-locale-carry')).toBe(true);
      expect(setCookieOf(response, SESSION_COOKIE)?.value, 'the person is signed in all the same').toBe('new-session');
    }
  });

  it('M2-AC04/2 carry: a carry refused as account.disabled signs the new session out, leaves no sb-* cookie and says disabled', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    authBehaviour.exchangeCodeForSession = writesSession;
    authBehaviour.signOut = () => ({ error: { name: 'AuthRetryableFetchError' } });
    incoming.set('wringy-locale-carry', 'zh-Hans-MY');
    stubSignIn(
      () => json(200, { profile: PROFILE }),
      () => json(403, { error: { code: 'account.disabled', message: 'x' } }),
    );

    const response = await callback(get('/auth/callback?code=abc'));

    expect(landing(response).searchParams.get('outcome')).toBe('disabled');
    expect(calls.signOut).toEqual([{ scope: 'local' }]);
    const kept = response.headers.getSetCookie().filter((header) => header.startsWith('sb-') && !/Max-Age=0/i.test(header));
    expect(kept).toEqual([]);
    expect(expiresCookie(response, 'wringy-locale-carry')).toBe(true);
    expect(expiresCookie(response, 'wringy-locale-session')).toBe(true);
  });

  /** True when `response` writes anything at all for `name` (a value or an expiry). */
  const touches = (response: Response, name: string): boolean =>
    response.headers.getSetCookie().some((header) => header.startsWith(`${name}=`));

  it('M2-AC04/1 shared device: a refusal that names the person makes no locale call and spends the carry', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const answers: [string, () => Response][] = [
      ['not_allowed', () => json(403, { error: { code: 'sign_in.not_allowed', message: 'x' } })],
      ['disabled', () => json(403, { error: { code: 'account.disabled', message: 'x' } })],
    ];
    for (const [label, answer] of answers) {
      incoming.clear();
      authBehaviour.exchangeCodeForSession = writesSession;
      incoming.set('wringy-locale-carry', 'zh-Hans-MY');
      incoming.set('wringy-locale-session', 'ms-MY');
      const apiCalls = stubSignIn(answer);

      const response = await callback(get('/auth/callback?code=abc'));

      expect(apiCalls.map((call) => call.url), label).toEqual(['http://127.0.0.1:3200/identity/sign-in']);
      expect(landing(response).searchParams.get('outcome'), label).toBe(label);
      // The choice was this refused person's: it never reaches whoever signs in next.
      expect(expiresCookie(response, 'wringy-locale-carry'), label).toBe(true);
      // The new session was signed out again: whatever was unsaved goes with it.
      expect(expiresCookie(response, 'wringy-locale-session'), label).toBe(true);
      expect(landing(response).searchParams.get('from'), label).toBeNull();
    }
  });

  it('M2-AC04/2 carry: a sign-in the API could not answer keeps the carry for the retry, and makes no locale call', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const answers: [string, () => void][] = [
      ['500', () => stubSignIn(() => json(500, {}))],
      ['503', () => stubSignIn(() => json(503, { error: { code: 'database_unavailable', message: 'x' } }))],
      ['unreachable', () => vi.stubGlobal('fetch', () => Promise.reject(Object.assign(new Error('connect'), { code: 'ECONNREFUSED' })))],
    ];
    for (const [label, arrange] of answers) {
      incoming.clear();
      authBehaviour.exchangeCodeForSession = writesSession;
      incoming.set('wringy-locale-carry', 'zh-Hans-MY');
      incoming.set('wringy-locale-session', 'ms-MY');
      arrange();

      const response = await callback(get('/auth/callback?code=abc'));

      expect(landing(response).searchParams.get('outcome'), label).toBe('unexpected');
      expect(touches(response, 'wringy-locale-carry'), `${label}: the carry is neither spent nor rewritten`).toBe(false);
      // The new session was signed out again all the same, and whatever was unsaved with it.
      expect(expiresCookie(response, 'wringy-locale-session'), label).toBe(true);
    }
  });

  it('M2-AC04/2 carry: the exits before the API knows who it is keep the carry, and nothing else of the language', async () => {
    const exits: [string, () => void][] = [
      ['/auth/callback?error=access_denied', () => {}],
      ['/auth/callback?error=server_error&error_code=flow_state_not_found', () => {}],
      ['/auth/callback', () => {}],
      [
        '/auth/callback?code=abc',
        () => (authBehaviour.exchangeCodeForSession = () => ({ data: null, error: { name: 'AuthApiError', code: 'flow_state_expired', status: 422 } })),
      ],
      [
        '/auth/callback?code=abc',
        () => (authBehaviour.exchangeCodeForSession = () => ({ data: null, error: { name: 'AuthApiError', code: 'bad_code_verifier', status: 400 } })),
      ],
      ['/auth/callback?code=abc', () => (authBehaviour.exchangeCodeForSession = () => ({ data: { session: null }, error: null }))],
    ];
    for (const [index, [path, arrange]] of exits.entries()) {
      incoming.clear();
      authBehaviour = {};
      incoming.set('wringy-locale-carry', 'zh-Hans-MY');
      incoming.set('wringy-locale-session', 'ms-MY');
      arrange();
      const apiCalls = stubApi(() => json(200, {}));

      const response = await callback(get(path));

      const label = `${index}: ${path}`;
      expect(response.status, label).toBe(303);
      expect(touches(response, 'wringy-locale-carry'), `${label}: the carry is kept`).toBe(false);
      // No session ended here, so the session choice is untouched too.
      expect(setCookieOf(response, 'wringy-locale-session'), label).toBeUndefined();
      expect(apiCalls, label).toHaveLength(0);
    }
  });

  it('M2-AC04/2 carry: after a cancelled attempt, the retry carries the choice into the account and says what it replaced', async () => {
    // Gopal (account ms-MY) chose Chinese on the sign-in page, then cancelled at Google.
    incoming.set('wringy-locale-carry', 'zh-Hans-MY');
    const firstCalls = stubApi(() => json(200, {}));

    const cancelled = await callback(get('/auth/callback?error=access_denied'));

    expect(landing(cancelled).searchParams.get('outcome')).toBe('cancelled');
    expect(touches(cancelled, 'wringy-locale-carry'), 'the cancel keeps the carry').toBe(false);
    expect(firstCalls).toHaveLength(0);

    // He signs in again within the ten minutes; the browser still holds the carry.
    authBehaviour.exchangeCodeForSession = writesSession;
    const apiCalls = stubSignIn(() =>
      json(200, { profile: { ...PROFILE, localePref: 'ms-MY', localePrefSetAt: '2026-09-26T01:00:00.000Z' } }),
    );

    const response = await callback(get('/auth/callback?code=abc'));

    expect(apiCalls.map((call) => call.url)).toEqual(['http://127.0.0.1:3200/identity/sign-in', 'http://127.0.0.1:3200/me/locale']);
    expect(JSON.parse(String(apiCalls[1]?.init.body))).toEqual({ locale: 'zh-Hans-MY' });
    expect(landing(response).searchParams.get('outcome')).toBe('locale_synced');
    expect(landing(response).searchParams.get('from')).toBe('ms-MY');
    expect(expiresCookie(response, 'wringy-locale-carry'), 'spent by the sign-in that used it').toBe(true);
  });

  it('M2-AC04/2 carry: a sign-in the API let in spends the carry whether it was used, equal or invalid', async () => {
    for (const carry of ['zh-Hans-MY', 'ms-MY', 'not-a-locale']) {
      incoming.clear();
      authBehaviour.exchangeCodeForSession = writesSession;
      incoming.set('wringy-locale-carry', carry);
      stubSignIn(() => json(200, { profile: { ...PROFILE, localePref: 'ms-MY', localePrefSetAt: '2026-09-26T01:00:00.000Z' } }));

      const response = await callback(get('/auth/callback?code=abc'));

      expect(expiresCookie(response, 'wringy-locale-carry'), carry).toBe(true);
      expect(setCookieOf(response, 'wringy-locale-carry')?.path, carry).toBe('/auth');
    }
  });

  it('M2-AC04/1 shared device: every successful sign-in expires the unsaved choice somebody before left behind', async () => {
    authBehaviour.exchangeCodeForSession = writesSession;
    incoming.set('wringy-locale-session', 'zh-Hans-MY');
    stubSignIn(() => json(200, { profile: PROFILE }));

    const response = await callback(get('/auth/callback?code=abc'));

    expect(expiresCookie(response, 'wringy-locale-session')).toBe(true);
    expect(setCookieOf(response, 'wringy-locale-session')).toMatchObject({ httpOnly: true, path: '/' });
  });
});

describe('M2-AC04/1 shared device: ending a session takes its unsaved language choice with it', () => {
  const languageCookies = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((header) => header.split('=')[0] as string)
      .filter((name) => name.startsWith('wringy-locale'));

  it('M2-AC04/1 shared device: sign-out expires wringy-locale-session and no other language cookie', async () => {
    for (const confirmed of [true, false]) {
      incoming.clear();
      authBehaviour.signOut = () => ({ error: confirmed ? null : { name: 'AuthRetryableFetchError' } });
      incoming.set(SESSION_COOKIE, 'good');
      incoming.set('wringy-locale-session', 'zh-Hans-MY');
      incoming.set('wringy-locale', 'ms-MY');
      incoming.set('wringy-locale-prompt', '1');

      const response = await signOut(post('/auth/sign-out'));

      expect(expiresCookie(response, 'wringy-locale-session'), String(confirmed)).toBe(true);
      expect(languageCookies(response), String(confirmed)).toEqual(['wringy-locale-session']);
    }
  });

  it('M2-AC04/1 shared device: end-session expires it in its sign-out branch', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    incoming.set(SESSION_COOKIE, storedSessionOf('token-abc'));
    incoming.set('wringy-locale-session', 'zh-Hans-MY');
    stubApi(() => json(403, { error: { code: 'account.disabled', message: 'x' } }));

    const response = await endSession();

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in?outcome=disabled`);
    expect(expiresCookie(response, 'wringy-locale-session')).toBe(true);
    expect(languageCookies(response)).toEqual(['wringy-locale-session']);
  });

  it('M2-AC04/1 shared device: end-session with no token, a 200 or a 401 leaves every language cookie alone', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const LIVE = { profile: PROFILE, session: { expiresAt: '2026-09-25T02:00:00.000Z' } };
    const arrangements: [string, () => void][] = [
      ['no token', () => stubApi(() => json(200, {}))],
      ['200', () => (incoming.set(SESSION_COOKIE, storedSessionOf('token-abc')), stubApi(() => json(200, LIVE)))],
      [
        '401',
        () => (
          incoming.set(SESSION_COOKIE, storedSessionOf('token-abc')),
          stubApi(() => json(401, { error: { code: 'auth.expired', message: 'x' } }))
        ),
      ],
    ];
    for (const [label, arrange] of arrangements) {
      incoming.clear();
      incoming.set('wringy-locale-session', 'zh-Hans-MY');
      arrange();

      const response = await endSession();

      expect(languageCookies(response), label).toEqual([]);
    }
  });
});
