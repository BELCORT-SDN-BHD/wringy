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
 * The bound decides the language, not the render. `/internal`'s page awaits the
 * same `/me` read for its own content (the profile, the Language card) under
 * `apiFetch`'s 5 s, so when `/me` answers between 1.5 s and 5 s that page renders
 * when it answers, in the language resolved without the account, while its card
 * shows the saved preference from the same answer. No other internal page awaits
 * `/me`, so a slow `/me` holds them for 1.5 s at most (`read.test.ts` pins both
 * halves: the language at 1.5 s, the page's read when `/me` answers).
 *
 * ## Where the token comes from, and one caveat
 *
 * The token is `accessTokenFromHeaders()`, which `proxy.ts` sets from a session it
 * just verified on every matched internal read, after removing whatever a client
 * sent. The sign-in and not-found pages are passed through without a session
 * check, so there the visitor resolves as signed out; a session cookie in the jar
 * (`holdsSessionCookie`, the proxy's own test) only keeps the prompt from asking
 * somebody whose account nobody read (`resolve.ts`). On a path the proxy's
 * matcher excludes (`/internal/x.png`) a client-sent token header reaches the
 * render unstripped; what it can learn is the language preference of a token the
 * caller already holds, because the API verifies every token it is sent.
 */

import { cache } from 'react';
import { cookies, headers } from 'next/headers';

import { meResponseSchema, type MeResponse } from '@wringy/contracts';
import { accessTokenFromHeaders, apiFetch, type ApiResult } from '@/lib/auth/api-client';
import { internalAuthEnv } from '@/lib/auth/env';
import { holdsSessionCookie } from '@/lib/auth/supabase-server';

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

/**
 * What the account read says about the language: the preference, and the instant
 * it was set (`localePrefSetAt`), which the resolution compares with an unsaved
 * choice's stamp so the newer explicit choice decides.
 */
export interface AccountLanguage {
  readonly preference: AccountPreference;
  readonly setAt: string | null;
}

/** Nothing known about the account: no token, a failed read, or one that ran out of time. */
export const UNKNOWN_ACCOUNT: AccountLanguage = { preference: 'unknown', setAt: null };

/** The language a `/me` answer carries; any failure is `'unknown'`, never "none". */
export function accountLanguageOf(result: ApiResult<MeResponse>): AccountLanguage {
  if (result.kind !== 'ok') return UNKNOWN_ACCOUNT;
  const { localePref, localePrefSetAt } = result.data.profile;
  return { preference: localePref, setAt: localePrefSetAt };
}

/** The account's language, or `UNKNOWN_ACCOUNT` once `budgetMs` has passed. The read is not cancelled. */
export async function accountLanguageWithin(
  read: Promise<ApiResult<MeResponse>>,
  budgetMs: number = ACCOUNT_READ_BUDGET_MS,
): Promise<AccountLanguage> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<AccountLanguage>((resolve) => {
    timer = setTimeout(() => resolve(UNKNOWN_ACCOUNT), budgetMs);
    (timer as { unref?: () => void }).unref?.();
  });
  try {
    return await Promise.race([read.then(accountLanguageOf), expired]);
  } finally {
    clearTimeout(timer);
  }
}

/** The language of this internal-mode request. Call only in internal mode: the token header is trusted only there. */
export const resolveInternalLocale = cache(async (): Promise<ResolvedLocale> => {
  const [jar, requestHeaders, token] = await Promise.all([cookies(), headers(), accessTokenFromHeaders()]);
  const env = internalAuthEnv();

  const account = token !== null && env.ok ? await accountLanguageWithin(readMe(token, env.env.apiInternalUrl)) : UNKNOWN_ACCOUNT;
  const stored = readLocaleCookies((name) => jar.get(name)?.value);

  return resolveLocale({
    signedIn: token !== null,
    holdsSessionCookie: env.ok && holdsSessionCookie(env.env.supabaseUrl, jar.getAll()),
    sessionChoice: stored.sessionChoice,
    accountPreference: account.preference,
    accountPreferenceSetAt: account.setAt,
    guestChoice: stored.guestChoice,
    acceptLanguage: requestHeaders.get('accept-language'),
    promptDone: stored.promptDone,
  });
});
