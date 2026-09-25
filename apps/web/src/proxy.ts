/**
 * `proxy.ts`: session refresh and the internal build's routing shape (M2-02 R12;
 * kickoff-package.md §4.1, §4.3, §8.6). Next 16 renamed middleware to proxy; it
 * runs on the Node runtime only.
 *
 * What it owns: refreshing the session on matched private routes, and handing the
 * verified access token to Server Components. What it must not do: authorise,
 * query a database, or run on public cacheable paths. The Next docs limit a proxy
 * to optimistic checks, and Fastify re-verifies every token anyway, so nothing
 * here is a security decision on its own — except the two that are purely
 * negative: removing a client-supplied token header, and never building a
 * redirect from a client-supplied host.
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
 *   cookies, call `getClaims()`, copy any refreshed cookies onto **both** the
 *   forwarded request and the response, apply `noStore()` when anything was
 *   written, and put the access token on the forwarded request. No claims → 307 to
 *   the sign-in page, with `session_ended` only when this browser really held a
 *   session that could not be refreshed: a retryable Auth-server failure is
 *   `unexpected` (retry), never a sign-out (R9).
 * - Every other matched request (a non-GET, `/auth/…`) → passed through, so the
 *   route handler answers for itself. A POST is never refreshed here: the handler
 *   owns its own cookie writes, and a refresh in two places races.
 *
 * ## Two invariants
 *
 * 1. `ACCESS_TOKEN_HEADER` is deleted from every matched request before anything
 *    else happens, and set again only from a token this proxy just verified. A
 *    client cannot inject an identity into a Server Component.
 * 2. Every redirect's host comes from `APP_ORIGIN`, never from `Host` or
 *    `X-Forwarded-Host`. Paths are matched anchored (`/internal` or `/internal/`),
 *    never by bare prefix, so `/internal-tools` is not inside the internal build.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { internalAuthEnv, type InternalAuthEnv } from '@/lib/auth/env';
import { appMode } from '@/lib/auth/mode';
import { noStore } from '@/lib/auth/no-store';
import { isRetryableAuthError, SIGN_IN_PATH, signInPath, type Outcome } from '@/lib/auth/outcomes';
import { createRequestSupabase, isSecureOrigin, isSessionCookieName } from '@/lib/auth/supabase-server';
import { ACCESS_TOKEN_HEADER } from '@/lib/auth/wire';

/**
 * Everything except Next's own assets, the favicon and any path with a file
 * extension. Full regex is allowed in a matcher and the value must be a
 * statically analysable constant, so it is written out here rather than built.
 *
 * M2-06 excludes its public campaign paths from this matcher when they arrive, so
 * their "no cookie read, no Set-Cookie" evidence stays a routing property rather
 * than a code path that must be re-proved.
 */
export const config = {
  matcher: ['/((?!_next/|favicon\\.ico|.*\\..*).*)'],
};

/** The page under `(internal)` that calls `notFound()`, so the internal not-found renders. */
const NOT_FOUND_PATH = '/internal/__not-found';

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

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // M1 unchanged: no cookie read, no header touched, no Supabase client created.
  if (appMode() !== 'internal') return NextResponse.next();

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

/**
 * The signed-in read path: refresh if needed, forward the token, or send the
 * visitor to sign in.
 *
 * Cookie writes are buffered rather than applied as they arrive, because the
 * forwarded request headers can only be snapshotted once and the token is not
 * known until `getClaims()` has run. `request.cookies.set()` rewrites this
 * request's `cookie` header, so the app sees the refreshed session; the same
 * writes then go on the response, so the browser does too.
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
  const written: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createRequestSupabase({
    supabaseUrl,
    publishableKey,
    secure: isSecureOrigin(appOrigin),
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

  // `getClaims()` verifies the ES256 signature locally against the cached JWKS.
  // It never throws here: auth-js returns its errors. The error is kept, because
  // *why* there are no claims decides what the visitor is told.
  const { data, error } = await supabase.auth.getClaims();
  const token = data?.claims === undefined ? null : await accessTokenOf(supabase);

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
  // A response that carries a Set-Cookie must never be cached (R20).
  if (written.length > 0) noStore(response);
  return response;
}

/**
 * The access token behind the claims `getClaims()` just verified.
 *
 * `getSession()` is safe here and only here: `getClaims()` has already run on
 * this client, so any refresh it needed has happened, its rotated cookies are in
 * `written`, and this call reads the session the client now holds. A Server
 * Component could not do this — it cannot set cookies, so a refresh there would
 * lose the new refresh token, which is exactly why the token is handed over in a
 * header instead.
 */
async function accessTokenOf(supabase: ReturnType<typeof createRequestSupabase>): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return typeof token === 'string' && token !== '' ? token : null;
}
