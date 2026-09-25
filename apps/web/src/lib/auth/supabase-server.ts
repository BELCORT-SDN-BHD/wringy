/**
 * The **only** file in `apps/web` that imports a Supabase client library
 * (M2-02 R10, R17). Two CI checks keep it that way:
 *
 *  - `pnpm depcruise` rule `supabase-client-only-in-auth-lib` forbids
 *    `@supabase/ssr` and `@supabase/supabase-js` anywhere else under
 *    `apps/web/src`, type-only imports included;
 *  - `pnpm check:supabase-scope` (scripts/check-supabase-client-scope.mjs)
 *    requires every `createServerClient(` call in this file to sit inside a
 *    function body, so no module-level client can exist, and plants a violation
 *    to prove the check bites.
 *
 * Why no module-level client: one client per request is the vendor's own rule
 * ("Always initialize the Supabase client inside the request handler",
 * kickoff-package.md §4.3). A shared client would carry one request's cookies
 * into another's, and `@supabase/ssr` delivers its cache headers only with the
 * first cookie write of a client's life, so a reused client would leave later
 * responses cacheable.
 *
 * This module imports `@supabase/ssr` only — never `@supabase/supabase-js`
 * directly — so the client type is taken from `createServerClient`'s own return
 * type.
 */

import {
  combineChunks,
  createServerClient,
  stringFromBase64URL,
  type CookieOptions,
  type GetAllCookies,
  type SetAllCookies,
} from '@supabase/ssr';

/** The request-level client, typed from the library rather than from `@supabase/supabase-js`. */
export type RequestSupabase = ReturnType<typeof createServerClient>;

/** The cookie adapter a caller supplies: the proxy passes request/response cookies, a handler passes `cookies()`. */
export interface RequestCookieAdapter {
  getAll: GetAllCookies;
  setAll: SetAllCookies;
}

export interface CreateRequestSupabaseOptions {
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly cookies: RequestCookieAdapter;
  /** `Secure` on the session cookies. False only for a loopback origin, which has no TLS. */
  readonly secure: boolean;
  /**
   * An overall deadline for everything this client does, not just for one call
   * (`proxy.ts`'s `REFRESH_DEADLINE_MS`). Aborting it aborts whatever call is in
   * flight; `SUPABASE_REQUEST_TIMEOUT_MS` still bounds each call on its own.
   */
  readonly signal?: AbortSignal;
}

/**
 * True when `appOrigin` should get `Secure` cookies, i.e. everywhere except a
 * loopback development origin.
 *
 * `Secure` on `http://127.0.0.1` would stop the browser from storing the session
 * at all, so local development and the Playwright suites could never sign in.
 * Everything else — including any `https://` origin and any non-loopback host —
 * gets `Secure`, so a misread origin fails closed (secure), not open.
 */
export function isSecureOrigin(appOrigin: string): boolean {
  let url: URL;
  try {
    url = new URL(appOrigin);
  } catch {
    return true; // Unparseable: assume the stricter setting.
  }
  if (url.protocol === 'https:') return true;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const loopback = host === 'localhost' || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host);
  return !loopback;
}

/**
 * The cookie options every session cookie is written with (kickoff-package.md
 * §4.3). `httpOnly` is the important one: `@supabase/ssr` defaults it to
 * `false` because it assumes a browser client, and Wringy creates none, so the
 * tokens never need to be readable from JavaScript.
 *
 * `maxAge` is deliberately absent: the library overrides whatever is passed with
 * its own fixed 400 days (`{...DEFAULT, ...cookieOptions, maxAge: DEFAULT.maxAge}`).
 * Setting it here would only look like a control that does not exist. Accepted
 * under ruling D14 and recorded in known-issues; the access token's own 1-hour
 * `exp` and the session's liveness check are what actually bound a session.
 */
export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/' };
}

/**
 * Wringy's cookie options laid over whatever the library computed for each
 * cookie it wants to write.
 *
 * This is the guarantee that a library default — notably `httpOnly: false`,
 * which `@supabase/ssr` chooses because it assumes a browser client — can never
 * reach a real `Set-Cookie`. Kept as its own pure function so that guarantee can
 * be tested without constructing a client.
 */
export function withSessionCookieOptions(
  cookiesToSet: readonly { name: string; value: string; options: CookieOptions }[],
  secure: boolean,
): { name: string; value: string; options: CookieOptions }[] {
  const options = sessionCookieOptions(secure);
  return cookiesToSet.map(({ name, value, options: libraryOptions }) => ({
    name,
    value,
    options: { ...libraryOptions, ...options },
  }));
}

/**
 * OPERATIONAL limit on **one call** to the Supabase Auth server (not a business
 * rule), the same 5 s `api-client.ts` puts on one call to Fastify.
 *
 * One call is not the whole operation. `getClaims()` can make two in a row — the
 * JWKS fetch, then `POST /token?grant_type=refresh_token` — so a per-call limit
 * alone bounds a matched `/internal` read at twice this, and at more if auth-js
 * ever adds a hop. `api-client.ts` bounds the whole operation because it *is* one
 * call; the proxy gets the same guarantee from its own overall deadline
 * (`REFRESH_DEADLINE_MS` in `proxy.ts`), handed to `boundedFetch` as `signal`.
 */
export const SUPABASE_REQUEST_TIMEOUT_MS = 5_000;

/**
 * `fetchImpl` with a deadline, for every call the Supabase client makes.
 *
 * auth-js passes no `signal` and sets no timeout of its own, so without this a
 * Supabase Auth endpoint that accepts the connection and never answers would hang
 * the request that is refreshing the session — with undici's 300 s
 * `headersTimeout` as the only backstop. Every other outbound call the web makes
 * is bounded (`api-client.ts`, `api-read.ts`), and this one is on the path of
 * every matched `/internal` read, so it is bounded twice: per call by `timeoutMs`,
 * and for the whole operation by `deadline`, which the caller owns.
 *
 * The per-call timer is deliberately never cleared: the deadline covers the body
 * too, so a server that sends headers and then stalls is an abort rather than a
 * hung page. It is unreferenced so it can never hold the process open. An abort
 * surfaces as auth-js's `AuthRetryableFetchError`, which `isRetryableAuthError`
 * (outcomes.ts) turns into a retry rather than a sign-out.
 */
export function boundedFetch(
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
  deadline?: AbortSignal,
): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer: unknown = setTimeout(() => controller.abort(new Error('supabase request timed out')), timeoutMs);
    (timer as { unref?: () => void }).unref?.();
    // A caller's own signal still wins, so nothing loses the ability to cancel,
    // and the operation's deadline cancels whatever is in flight when it expires.
    const follow = (signal: AbortSignal | null | undefined): void => {
      if (signal === null || signal === undefined) return;
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    };
    follow(init?.signal as AbortSignal | null | undefined);
    follow(deadline);
    return fetchImpl(input, { ...init, signal: controller.signal });
  };
}

/**
 * A request-level Supabase client over the cookies `cookies` reads and writes.
 *
 * The `setAll` wrapper re-applies `sessionCookieOptions` through
 * `withSessionCookieOptions`. The caller's `setAll` still receives the library's
 * headers argument, which the proxy and the handlers ignore in favour of
 * `noStore()` — applied unconditionally, because the library latches those
 * headers to the first write only (R20).
 *
 * Every call the client makes is bounded by `SUPABASE_REQUEST_TIMEOUT_MS`
 * (`boundedFetch`), and `signal` bounds the whole operation when a caller has a
 * deadline of its own.
 */
export function createRequestSupabase({
  supabaseUrl,
  publishableKey,
  cookies,
  secure,
  signal,
}: CreateRequestSupabaseOptions): RequestSupabase {
  // Inside the function, once per request: see the header, and check:supabase-scope.
  return createServerClient(supabaseUrl, publishableKey, {
    global: { fetch: boundedFetch(SUPABASE_REQUEST_TIMEOUT_MS, fetch, signal) },
    cookieOptions: sessionCookieOptions(secure),
    cookies: {
      getAll: cookies.getAll,
      setAll: (cookiesToSet, headers) => cookies.setAll(withSessionCookieOptions(cookiesToSet, secure), headers),
    },
  });
}

// --- Reading the session without refreshing it ------------------------------

/**
 * The cookie name `@supabase/ssr` stores the session under, derived exactly as
 * `supabase-js` derives its default `storageKey`:
 * `` `sb-${new URL(url).hostname.split('.')[0]}-auth-token` ``.
 *
 * Kept as our own one-liner rather than read off a client, so the probe handler
 * can find the cookie without constructing anything. It is always an `sb-*`
 * name, which is what the sign-out and proxy paths match on.
 */
export function sessionStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

/**
 * True for any cookie `@supabase/ssr` may have written on this project's behalf.
 *
 * Deliberately broad — every `sb-*` name, session or not — because it answers the
 * sign-out question: *what must the browser be left holding none of?* That
 * includes the PKCE verifier cookies (`…-code-verifier`, `…-flows-code-verifier`,
 * `…-flow-<id>-code-verifier`). It does **not** answer "did this browser have a
 * session?": `isSessionCookieName` does, because a browser that only started a
 * sign-in holds a verifier and never had a session.
 */
export function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith('sb-');
}

/**
 * True only for the cookie (or a chunk of it) that holds **this project's
 * session**: `sessionStorageKey(supabaseUrl)`, or `<key>.<n>` when the library
 * had to split the value.
 *
 * The narrow question, kept apart from `isSupabaseAuthCookie` on purpose. An
 * abandoned sign-in leaves `<key>-code-verifier` behind with the library's fixed
 * 400-day `maxAge`, so a prefix test would tell `proxy.ts` "a session cookie
 * existed" for up to 400 days and answer "your session ended, so you were signed
 * out" to somebody who never had a session.
 */
export function isSessionCookieName(supabaseUrl: string, name: string): boolean {
  const key = sessionStorageKey(supabaseUrl);
  if (name === key) return true;
  return name.startsWith(`${key}.`) && /^\d+$/.test(name.slice(key.length + 1));
}

/** `base64url`-encoded cookie values carry this prefix; a plain JSON value carries none. */
const BASE64_PREFIX = 'base64-';

/**
 * The access token stored in the session cookie, read **without any refresh**.
 *
 * `POST /internal/session-probe` needs the caller's access token to forward it
 * to the API, and it must not refresh while doing so. Neither accessor the
 * client offers is safe here:
 *
 *  - `getSession()` runs `__loadSession`, which refreshes when the access token
 *    is inside auth-js's 90 s `EXPIRY_MARGIN_MS` (the installed
 *    `GoTrueClient._useSession` says so in as many words);
 *  - `getClaims()` with no argument calls `getSession()` first, so it inherits
 *    exactly the same refresh path. Only `getClaims(jwt)` avoids it, and that
 *    already needs the token this function returns.
 *
 * A refresh in a POST handler would rotate the refresh token and hand the new
 * one to whichever response won the race, which is how concurrent tabs lose a
 * session. So the token is read the way it was written: combine the chunks, undo
 * the `base64url` encoding, parse the JSON, take `access_token`. All three
 * helpers (`combineChunks`, `stringFromBase64URL`) are public `@supabase/ssr`
 * exports, so this is the library's own format, not a guess about it.
 *
 * The token is returned to the caller and never logged, and no caller ever puts
 * it in a page, a URL or a cookie of its own.
 */
export async function readStoredAccessToken(
  supabaseUrl: string,
  readCookie: (name: string) => string | null | undefined,
): Promise<string | null> {
  const key = sessionStorageKey(supabaseUrl);

  let combined: string | null;
  try {
    combined = await combineChunks(key, (name) => readCookie(name) ?? null);
  } catch {
    return null;
  }
  if (combined === null || combined === '') return null;

  let json = combined;
  if (combined.startsWith(BASE64_PREFIX)) {
    try {
      json = stringFromBase64URL(combined.slice(BASE64_PREFIX.length));
    } catch {
      return null; // Chunks from different writes, or a truncated cookie.
    }
  }

  let session: unknown;
  try {
    session = JSON.parse(json);
  } catch {
    return null;
  }

  if (session === null || typeof session !== 'object') return null;
  const { access_token: accessToken } = session as { access_token?: unknown };
  return typeof accessToken === 'string' && accessToken !== '' ? accessToken : null;
}
