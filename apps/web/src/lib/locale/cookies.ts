/**
 * The internal build's four language cookies: their names, their options and
 * the writers the Route Handlers use (M2-04; docs/m2-internal/m2-04-code-review.md
 * R3, R4, R6, and the cookie table in §3).
 *
 * This is the one module that names them. The guest cookie keeps the name the
 * demo already writes (`LOCALE_COOKIE` in `@/i18n/config`), so the two builds
 * cannot drift apart on it; the other three are the internal build's own.
 *
 * | Cookie                  | Meaning                                                      | httpOnly |
 * |-------------------------|--------------------------------------------------------------|----------|
 * | `wringy-locale`         | the guest's explicit saved preference (a signed-out choose)   | no       |
 * | `wringy-locale-session` | an explicit choice the signed-in account does not yet hold, with the instant it was made (`<locale>.<epoch ms>`) | yes |
 * | `wringy-locale-carry`   | the choice made on the sign-in page, for the sign-in that starts now (10 min, `/auth`) | yes |
 * | `wringy-locale-prompt`  | the first-visit prompt was answered or skipped this browsing session | yes |
 *
 * `sameSite: 'lax'` everywhere, because the callback is a cross-site top-level
 * GET from Google and `Strict` would drop the carry cookie there. `Secure`
 * follows `isSecureOrigin` (the caller passes it: this module imports nothing
 * that reaches a Supabase library, so a client component may read the names).
 * `wringy-locale` is not httpOnly: the demo writes it from script, a script
 * write over an httpOnly cookie is silently ignored, and the switch reads it
 * back to tell a refused store from a saved one (R5).
 *
 * `wringy-locale-session` holds what the glossary (`CONTEXT.md`) calls the
 * **unsaved choice**; the code's names for it — the session choice, `unsaved`,
 * `writeUnsaved` — all mean that one thing.
 *
 * The session and prompt cookies have no `maxAge`: they live for the browsing
 * session. The carry cookie shares the return-path cookie's lifetime and scope
 * (`AUTH_NEXT_COOKIE_MAX_AGE_SECONDS`, `/auth`), so a choice made on the
 * sign-in page is carried only by a sign-in that starts within ten minutes.
 */

import { isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/config';
import { AUTH_NEXT_COOKIE_MAX_AGE_SECONDS, AUTH_NEXT_COOKIE_PATH } from '@/lib/auth/wire';

/** The guest's explicit saved preference. The same cookie the demo writes. */
export const GUEST_LOCALE_COOKIE = LOCALE_COOKIE;

/** An explicit choice the signed-in account does not hold yet (a failed save or a failed carry). */
export const LOCALE_SESSION_COOKIE = 'wringy-locale-session';

/** The choice made on the sign-in page, carried into the account by the sign-in that follows. */
export const LOCALE_CARRY_COOKIE = 'wringy-locale-carry';

/** The first-visit prompt was answered or skipped in this browsing session. */
export const LOCALE_PROMPT_COOKIE = 'wringy-locale-prompt';

/** One year, as the demo's own writer (`src/i18n/locale-cookie.ts`) keeps the guest cookie. */
export const GUEST_LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The value the prompt cookie carries; only its presence is read. */
export const PROMPT_DONE_VALUE = '1';

export type CookieOptions = Record<string, unknown>;

export function guestLocaleCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: false, sameSite: 'lax', secure, path: '/', maxAge: GUEST_LOCALE_MAX_AGE_SECONDS };
}

export function sessionChoiceCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}

export function promptCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}

export function carryCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: AUTH_NEXT_COOKIE_PATH, maxAge: AUTH_NEXT_COOKIE_MAX_AGE_SECONDS };
}

/**
 * The part of the M2-02 `CookieJar` (`@/lib/auth/route-support`) the writers use.
 * Named structurally so this module stays free of `next/headers` and can be
 * read by the client for the cookie names.
 */
export interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): void;
  expire(name: string, options: CookieOptions): void;
}

/** A signed-out `choose` (R4): the guest's preference in this browser. */
export function writeGuestChoice(jar: CookieWriter, locale: Locale, secure: boolean): void {
  jar.set(GUEST_LOCALE_COOKIE, locale, guestLocaleCookieOptions(secure));
}

/**
 * The unsaved choice as the cookie holds it: the locale and the instant it was
 * made, `<locale>.<epoch ms>` on this web host's clock (e.g. `ms-MY.1790000000000`).
 *
 * The instant is what lets a newer explicit choice outrank it (`resolve.ts`): a
 * render cannot expire a cookie, so a choice that failed to save here and was
 * then overtaken by a save on another device would otherwise decide this
 * browser's page again — with a Retry that writes the older choice over the
 * newer one. It is compared with `profiles.locale_pref_set_at`, the database's
 * clock; skew between the two hosts can misorder only choices made within that
 * skew of each other, a display preference off by seconds at most.
 */
export interface UnsavedChoice {
  readonly locale: Locale;
  /** Epoch milliseconds when this browser's choice was made. */
  readonly at: number;
}

export function unsavedChoiceValue({ locale, at }: UnsavedChoice): string {
  return `${locale}.${Math.trunc(at)}`;
}

/** The stamp's digits: a non-negative whole number of milliseconds. */
const EPOCH_MS = /^\d{1,15}$/;

/**
 * A raw `wringy-locale-session` value, read back. Unstamped (a value written
 * before the stamp existed), malformed or naming no locale is `null`, which
 * counts as absent: a choice of unknown age never outranks the account.
 */
export function readUnsavedChoice(raw: string | null | undefined): UnsavedChoice | null {
  if (typeof raw !== 'string') return null;
  const dot = raw.indexOf('.');
  if (dot < 0) return null;
  const locale = raw.slice(0, dot);
  const stamp = raw.slice(dot + 1);
  if (!isLocale(locale) || !EPOCH_MS.test(stamp)) return null;
  return { locale, at: Number(stamp) };
}

/** A signed-in choice the account could not take (R4), or a carry that failed (R6), stamped now. */
export function writeUnsaved(jar: CookieWriter, locale: Locale, secure: boolean): void {
  jar.set(LOCALE_SESSION_COOKIE, unsavedChoiceValue({ locale, at: Date.now() }), sessionChoiceCookieOptions(secure));
}

/** The account holds the choice now, or the session it belonged to has ended (R4, R6). */
export function expireUnsaved(jar: CookieWriter, secure: boolean): void {
  jar.expire(LOCALE_SESSION_COOKIE, sessionChoiceCookieOptions(secure));
}

/** A signed-out `choose`: carried by a sign-in that starts within ten minutes (R6). */
export function writeCarry(jar: CookieWriter, locale: Locale, secure: boolean): void {
  jar.set(LOCALE_CARRY_COOKIE, locale, carryCookieOptions(secure));
}

/**
 * The callback, once the API has answered for a person: a sign-in it let in, or a
 * refusal naming who was signing in (R6 rev 3). An attempt that failed before
 * that keeps the carry for the retry. The path must match the write's, or the
 * browser keeps it.
 */
export function expireCarry(jar: CookieWriter, secure: boolean): void {
  jar.expire(LOCALE_CARRY_COOKIE, carryCookieOptions(secure));
}

/** A `choose` or a `skip`: the prompt is not shown again in this browsing session. */
export function writePromptDone(jar: CookieWriter, secure: boolean): void {
  jar.set(LOCALE_PROMPT_COOKIE, PROMPT_DONE_VALUE, promptCookieOptions(secure));
}

/**
 * The expiry of the session-choice cookie as a plain write, for `proxy.ts`,
 * which writes straight onto its `NextResponse` rather than through a jar.
 */
export function unsavedExpiry(secure: boolean): { name: string; value: string; options: CookieOptions } {
  return { name: LOCALE_SESSION_COOKIE, value: '', options: { ...sessionChoiceCookieOptions(secure), maxAge: 0 } };
}

/**
 * The raw language cookies a request arrived with. Values are unchecked:
 * `resolveLocale` reads the guest's through `isLocale` and the session choice
 * through `readUnsavedChoice`.
 */
export interface LocaleCookies {
  readonly sessionChoice: string | undefined;
  readonly guestChoice: string | undefined;
  readonly promptDone: boolean;
}

export function readLocaleCookies(read: (name: string) => string | undefined): LocaleCookies {
  return {
    sessionChoice: read(LOCALE_SESSION_COOKIE),
    guestChoice: read(GUEST_LOCALE_COOKIE),
    promptDone: read(LOCALE_PROMPT_COOKIE) !== undefined,
  };
}

/**
 * Whether a `document.cookie` string holds `wringy-locale=<locale>` exactly:
 * how the switch tells a refused store from a saved one after a guest answer
 * (R5). A prefix match would take `wringy-locale-x=` for it.
 */
export function guestCookieHolds(cookieHeader: string, locale: Locale): boolean {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${GUEST_LOCALE_COOKIE}=${locale}`);
}
