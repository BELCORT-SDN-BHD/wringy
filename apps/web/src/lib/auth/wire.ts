/**
 * The names the web's own parts use to talk to each other (M2-02 R10, R12).
 *
 * They live in their own module, with no imports, because both ends need them:
 * `proxy.ts` writes the header and the page reads it, the sign-in handler writes
 * the cookie and the callback consumes it. Importing either end from the other
 * would drag `next/headers` into the proxy, where it does not belong.
 */

/**
 * The internal request header that carries the verified access token from
 * `proxy.ts` to a Server Component (R10).
 *
 * The token reaches Server Components this way and no other: a Server Component
 * must not create a Supabase client, because `getSession()`/`getClaims()` would
 * refresh inside auth-js's 90 s expiry margin and lose the rotated refresh token
 * (a page cannot set cookies, so the new one would be dropped).
 *
 * `proxy.ts` therefore **always** overwrites or deletes this header on every
 * request it matches, before deciding anything. A client that sends
 * `x-wringy-access-token: <forged>` can never have it survive, so the page can
 * treat it as trustworthy.
 */
export const ACCESS_TOKEN_HEADER = 'x-wringy-access-token';

/**
 * The short-lived cookie that carries the return path across the provider leg
 * (R10). `next` is not put in `redirectTo`: that stays the constant
 * `APP_ORIGIN + '/auth/callback'`, so an exact redirect allow-list entry works
 * in every environment (Supabase validates `redirect_to` against the Site URL
 * before the glob list).
 *
 * Written by `POST /auth/sign-in`, read and deleted by `GET /auth/callback`.
 */
export const AUTH_NEXT_COOKIE = 'wringy-auth-next';

/** `path: '/auth'` scopes it to the two handlers that use it, so it is not sent with every page request. */
export const AUTH_NEXT_COOKIE_PATH = '/auth';

/** Ten minutes: long enough for a Google consent screen, short enough not to linger. */
export const AUTH_NEXT_COOKIE_MAX_AGE_SECONDS = 600;
