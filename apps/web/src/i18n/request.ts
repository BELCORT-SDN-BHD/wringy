import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { TIMEZONE } from '@/domain/types';
import { appMode } from '@/lib/auth/mode';
import { resolveInternalLocale } from '@/lib/locale/read';

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { getMessages } from './messages';

/**
 * next-intl request configuration. There is no `[locale]` route segment
 * (kickoff decision 8), so the locale comes from the `wringy-locale` cookie
 * that the persisted session mirrors, and falls back to `en-MY`.
 *
 * This only drives server-rendered output (page metadata and the initial
 * `<html lang>`). Client components read their messages from `LocaleProvider`,
 * which switches in place from the persisted session without navigating.
 *
 * The internal build (`WRINGY_APP_MODE=internal`) resolves its language in
 * localization-v1's order instead — the unsaved session choice, the account's
 * preference, the guest's cookie, the browser's suggestion, English
 * (M2-04; m2-04-code-review.md R3) — through `resolveInternalLocale()`, which is
 * cached per request, so the layout, the metadata and every page agree. The demo
 * branch below is M1's, unchanged.
 */
export default getRequestConfig(async ({ locale: requested }) => {
  const explicit = isLocale(requested) ? requested : undefined;

  if (appMode() === 'internal') {
    const locale: Locale = explicit ?? (await resolveInternalLocale()).locale;
    return { locale, timeZone: TIMEZONE, messages: getMessages(locale) };
  }

  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = explicit ?? (isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE);

  return {
    locale,
    timeZone: TIMEZONE,
    messages: getMessages(locale),
  };
});
