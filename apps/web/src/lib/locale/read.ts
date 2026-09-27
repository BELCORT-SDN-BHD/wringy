/**
 * The internal build's language, resolved on the server for one request
 * (M2-04; m2-04-code-review.md R3 rev 2). Server only: it reads `next/headers`.
 *
 * `src/i18n/request.ts` calls `resolveInternalLocale()` in internal mode, so the
 * layout, `generateMetadata`, every `getTranslations` and the page all agree on
 * one answer: next-intl's own request config is `cache()`-wrapped, and so is
 * this (executed, record §1).
 *
 * ## The account read, and its own bound
 *
 * The account's preference comes from `GET /me`, through `readMe()`, one
 * `React.cache`d read per request keyed by token and base URL. `/internal`'s page
 * reads `/me` through the same function, so it makes one call, not two. Every
 * page awaits its translations before its own reads, so a slow `/me` here would
 * delay the whole page: the preference is therefore raced against
 * `ACCOUNT_READ_BUDGET_MS`. On timeout it is `'unknown'` and the order simply
 * continues (the guest cookie, the browser, English), while the read itself keeps
 * running for the page that needs its answer.
 *
 * ## Where the token comes from, and one caveat
 *
 * The token is `accessTokenFromHeaders()`, which `proxy.ts` sets from a session it
 * just verified on every matched internal read, after removing whatever a client
 * sent. The sign-in and not-found pages are passed through without a session
 * check, so there the visitor resolves as signed out. On a path the proxy's
 * matcher excludes (`/internal/x.png`) a client-sent token header reaches the
 * render unstripped; what it can learn is the language preference of a token the
 * caller already holds, because the API verifies every token it is sent.
 */

import { cache } from 'react';
import { cookies, headers } from 'next/headers';

import { meResponseSchema, type MeResponse } from '@wringy/contracts';
import { accessTokenFromHeaders, apiFetch, type ApiResult } from '@/lib/auth/api-client';
import { internalAuthEnv } from '@/lib/auth/env';

import { readLocaleCookies } from './cookies';
import { resolveLocale, type AccountPreference, type ResolvedLocale } from './resolve';

/**
 * OPERATIONAL bound on how long the language waits for the account's preference
 * (not a business rule). The page's own reads keep `API_REQUEST_TIMEOUT_MS`.
 */
export const ACCOUNT_READ_BUDGET_MS = 1_500;

/**
 * `GET /me` for this request, shared by the language resolution and `/internal`'s
 * page: the full result, so the page can still redirect on a refusal.
 */
export const readMe = cache(
  (token: string | null, baseUrl: string): Promise<ApiResult<MeResponse>> =>
    apiFetch('/me', { baseUrl, token, schema: meResponseSchema }),
);

/** The preference a `/me` answer carries; any failure is `'unknown'`, never "none". */
export function accountPreferenceOf(result: ApiResult<MeResponse>): AccountPreference {
  return result.kind === 'ok' ? result.data.profile.localePref : 'unknown';
}

/** The preference, or `'unknown'` once `budgetMs` has passed. The read is not cancelled. */
export async function accountPreferenceWithin(
  read: Promise<ApiResult<MeResponse>>,
  budgetMs: number = ACCOUNT_READ_BUDGET_MS,
): Promise<AccountPreference> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<AccountPreference>((resolve) => {
    timer = setTimeout(() => resolve('unknown'), budgetMs);
    (timer as { unref?: () => void }).unref?.();
  });
  try {
    return await Promise.race([read.then(accountPreferenceOf), expired]);
  } finally {
    clearTimeout(timer);
  }
}

/** The language of this internal-mode request. Call only in internal mode: the token header is trusted only there. */
export const resolveInternalLocale = cache(async (): Promise<ResolvedLocale> => {
  const [jar, requestHeaders, token] = await Promise.all([cookies(), headers(), accessTokenFromHeaders()]);
  const env = internalAuthEnv();

  const accountPreference: AccountPreference =
    token !== null && env.ok ? await accountPreferenceWithin(readMe(token, env.env.apiInternalUrl)) : 'unknown';
  const stored = readLocaleCookies((name) => jar.get(name)?.value);

  return resolveLocale({
    signedIn: token !== null,
    sessionChoice: stored.sessionChoice,
    accountPreference,
    guestChoice: stored.guestChoice,
    acceptLanguage: requestHeaders.get('accept-language'),
    promptDone: stored.promptDone,
  });
});
