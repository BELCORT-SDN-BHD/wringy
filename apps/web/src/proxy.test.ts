import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextResponse } from 'next/server';

import type { CreateRequestSupabaseOptions } from '@/lib/auth/supabase-server';
import { ACCESS_TOKEN_HEADER } from '@/lib/auth/wire';

import { config, FRAMING_HEADERS, proxy, REFRESH_DEADLINE_MS } from './proxy';

/**
 * The request-level Supabase client is the one thing the proxy talks to, so it is
 * the one thing mocked. Everything else — the mode, the environment, the paths,
 * the cookies, the headers — is the real code.
 */
type MockClient = {
  auth: {
    getClaims: () => Promise<{ data: { claims?: unknown } | null; error: unknown }>;
    getSession: () => Promise<{ data: { session: { access_token: string } | null }; error: unknown }>;
  };
};

let makeClient: (options: CreateRequestSupabaseOptions) => MockClient;
const clientCalls: CreateRequestSupabaseOptions[] = [];

vi.mock('@/lib/auth/supabase-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/supabase-server')>();
  return {
    ...actual,
    createRequestSupabase: (options: CreateRequestSupabaseOptions) => {
      clientCalls.push(options);
      return makeClient(options);
    },
  };
});

const APP_ORIGIN = 'http://127.0.0.1:3100';
const SESSION_COOKIE = 'sb-project-auth-token';

/**
 * A session cookie value in the format `@supabase/ssr` writes: the session JSON,
 * `base64url`-encoded behind the library's `base64-` prefix.
 *
 * The proxy reads the access token out of the cookie rather than asking the client
 * for it (`resolveSession` says why), so the arrangement for a signed-in read is a
 * cookie a real one could have been written by — not a placeholder string.
 */
const storedSession = (accessToken: string): string =>
  `base64-${Buffer.from(
    JSON.stringify({
      access_token: accessToken,
      refresh_token: 'refresh-token-value',
      token_type: 'bearer',
      user: { id: 'u1' },
    }),
  ).toString('base64url')}`;

/** A signed-in client that needs no refresh: the token comes from the cookie. */
const signedIn = (): typeof makeClient => () => ({
  auth: {
    getClaims: () => Promise.resolve({ data: { claims: { sub: 'u1' } }, error: null }),
    getSession: () =>
      Promise.reject(new Error('proxy.ts must not call getSession(): it can refresh a second time')),
  },
});

/** A client with no usable session. */
const signedOut: typeof makeClient = () => ({
  auth: {
    getClaims: () => Promise.resolve({ data: null, error: { name: 'AuthSessionMissingError' } }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  },
});

/**
 * A client that could not reach the Auth server: auth-js's own answer for a JWKS
 * fetch that failed, timed out or was aborted (`AuthRetryableFetchError`, status
 * 0 for a transport failure and the response's status for a 5xx).
 */
const authUnavailable = (error: unknown): typeof makeClient => () => ({
  auth: {
    getClaims: () => Promise.resolve({ data: null, error }),
    getSession: () => Promise.resolve({ data: { session: null }, error }),
  },
});

/** A client that refreshes: it writes the rotated session through `setAll`, then reports claims. */
const refreshes = (token = 'token-fresh'): typeof makeClient => (options) => ({
  auth: {
    getClaims: () => {
      options.cookies.setAll([{ name: SESSION_COOKIE, value: storedSession(token), options: { path: '/' } }], {});
      return Promise.resolve({ data: { claims: { sub: 'u1' } }, error: null });
    },
    getSession: () =>
      Promise.reject(new Error('proxy.ts must not call getSession(): it can refresh a second time')),
  },
});

function internalEnv(): void {
  vi.stubEnv('WRINGY_APP_MODE', 'internal');
  vi.stubEnv('WRINGY_ENV', 'ci');
  vi.stubEnv('API_INTERNAL_URL', 'http://127.0.0.1:3200');
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fake_0123456789abcdef');
  vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
}

function request(
  path: string,
  { method = 'GET', headers = {}, cookies }: { method?: string; headers?: Record<string, string>; cookies?: string } = {},
): NextRequest {
  const all = { ...headers };
  if (cookies !== undefined) all.cookie = cookies;
  return new NextRequest(new URL(path, APP_ORIGIN), { method, headers: all });
}

/** The request headers the proxy forwarded to the app, as Next encodes them on the response. */
function forwarded(response: NextResponse): Record<string, string> {
  const overridden = response.headers.get('x-middleware-override-headers');
  if (overridden === null) return {};
  return Object.fromEntries(
    overridden
      .split(',')
      .filter((name) => name !== '')
      .map((name) => [name, response.headers.get(`x-middleware-request-${name}`) ?? '']),
  );
}

/**
 * `config.matcher` compiled the way the build compiles it.
 *
 * Next 16.3.5 exports `getMiddlewareMatchers` from
 * `next/dist/build/analysis/get-page-static-info`, which is what
 * `parseMiddlewareConfig` calls to turn a `config.matcher` into the
 * middleware-manifest entries the router matches against. It is not in that
 * module's `.d.ts`, so the module is cast once, here, rather than in each row.
 */
async function compileMatchers(matcher: readonly string[]): Promise<{ regexp: string }[]> {
  const build = (await import('next/dist/build/analysis/get-page-static-info')) as unknown as {
    getMiddlewareMatchers: (
      matcher: readonly string[],
      nextConfig: Record<string, unknown>,
    ) => { regexp: string }[];
  };
  return build.getMiddlewareMatchers(matcher, {});
}

const isPassThrough = (response: NextResponse) =>
  response.status === 200 && response.headers.get('x-middleware-rewrite') === null;

beforeEach(() => {
  clientCalls.length = 0;
  makeClient = signedIn();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('M2-AC02/3 cache: the demo build is untouched by the proxy', () => {
  it('M2-AC02/3 cache: demo mode passes every path through and creates no Supabase client', async () => {
    vi.stubEnv('WRINGY_APP_MODE', 'demo');

    for (const path of ['/', '/internal', '/internal/campaigns', '/merchant/campaigns', '/auth/sign-in']) {
      const response = await proxy(request(path));
      expect(isPassThrough(response), path).toBe(true);
      // No cookie was read and no header was rewritten: M1 exactly as it was.
      expect(forwarded(response), path).toEqual({});
    }
    expect(clientCalls).toHaveLength(0);
  });

  it('M2-AC02/3 cache: internal mode without its variables passes through, so the page can say so', async () => {
    // The env-less web image must still render /internal's not-configured state.
    vi.stubEnv('WRINGY_APP_MODE', 'internal');
    vi.stubEnv('WRINGY_ENV', 'ci');
    vi.stubEnv('API_INTERNAL_URL', 'http://127.0.0.1:3200');

    for (const path of ['/internal', '/internal/sign-in', '/auth/callback?code=abc']) {
      const response = await proxy(request(path));
      expect(isPassThrough(response), path).toBe(true);
    }
    expect(clientCalls).toHaveLength(0);
  });

  it('M2-AC02/3 cache: internal mode without its variables still never serves the demo build', async () => {
    // A half-configured internal deployment is exactly the state a first deploy is
    // in. The routing shape needs no environment, so it still applies: nothing of
    // the demo build may render on this origin (R12, R13).
    vi.stubEnv('WRINGY_APP_MODE', 'internal');
    vi.stubEnv('WRINGY_ENV', 'ci');
    vi.stubEnv('API_INTERNAL_URL', 'http://127.0.0.1:3200');

    for (const path of ['/merchant/campaigns', '/creator', '/campaigns/abc', '/settings']) {
      const rewrite = (await proxy(request(path))).headers.get('x-middleware-rewrite');
      expect(rewrite, path).not.toBeNull();
      expect(new URL(rewrite as string).pathname, path).toBe('/internal/__not-found');
    }

    // `/` cannot be redirected without APP_ORIGIN (a Location must never be built
    // from the request's host), so it is rewritten to the page that names the
    // missing variables — never to the demo home.
    const root = await proxy(request('/'));
    const rootRewrite = root.headers.get('x-middleware-rewrite');
    expect(rootRewrite).not.toBeNull();
    expect(new URL(rootRewrite as string).pathname).toBe('/internal');
    expect(root.headers.get('location')).toBeNull();
    expect(clientCalls).toHaveLength(0);
  });

  it('M2-AC02/2 isolation: in demo mode a client-supplied token header survives, which is why every reader gates on the mode', async () => {
    // R12 keeps the proxy out of the way in demo mode, so it cannot strip the
    // header either. The guarantee is therefore "trustworthy in internal mode,
    // never read in demo mode" (wire.ts), and the page's `appMode()` check is what
    // enforces the second half.
    vi.stubEnv('WRINGY_APP_MODE', 'demo');

    const response = await proxy(request('/internal', { headers: { [ACCESS_TOKEN_HEADER]: 'forged' } }));

    expect(isPassThrough(response)).toBe(true);
    // Nothing was rewritten at all: the forged header reaches the render untouched.
    expect(response.headers.get('x-middleware-override-headers')).toBeNull();
  });
});

describe('M2-AC02/3 cache: internal mode routes only its own paths', () => {
  beforeEach(internalEnv);

  it('M2-AC02/3 cache: / redirects to /internal with a 307', async () => {
    const response = await proxy(request('/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal`);
    expect(clientCalls).toHaveLength(0);
  });

  it('M2-AC02/3 cache: a demo path is rewritten to the internal not-found page', async () => {
    for (const path of ['/merchant/campaigns', '/creator', '/campaigns/abc', '/settings', '/demo']) {
      const response = await proxy(request(path));

      const rewrite = response.headers.get('x-middleware-rewrite');
      expect(rewrite, path).not.toBeNull();
      expect(new URL(rewrite as string).pathname, path).toBe('/internal/__not-found');
    }
    // A not-found needs no session, so nothing is read.
    expect(clientCalls).toHaveLength(0);
  });

  it('M2-AC02/3 cache: /internal is matched anchored, so /internal-tools is not inside the build', async () => {
    const response = await proxy(request('/internal-tools'));

    const rewrite = response.headers.get('x-middleware-rewrite');
    expect(rewrite).not.toBeNull();
    expect(new URL(rewrite as string).pathname).toBe('/internal/__not-found');
  });

  it('M2-AC02/3 cache: the public sign-in page and the not-found page are never session-checked', async () => {
    for (const path of ['/internal/sign-in', '/internal/sign-in?outcome=cancelled', '/internal/__not-found']) {
      const response = await proxy(request(path, { cookies: `${SESSION_COOKIE}=stale` }));
      expect(isPassThrough(response), path).toBe(true);
    }
    expect(clientCalls).toHaveLength(0);
  });

  it('M2-AC02/3 cache: /auth/… is passed through so the route handler answers for itself', async () => {
    for (const path of ['/auth/sign-in', '/auth/callback?code=abc', '/auth/sign-out']) {
      const response = await proxy(request(path, { method: path === '/auth/callback?code=abc' ? 'GET' : 'POST' }));
      expect(isPassThrough(response), path).toBe(true);
    }
    expect(clientCalls).toHaveLength(0);
  });

  it('M2-AC02/2 isolation: a non-GET on /internal is passed through, never refreshed here', async () => {
    // The probe handler owns its own cookies; refreshing in two places races.
    const response = await proxy(
      request('/internal/session-probe', { method: 'POST', cookies: `${SESSION_COOKIE}=${storedSession('token-abc')}` }),
    );

    expect(isPassThrough(response)).toBe(true);
    expect(clientCalls).toHaveLength(0);
  });

  it('M2-AC02/3 cache: the matcher skips Next’s assets and the favicon, and matches every page path, dots included', async () => {
    // Compiled the way the runtime compiles it, not with a hand-written RegExp
    // over the source. `next build` turns `config.matcher` into the manifest's
    // `regexp` with `getMiddlewareMatchers`, and `getMiddlewareRouteMatcher` then
    // runs `new RegExp(matcher.regexp).exec(pathname)` per request
    // (next/dist/shared/lib/router/utils/middleware-route-matcher.js). Compiling
    // it here is what proves the rev-3 fix: with the previous `.*\..*` exclusion
    // this very regex refused `/campaigns/a.b`, so the proxy never ran on it and
    // the demo catch-all rendered it on an internal origin.
    const compiled = await compileMatchers(config.matcher);
    expect(compiled).toHaveLength(1);
    const matches = (pathname: string) => new RegExp(compiled[0].regexp).test(pathname);

    // Pages, including every dotted path that is not an asset.
    for (const pathname of [
      '/',
      '/internal',
      '/internal/campaigns',
      '/internal/sign-in',
      '/auth/callback',
      '/campaigns/a.b',
      '/foo.bar',
      '/internal/x.y',
      '/merchant/campaigns',
    ]) {
      expect(matches(pathname), pathname).toBe(true);
    }

    // Next's own assets, the favicon, and the file suffixes a browser fetches
    // beside a page — and only when the path ENDS in one of them.
    for (const pathname of [
      '/_next/static/chunk.js',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/logo.png',
      '/logo.svg',
      '/photo.jpeg',
      '/styles.css',
      '/bundle.js.map',
      '/fonts/inter.woff2',
    ]) {
      expect(matches(pathname), pathname).toBe(false);
    }
  });
});

describe('M2-AC02/2 isolation: an unauthenticated read is sent to sign in, from APP_ORIGIN only', () => {
  beforeEach(internalEnv);

  it('M2-AC02/2 isolation: no session redirects to the sign-in page carrying the path asked for', async () => {
    makeClient = signedOut;

    const response = await proxy(request('/internal/campaigns?tab=rules'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') as string);
    expect(location.origin).toBe(APP_ORIGIN);
    expect(location.pathname).toBe('/internal/sign-in');
    expect(location.searchParams.get('next')).toBe('/internal/campaigns?tab=rules');
    // No session cookie existed, so this is not "your session ended".
    expect(location.searchParams.get('outcome')).toBeNull();
  });

  it('M2-AC02/2 isolation: the Location host is APP_ORIGIN even when Host and X-Forwarded-Host are forged', async () => {
    makeClient = signedOut;

    const forgedRequest = new NextRequest(new URL('/internal', 'http://evil.example'), {
      method: 'GET',
      headers: { host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https' },
    });

    const response = await proxy(forgedRequest);

    const location = new URL(response.headers.get('location') as string);
    expect(location.origin).toBe(APP_ORIGIN);
    expect(location.host).not.toContain('evil.example');
  });

  it('M2-AC02/2 isolation: a session cookie that could not be refreshed says session_ended', async () => {
    makeClient = signedOut;

    const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=expired` }));

    const location = new URL(response.headers.get('location') as string);
    expect(location.searchParams.get('outcome')).toBe('session_ended');
    expect(location.searchParams.get('next')).toBe('/internal');
  });

  it('M2-AC02/2 isolation: an Auth server that cannot answer is a retry, never "your session ended"', async () => {
    // R9: a transient Auth-server blip must not sign everyone out. The session is
    // untouched — no cookie is written — so the page offers a retry instead.
    for (const error of [
      { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' },
      { name: 'AuthRetryableFetchError', status: 503 },
      { name: 'AbortError' },
    ]) {
      makeClient = authUnavailable(error);

      const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=${storedSession('token-abc')}` }));

      const location = new URL(response.headers.get('location') as string);
      expect(location.searchParams.get('outcome'), JSON.stringify(error)).toBe('unexpected');
      expect(location.searchParams.get('next')).toBe('/internal');
      expect(response.cookies.getAll()).toEqual([]);
    }
  });

  it('M2-AC02/2 isolation: an abandoned sign-in is not a session that ended', async () => {
    // `sb-…-auth-token-code-verifier` is written when a sign-in STARTS and carries
    // the library's fixed 400-day maxAge. A browser that only holds one never had
    // a session, so it must be told "please sign in", not "you were signed out".
    makeClient = signedOut;

    for (const cookie of [
      `${SESSION_COOKIE}-code-verifier=abc123`,
      `${SESSION_COOKIE}-flows-code-verifier=abc123`,
      `${SESSION_COOKIE}-flow-abcDEF12-code-verifier=abc123`,
    ]) {
      const response = await proxy(request('/internal', { cookies: cookie }));
      const location = new URL(response.headers.get('location') as string);
      expect(location.searchParams.get('outcome'), cookie).toBeNull();
    }

    // The session cookie itself, chunked or not, still says session_ended.
    for (const cookie of [`${SESSION_COOKIE}=expired`, `${SESSION_COOKIE}.0=part`, `${SESSION_COOKIE}.1=part`]) {
      const response = await proxy(request('/internal', { cookies: cookie }));
      const location = new URL(response.headers.get('location') as string);
      expect(location.searchParams.get('outcome'), cookie).toBe('session_ended');
    }
  });

  it('M2-AC02/3 cache: the sign-in redirect is never cacheable', async () => {
    makeClient = signedOut;

    const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=expired` }));

    expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });
});

describe('M2-AC02/2 refresh: a refreshed session reaches the page and the browser together', () => {
  beforeEach(internalEnv);

  it('M2-AC02/2 refresh: refreshed cookies land on both the forwarded request and the response', async () => {
    makeClient = refreshes();

    const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=${storedSession('token-stale')}` }));

    // The browser is told.
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe(storedSession('token-fresh'));
    // And so is the app: the forwarded `cookie` header carries the new value, so a
    // Server Component reading cookies does not see the stale one.
    expect(forwarded(response).cookie).toContain(storedSession('token-fresh'));
  });

  it('M2-AC02/3 cache: a response that writes a cookie is never cacheable', async () => {
    makeClient = refreshes();

    const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=${storedSession('token-stale')}` }));

    expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
    expect(response.headers.get('expires')).toBe('0');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('M2-AC02/2 refresh: a read that needed no refresh writes no cookie', async () => {
    makeClient = signedIn();

    const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=${storedSession('token-abc')}` }));

    expect(response.cookies.getAll()).toEqual([]);
    expect(forwarded(response)[ACCESS_TOKEN_HEADER]).toBe('token-abc');
  });

  it('M2-AC02/2 isolation: the client is built per request, on this request’s own cookies', async () => {
    makeClient = signedIn();

    const first = storedSession('token-first');
    const second = storedSession('token-second');
    const responses = [
      await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=${first}` })),
      await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=${second}` })),
    ];

    expect(clientCalls).toHaveLength(2);
    expect(clientCalls[0].cookies.getAll()).toEqual([{ name: SESSION_COOKIE, value: first }]);
    expect(clientCalls[1].cookies.getAll()).toEqual([{ name: SESSION_COOKIE, value: second }]);
    // And each read forwarded its own request's token, never the other's.
    expect(forwarded(responses[0])[ACCESS_TOKEN_HEADER]).toBe('token-first');
    expect(forwarded(responses[1])[ACCESS_TOKEN_HEADER]).toBe('token-second');
    // A loopback APP_ORIGIN cannot carry Secure cookies, or the browser stores nothing.
    expect(clientCalls[0].secure).toBe(false);
  });
});

describe('M2-AC02/2 isolation: the identity header can only ever come from the proxy', () => {
  beforeEach(internalEnv);

  it('M2-AC02/2 isolation: a client-supplied token header is replaced on a signed-in read', async () => {
    makeClient = signedIn();

    const response = await proxy(
      request('/internal', {
        headers: { [ACCESS_TOKEN_HEADER]: 'forged-by-the-client' },
        cookies: `${SESSION_COOKIE}=${storedSession('token-real')}`,
      }),
    );

    expect(forwarded(response)[ACCESS_TOKEN_HEADER]).toBe('token-real');
  });

  it('M2-AC02/2 isolation: a client-supplied token header is removed on every other matched path', async () => {
    makeClient = signedIn();

    const paths: { path: string; method?: string }[] = [
      { path: '/internal/sign-in' },
      { path: '/internal/__not-found' },
      { path: '/auth/sign-in', method: 'POST' },
      { path: '/internal/session-probe', method: 'POST' },
      { path: '/merchant/campaigns' },
    ];

    for (const { path, method } of paths) {
      const response = await proxy(
        request(path, { method, headers: { [ACCESS_TOKEN_HEADER]: 'forged', 'user-agent': 'test' } }),
      );

      // The proxy rewrote the request headers (so it did look at them) …
      expect(response.headers.get('x-middleware-override-headers'), path).not.toBeNull();
      expect(forwarded(response)['user-agent'], path).toBe('test');
      // … and the forgery is not among the ones the app will see.
      expect(response.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`), path).toBeNull();
      expect(forwarded(response)[ACCESS_TOKEN_HEADER], path).toBeUndefined();
    }
  });

  it('M2-AC02/2 isolation: an unauthenticated read forwards no token at all', async () => {
    makeClient = signedOut;

    const response = await proxy(
      request('/internal', { headers: { [ACCESS_TOKEN_HEADER]: 'forged' } }),
    );

    // It is a redirect: nothing reaches the app, so nothing can carry a token.
    expect(response.status).toBe(307);
    expect(forwarded(response)[ACCESS_TOKEN_HEADER]).toBeUndefined();
    expect(response.headers.get('x-middleware-request-' + ACCESS_TOKEN_HEADER)).toBeNull();
  });
});

describe('M2-AC02/2 refresh: a session check that fails badly still ends in an answer, never a 500', () => {
  beforeEach(internalEnv);

  it('M2-AC02/2 refresh: a getClaims that throws ends the session and expires every sb-* cookie, with no 500', async () => {
    // auth-js is documented to return its errors, and does — except on a cookie
    // value it cannot parse, where JSON.parse raises out of the storage read. A
    // 500 would leave the browser holding the cookie that caused it, so the same
    // request would fail again for ever. The session is ended instead.
    makeClient = () => ({
      auth: {
        getClaims: () => {
          throw new SyntaxError('Unexpected token b in JSON at position 0');
        },
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      },
    });

    const response = await proxy(
      request('/internal/campaigns', {
        cookies: `${SESSION_COOKIE}=truncated; ${SESSION_COOKIE}-code-verifier=abc; other=keep`,
      }),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') as string);
    expect(location.origin).toBe(APP_ORIGIN);
    expect(location.pathname).toBe('/internal/sign-in');
    expect(location.searchParams.get('outcome')).toBe('session_ended');
    expect(location.searchParams.get('next')).toBe('/internal/campaigns');

    // Every sb-* cookie is expired — the session and the PKCE verifier alike —
    // and nothing else is touched.
    const expired = response.cookies.getAll();
    expect(expired.map((cookie) => cookie.name).sort()).toEqual(
      [SESSION_COOKIE, `${SESSION_COOKIE}-code-verifier`].sort(),
    );
    for (const cookie of expired) {
      expect(cookie.value, cookie.name).toBe('');
      expect(cookie.maxAge, cookie.name).toBe(0);
      expect(cookie.httpOnly, cookie.name).toBe(true);
      expect(cookie.path, cookie.name).toBe('/');
    }
    expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
  });

  it('M2-AC02/2 refresh: a getClaims that never answers hits the overall deadline, offers a retry and applies no cookie', async () => {
    // Per-call bounds are not enough: getClaims() can make two calls, so only an
    // overall deadline bounds the page. And a refresh that has not finished must
    // leave the browser exactly as it was — half a rotation is worse than none.
    vi.useFakeTimers();
    try {
      makeClient = (options) => ({
        auth: {
          getClaims: () => {
            // It got far enough to buffer a rotated session, and then stalled.
            options.cookies.setAll([{ name: SESSION_COOKIE, value: 'half-written', options: { path: '/' } }], {});
            return new Promise(() => {});
          },
          getSession: () => new Promise(() => {}),
        },
      });

      const pending = proxy(request('/internal', { cookies: `${SESSION_COOKIE}=${storedSession('token-stale')}` }));
      await vi.advanceTimersByTimeAsync(REFRESH_DEADLINE_MS);
      const response = await pending;

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location') as string);
      expect(location.searchParams.get('outcome'), 'a deadline says nothing about this session').toBe('unexpected');
      expect(location.searchParams.get('next')).toBe('/internal');
      expect(response.cookies.getAll(), 'not one buffered write is applied').toEqual([]);
      expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
      // The client was told to stop, so the stalled call is not left running
      // behind the answer.
      expect(clientCalls).toHaveLength(1);
      expect(clientCalls[0].signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('M2-AC02/3 cache: the internal build is private and unframeable on every response the proxy produces', () => {
  beforeEach(internalEnv);

  it('M2-AC02/3 cache: a signed-in read that needed no refresh is still no-store (R20 rev 3)', async () => {
    makeClient = signedIn();

    const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=${storedSession('token-abc')}` }));

    expect(isPassThrough(response)).toBe(true);
    expect(response.cookies.getAll(), 'nothing was written this time').toEqual([]);
    // And it is no-store anyway: the property is Wringy's, not the library's.
    expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
    expect(response.headers.get('expires')).toBe('0');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('M2-AC02/3 cache: every internal-mode response refuses framing — rewrites, redirects and the forwarded read', async () => {
    const cases: { label: string; response: NextResponse }[] = [
      { label: 'signed-in read', response: await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=${storedSession('token-abc')}` })) },
      { label: 'public sign-in page', response: await proxy(request('/internal/sign-in')) },
      { label: 'auth route handler', response: await proxy(request('/auth/sign-out', { method: 'POST' })) },
      { label: 'root redirect', response: await proxy(request('/')) },
      { label: 'demo path rewrite', response: await proxy(request('/merchant/campaigns')) },
      { label: 'dotted demo path rewrite', response: await proxy(request('/campaigns/a.b')) },
    ];
    for (const { label, response } of cases) {
      expect(response.headers.get('content-security-policy'), label).toBe("frame-ancestors 'none'");
      expect(response.headers.get('x-frame-options'), label).toBe('DENY');
    }

    // The unauthenticated redirect to the sign-in page carries them too.
    makeClient = signedOut;
    const redirected = await proxy(request('/internal'));
    expect(redirected.status).toBe(307);
    expect(redirected.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
    expect(redirected.headers.get('x-frame-options')).toBe('DENY');

    // Both headers, stated once in the module so a page and a test cannot drift.
    expect(FRAMING_HEADERS).toEqual({
      'Content-Security-Policy': "frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
    });
  });

  it('M2-AC02/3 cache: demo mode adds no framing headers, because the proxy does nothing there', async () => {
    vi.stubEnv('WRINGY_APP_MODE', 'demo');

    const response = await proxy(request('/merchant/campaigns'));

    expect(isPassThrough(response)).toBe(true);
    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(response.headers.get('x-frame-options')).toBeNull();
  });
});
