/**
 * The internal build's language resolution, as one pure function (M2-04;
 * m2-04-code-review.md R3 rev 2; localization-v1 "未来产品解析顺序").
 *
 * Evaluated on the server for every internal-mode request (`read.ts`), in
 * localization-v1's order, with each cookie's meaning fixed so a stale device
 * cannot game the order:
 *
 * 1. `session` — `wringy-locale-session`, an explicit choice the account does
 *    not hold yet (a failed save or a failed carry). Read only when the request
 *    carries a token: a leftover with no session belongs to nobody. A value the
 *    account is known to hold already (saved since, on this device or another)
 *    is not unsaved: the account decides, so no notice says "not saved" beside a
 *    card that says "Saved".
 * 2. `account` — the signed-in person's `profiles.locale_pref`. `'unknown'` when
 *    there is no token or the read failed or ran out of time: the order simply
 *    continues.
 * 3. `guest` — `wringy-locale`, the guest's explicit preference in this browser.
 * 4. `browser` — `Accept-Language`, as a suggestion only (`accept-language.ts`).
 * 5. `default` — `en-MY`.
 *
 * So a choice saved on one device shows on the next render of every other: a
 * device holds a session cookie only while its own choice is unsaved, and a
 * fresh unsaved choice still outranks the account ("当前会话新的明确选择优先，
 * 不被旧账号记录静默覆盖").
 *
 * The first-visit prompt shows when the language is only a suggestion
 * (`browser` or `default`), the prompt cookie is absent, and the visitor is known
 * to have no preference to be asked about: a guest (no session cookie at all), or
 * a signed-in person whose account is known to hold none. Never when the account
 * read is `'unknown'`: a person with a saved preference is not asked again
 * because the API blinked ("有已保存偏好的用户不会反复被问").
 *
 * The sign-in and not-found pages render without a token whatever the browser
 * holds (`read.ts`), so there the language resolves as a guest's, and `POST
 * /internal/locale` treats a choice made there the same way: the guest's,
 * carried only into the account of the sign-in that follows. A session cookie in
 * the jar there still means somebody may be signed in whose account nobody read,
 * which for the prompt is `'unknown'`: not asked. On a shared device that keeps
 * the next person from being asked there too, until the cookie is gone (a sign-in
 * or a sign-out replaces it); the header's Language control switches for them all
 * the same.
 *
 * Every raw cookie value passes `isLocale`; an invalid value counts as absent.
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';

import { suggestLocale } from './accept-language';

/** Which step decided. Rendered as `<body data-locale-source>`. */
export type LocaleSource = 'session' | 'account' | 'guest' | 'browser' | 'default';

/** The account's preference: a locale, `null` (none saved), or `'unknown'` (no token, or the read failed). */
export type AccountPreference = Locale | null | 'unknown';

export interface ResolveInput {
  /** The request carries an access token (the proxy verified a session). */
  readonly signedIn: boolean;
  /**
   * The browser holds this project's session cookie, verified or not. Without a
   * token (the sign-in and not-found pages) it is the only sign that somebody may
   * be signed in, and it decides the prompt alone, never the language.
   */
  readonly holdsSessionCookie: boolean;
  /** Raw `wringy-locale-session`. */
  readonly sessionChoice: string | null | undefined;
  readonly accountPreference: AccountPreference;
  /** Raw `wringy-locale`. */
  readonly guestChoice: string | null | undefined;
  readonly acceptLanguage: string | null | undefined;
  /** `wringy-locale-prompt` is present. */
  readonly promptDone: boolean;
}

export interface ResolvedLocale {
  readonly locale: Locale;
  readonly source: LocaleSource;
  /** As read; signed out it is `'unknown'` whatever the input said, because there is no account to ask. */
  readonly accountPreference: AccountPreference;
  /** The session cookie's value when it decided: the language is switched, the preference not saved. */
  readonly unsaved: Locale | null;
  readonly showPrompt: boolean;
}

const valid = (value: string | null | undefined): Locale | null =>
  isLocale(value ?? undefined) ? (value as Locale) : null;

export function resolveLocale(input: ResolveInput): ResolvedLocale {
  const accountPreference: AccountPreference = input.signedIn ? input.accountPreference : 'unknown';
  const sessionChoice = input.signedIn ? valid(input.sessionChoice) : null;
  const guestChoice = valid(input.guestChoice);

  const decided = ((): { locale: Locale; source: LocaleSource } => {
    // Equal to the account's known preference, the choice is saved: the account step decides.
    if (sessionChoice !== null && sessionChoice !== accountPreference) return { locale: sessionChoice, source: 'session' };
    if (accountPreference !== null && accountPreference !== 'unknown') return { locale: accountPreference, source: 'account' };
    if (guestChoice !== null) return { locale: guestChoice, source: 'guest' };
    const suggested = suggestLocale(input.acceptLanguage);
    if (suggested !== null) return { locale: suggested, source: 'browser' };
    return { locale: DEFAULT_LOCALE, source: 'default' };
  })();

  const onlySuggested = decided.source === 'browser' || decided.source === 'default';
  // A guest is asked, and an account known to hold none. A session cookie this render did not verify is an account nobody read.
  const mayAsk = input.signedIn ? accountPreference === null : !input.holdsSessionCookie;

  return {
    ...decided,
    accountPreference,
    unsaved: decided.source === 'session' ? decided.locale : null,
    showPrompt: onlySuggested && !input.promptDone && mayAsk,
  };
}
