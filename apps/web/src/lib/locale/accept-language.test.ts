import { describe, expect, it } from 'vitest';

import { localeForTag, suggestLocale } from './accept-language';

/**
 * The browser's languages as a suggestion (M2-04; m2-04-code-review.md R3 step
 * 4, R13 "web unit"). Playwright's `locale` sends exactly one tag, so the
 * q-list and ordering proof lives here (§1).
 */

describe('M2-AC04/1 suggestion: Accept-Language suggests one of the three languages, in the header’s own order', () => {
  it('M2-AC04/1 suggestion: each supported tag maps to its locale', () => {
    const rows: [string, string][] = [
      ['en', 'en-MY'],
      ['en-GB', 'en-MY'],
      ['en-US', 'en-MY'],
      ['EN-us', 'en-MY'],
      ['ms', 'ms-MY'],
      ['ms-MY', 'ms-MY'],
      ['ms-BN', 'ms-MY'],
      ['zh', 'zh-Hans-MY'],
      ['zh-CN', 'zh-Hans-MY'],
      ['zh-SG', 'zh-Hans-MY'],
      ['zh-Hans', 'zh-Hans-MY'],
      ['zh-Hans-SG', 'zh-Hans-MY'],
      ['zh-Hans-MY', 'zh-Hans-MY'],
      ['zh-MY', 'zh-Hans-MY'],
    ];
    for (const [header, locale] of rows) expect(suggestLocale(header), header).toBe(locale);
  });

  it('M2-AC04/1 suggestion: Traditional Chinese, Indonesian and the wildcard match nothing', () => {
    for (const header of ['zh-Hant', 'zh-Hant-TW', 'zh-Hant-HK', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-yue', 'id', 'id-ID', '*', 'fr-FR']) {
      expect(suggestLocale(header), header).toBeNull();
      expect(localeForTag(header.toLowerCase()), header).toBeNull();
    }
  });

  it('M2-AC04/1 suggestion: q-values order the tags, and ties keep the header’s order', () => {
    expect(suggestLocale('en;q=0.5, ms;q=0.9')).toBe('ms-MY');
    expect(suggestLocale('zh-CN;q=0.8, en-GB;q=0.8, ms;q=0.7')).toBe('zh-Hans-MY');
    expect(suggestLocale('en-GB, ms-MY')).toBe('en-MY');
    expect(suggestLocale('ms-MY,en;q=0.9,zh-CN;q=0.8')).toBe('ms-MY');
    // A bare tag weighs 1, so it beats a weighted one written before it.
    expect(suggestLocale('zh-CN;q=0.9, ms')).toBe('ms-MY');
  });

  it('M2-AC04/1 suggestion: an unmatched tag is passed over for the next one that matches', () => {
    expect(suggestLocale('zh-TW, en;q=0.8')).toBe('en-MY');
    expect(suggestLocale('fr-FR, fr;q=0.9, ms;q=0.1')).toBe('ms-MY');
    expect(suggestLocale('zh-Hant-TW,zh;q=0.9')).toBe('zh-Hans-MY');
  });

  it('M2-AC04/1 suggestion: q=0 means not acceptable, and an unreadable weight drops only its entry', () => {
    expect(suggestLocale('ms;q=0, en;q=0.1')).toBe('en-MY');
    expect(suggestLocale('ms;q=0.000')).toBeNull();
    expect(suggestLocale('ms;q=high, en;q=0.2')).toBe('en-MY');
    expect(suggestLocale('ms;q=1.5, zh;q=0.3')).toBe('zh-Hans-MY');
    expect(suggestLocale('ms;q=0.1234, en;q=0.2')).toBe('en-MY');
  });

  it('M2-AC04/1 suggestion: garbage, an empty header and an absent one suggest nothing', () => {
    for (const header of [null, undefined, '', '   ', ',,,', ';q=1', 'en_US', '<script>', 'e n', 'x'.repeat(4096)]) {
      expect(suggestLocale(header), JSON.stringify(header)?.slice(0, 20)).toBeNull();
    }
  });
});
