/**
 * The browser's languages as a **suggestion** (M2-04; m2-04-code-review.md R3
 * step 4; localization-v1 "浏览器语言只用于建议").
 *
 * The request's `Accept-Language`, read on the server so the first byte is
 * already in the suggested language (§5: `navigator.languages` would mean a
 * flash). The header's own q-values decide the order, ties keep the header's
 * order, and the first tag that names one of Wringy's three languages wins:
 *
 * - `en*` → `en-MY`; `ms*` → `ms-MY`;
 * - `zh`, `zh-Hans*`, `zh-CN`, `zh-SG` (and `zh-MY`, see below) → `zh-Hans-MY`;
 * - `zh-Hant*`, `zh-TW`, `zh-HK`, `zh-MO` match nothing: Wringy has no
 *   Traditional Chinese, so such a visitor sees English with the prompt
 *   offering 简体中文 by its real name, and chooses;
 * - `*`, `id` (Malay is never Indonesian), anything else, garbage: nothing.
 *
 * `zh-MY` is not in R3's list; it maps to `zh-Hans-MY` because Chinese in
 * Malaysia is written in Simplified script, which is exactly the locale's own
 * region (recorded as a deviation in the build report).
 *
 * A tag with `q=0` is "not acceptable" (RFC 9110 §12.4.2) and is skipped; an
 * entry whose weight does not parse is ignored rather than guessed at.
 * Pure, so every row is a unit test.
 */

import type { Locale } from '@/i18n/config';

/** More than any real browser sends; bounds the work on a hostile header. */
const MAX_ENTRIES = 32;

/** RFC 9110's `qvalue`: 0 to 1 with at most three decimals. */
const QVALUE = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

/** A language range: letters and digits in hyphen-separated subtags, or `*`. */
const LANGUAGE_RANGE = /^(?:\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)$/;

const TRADITIONAL_REGIONS = new Set(['tw', 'hk', 'mo']);
const SIMPLIFIED_REGIONS = new Set(['cn', 'sg', 'my']);

/** The locale one language range suggests, or null. */
export function localeForTag(tag: string): Locale | null {
  const subtags = tag.toLowerCase().split('-');
  const [primary, ...rest] = subtags;

  if (primary === 'en') return 'en-MY';
  if (primary === 'ms') return 'ms-MY';
  if (primary !== 'zh') return null;

  const script = rest.find((subtag) => subtag.length === 4);
  if (script === 'hans') return 'zh-Hans-MY';
  if (script !== undefined) return null; // `hant`, or a script Wringy does not write.

  const region = rest.find((subtag) => subtag.length === 2 || /^\d{3}$/.test(subtag));
  if (region === undefined) return rest.length === 0 ? 'zh-Hans-MY' : null;
  if (TRADITIONAL_REGIONS.has(region)) return null;
  return SIMPLIFIED_REGIONS.has(region) ? 'zh-Hans-MY' : null;
}

interface Weighted {
  readonly tag: string;
  readonly q: number;
  readonly position: number;
}

function parse(header: string): Weighted[] {
  const entries: Weighted[] = [];
  const parts = header.split(',').slice(0, MAX_ENTRIES);
  parts.forEach((part, position) => {
    const [rawTag, ...params] = part.split(';').map((piece) => piece.trim());
    const tag = (rawTag ?? '').toLowerCase();
    if (!LANGUAGE_RANGE.test(tag)) return;

    let q = 1;
    for (const param of params) {
      const [name, value] = param.split('=').map((piece) => piece.trim());
      if (name?.toLowerCase() !== 'q') continue;
      if (value === undefined || !QVALUE.test(value)) return; // An unreadable weight: ignore the entry.
      q = Number(value);
    }
    if (q <= 0) return;
    entries.push({ tag, q, position });
  });
  return entries;
}

/** The suggested locale for an `Accept-Language` header, or null when nothing in it matches. */
export function suggestLocale(header: string | null | undefined): Locale | null {
  if (typeof header !== 'string' || header.trim() === '') return null;

  const ordered = parse(header).sort((left, right) => right.q - left.q || left.position - right.position);
  for (const { tag } of ordered) {
    const locale = localeForTag(tag);
    if (locale !== null) return locale;
  }
  return null;
}
