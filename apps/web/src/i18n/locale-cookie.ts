import { LOCALE_COOKIE } from './config';
import type { Locale } from './config';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Mirrors the persisted session locale into a cookie so server rendering
 * (page metadata, the initial `<html lang>`) agrees with the client.
 *
 * Returns false when the browser refused to store it. The caller must then say
 * "language switched, preference not saved" rather than claim a saved
 * preference (localization-v1: never show a false save success).
 */
export function writeLocaleCookie(locale: Locale): boolean {
  if (typeof document === 'undefined') return false;
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    return document.cookie.includes(`${LOCALE_COOKIE}=${locale}`);
  } catch {
    return false;
  }
}

export function readLocaleCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    return document.cookie
      .split('; ')
      .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
      ?.slice(LOCALE_COOKIE.length + 1);
  } catch {
    return undefined;
  }
}
