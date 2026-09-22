'use client';

import { useLocale } from 'next-intl';

import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';

/**
 * The locale the current render is using, taken from the intl provider rather
 * than the store, so a formatted amount and the text around it can never come
 * from two different languages.
 */
export function useAppLocale(): Locale {
  const locale = useLocale();
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
