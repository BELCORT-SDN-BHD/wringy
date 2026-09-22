// Display formatters. These never write back to state: the demo engine keeps
// integer sen and ISO timestamps, and this module only renders them.
//
// Rules taken from phase-0/foundation/localization-v1.md:
//   - amounts through `Intl.NumberFormat` with currency `MYR`; switching
//     language changes the format only, never the amount;
//   - event times through `Intl.DateTimeFormat` with an explicit
//     `Asia/Kuala_Lumpur` time zone and a written month, never a bare 09/11/2026;
//   - known-zero, unknown and not-applicable are different things, and an
//     unknown amount must never render as RM 0.00.

import { CURRENCY, TIMEZONE, type IsoDateTime, type Locale, type Sen } from '@/domain/types';

/** Written next to a localized "Unknown" label. Deliberately not "0". */
export const UNKNOWN_PLACEHOLDER = '—';

/** The offset hint every absolute time carries, per localization-v1. */
export const UTC_OFFSET_HINT = 'UTC+08:00';

const currencyFormatters = new Map<Locale, Intl.NumberFormat>();
const numberFormatters = new Map<Locale, Intl.NumberFormat>();
const dateTimeFormatters = new Map<Locale, Intl.DateTimeFormat>();
const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();

function currencyFormatter(locale: Locale): Intl.NumberFormat {
  let formatter = currencyFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(locale, formatter);
  }
  return formatter;
}

function numberFormatter(locale: Locale): Intl.NumberFormat {
  let formatter = numberFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale);
    numberFormatters.set(locale, formatter);
  }
  return formatter;
}

function dateTimeFormatter(locale: Locale): Intl.DateTimeFormat {
  let formatter = dateTimeFormatters.get(locale);
  if (!formatter) {
    // `month: 'short'` keeps the month written; `hourCycle: 'h23'` avoids both
    // am/pm ambiguity and a 24:30 reading at midnight.
    formatter = new Intl.DateTimeFormat(locale, {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    dateTimeFormatters.set(locale, formatter);
  }
  return formatter;
}

function dateFormatter(locale: Locale): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    dateFormatters.set(locale, formatter);
  }
  return formatter;
}

/**
 * Integer sen to a currency string, e.g. 500 -> "RM 5.00" (en-MY, ms-MY) or
 * "MYR 5.00" (zh-Hans-MY, where ICU prefers the code). The number is identical
 * in all three; only the presentation differs.
 */
export function formatSen(sen: Sen, locale: Locale): string {
  return currencyFormatter(locale).format(sen / 100);
}

/** Placeholder for a value that is genuinely unknown. Never renders 0. */
export function formatUnknown(): string {
  return UNKNOWN_PLACEHOLDER;
}

/** Amount, or the unknown placeholder. Use when the source may not have answered. */
export function formatSenOrUnknown(sen: Sen | null | undefined, locale: Locale): string {
  return sen === null || sen === undefined ? formatUnknown() : formatSen(sen, locale);
}

/** Qualified-view counts. The unit and its definition are supplied by the caller's copy. */
export function formatViews(views: number, locale: Locale): string {
  return numberFormatter(locale).format(views);
}

export function formatViewsOrUnknown(views: number | null | undefined, locale: Locale): string {
  return views === null || views === undefined ? formatUnknown() : formatViews(views, locale);
}

/** Any other integer count. */
export function formatCount(value: number, locale: Locale): string {
  return numberFormatter(locale).format(value);
}

/**
 * Absolute event time in Malaysia time with the offset written out, e.g.
 * "1 Sept 2026, 12:00 (UTC+08:00)". Used for deadlines, payouts and every
 * "last confirmed at" so a page refresh is never mistaken for the event time.
 */
export function formatDateTime(iso: IsoDateTime, locale: Locale): string {
  return `${dateTimeFormatter(locale).format(new Date(iso))} (${UTC_OFFSET_HINT})`;
}

/** Same instant without the offset suffix, for places that show the hint separately. */
export function formatDateTimeBare(iso: IsoDateTime, locale: Locale): string {
  return dateTimeFormatter(locale).format(new Date(iso));
}

export function formatDateTimeOrUnknown(
  iso: IsoDateTime | null | undefined,
  locale: Locale,
): string {
  return iso === null || iso === undefined ? formatUnknown() : formatDateTime(iso, locale);
}

/**
 * A calendar day with a written month. Takes the date in Malaysia time, so a
 * plain calendar date never slips to the previous day through UTC.
 */
export function formatDateOnly(iso: IsoDateTime, locale: Locale): string {
  return dateFormatter(locale).format(new Date(iso));
}

/** Machine-readable value for `<time dateTime>`; keeps the original offset. */
export function toDateTimeAttribute(iso: IsoDateTime): string {
  return iso;
}
