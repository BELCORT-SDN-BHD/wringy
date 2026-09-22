import { describe, expect, it } from 'vitest';

import { LOCALES } from '@/domain/types';

import {
  UNKNOWN_PLACEHOLDER,
  formatDateOnly,
  formatDateTime,
  formatSen,
  formatSenOrUnknown,
  formatUnknown,
  formatViews,
  formatViewsOrUnknown,
} from './format';

describe('formatSen', () => {
  it('renders integer sen as a two-decimal MYR amount', () => {
    // ICU puts a no-break space after the symbol; assert the real bytes.
    expect(formatSen(500, 'en-MY')).toBe('RM 5.00');
    expect(formatSen(199500, 'en-MY')).toBe('RM 1,995.00');
    expect(formatSen(0, 'en-MY')).toBe('RM 0.00');
  });

  it('keeps the same amount in every locale, changing only the presentation', () => {
    const digits = (value: string) => value.replace(/[^\d.,]/g, '').trim();
    for (const locale of LOCALES) {
      expect(digits(formatSen(6000, locale))).toBe('60.00');
    }
  });

  it('keeps the sign for negative amounts', () => {
    expect(formatSen(-1995, 'en-MY')).toContain('19.95');
    expect(formatSen(-1995, 'en-MY').startsWith('-')).toBe(true);
  });
});

describe('unknown values', () => {
  it('never renders zero for an unknown amount', () => {
    expect(formatUnknown()).toBe(UNKNOWN_PLACEHOLDER);
    expect(formatSenOrUnknown(null, 'en-MY')).toBe(UNKNOWN_PLACEHOLDER);
    expect(formatSenOrUnknown(undefined, 'en-MY')).toBe(UNKNOWN_PLACEHOLDER);
    expect(formatSenOrUnknown(null, 'en-MY')).not.toContain('0');
  });

  it('distinguishes a known zero from an unknown value', () => {
    expect(formatSenOrUnknown(0, 'en-MY')).toBe('RM 0.00');
    expect(formatViewsOrUnknown(0, 'en-MY')).toBe('0');
    expect(formatViewsOrUnknown(null, 'en-MY')).toBe(UNKNOWN_PLACEHOLDER);
  });
});

describe('formatViews', () => {
  it('groups thousands', () => {
    expect(formatViews(1000, 'en-MY')).toBe('1,000');
    expect(formatViews(1234567, 'en-MY')).toBe('1,234,567');
  });
});

describe('formatDateTime', () => {
  // L10N-04 from phase-0/foundation/localization-v1.md.
  it('shows 2026-09-10T16:30:00Z as 11 September 2026 00:30 Malaysia time', () => {
    const iso = '2026-09-10T16:30:00Z';
    expect(formatDateTime(iso, 'en-MY')).toBe('11 Sept 2026, 00:30 (UTC+08:00)');
    expect(formatDateTime(iso, 'zh-Hans-MY')).toBe('2026年9月11日 00:30 (UTC+08:00)');
    expect(formatDateTime(iso, 'ms-MY')).toBe('11 Sep 2026, 00:30 (UTC+08:00)');
  });

  it('writes the month rather than a bare numeric date', () => {
    for (const locale of LOCALES) {
      expect(formatDateTime('2026-09-01T12:00:00+08:00', locale)).not.toMatch(/\b09\/01\b/);
    }
  });

  it('carries the UTC offset hint in every locale', () => {
    for (const locale of LOCALES) {
      expect(formatDateTime('2026-09-01T12:00:00+08:00', locale)).toContain('UTC+08:00');
    }
  });

  it('keeps a Malaysia calendar date on the same day', () => {
    expect(formatDateOnly('2026-09-11T00:00:00+08:00', 'en-MY')).toBe('11 September 2026');
    expect(formatDateOnly('2026-09-11T00:00:00+08:00', 'zh-Hans-MY')).toBe('2026年9月11日');
  });
});
