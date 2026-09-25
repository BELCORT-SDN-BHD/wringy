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
