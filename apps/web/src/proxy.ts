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
 * untouched — no cookie is read, no header is changed. In `internal` mode with an
 * unusable environment it passes the request through, so an env-less container
 * still reaches the page's `not-configured` state instead of erroring at the edge
 * of every request.
 *
 * ## Internal mode
 *
 * - `/` → 307 `/internal`.
 * - Anything outside `/internal`, `/internal/…` and `/auth/…` → rewritten to the
 *   internal not-found page, so the demo's catch-all never renders here.
 * - `GET`/`HEAD` on `/internal` and `/internal/…`, except the public sign-in page
 *   and the not-found page → create a request-level client on this request's
 *   cookies, call `getClaims()`, copy any refreshed cookies onto **both** the
 *   forwarded request and the response, apply `noStore()` when anything was
 *   written, and put the access token on the forwarded request. No claims → 307 to
 *   the sign-in page.
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
import { SIGN_IN_PATH, signInPath } from '@/lib/auth/outcomes';
import { createRequestSupabase, isSecureOrigin, isSupabaseAuthCookie } from '@/lib/auth/supabase-server';
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

  // Internal mode without its variables: let the page say so.
  const env = internalAuthEnv();
  if (!env.ok) return passThrough(request);

  const { appOrigin } = env.env;
  const { pathname, search } = request.nextUrl;

  if (pathname === '/') return redirect('/internal', appOrigin);

  const inInternal = isUnder(pathname, '/internal');
  const inAuth = isUnder(pathname, '/auth');

  if (!inInternal && !inAuth) {
    // A rewrite never reaches the browser, so it is built on the URL the request
    // actually arrived at (path replaced). That keeps it same-origin by
    // construction: an APP_ORIGIN that disagreed with the serving origin would
    // otherwise turn a not-found into an outbound request.
    const target = request.nextUrl.clone();
    target.pathname = NOT_FOUND_PATH;
    target.search = '';
    return NextResponse.rewrite(target, { request: { headers: forwardedHeaders(request) } });
  }

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
  const hadSessionCookie = request.cookies.getAll().some(({ name }) => isSupabaseAuthCookie(name));
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
  // It never throws here: auth-js returns its errors, and an unusable session is
  // simply "no claims", which is the same outcome as no session at all.
  const { data } = await supabase.auth.getClaims();
  const token = data?.claims === undefined ? null : await accessTokenOf(supabase);

  if (token === null) {
    // A session cookie that could not be refreshed is a session that ended, which
    // is worth saying; no cookie at all is just "please sign in".
    const response = redirect(
      signInPath({ next: nextPath, outcome: hadSessionCookie ? 'session_ended' : null }),
      appOrigin,
    );
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
