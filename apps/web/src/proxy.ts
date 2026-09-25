/**
 * `proxy.ts`: session refresh and the internal build's routing shape (M2-02 R12;
 * kickoff-package.md §4.1, §4.3, §8.6). Next 16 renamed middleware to proxy; it
 * runs on the Node runtime only.
 *
 * What it owns: refreshing the session on matched private routes, and handing the
 * verified access token to Server Components. What it must not do: authorise,
 * query a database, or run on public cacheable paths. The Next docs limit a proxy
 * to optimistic checks, and Fastify re-verifies every token anyway, so nothing
 * here is a security decision on its own — except the ones that are purely
 * negative: removing a client-supplied token header, never building a redirect
 * from a client-supplied host, and refusing to be framed.
 *
 * ## The mode comes first
 *
 * The mode is read non-throwing (`lib/auth/mode.ts`), never through
 * `loadWebEnv()`. In `demo` mode this returns `NextResponse.next()` and M1 is
 * untouched — no cookie is read, no header is changed.
 *
 * In `internal` mode the **routing shape is decided before the environment is
 * read**, because it needs none of it: a rewrite is built from the URL the
 * request arrived at. An internal origin whose three variables are missing (a
 * first deploy, the env-less image smoke) therefore still answers the internal
 * not-found page for a demo path, and still reaches the page's `not-configured`
 * state on `/internal` and `/` — it never serves the demo build on an internal
 * origin.
 *
 * ## Internal mode
 *
 * - `/` → 307 `/internal` (a rewrite to `/internal` when the environment is
 *   unusable, because a `Location` must never be built from the request's host).
 * - Anything outside `/internal`, `/internal/…` and `/auth/…` → rewritten to the
 *   internal not-found page, so the demo's catch-all never renders here.
 * - `GET`/`HEAD` on `/internal` and `/internal/…`, except the public sign-in page
 *   and the not-found page → create a request-level client on this request's
 *   cookies, call `getClaims()` under an overall deadline, copy any refreshed
 *   cookies onto **both** the forwarded request and the response, apply
 *   `noStore()`, and put the access token on the forwarded request. No claims →
 *   307 to the sign-in page, with `session_ended` only when this browser really
 *   held a session that could not be refreshed: a retryable Auth-server failure
 *   is `unexpected` (retry), never a sign-out (R9).
 * - Every other matched request (a non-GET, `/auth/…`) → passed through, so the
 *   route handler answers for itself. A POST is never refreshed here: the handler
 *   owns its own cookie writes, and a refresh in two places races.
 *
 * ## Four invariants
 *
 * 1. `ACCESS_TOKEN_HEADER` is deleted from every matched request before anything
 *    else happens, and set again only from a token this proxy just verified. A
 *    client cannot inject an identity into a Server Component.
 * 2. Every redirect's host comes from `APP_ORIGIN`, never from `Host` or
 *    `X-Forwarded-Host`. Paths are matched anchored (`/internal` or `/internal/`),
 *    never by bare prefix, so `/internal-tools` is not inside the internal build.
 * 3. Every response the proxy produces in internal mode refuses framing
 *    (`FRAMING_HEADERS`), and every response it produces for an authenticated
 *    `/internal` path is `no-store` whether or not a cookie was written this time
 *    (R20 rev 3).
 * 4. `getClaims()` cannot hang the page and cannot half-write a session: it runs
 *    under `REFRESH_DEADLINE_MS`, and a deadline or a throw applies no buffered
 *    cookie write at all.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { internalAuthEnv, type InternalAuthEnv } from '@/lib/auth/env';
import { appMode } from '@/lib/auth/mode';
import { noStore } from '@/lib/auth/no-store';
import { isRetryableAuthError, SIGN_IN_PATH, signInPath, type Outcome } from '@/lib/auth/outcomes';
import {
  createRequestSupabase,
  isSecureOrigin,
  isSessionCookieName,
  isSupabaseAuthCookie,
  readStoredAccessToken,
  sessionCookieOptions,
} from '@/lib/auth/supabase-server';
import { ACCESS_TOKEN_HEADER } from '@/lib/auth/wire';

/**
 * Everything except Next's own assets, the favicon and any path ending in a
 * static-asset suffix. Full regex is allowed in a matcher and the value must be a
 * statically analysable constant, so it is written out here rather than built.
 *
 * The suffix list is the point (**rev 3**). The first form of this matcher
 * excluded `.*\..*` — every path *containing* a dot — so on an internal origin
 * `/campaigns/a.b` and `/foo.bar` were never matched at all: the proxy never ran,
 * the demo catch-all rendered them, and neither the routing shape nor the token
 * header nor the framing headers applied to them. Anchoring the suffixes with `$`
 * excludes exactly the files a browser fetches beside a page.
 *
 * `proxy.test.ts` compiles this constant with Next's own `getMiddlewareMatchers`
 * and matches paths against the resulting `regexp`, which is what
 * `getMiddlewareRouteMatcher` does at run time — a hand-written `new RegExp` over
 * the source would not prove the same thing.
 *
 * M2-06 excludes its public campaign paths from this matcher when they arrive, so
 * their "no cookie read, no Set-Cookie" evidence stays a routing property rather
 * than a code path that must be re-proved.
 */
export const config = {
  matcher: ['/((?!_next/|favicon\\.ico|.*\\.(?:ico|png|svg|jpg|jpeg|gif|webp|txt|xml|map|js|css|woff|woff2)$).*)'],
};

/** The page under `(internal)` that calls `notFound()`, so the internal not-found renders. */
const NOT_FOUND_PATH = '/internal/__not-found';

/**
 * The internal build is never framed.
 *
 * Both headers, because they are read by different things: `frame-ancestors` is
 * the modern rule every current browser honours, and `X-Frame-Options: DENY` is
 * what an old browser and some corporate proxies understand. There is no page of
 * this build that anybody should embed, and a framed sign-in page is how a
 * click-jacking flow gets somebody to press "Continue with Google" — or press
 * "sign out", or the session probe — without knowing what they pressed. Applied
 * to **every** response the proxy produces in internal mode, including the
 * rewrites and the redirects, because a header that only some responses carry is
 * a header an attacker picks around.
 */
export const FRAMING_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
};

/**
 * OPERATIONAL deadline for the whole session-refresh step of one matched read
 * (not a business rule).
 *
 * `SUPABASE_REQUEST_TIMEOUT_MS` bounds one call; `getClaims()` can make two (the
 * JWKS fetch, then the refresh), so only an overall deadline bounds the page.
 * 8 s is under that pair's 10 s and well inside GoTrue's own 10 s refresh-token
 * reuse interval, which is what makes the trade-off safe: a refresh that
 * completes upstream *after* this deadline leaves the browser holding the old
 * refresh token, and the next read may reuse it — inside the reuse interval
 * GoTrue returns the same new session, and outside it the session ends and the
 * tester signs in again. Recorded in known-issues.md (M2-02).
 */
export const REFRESH_DEADLINE_MS = 8_000;

/** A cookie write the proxy has buffered but not yet applied to a response. */
interface BufferedCookie {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

/** True when `pathname` is `base` itself or something under it — anchored, never a bare prefix. */
function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** The forwarded request headers, always without any token a client may have sent. */
function forwardedHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete(ACCESS_TOKEN_HEADER);
  return headers;
}

/** Pass the request to the app untouched, except that the token header is stripped. */
function passThrough(request: NextRequest): NextResponse {
  return NextResponse.next({ request: { headers: forwardedHeaders(request) } });
}

/**
 * A same-origin rewrite to `path`.
 *
 * A rewrite never reaches the browser, so it is built on the URL the request
 * actually arrived at (path replaced) rather than on `APP_ORIGIN`. That keeps it
 * same-origin by construction — an `APP_ORIGIN` that disagreed with the serving
 * origin would otherwise turn a not-found into an outbound request — and it is
 * why the routing shape can be decided before the environment is read.
 */
function rewriteTo(request: NextRequest, path: string): NextResponse {
  const target = request.nextUrl.clone();
  target.pathname = path;
  target.search = '';
  return NextResponse.rewrite(target, { request: { headers: forwardedHeaders(request) } });
}

/**
 * A 307 to a root-relative path of this app. The host is `APP_ORIGIN` from the
 * environment: `Host` and `X-Forwarded-Host` are attacker-controlled, and a
 * redirect is the one place a bad host would reach the browser.
 *
 * No forwarded request headers are passed: `NextResponse.redirect`'s init sets
 * **response** headers, and a redirected request never reaches the app anyway, so
 * there is nothing to forward and nothing a stray token header could reach.
 */
function redirect(path: string, appOrigin: string): NextResponse {
  return NextResponse.redirect(new URL(path, appOrigin), 307);
}

/** The two framing headers on every response the internal-mode proxy produces. */
function noFraming<T extends { headers: Headers }>(response: T): T {
  for (const [name, value] of Object.entries(FRAMING_HEADERS)) response.headers.set(name, value);
  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // M1 unchanged: no cookie read, no header touched, no Supabase client created.
  if (appMode() !== 'internal') return NextResponse.next();

  return noFraming(await internalProxy(request));
}

/** Everything the proxy does on an internal origin, before the framing headers go on. */
async function internalProxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const inInternal = isUnder(pathname, '/internal');
  const inAuth = isUnder(pathname, '/auth');

  // The routing shape first, because it needs no environment: on an internal
  // origin the demo build's pages must not render even when the three variables
  // are missing, which is exactly the state a first deploy is in.
  if (!inInternal && !inAuth && pathname !== '/') return rewriteTo(request, NOT_FOUND_PATH);

  // Internal mode without its variables: let the page say so. `/` is rewritten
  // rather than redirected, because there is no APP_ORIGIN to build a `Location`
  // from and a request's own host must never become one.
  const env = internalAuthEnv();
  if (!env.ok) return pathname === '/' ? rewriteTo(request, '/internal') : passThrough(request);

  const { appOrigin } = env.env;
  if (pathname === '/') return redirect('/internal', appOrigin);

  const isRead = request.method === 'GET' || request.method === 'HEAD';
  // `/auth/…` is always a route handler, and a non-GET owns its own cookies.
  if (!inInternal || !isRead) return passThrough(request);
  // The only public internal page, and the page that renders not-found.
  if (pathname === SIGN_IN_PATH || pathname === NOT_FOUND_PATH) return passThrough(request);

  return refreshAndForward(request, env.env, `${pathname}${search}`);
}

/** What `resolveSession` answers when the overall deadline expired first. */
const DEADLINE = Symbol('refresh deadline');

/**
 * The signed-in read path: refresh if needed, forward the token, or send the
 * visitor to sign in.
 *
 * Cookie writes are buffered rather than applied as they arrive, because the
 * forwarded request headers can only be snapshotted once and the token is not
 * known until `getClaims()` has run. `request.cookies.set()` rewrites this
 * request's `cookie` header, so the app sees the refreshed session; the same
 * writes then go on the response, so the browser does too.
 *
 * Buffering is also what makes the two failure modes safe. A deadline applies
 * **no** buffered write, because a refresh that has not finished must not leave a
 * half-rotated session in the browser; a throw applies the `sb-*` expiries
 * instead, because a cookie the library could not parse is not a session.
 */
async function refreshAndForward(
  request: NextRequest,
  { supabaseUrl, publishableKey, appOrigin }: InternalAuthEnv,
  nextPath: string,
): Promise<NextResponse> {
  // The session cookie itself, not any `sb-*` cookie: an abandoned sign-in leaves
  // `sb-<ref>-auth-token-code-verifier` behind for the library's fixed 400 days,
  // and a browser that only started a sign-in never had a session to end.
  const hadSessionCookie = request.cookies.getAll().some(({ name }) => isSessionCookieName(supabaseUrl, name));
  const secure = isSecureOrigin(appOrigin);
  const written: BufferedCookie[] = [];

  // The overall deadline. It is handed to the client, so expiring it aborts
  // whatever call is in flight rather than leaving it running behind the answer.
  const deadline = new AbortController();
  const supabase = createRequestSupabase({
    supabaseUrl,
    publishableKey,
    secure,
    signal: deadline.signal,
    cookies: {
      getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          written.push({ name, value, options: options as Record<string, unknown> });
        }
      },
    },
  });

  let timer: unknown;
  const expired = new Promise<typeof DEADLINE>((resolve) => {
    timer = setTimeout(() => {
      deadline.abort(new Error('supabase session refresh deadline'));
      resolve(DEADLINE);
    }, REFRESH_DEADLINE_MS);
    (timer as { unref?: () => void }).unref?.();
  });

  let settled: Awaited<ReturnType<typeof resolveSession>> | typeof DEADLINE;
  try {
    settled = await Promise.race([
      // The cookie is read off THIS request's jar, which `setAll` above has
      // already updated with whatever `getClaims()` rotated.
      resolveSession(supabase, supabaseUrl, (name) => request.cookies.get(name)?.value ?? null),
      expired,
    ]);
  } catch {
    // `getClaims()` is documented to return its errors rather than throw, and a
    // cookie value it cannot parse is the case where it does anyway (a truncated
    // or foreign `sb-*` cookie makes auth-js raise, most visibly a SyntaxError
    // out of JSON.parse). A 500 would be the wrong answer twice over: the visitor
    // can do nothing with it, and the browser would keep the cookie that caused
    // it and hit the same wall on the next request. So the session is ended the
    // way the sign-out fallback ends it — every `sb-*` cookie expired by our own
    // code — and the person is told their session ended and can sign in again.
    clearTimeout(timer as Parameters<typeof clearTimeout>[0]);
    const response = redirect(signInPath({ next: nextPath, outcome: 'session_ended' }), appOrigin);
    for (const { name, value, options } of expireSupabaseCookies(request, secure)) {
      response.cookies.set(name, value, options);
    }
    return noStore(response);
  }
  clearTimeout(timer as Parameters<typeof clearTimeout>[0]);

  if (settled === DEADLINE) {
    // Nothing is known about this session, so nothing is said about it: the
    // deadline is `unexpected`, the wording that offers a retry (R9). And not one
    // buffered write is applied — a refresh still in flight upstream may yet
    // succeed, and half of a rotation in the browser is worse than none.
    return noStore(redirect(signInPath({ next: nextPath, outcome: 'unexpected' }), appOrigin));
  }

  const { token, error } = settled;

  if (token === null) {
    // A session cookie that could not be refreshed is a session that ended, which
    // is worth saying; no cookie at all is just "please sign in". But a JWKS that
    // could not be fetched, a timeout or any other retryable Auth-server failure
    // says nothing about this session, and must never read as "you were signed
    // out" (R9): it is `unexpected`, the wording that offers a retry.
    const outcome: Outcome | null = isRetryableAuthError(error)
      ? 'unexpected'
      : hadSessionCookie
        ? 'session_ended'
        : null;
    const response = redirect(signInPath({ next: nextPath, outcome }), appOrigin);
    // Clear whatever the library decided to expire, and never let this be cached.
    for (const { name, value, options } of written) response.cookies.set(name, value, options);
    return noStore(response);
  }

  const headers = forwardedHeaders(request);
  headers.set(ACCESS_TOKEN_HEADER, token);
  const response = NextResponse.next({ request: { headers } });
  for (const { name, value, options } of written) response.cookies.set(name, value, options);
  // Unconditionally, whether or not a cookie was written this time (R20 rev 3):
  // no-store on a private page is Wringy's own property, not one inherited from
  // a library that latches its headers to the first write of a response.
  return noStore(response);
}

/**
 * Every `sb-*` cookie this request arrived with, as an expiry.
 *
 * The same fallback `signOutLocally` uses through the route handlers' cookie jar
 * (`lib/auth/route-support.ts`), written against the proxy's own buffer: one
 * question — what must the browser be left holding none of? — and one answer,
 * `isSupabaseAuthCookie` plus `sessionCookieOptions`, so the two paths cannot
 * disagree about which cookies a session is.
 */
function expireSupabaseCookies(request: NextRequest, secure: boolean): BufferedCookie[] {
  return request.cookies
    .getAll()
    .filter(({ name }) => isSupabaseAuthCookie(name))
    .map(({ name }) => ({ name, value: '', options: { ...sessionCookieOptions(secure), maxAge: 0 } }));
}

/**
 * The claims and the access token behind them, or the error that explains why
 * there are none.
 *
 * Exactly **one** call to the client, and then the cookie is read.
 * `getClaims()` verifies the ES256 signature locally against the cached JWKS,
 * refreshing first when the stored token is inside auth-js's 90 s
 * `EXPIRY_MARGIN_MS`; its rotated session is written straight back into
 * `request.cookies` by the caller's `setAll`, so the token those claims came from
 * is in the cookie by the time this returns, and `readStoredAccessToken` takes it
 * out without asking the Auth server anything.
 *
 * It must not be `getSession()`. `getSession()` runs `_useSession`, which
 * refreshes whenever the stored token is inside that same 90 s margin — and after
 * a refresh whose token lives less than 90 s (which the E2E suite arranges on
 * purpose, and a short-lived project setting could produce) the token `getClaims()`
 * just fetched is *already* inside it, so the call rotates the refresh token a
 * second time in one request. Two tabs reloading together then burn each other's
 * grace: the first request rotates twice, so the token the second presents is two
 * generations old, outside GoTrue's reuse interval, and the Auth server ends the
 * session — one tab signed in, the other told its session ended. Found by the
 * two-tab row in `auth.spec.ts` (7 refreshes for 3 reads, one of them a 400).
 */
async function resolveSession(
  supabase: ReturnType<typeof createRequestSupabase>,
  supabaseUrl: string,
  readCookie: (name: string) => string | null,
): Promise<{ token: string | null; error: unknown }> {
  // It normally returns its errors rather than throwing; the caller catches the
  // exception for the cookie values where auth-js throws anyway.
  const { data, error } = await supabase.auth.getClaims();
  if (data?.claims === undefined) return { token: null, error };
  return { token: await readStoredAccessToken(supabaseUrl, readCookie), error };
}
