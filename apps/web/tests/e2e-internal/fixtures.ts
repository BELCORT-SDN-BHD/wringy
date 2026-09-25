/**
 * Playwright fixtures for the internal-build suite once it needs an identity
 * (M2-02 R15).
 *
 * Every page of the internal build behind `/internal` is private: signed out,
 * `proxy.ts` answers 307 to `/internal/sign-in`. So the M2-AC01 rows and every
 * M2-AC02 row start from a **signed-in context**, and this module is where that
 * happens once:
 *
 * - `tag` gives each test a unique `X-Wringy-Test` value. The context stamps it
 *   on every request, so the simulated auth server counts that test's calls in
 *   its own bucket and its control knobs (token lifetime, expire-next-flow,
 *   fail-next) touch nobody else, even under `fullyParallel`.
 * - `control` talks to `/_control` on the simulated auth server.
 * - `signedIn` gives a fresh context that has walked the real flow: `/internal`
 *   → 307 → `/internal/sign-in` → `POST /auth/sign-in` → the simulated consent
 *   page → `GET /auth/callback` → back on `/internal` as Alice. Nothing is
 *   injected: no cookie is written by hand and no token is minted in the test.
 *
 * THE TWO WEB INSTANCES. The suite runs two `next start` instances on
 * neighbouring ports, the second with a dead API address (project `outage`).
 * Signing in there is impossible, because the callback has to reach
 * `POST /identity/sign-in`. Session cookies are host-scoped, not port-scoped, so
 * the fixture always signs in against the HEALTHY instance and the same context
 * then reads the project's own `baseURL`; that is how `outage.spec.ts` and
 * `database-outage.spec.ts` get a signed-in page on their instance.
 *
 * This module deliberately imports nothing from `src/`: it is type-checked by
 * tests/e2e-internal/tsconfig.json as plain Node beside the fake auth server.
 * Locale cookies and evidence frames stay in support.ts.
 */
import { createServer, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type Server } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import CachePolicy from 'http-cache-semantics';

import { FAKE_USERS, TEST_TAG_HEADER, type FakeUser, type FakeUserName } from './fake-auth/users';

export { expect };
export { FAKE_USERS, TEST_TAG_HEADER };
export type { FakeUser, FakeUserName };

/**
 * The healthy web instance, which is the only one that can complete a sign-in.
 * Mirrors `WEB_PORT` in playwright.internal.config.ts, the way `E2E_WORKER_ID`
 * in support.ts mirrors the worker entry's `WORKER_ID`.
 */
export const WEB_PORT = Number(process.env['WEB_PORT'] ?? 3100);
export const HEALTHY_WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;

/** The web routes and pages of the identity slice (M2-02 R10, R11). */
export const WEB_ROUTES = {
  signIn: '/auth/sign-in',
  callback: '/auth/callback',
  signOut: '/auth/sign-out',
  probe: '/internal/session-probe',
  signInPage: '/internal/sign-in',
  internal: '/internal',
} as const;

/** The short-lived cookie that carries the return path across the provider (R10). */
export const NEXT_COOKIE = 'wringy-auth-next';

/** The prefix `@supabase/ssr` gives every cookie of its own, session and PKCE alike. */
export const SESSION_COOKIE_PREFIX = 'sb-';

/**
 * A `sb-*` cookie that is NOT a session.
 *
 * `@supabase/ssr` keeps the PKCE verifier in cookies whose names all end in
 * `-code-verifier` (auth-js `pkceVerifierSlotKey`, `pkceFlowIndexKey` and the
 * legacy fixed key), and one of those survives a cancelled or refused flow,
 * because nothing ever exchanged the code that would have consumed it. It is not
 * a credential for anything, so a row asserting "no session cookie survives"
 * must not trip on it — and must not be written as "no sb-* cookie at all",
 * which would pass for the wrong reason once the verifier happens to be gone.
 */
const isPkceCookie = (name: string): boolean => name.includes('code-verifier');

/** Every outcome code `/internal/sign-in?outcome=` accepts (R11). */
export const OUTCOMES = [
  'cancelled',
  'expired',
  'wrong_browser',
  'session_ended',
  'signed_out',
  'signed_out_unconfirmed',
  'not_allowed',
  'disabled',
  'unexpected',
] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Every probe result `/internal?probe=` accepts. */
export const PROBE_RESULTS = ['ok', 'revoked', 'unauthenticated', 'unavailable'] as const;
export type ProbeResult = (typeof PROBE_RESULTS)[number];

/** The DOM contract of the two pages this suite drives. */
export const TESTIDS = {
  signInGoogle: 'sign-in-google',
  signInOutcome: 'sign-in-outcome',
  signedInAs: 'signed-in-as',
  signOut: 'sign-out',
  sessionProbe: 'session-probe',
  probeResult: 'probe-result',
  fakeCancel: 'fake-cancel',
} as const;

/** The sign-in page's root, which carries `data-outcome`. */
export const SIGN_IN_ROOT = '[data-app-state="sign-in"]';

// --- the control API of the simulated auth server -----------------------------

/** Mirrors `CallReport` in fake-auth/server.mts, as JSON over the control API. */
export interface AuthCallReport {
  tag: string;
  calls: {
    authorize: number;
    consent: number;
    token_pkce: number;
    token_refresh: number;
    logout: number;
    user: number;
    jwks: number;
  };
  authorize: {
    provider: string | null;
    redirectTo: string | null;
    scopes: string | null;
    codeChallenge: string | null;
    codeChallengeMethod: string | null;
    skipHttpRedirect: boolean;
  }[];
  sessions: { id: string; userName: FakeUserName; active: boolean }[];
}

/** Where the simulated auth server announced its control API (WRINGY_E2E_AUTH_CONTROL). */
export function authControlBase(): string {
  const base = process.env['WRINGY_E2E_AUTH_CONTROL'];
  if (!base) {
    throw new Error('the simulated auth server is not announced (run through playwright.internal.config.ts)');
  }
  return base;
}

async function controlCall(path: string, init: { method: 'GET' | 'POST'; body?: unknown } = { method: 'POST' }): Promise<unknown> {
  const response = await fetch(`${authControlBase()}${path}`, {
    method: init.method,
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`the simulated auth server refused ${init.method} ${path} (HTTP ${response.status})`);
  }
  return (await response.json()) as unknown;
}

/** The knobs a test turns on the simulated auth server, all scoped to one tag. */
export interface AuthControl {
  /** Every call, authorize parameter and session the tag's traffic produced. */
  calls(tag: string): Promise<AuthCallReport>;
  /** The lifetime of the access tokens the tag's sessions get from now on. */
  tokenLifetime(tag: string, seconds: number): Promise<void>;
  /** Makes the tag's NEXT consent produce a flow state that the exchange refuses as expired. */
  expireNextFlow(tag: string): Promise<void>;
  /** Makes the tag's next `/logout` or `/user` call fail once with that status and code. */
  failNext(tag: string, endpoint: 'logout' | 'user', status: number, code: string): Promise<void>;
  /** Ends one session, as a sign-out elsewhere or an operator revoke does. */
  revokeSession(sessionId: string): Promise<void>;
  /** Ends every live session of that user. */
  revokeAllFor(name: FakeUserName): Promise<void>;
  /** The ids of every live session, across tags. */
  liveSessions(): Promise<string[]>;
}

export const authControl: AuthControl = {
  async calls(tag) {
    return (await controlCall(`/calls?tag=${encodeURIComponent(tag)}`, { method: 'GET' })) as AuthCallReport;
  },
  async tokenLifetime(tag, seconds) {
    await controlCall('/token-lifetime', { method: 'POST', body: { seconds, tag } });
  },
  async expireNextFlow(tag) {
    await controlCall('/flows/expire-next', { method: 'POST', body: { tag } });
  },
  async failNext(tag, endpoint, status, code) {
    await controlCall('/fail', { method: 'POST', body: { endpoint, status, code, tag } });
  },
  async revokeSession(sessionId) {
    await controlCall(`/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: 'POST' });
  },
  async revokeAllFor(name) {
    await controlCall(`/users/${encodeURIComponent(name)}/revoke-all`, { method: 'POST' });
  },
  async liveSessions() {
    const body = (await controlCall('/sessions', { method: 'GET' })) as { sessions: string[] };
    return body.sessions;
  },
};

/** The one live session the tag created, which is what a revoke row needs. */
export async function onlySessionOf(tag: string): Promise<string> {
  const report = await authControl.calls(tag);
  const live = report.sessions.filter((session) => session.active);
  expect(live, `tag ${tag} should hold exactly one live session`).toHaveLength(1);
  const id = live[0]?.id;
  if (id === undefined) throw new Error(`tag ${tag} holds no live session`);
  return id;
}

/** The simulated project's origin (SUPABASE_URL), as the fake-auth entry announced it. */
export function supabaseUrl(): string {
  const url = process.env['SUPABASE_URL'];
  if (!url) throw new Error('SUPABASE_URL is not announced (run through playwright.internal.config.ts)');
  return url;
}

// --- signing in ---------------------------------------------------------------

/** What the simulated consent page exposes, for the rows that walk the flow over plain HTTP. */
export interface ConsentForm {
  /** The form's own action, resolved against the auth origin. */
  action: string;
  /** The hidden state field that names the pending authorize request. */
  state: string;
  /** The cancel link, with its HTML entities decoded as a browser would. */
  cancel: string;
}

/** Reads the consent page's own form out of its HTML; nothing about it is hard-coded here. */
export function parseConsentPage(html: string): ConsentForm {
  const action = /<form[^>]*action="([^"]+)"/.exec(html)?.[1];
  const state = /name="state" value="([^"]+)"/.exec(html)?.[1];
  const cancel = /href="([^"]+)"[^>]*data-testid="fake-cancel"/.exec(html)?.[1];
  if (action === undefined || state === undefined || cancel === undefined) {
    throw new Error('the simulated consent page did not expose a form action, a state and a cancel link');
  }
  return { action: new URL(action, supabaseUrl()).toString(), state, cancel: new URL(cancel.replace(/&amp;/g, '&'), supabaseUrl()).toString() };
}

export interface SignInOptions {
  /**
   * Where the visitor starts. Absolute by default and on the HEALTHY instance,
   * because only that one can complete a callback.
   */
  start?: string;
}

/**
 * Walks from `start` to the simulated consent page: the visitor is redirected to
 * the sign-in page and presses "Continue with Google". Returns the consent URL,
 * which a `wrong_browser` row completes in a different context.
 */
export async function startSignIn(page: Page, { start = `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}` }: SignInOptions = {}): Promise<string> {
  await page.goto(start);
  await page.waitForURL((url) => url.pathname === WEB_ROUTES.signInPage);
  await expect(page.locator(SIGN_IN_ROOT)).toBeVisible();
  await page.getByTestId(TESTIDS.signInGoogle).click();
  await page.waitForURL((url) => url.pathname === '/auth/v1/authorize');
  return page.url();
}

/** Presses one fake user's button on the consent page and waits until the app answers again. */
export async function consentAs(page: Page, name: FakeUserName, appOrigin: string): Promise<string> {
  await page.getByTestId(`fake-user-${name}`).click();
  await page.waitForURL((url) => url.origin === appOrigin);
  return page.url();
}

/**
 * The whole dance, without asserting the outcome: Alice lands on `/internal`,
 * Mallory lands back on the sign-in page with `outcome=not_allowed`. Returns the
 * URL the browser ended on.
 */
export async function signInAs(page: Page, name: FakeUserName, options: SignInOptions = {}): Promise<string> {
  const start = options.start ?? `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}`;
  await startSignIn(page, { start });
  return consentAs(page, name, new URL(start).origin);
}

/** Cancels at the simulated provider and waits until the app answers again. */
export async function cancelSignIn(page: Page, options: SignInOptions = {}): Promise<string> {
  const start = options.start ?? `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}`;
  await startSignIn(page, { start });
  await page.getByTestId(TESTIDS.fakeCancel).click();
  await page.waitForURL((url) => url.origin === new URL(start).origin);
  return page.url();
}

/** The names of the session cookies a context currently holds, PKCE artefacts aside. */
export async function sessionCookieNames(context: BrowserContext): Promise<string[]> {
  const cookies = await context.cookies();
  return cookies
    .filter((cookie) => cookie.name.startsWith(SESSION_COOKIE_PREFIX) && !isPkceCookie(cookie.name))
    .map((cookie) => cookie.name);
}

/**
 * A digest of the session cookies, so a refresh row can prove they changed
 * without anything derived from a token appearing anywhere. Only the hash is
 * compared, and only the hash can end up in a failure message.
 */
export async function sessionCookieFingerprint(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies();
  const material = cookies
    .filter((cookie) => cookie.name.startsWith(SESSION_COOKIE_PREFIX) && !isPkceCookie(cookie.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('|');
  return material === '' ? '' : createHash('sha256').update(material).digest('base64url').slice(0, 16);
}

// --- the shared-cache helper ---------------------------------------------------

/** A request as `http-cache-semantics` wants it. */
export interface CacheableRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
}

/** A response as `http-cache-semantics` wants it. */
export interface CacheableResponse {
  status: number;
  headers: Record<string, string>;
}

/**
 * Whether an RFC 9111 **shared** cache would be allowed to store this exchange.
 * The M2-AC02/3 cache row requires `false` for every response that sets a
 * cookie: a stored `Set-Cookie` can sign the next visitor in as someone else
 * (§4.7).
 */
export function storableInSharedCache(request: CacheableRequest, response: CacheableResponse): boolean {
  return new CachePolicy(request, response, { shared: true }).storable();
}

/** Node's header bag flattened to single values, which is what CachePolicy reads. */
export function flattenHeaders(headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    flat[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return flat;
}

interface CacheEntry {
  policy: CachePolicy;
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

export interface CachingProxy {
  /** The origin to fetch through, e.g. `http://127.0.0.1:53421`. */
  origin: string;
  /** `METHOD path` for every exchange the shared cache decided it could store. */
  storedKeys(): string[];
  /** How many responses it served out of its own store instead of the upstream. */
  hits(): number;
  stop(): Promise<void>;
}

/**
 * An RFC 9111 **shared** cache in front of one origin, for the M2-AC02/3 cache
 * rows: it stores exactly what `http-cache-semantics` 4.2.0 says a shared cache
 * may store, and serves a stored response only when
 * `satisfiesWithoutRevalidation` says so. If the internal build ever answered a
 * private page without `no-store`, this proxy would hand the next visitor the
 * previous visitor's page — which is what the row proves it does not.
 */
export async function startCachingProxy(upstreamOrigin: string): Promise<CachingProxy> {
  const store = new Map<string, CacheEntry>();
  let hits = 0;

  const forward = (
    request: IncomingMessage,
    body: Buffer,
  ): Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> => {
    const target = new URL(request.url ?? '/', upstreamOrigin);
    const headers: Record<string, string | string[]> = {};
    for (const [name, value] of Object.entries(request.headers)) {
      if (value === undefined || name === 'host' || name === 'connection') continue;
      headers[name] = value;
    }
    headers['host'] = target.host;
    return new Promise((resolve, reject) => {
      const upstream = httpRequest(
        { protocol: target.protocol, hostname: target.hostname, port: target.port, path: `${target.pathname}${target.search}`, method: request.method, headers },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }),
          );
          response.on('error', reject);
        },
      );
      upstream.on('error', reject);
      if (body.byteLength > 0) upstream.write(body);
      upstream.end();
    });
  };

  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks);
      const descriptor: CacheableRequest = {
        method: request.method ?? 'GET',
        url: request.url ?? '/',
        headers: flattenHeaders(request.headers),
      };
      const key = `${descriptor.method} ${descriptor.url}`;
      const entry = store.get(key);
      if (entry !== undefined && entry.policy.satisfiesWithoutRevalidation(descriptor)) {
        hits += 1;
        const headers = { ...entry.headers, ...entry.policy.responseHeaders() } as Record<string, string | string[]>;
        delete headers['transfer-encoding'];
        headers['content-length'] = String(entry.body.byteLength);
        headers['x-wringy-proxy'] = 'hit';
        response.writeHead(entry.status, headers);
        response.end(entry.body);
        return;
      }
      forward(request, body).then(
        (upstream) => {
          const policy = new CachePolicy(descriptor, { status: upstream.status, headers: flattenHeaders(upstream.headers) }, { shared: true });
          if (policy.storable()) store.set(key, { policy, status: upstream.status, headers: upstream.headers, body: upstream.body });
          const headers = { ...upstream.headers } as Record<string, string | string[]>;
          delete headers['transfer-encoding'];
          headers['content-length'] = String(upstream.body.byteLength);
          headers['x-wringy-proxy'] = policy.storable() ? 'stored' : 'pass';
          response.writeHead(upstream.status, headers);
          response.end(upstream.body);
        },
        (error: unknown) => {
          response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
          response.end(`caching proxy could not reach the upstream: ${error instanceof Error ? error.name : 'error'}`);
        },
      );
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = address !== null && typeof address === 'object' ? address.port : 0;

  return {
    origin: `http://127.0.0.1:${port}`,
    storedKeys: () => [...store.keys()],
    hits: () => hits,
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

// --- the fixtures --------------------------------------------------------------

/** One browser that carries its own tag: the test's own, or a second device. */
export interface Device {
  page: Page;
  context: BrowserContext;
  /** The `X-Wringy-Test` value this context stamps on every request. */
  tag: string;
  control: AuthControl;
}

/** The test's own browser, signed in as Alice. */
export interface SignedIn extends Device {
  user: FakeUser;
}

/**
 * Opens a second browser for the rows that need two people, or the same person
 * twice. The suffix becomes part of its tag, so the two sets of auth calls stay
 * apart, and the context is closed when the test ends.
 */
export type OpenDevice = (suffix: string) => Promise<Device>;

export interface InternalFixtures {
  /** A value unique to this test, stamped on every request the test's contexts make. */
  tag: string;
  control: AuthControl;
  /** The test's own page and context, with the tag header set. Nobody is signed in yet. */
  tagged: Device;
  /** The test's own page and context, signed in as Alice through the real flow. */
  signedIn: SignedIn;
  openDevice: OpenDevice;
}

/**
 * Playwright's fixture callback takes its value-provider as the second
 * positional argument, which the documentation names `use`. It is called
 * `provide` here because `eslint-config-next`'s `react-hooks/rules-of-hooks`
 * reads a call to `use(...)` as React 19's `use` hook and refuses it outside a
 * component. The name is arbitrary to Playwright; the rule stays on everywhere.
 *
 * `tagged` and `signedIn` build on Playwright's OWN `context` and `page`
 * fixtures rather than calling `browser.newContext()`. That matters: a context
 * made by hand ignores the project's `use`, so the 320 px project would silently
 * run at the default 1280, and Playwright's traces, videos and
 * screenshot-on-failure would not be attached to it. The tag header is added to
 * the project's context instead, with `setExtraHTTPHeaders`.
 */
export const test = base.extend<InternalFixtures>({
  tag: async ({}, provide, testInfo) => {
    // The project and title make a failure readable in the auth server's log;
    // the uuid keeps two retries of the same test apart.
    await provide(`${testInfo.project.name}-${testInfo.title.slice(0, 40).replace(/[^\w]+/g, '-')}-${randomUUID()}`);
  },
  control: async ({}, provide) => {
    await provide(authControl);
  },
  tagged: async ({ context, page, tag, control }, provide) => {
    await context.setExtraHTTPHeaders({ [TEST_TAG_HEADER]: tag });
    await provide({ page, context, tag, control });
  },
  signedIn: async ({ tagged }, provide) => {
    // The dance is the real one: 307 → sign-in page → POST → consent → callback.
    await signInAs(tagged.page, 'alice');
    await expect(tagged.page.getByTestId(TESTIDS.signedInAs), 'the fixture must land signed in as Alice').toContainText(
      FAKE_USERS.alice.email,
    );
    await provide({ ...tagged, user: FAKE_USERS.alice });
  },
  openDevice: async ({ browser, baseURL, tag, control }, provide, testInfo) => {
    const opened: BrowserContext[] = [];
    const open: OpenDevice = async (suffix) => {
      const deviceTag = `${tag}-${suffix}`;
      const context = await browser.newContext({
        baseURL,
        // The project's own viewport, which browser.newContext() would not take.
        viewport: testInfo.project.use.viewport,
        extraHTTPHeaders: { [TEST_TAG_HEADER]: deviceTag },
      });
      opened.push(context);
      return { page: await context.newPage(), context, tag: deviceTag, control };
    };
    await provide(open);
    for (const context of opened) await context.close();
  },
});
