import { LOCALES, type Locale } from '@/domain/types';

/** Cookie the session writes so server rendering knows the chosen locale. */
export const LOCALE_COOKIE = 'wringy-locale';

/** Used until the visitor chooses (kickoff decision 8: no locale routing). */
export const DEFAULT_LOCALE: Locale = 'en-MY';

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

export { LOCALES };
export type { Locale };
