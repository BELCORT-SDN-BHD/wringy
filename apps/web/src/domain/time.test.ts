import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMs,
  calendarDaysAfter,
  diffMs,
  isAfter,
  isAtOrAfter,
  isAtOrBefore,
  isBefore,
  isIsoDateTime,
  maxIso,
  minIso,
} from './time';

const BASE = '2026-09-01T12:00:00+08:00';

describe('time', () => {
  it('keeps the +08:00 offset in every output', () => {
    expect(addMs(BASE, 1000)).toBe('2026-09-01T12:00:01+08:00');
    expect(addDays(BASE, 7)).toBe('2026-09-08T12:00:00+08:00');
    expect(calendarDaysAfter(BASE, 14)).toBe('2026-09-15T12:00:00+08:00');
  });

  it('reproduces the approved deadline example (A13)', () => {
    // campaign-defaults-v1.md: 9月1日12:00接受 → 9月8日12:00停止计量 → 9月15日12:00申请截止
    const meteringEndsAt = calendarDaysAfter(BASE, 7);
    const claimDeadlineAt = calendarDaysAfter(meteringEndsAt, 7);
    expect(meteringEndsAt).toBe('2026-09-08T12:00:00+08:00');
    expect(claimDeadlineAt).toBe('2026-09-15T12:00:00+08:00');
  });

  it('crosses month boundaries by calendar day', () => {
    expect(calendarDaysAfter('2026-09-28T09:30:00+08:00', 7)).toBe('2026-10-05T09:30:00+08:00');
    expect(calendarDaysAfter('2026-12-31T23:00:00+08:00', 1)).toBe('2027-01-01T23:00:00+08:00');
  });

  it('compares instants across different offsets', () => {
    const kl = '2026-09-01T12:00:00+08:00';
    const utc = '2026-09-01T04:00:00Z';
    expect(diffMs(kl, utc)).toBe(0);
    expect(isBefore(kl, utc)).toBe(false);
    expect(isAfter(kl, utc)).toBe(false);
    expect(isAtOrBefore(kl, utc)).toBe(true);
    expect(isAtOrAfter(kl, utc)).toBe(true);
  });

  it('picks the latest and earliest, ignoring nulls', () => {
    expect(maxIso(null, BASE, '2026-09-10T00:00:00+08:00')).toBe('2026-09-10T00:00:00+08:00');
    expect(minIso(null, BASE, '2026-09-10T00:00:00+08:00')).toBe(BASE);
    expect(maxIso(null, undefined)).toBe(null);
  });

  it('validates ISO strings with an explicit offset', () => {
    expect(isIsoDateTime(BASE)).toBe(true);
    expect(isIsoDateTime('2026-09-01T12:00:00')).toBe(false);
    expect(isIsoDateTime('not a date')).toBe(false);
    expect(isIsoDateTime(42)).toBe(false);
  });
});
