import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `POST /internal/locale` (M2-04; m2-04-code-review.md R4 rev 2, R13 "web
 * unit"), driven as what it is: a plain function of a `Request`. Two things are
 * mocked and nothing else — the cookie store (`next/headers` only works inside a
 * real request) and `fetch` to the API. The guard, the token read, the cookie
 * options, the JSON-or-303 rule and the redirects are the real code.
 *
 * Every identity here is simulated: the access token is a string in a cookie of
 * the shape `@supabase/ssr` writes, and the API is a stub.
 */

const incoming = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [...incoming].map(([name, value]) => ({ name, value })),
      get: (name: string) => (incoming.has(name) ? { name, value: incoming.get(name) } : undefined),
    }),
  headers: () => Promise.resolve(new Headers()),
}));

const { POST: switchLocale, asksForJson, reasonOf, rendersSignedOut, returnPathname } = await import('./route');

const APP_ORIGIN = 'http://127.0.0.1:3100';
const API = 'http://127.0.0.1:3200';
const SUPABASE_URL = 'https://project.supabase.co';
const SESSION_COOKIE = 'sb-project-auth-token';
const NO_STORE = 'private, no-cache, no-store, must-revalidate, max-age=0';
/** The caller's access token, as the session cookie carries it. Never to appear in a URL or a log line. */
const ACCESS_TOKEN = 'access-token-for-the-simulated-caller';

/** What Chromium sends on a form navigation (captured by the stack critic, record §1). */
const NAVIGATION_ACCEPT =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=7';

const PROFILE = {
  id: '0f10a000-0000-4000-8000-000000000007',
  displayName: 'Fiona Chen',
  contactEmail: 'fiona@example.test',
  status: 'active',
  lastSignInAt: '2026-09-27T01:00:00.000Z',
  createdAt: '2026-09-20T01:00:00.000Z',
  localePref: 'zh-Hans-MY',
  localePrefSetAt: '2026-09-27T01:00:05.000Z',
};

function internalEnv(): void {
  vi.stubEnv('WRINGY_APP_MODE', 'internal');
  vi.stubEnv('WRINGY_ENV', 'ci');
  vi.stubEnv('API_INTERNAL_URL', API);
  vi.stubEnv('SUPABASE_URL', SUPABASE_URL);
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fake_0123456789abcdef');
  vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
}

const storedSession = (accessToken: string) =>
  `base64-${Buffer.from(JSON.stringify({ access_token: accessToken }), 'utf8').toString('base64url')}`;

const signIn = () => incoming.set(SESSION_COOKIE, storedSession(ACCESS_TOKEN));

type Mode = 'json' | 'form';

/** A same-origin post: the client's `fetch` (`json`) or a plain form navigation (`form`). */
function post(
  form: Record<string, string>,
  { mode = 'json', headers = {} }: { mode?: Mode; headers?: Record<string, string> } = {},
): Request {
  const asked =
    mode === 'json'
      ? { accept: 'application/json', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin' }
      : { accept: NAVIGATION_ACCEPT, 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'same-origin' };
  return new Request(`${APP_ORIGIN}/internal/locale`, {
    method: 'POST',
    headers: { origin: APP_ORIGIN, ...asked, ...headers },
    body: new URLSearchParams(form),
  });
}

const choose = (locale: string, next = '/internal') => ({ intent: 'choose', locale, next });

interface ApiCall {
  url: string;
  init: RequestInit;
}

function stubApi(answer: () => Response): ApiCall[] {
  const calls: ApiCall[] = [];
  vi.stubGlobal('fetch', (input: string | URL, init: RequestInit = {}) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), init });
    return Promise.resolve(answer());
  });
  return calls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refusal = (status: number, code: string) => () => json(status, { error: { code, message: 'x' } });
const saved = () => json(200, { profile: PROFILE });

/** The cookie a response sets (value and attributes), or undefined. */
const cookie = (response: Response, name: string) =>
  (response as unknown as { cookies: { get(name: string): Record<string, unknown> | undefined } }).cookies.get(name);

const setCookieNames = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((header) => header.split('=')[0])
    .sort();

const isExpiry = (response: Response, name: string) => {
  const set = cookie(response, name);
  return set !== undefined && set.value === '' && set.maxAge === 0;
};

function expectNoStore(response: Response, label = ''): void {
  expect(response.headers.get('cache-control'), label).toBe(NO_STORE);
}

beforeEach(() => {
  incoming.clear();
  internalEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('M2-AC04/2 locale handler: guarded like every other write path', () => {
  it('M2-AC04/2 locale handler: the demo build has no such endpoint, and nothing is written or called', async () => {
    vi.stubEnv('WRINGY_APP_MODE', 'demo');
    const calls = stubApi(saved);
    signIn();

    const response = await switchLocale(post(choose('ms-MY')));

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('not_found');
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(calls).toHaveLength(0);
    expectNoStore(response);
  });

  it('M2-AC04/2 locale handler: a cross-site post is 403 before anything is read, written or called', async () => {
    const calls = stubApi(saved);
    signIn();

    for (const headers of [{ origin: 'https://evil.example' }, { origin: 'null' }]) {
      const response = await switchLocale(post(choose('ms-MY'), { headers }));
      expect(response.status, headers.origin).toBe(403);
      expect(response.headers.getSetCookie(), headers.origin).toEqual([]);
      expectNoStore(response, headers.origin);
    }
    const noOrigin = new Request(`${APP_ORIGIN}/internal/locale`, {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site', accept: 'application/json' },
      body: new URLSearchParams(choose('ms-MY')),
    });
    expect((await switchLocale(noOrigin)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('M2-AC04/2 locale handler: a locale that is not one of the three, or an unknown intent, is 400 and writes nothing', async () => {
    const calls = stubApi(saved);
    signIn();

    const forms: Record<string, string>[] = [
      choose('en'),
      choose('en-US'),
      choose('zh-Hant-MY'),
      choose('zh-hans-my'),
      choose(''),
      { intent: 'choose', next: '/internal' },
      { intent: 'save', locale: 'ms-MY', next: '/internal' },
      { locale: 'ms-MY', next: '/internal' },
    ];
    for (const form of forms) {
      for (const mode of ['json', 'form'] as const) {
        const response = await switchLocale(post(form, { mode }));
        const label = `${mode} ${JSON.stringify(form)}`;
        expect(response.status, label).toBe(400);
        expect((await response.json()).error.code, label).toBe('bad_request');
        expect(response.headers.getSetCookie(), label).toEqual([]);
        expectNoStore(response, label);
      }
    }
    expect(calls).toHaveLength(0);
  });
});

describe('M2-AC04/2 locale handler: skip records no preference in any scope', () => {
  it('M2-AC04/2 locale handler: skip sets only the prompt cookie, signed out or signed in, and calls nothing', async () => {
    const calls = stubApi(saved);
    for (const signedIn of [false, true]) {
      incoming.clear();
      if (signedIn) signIn();

      const response = await switchLocale(post({ intent: 'skip', locale: 'ms-MY', next: '/internal/sign-in' }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ skipped: true });
      expect(setCookieNames(response), `signed in: ${signedIn}`).toEqual(['wringy-locale-prompt']);
      const prompt = cookie(response, 'wringy-locale-prompt');
      expect(prompt).toMatchObject({ value: '1', httpOnly: true, sameSite: 'lax', path: '/', secure: false });
      expect(prompt?.maxAge, 'a browsing-session cookie').toBeUndefined();
      expectNoStore(response);
    }
    expect(calls).toHaveLength(0);
  });

  it('M2-AC04/2 locale handler: a skip form goes back to the page it came from, with no outcome', async () => {
    const response = await switchLocale(post({ intent: 'skip', next: '/internal/sign-in' }, { mode: 'form' }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in`);
    expect(setCookieNames(response)).toEqual(['wringy-locale-prompt']);
  });
});

describe('M2-AC04/2 locale handler: a signed-out choice is the guest’s, in this browser', () => {
  it('M2-AC04/2 locale handler: signed-out choose sets the guest, carry and prompt cookies and expires the session choice', async () => {
    const calls = stubApi(saved);
    incoming.set('wringy-locale-session', 'en-MY'); // A stranger's leftover: this choice replaces it.

    const response = await switchLocale(post(choose('zh-Hans-MY', '/internal/sign-in')));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ switched: true, locale: 'zh-Hans-MY', scope: 'guest', saved: true });
    expect(calls, 'a guest choice has no account to save to').toHaveLength(0);

    expect(cookie(response, 'wringy-locale')).toMatchObject({
      value: 'zh-Hans-MY',
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure: false,
      maxAge: 60 * 60 * 24 * 365,
    });
    expect(cookie(response, 'wringy-locale-carry')).toMatchObject({
      value: 'zh-Hans-MY',
      httpOnly: true,
      sameSite: 'lax',
      path: '/auth',
      maxAge: 600,
    });
    expect(cookie(response, 'wringy-locale-prompt')).toMatchObject({ value: '1', httpOnly: true, path: '/' });
    expect(isExpiry(response, 'wringy-locale-session')).toBe(true);
    expect(cookie(response, 'wringy-locale-session')).toMatchObject({ httpOnly: true, path: '/' });
    expectNoStore(response);
  });

  it('M2-AC04/2 locale handler: a signed-out choice form lands on the page with locale_switched', async () => {
    const response = await switchLocale(post(choose('ms-MY', '/internal/sign-in'), { mode: 'form' }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in?outcome=locale_switched`);
    expect(cookie(response, 'wringy-locale')?.value).toBe('ms-MY');
    expectNoStore(response);
  });

  it('M2-AC04/2 locale handler: an abandoned sign-in’s verifier cookie is not a session, so the choice is the guest’s', async () => {
    const calls = stubApi(saved);
    incoming.set(`${SESSION_COOKIE}-code-verifier`, 'verifier');

    const response = await switchLocale(post(choose('ms-MY')));

    expect((await response.json()).scope).toBe('guest');
    expect(calls).toHaveLength(0);
  });

  it('M2-AC04/2 locale handler: an https origin gets Secure cookies', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://internal.wringy.example');
    const request = new Request('https://internal.wringy.example/internal/locale', {
      method: 'POST',
      headers: { origin: 'https://internal.wringy.example', accept: 'application/json', 'sec-fetch-mode': 'cors' },
      body: new URLSearchParams(choose('ms-MY')),
    });

    const response = await switchLocale(request);

    for (const name of ['wringy-locale', 'wringy-locale-carry', 'wringy-locale-prompt', 'wringy-locale-session']) {
      expect(cookie(response, name)?.secure, name).toBe(true);
    }
  });
});

describe('M2-AC04/2 locale handler: a signed-in choice is saved to the account, or the page says it is not', () => {
  it('M2-AC04/2 locale handler: signed-in choose posts to the API with the stored token and never writes the guest cookie', async () => {
    signIn();
    incoming.set('wringy-locale-session', 'en-MY'); // An earlier unsaved choice: the account now holds this one.
    const calls = stubApi(saved);

    const response = await switchLocale(post(choose('zh-Hans-MY')));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ switched: true, locale: 'zh-Hans-MY', scope: 'account', saved: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${API}/me/locale`);
    expect(calls[0]?.init.method).toBe('POST');
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ locale: 'zh-Hans-MY' });

    expect(cookie(response, 'wringy-locale'), 'never the guest cookie for a signed-in choice').toBeUndefined();
    expect(cookie(response, 'wringy-locale-carry')).toBeUndefined();
    expect(isExpiry(response, 'wringy-locale-session'), 'the account holds it now').toBe(true);
    expect(cookie(response, 'wringy-locale-prompt')?.value).toBe('1');
    expectNoStore(response);
  });

  it('M2-AC04/2 locale handler: a save that changes nothing is still a success, and the session choice goes', async () => {
    // This browser's own choice once failed to save; the account holds that language now.
    for (const mode of ['json', 'form'] as const) {
      incoming.clear();
      signIn();
      incoming.set('wringy-locale-session', 'zh-Hans-MY');
      const calls = stubApi(saved); // PROFILE.localePref is already zh-Hans-MY.

      const response = await switchLocale(post(choose('zh-Hans-MY'), { mode }));

      expect(calls, mode).toHaveLength(1);
      if (mode === 'json') {
        expect(await response.json()).toEqual({ switched: true, locale: 'zh-Hans-MY', scope: 'account', saved: true });
      } else {
        expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal?outcome=locale_saved`);
      }
      expect(isExpiry(response, 'wringy-locale-session'), mode).toBe(true);
    }
  });

  it('M2-AC04/2 locale handler: a saved choice form lands on the page with locale_saved', async () => {
    signIn();
    stubApi(saved);

    const response = await switchLocale(post(choose('ms-MY', '/internal/orgs/0c0ffee0-0000-4000-8000-00000000000a'), { mode: 'form' }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${APP_ORIGIN}/internal/orgs/0c0ffee0-0000-4000-8000-00000000000a?outcome=locale_saved`,
    );
  });

  it('M2-AC04/2 locale handler: an API failure writes the session choice and answers saved: false with its reason', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows: [() => Response, string][] = [
      [refusal(503, 'session_check_unavailable'), 'unavailable'],
      [refusal(503, 'database_unavailable'), 'unavailable'],
      [() => json(500, {}), 'unexpected'],
      [refusal(403, 'profile.missing'), 'unexpected'],
      [refusal(400, 'bad_request'), 'unexpected'],
      [() => json(200, { profile: { id: 'not-a-profile' } }), 'unexpected'],
    ];
    for (const [answer, reason] of rows) {
      incoming.clear();
      signIn();
      stubApi(answer);

      const response = await switchLocale(post(choose('ms-MY')));

      expect(response.status, reason).toBe(200);
      expect(await response.json(), reason).toEqual({ switched: true, locale: 'ms-MY', scope: 'account', saved: false, reason });
      expect(cookie(response, 'wringy-locale-session'), reason).toMatchObject({
        value: 'ms-MY',
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
      expect(cookie(response, 'wringy-locale-session')?.maxAge, 'a browsing-session cookie').toBeUndefined();
      expect(cookie(response, 'wringy-locale'), reason).toBeUndefined();
      expect(cookie(response, 'wringy-locale-prompt')?.value, reason).toBe('1');
    }
  });

  it('M2-AC04/2 locale handler: an unreachable API is unexpected, and the language is still switched', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    signIn();
    vi.stubGlobal('fetch', () => Promise.reject(Object.assign(new Error('connect'), { code: 'ECONNREFUSED' })));

    const response = await switchLocale(post(choose('ms-MY')));

    expect(await response.json()).toMatchObject({ saved: false, reason: 'unexpected' });
    expect(cookie(response, 'wringy-locale-session')?.value).toBe('ms-MY');
  });

  it('M2-AC04/2 locale handler: a 401 is session_ended as JSON and locale_not_saved as a form — never the org copy that says nothing changed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const code of ['auth.expired', 'session.revoked', 'unauthenticated']) {
      incoming.clear();
      signIn();
      stubApi(refusal(401, code));
      const asJson = await switchLocale(post(choose('ms-MY')));
      expect(await asJson.json(), code).toMatchObject({ saved: false, reason: 'session_ended' });
      expect(cookie(asJson, 'wringy-locale-session')?.value, code).toBe('ms-MY');

      stubApi(refusal(401, code));
      const asForm = await switchLocale(post(choose('ms-MY', '/internal'), { mode: 'form' }));
      expect(asForm.status, code).toBe(303);
      expect(asForm.headers.get('location'), code).toBe(`${APP_ORIGIN}/internal?outcome=locale_not_saved`);
      expect(cookie(asForm, 'wringy-locale-session')?.value, code).toBe('ms-MY');
    }
  });

  it('M2-AC04/2 locale handler: a session cookie with no usable token is session_ended without calling the API', async () => {
    incoming.set(SESSION_COOKIE, 'truncated');
    const calls = stubApi(saved);

    const response = await switchLocale(post(choose('ms-MY')));

    expect(await response.json()).toMatchObject({ scope: 'account', saved: false, reason: 'session_ended' });
    expect(calls).toHaveLength(0);
  });

  it('M2-AC04/2 locale handler: a disabled account is account_disabled as JSON and a 303 to end-session as a form', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    signIn();
    stubApi(refusal(403, 'account.disabled'));
    const asJson = await switchLocale(post(choose('ms-MY')));
    expect(asJson.status).toBe(200);
    expect(await asJson.json()).toEqual({ switched: true, locale: 'ms-MY', scope: 'account', saved: false, reason: 'account_disabled' });

    stubApi(refusal(403, 'account.disabled'));
    const asForm = await switchLocale(post(choose('ms-MY'), { mode: 'form' }));
    expect(asForm.status).toBe(303);
    expect(asForm.headers.get('location')).toBe(`${APP_ORIGIN}/auth/end-session`);
    expectNoStore(asForm);
  });

  it('M2-AC04/2 locale handler: the whole reason mapping', () => {
    expect(reasonOf({ kind: 'ok', data: {} })).toBeNull();
    expect(reasonOf({ kind: 'failure', failure: 'api-unavailable' })).toBe('unavailable');
    expect(reasonOf({ kind: 'failure', failure: 'api-unreachable' })).toBe('unexpected');
    expect(reasonOf({ kind: 'failure', failure: 'unexpected' })).toBe('unexpected');
    for (const code of ['auth.expired', 'session.revoked', null]) {
      expect(reasonOf({ kind: 'error', status: 401, code }), String(code)).toBe('session_ended');
    }
    expect(reasonOf({ kind: 'error', status: 403, code: 'account.disabled' })).toBe('account_disabled');
    for (const [status, code] of [
      [403, 'profile.missing'],
      [403, null],
      [400, 'bad_request'],
      [404, 'not_found'],
      [409, 'account.disabled'],
    ] as const) {
      expect(reasonOf({ kind: 'error', status, code }), `${status} ${code}`).toBe('unexpected');
    }
  });
});

describe('M2-AC04/1 shared device: a choice from a page that renders signed out is the guest’s, whatever cookie arrived', () => {
  /** The pages `proxy.ts` renders without a session check, as their switchers post them. */
  const SIGNED_OUT_PAGES = ['/internal/sign-in', '/internal/__not-found', '/campaigns', '/internal-tools'];

  /** Somebody's session in the jar: still valid, or stale (the token no longer decodes). */
  const SESSIONS: [string, () => void][] = [
    ['a live session', () => signIn()],
    ['a stale session', () => incoming.set(SESSION_COOKIE, 'truncated')],
  ];

  it('M2-AC04/1 shared device: over somebody’s session, a choice on the sign-in or not-found page calls nothing and sets the guest, carry and prompt cookies', async () => {
    for (const next of SIGNED_OUT_PAGES) {
      for (const [label, arrange] of SESSIONS) {
        incoming.clear();
        arrange();
        const calls = stubApi(saved);

        const response = await switchLocale(post(choose('zh-Hans-MY', next)));

        const row = `${next}, ${label}`;
        expect(calls, `${row}: no API call with the cookie that arrived`).toHaveLength(0);
        expect(await response.json(), row).toEqual({ switched: true, locale: 'zh-Hans-MY', scope: 'guest', saved: true });
        expect(cookie(response, 'wringy-locale')?.value, row).toBe('zh-Hans-MY');
        expect(cookie(response, 'wringy-locale-carry'), row).toMatchObject({ value: 'zh-Hans-MY', path: '/auth', maxAge: 600 });
        expect(cookie(response, 'wringy-locale-prompt')?.value, row).toBe('1');
        expect(isExpiry(response, 'wringy-locale-session'), row).toBe(true);
        expectNoStore(response, row);
      }
    }
  });

  it('M2-AC04/1 shared device: the same choice as a form lands back on that page with locale_switched', async () => {
    signIn();
    const calls = stubApi(saved);

    for (const next of ['/internal/sign-in', '/internal/__not-found']) {
      const response = await switchLocale(post(choose('ms-MY', next), { mode: 'form' }));
      expect(response.status, next).toBe(303);
      expect(response.headers.get('location'), next).toBe(`${APP_ORIGIN}${next}?outcome=locale_switched`);
      expect(cookie(response, 'wringy-locale-carry')?.value, next).toBe('ms-MY');
    }
    expect(calls).toHaveLength(0);
  });

  it('M2-AC04/2 locale handler: an ordinary internal page keeps the signed-in branch', async () => {
    for (const next of ['/internal', '/internal/orgs/0c0ffee0-0000-4000-8000-00000000000a', '/internal/invitations/accept', '/internal/sign-in-help']) {
      incoming.clear();
      signIn();
      const calls = stubApi(saved);

      const response = await switchLocale(post(choose('zh-Hans-MY', next)));

      expect(calls.map((call) => call.url), next).toEqual([`${API}/me/locale`]);
      expect((await response.json()).scope, next).toBe('account');
      expect(cookie(response, 'wringy-locale-carry'), next).toBeUndefined();
    }
  });

  it('M2-AC04/1 shared device: the handler’s signed-out pages are exactly the ones the proxy renders without a session check', async () => {
    // Drift guard: run the real proxy on the pages the handler treats as signed out,
    // with a session cookie in the jar, and check none of them is forwarded a token.
    const { proxy } = await import('@/proxy');
    const { NextRequest } = await import('next/server');
    const tokenHeaderForwarded = (response: Response) =>
      (response.headers.get('x-middleware-override-headers') ?? '').split(',').includes('x-wringy-access-token');

    for (const path of SIGNED_OUT_PAGES) {
      const request = new NextRequest(new URL(path, APP_ORIGIN), { headers: { cookie: `${SESSION_COOKIE}=${storedSession(ACCESS_TOKEN)}` } });
      const response = await proxy(request);
      expect(response.status, path).toBe(200);
      expect(tokenHeaderForwarded(response), path).toBe(false);
      const rewrite = response.headers.get('x-middleware-rewrite');
      const rendered = rewrite === null ? path : new URL(rewrite).pathname;
      expect(rendersSignedOut(rendered), `${path} renders ${rendered}`).toBe(true);
      expect(rendersSignedOut(path), path).toBe(true);
    }
    for (const path of ['/internal', '/internal/orgs/abc', '/internal/sign-in/x', '/internal/__not-found/x']) {
      expect(rendersSignedOut(path), path).toBe(false);
    }
  });
});

describe('M2-AC04/2 locale handler: a request that asked for JSON never gets a 3xx', () => {
  /** One arrangement per branch the handler has. */
  const BRANCHES: { name: string; arrange: () => void; form: Record<string, string> }[] = [
    { name: 'skip', arrange: () => stubApi(saved), form: { intent: 'skip', next: '/internal' } },
    { name: 'guest choose', arrange: () => stubApi(saved), form: choose('ms-MY') },
    { name: 'account saved', arrange: () => (signIn(), stubApi(saved)), form: choose('ms-MY') },
    { name: 'account 401', arrange: () => (signIn(), stubApi(refusal(401, 'auth.expired'))), form: choose('ms-MY') },
    { name: 'account disabled', arrange: () => (signIn(), stubApi(refusal(403, 'account.disabled'))), form: choose('ms-MY') },
    { name: 'account 503', arrange: () => (signIn(), stubApi(refusal(503, 'database_unavailable'))), form: choose('ms-MY') },
    { name: 'account 500', arrange: () => (signIn(), stubApi(() => json(500, {}))), form: choose('ms-MY') },
    { name: 'no usable token', arrange: () => incoming.set(SESSION_COOKIE, 'truncated'), form: choose('ms-MY') },
    { name: 'bad locale', arrange: () => stubApi(saved), form: choose('xx') },
  ];

  it('M2-AC04/2 locale handler: every branch answers a JSON request with JSON, never a redirect', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const { name, arrange, form } of BRANCHES) {
      incoming.clear();
      arrange();
      const response = await switchLocale(post(form));
      expect(response.status >= 300 && response.status < 400, `${name}: ${response.status}`).toBe(false);
      expect(response.headers.get('location'), name).toBeNull();
      expect(response.headers.get('content-type'), name).toContain('application/json');
      expect(await response.json(), name).toBeTypeOf('object');
      expectNoStore(response, name);
    }
    // The guard's own answers are JSON too.
    vi.stubEnv('WRINGY_APP_MODE', 'demo');
    expect((await switchLocale(post(choose('ms-MY')))).headers.get('content-type')).toContain('application/json');
  });

  it('M2-AC04/2 locale handler: Chromium’s real navigation Accept with Sec-Fetch-Mode: navigate is a form, answered 303', async () => {
    stubApi(saved);
    const response = await switchLocale(post(choose('ms-MY', '/internal/sign-in'), { mode: 'form' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/sign-in?outcome=locale_switched`);
  });

  it('M2-AC04/2 locale handler: JSON is asked for only by the literal application/json outside a navigation', () => {
    const asks = (headers: Record<string, string>) => asksForJson({ headers: new Headers(headers) });
    expect(asks({ accept: 'application/json' })).toBe(true);
    expect(asks({ accept: 'application/json', 'sec-fetch-mode': 'cors' })).toBe(true);
    expect(asks({ accept: 'text/plain, Application/JSON;q=0.5' })).toBe(true);
    expect(asks({ accept: 'application/json', 'sec-fetch-mode': 'navigate' })).toBe(false);
    expect(asks({ accept: NAVIGATION_ACCEPT, 'sec-fetch-mode': 'navigate' })).toBe(false);
    expect(asks({ accept: NAVIGATION_ACCEPT })).toBe(false);
    expect(asks({ accept: '*/*' })).toBe(false);
    expect(asks({ accept: 'application/*' })).toBe(false);
    expect(asks({ accept: 'application/json-seq' })).toBe(false);
    expect(asks({})).toBe(false);
  });
});

/**
 * Paths `safeNextPath` accepts as they stand, whose dot segments `URL` resolves
 * to the protocol-relative `//evil.example`: re-parsed as a path, that is a host.
 */
const DOT_SEGMENT_HOSTILE = ['/internal/..//evil.example', '/.//evil.example/x', '/%2e%2e//evil.example'];

describe('M2-AC04/2 locale handler: the return path is a pathname of this origin, never a query', () => {
  it('M2-AC04/2 locale handler: next is reduced by safeNextPath and loses its query and fragment', () => {
    expect(returnPathname('/internal/orgs/abc', APP_ORIGIN)).toBe('/internal/orgs/abc');
    expect(returnPathname('/internal/invitations/accept?token=inviteToken_0123456789-abcdefghijklmnopqrst', APP_ORIGIN)).toBe(
      '/internal/invitations/accept',
    );
    expect(returnPathname('/internal?outcome=created#x', APP_ORIGIN)).toBe('/internal');
    for (const hostile of [
      '',
      '//evil.example',
      'https://evil.example/x',
      '/\\evil.example',
      'javascript:alert(1)',
      'internal',
      '/internal\r\nSet-Cookie: a=b',
      ...DOT_SEGMENT_HOSTILE,
    ]) {
      expect(returnPathname(hostile, APP_ORIGIN), JSON.stringify(hostile)).toBe('/internal');
    }
    // An ordinary dot segment still resolves to the page it names.
    expect(returnPathname('/internal/orgs/../invitations', APP_ORIGIN)).toBe('/internal/invitations');
  });

  it('M2-AC04/2 locale handler: a form from the accept page returns to it without its token, and with the outcome set, not appended', async () => {
    signIn();
    stubApi(saved);
    const next = '/internal/invitations/accept?token=inviteToken_0123456789-abcdefghijklmnopqrst&outcome=joined';

    const response = await switchLocale(post(choose('ms-MY', next), { mode: 'form' }));

    const location = new URL(response.headers.get('location') as string);
    expect(location.origin).toBe(APP_ORIGIN);
    expect(location.pathname).toBe('/internal/invitations/accept');
    expect([...location.searchParams]).toEqual([['outcome', 'locale_saved']]);
    expect(response.headers.get('location')).not.toContain('token');
  });

  it('M2-AC04/2 locale handler: a hostile next lands on /internal of APP_ORIGIN', async () => {
    for (const hostile of ['//evil.example/x', 'https://evil.example', ...DOT_SEGMENT_HOSTILE]) {
      const response = await switchLocale(post(choose('ms-MY', hostile), { mode: 'form' }));
      const location = new URL(response.headers.get('location') as string);
      expect(location.origin, hostile).toBe(APP_ORIGIN);
      expect(response.headers.get('location'), hostile).toBe(`${APP_ORIGIN}/internal?outcome=locale_switched`);
    }
  });
});
