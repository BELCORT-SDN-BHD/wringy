/**
 * The cache headers Wringy sets itself on every response that may carry a
 * `Set-Cookie` (M2-02 R20; kickoff-package.md §4.7).
 *
 * `@supabase/ssr` hands these same headers to `setAll`, but only on its
 * `applyServerStorage` path and not on the PKCE verifier write, and it latches
 * them to the first write of a response. A cached `Set-Cookie` can sign the
 * next visitor in as someone else, so no-store is not something this app
 * inherits from a library: the proxy branch that may write cookies and every
 * cookie-writing route handler call `noStore()` unconditionally.
 */

/** The exact header set, as one object, so the proxy, the handlers and the tests share one source. */
export function noStoreHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
    Expires: '0',
    Pragma: 'no-cache',
  };
}

/** The part of a response this module touches, so a plain `Response` and a `NextResponse` both fit. */
interface HeaderBearing {
  readonly headers: { set(name: string, value: string): void };
}

/** Sets the no-store headers on `response` and returns it, so callers can `return noStore(...)`. */
export function noStore<T extends HeaderBearing>(response: T): T {
  for (const [name, value] of Object.entries(noStoreHeaders())) {
    response.headers.set(name, value);
  }
  return response;
}
