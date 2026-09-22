import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { TIMEZONE } from '@/domain/types';

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';

/**
 * next-intl request configuration. There is no `[locale]` route segment
 * (kickoff decision 8), so the locale comes from the `wringy-locale` cookie
 * that the persisted session mirrors, and falls back to `en-MY`.
 */
export default getRequestConfig(async ({ locale: requested }) => {
  const explicit = isLocale(requested) ? requested : undefined;
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = explicit ?? (isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE);

  return {
    locale,
    timeZone: TIMEZONE,
    messages: (await import(`../messages/${locale}/common.json`)).default,
  };
});
