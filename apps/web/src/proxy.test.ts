import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextResponse } from 'next/server';

import type { CreateRequestSupabaseOptions } from '@/lib/auth/supabase-server';
import { ACCESS_TOKEN_HEADER } from '@/lib/auth/wire';

import { config, proxy } from './proxy';

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

/** A signed-in client that needs no refresh. */
const signedIn = (token = 'token-abc'): typeof makeClient => () => ({
  auth: {
    getClaims: () => Promise.resolve({ data: { claims: { sub: 'u1' } }, error: null }),
    getSession: () => Promise.resolve({ data: { session: { access_token: token } }, error: null }),
  },
});

/** A client with no usable session. */
const signedOut: typeof makeClient = () => ({
  auth: {
    getClaims: () => Promise.resolve({ data: null, error: { name: 'AuthSessionMissingError' } }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  },
});

/** A client that refreshes: it writes new cookies through `setAll`, then reports a session. */
const refreshes = (token = 'token-fresh'): typeof makeClient => (options) => ({
  auth: {
    getClaims: () => {
      options.cookies.setAll(
        [{ name: SESSION_COOKIE, value: 'fresh-session-value', options: { path: '/' } }],
        {},
      );
      return Promise.resolve({ data: { claims: { sub: 'u1' } }, error: null });
    },
    getSession: () => Promise.resolve({ data: { session: { access_token: token } }, error: null }),
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

    const response = await proxy(request('/internal'));

    expect(isPassThrough(response)).toBe(true);
    expect(clientCalls).toHaveLength(0);
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
      request('/internal/session-probe', { method: 'POST', cookies: `${SESSION_COOKIE}=good` }),
    );

    expect(isPassThrough(response)).toBe(true);
    expect(clientCalls).toHaveLength(0);
  });

  it('M2-AC02/3 cache: the matcher skips Next’s assets, the favicon and any path with an extension', () => {
    expect(config.matcher).toEqual(['/((?!_next/|favicon\\.ico|.*\\..*).*)']);

    const matches = (pathname: string) => new RegExp(`^${config.matcher[0]}$`).test(pathname);

    expect(matches('/internal')).toBe(true);
    expect(matches('/internal/campaigns')).toBe(true);
    expect(matches('/')).toBe(true);
    expect(matches('/_next/static/chunk.js')).toBe(false);
    expect(matches('/favicon.ico')).toBe(false);
    expect(matches('/robots.txt')).toBe(false);
    expect(matches('/logo.svg')).toBe(false);
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

    const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=old` }));

    // The browser is told.
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe('fresh-session-value');
    // And so is the app: the forwarded `cookie` header carries the new value, so a
    // Server Component reading cookies does not see the stale one.
    expect(forwarded(response).cookie).toContain('fresh-session-value');
  });

  it('M2-AC02/3 cache: a response that writes a cookie is never cacheable', async () => {
    makeClient = refreshes();

    const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=old` }));

    expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
    expect(response.headers.get('expires')).toBe('0');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('M2-AC02/2 refresh: a read that needed no refresh writes no cookie', async () => {
    makeClient = signedIn();

    const response = await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=good` }));

    expect(response.cookies.getAll()).toEqual([]);
    expect(forwarded(response)[ACCESS_TOKEN_HEADER]).toBe('token-abc');
  });

  it('M2-AC02/2 isolation: the client is built per request, on this request’s own cookies', async () => {
    makeClient = signedIn();

    await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=first` }));
    await proxy(request('/internal', { cookies: `${SESSION_COOKIE}=second` }));

    expect(clientCalls).toHaveLength(2);
    expect(clientCalls[0].cookies.getAll()).toEqual([{ name: SESSION_COOKIE, value: 'first' }]);
    expect(clientCalls[1].cookies.getAll()).toEqual([{ name: SESSION_COOKIE, value: 'second' }]);
    // A loopback APP_ORIGIN cannot carry Secure cookies, or the browser stores nothing.
    expect(clientCalls[0].secure).toBe(false);
  });
});

describe('M2-AC02/2 isolation: the identity header can only ever come from the proxy', () => {
  beforeEach(internalEnv);

  it('M2-AC02/2 isolation: a client-supplied token header is replaced on a signed-in read', async () => {
    makeClient = signedIn('token-real');

    const response = await proxy(
      request('/internal', {
        headers: { [ACCESS_TOKEN_HEADER]: 'forged-by-the-client' },
        cookies: `${SESSION_COOKIE}=good`,
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
