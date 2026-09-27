/**
 * The internal build's routing shape, in one place (M2-02 R12; M2-04 T4).
 *
 * `proxy.ts` decides from this module what a request to each path gets — a
 * redirect, a rewrite to the not-found page, a pass-through, or a session check
 * that forwards a verified token — and `POST /internal/locale` asks the same
 * module which pages render signed out. Before this module each file kept its own
 * copy, and the copies had already drifted apart on `/` and on `/auth/…`: a
 * handler that guesses how a page rendered would guess wrong on exactly the pages
 * a shared device makes interesting.
 *
 * No imports, so the proxy, the Route Handlers and a client component can all
 * read it.
 */

/** The only public page of the internal build (M2-02 R11). */
export const SIGN_IN_PATH = '/internal/sign-in';

/**
 * The page under `(internal)` that calls `notFound()`, so the internal not-found
 * renders: the proxy rewrites every path outside the build to it.
 */
export const NOT_FOUND_PATH = '/internal/__not-found';

/** True when `pathname` is `base` itself or something under it — anchored, never a bare prefix. */
export function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * What the proxy does with a GET of `pathname` on a configured internal origin
 * (a provider error on the query aside, which the proxy reads first):
 *
 * - `root` — `/`: a 307 to `/internal`;
 * - `outside` — anything outside `/internal`, `/internal/…` and `/auth/…`
 *   (`/internal-tools` included, because the match is anchored): rewritten to
 *   `NOT_FOUND_PATH`, so the demo build never renders here;
 * - `auth` — `/auth` and `/auth/…`: Route Handlers, passed through without a
 *   session check (a path with no handler renders the app's own not-found);
 * - `public` — the sign-in page and the not-found page: passed through without a
 *   session check;
 * - `private` — every other internal path: session-checked, and forwarded the
 *   verified token.
 */
export type InternalRoute = 'root' | 'outside' | 'auth' | 'public' | 'private';

export function internalRouteOf(pathname: string): InternalRoute {
  if (pathname === '/') return 'root';
  if (isUnder(pathname, '/auth')) return 'auth';
  if (!isUnder(pathname, '/internal')) return 'outside';
  if (pathname === SIGN_IN_PATH || pathname === NOT_FOUND_PATH) return 'public';
  return 'private';
}

/**
 * Whether the page at `pathname` renders signed out whatever the cookie jar
 * holds: every route the proxy forwards no token to. `/` is not one of them — it
 * is only ever a redirect to `/internal`, a signed-in page.
 */
export function rendersSignedOut(pathname: string): boolean {
  const route = internalRouteOf(pathname);
  return route !== 'private' && route !== 'root';
}
