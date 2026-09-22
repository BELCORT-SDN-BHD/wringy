import { describe, expect, it } from 'vitest';

import {
  cappedRewardSen,
  claimableSen,
  exactRewardMilliSen,
  isCapReached,
  MILLI_PER_SEN,
} from './money';
import { DEFAULT_RULES } from './rules';

// RM1 per 1,000 views = 100 sen per 1,000 views. At this rate the approved examples
// land exactly on the decimals the source quotes (5.009 → 5.00, 10.018 → 10.01).
const RM1_PER_THOUSAND = { ratePerThousandSen: 100, capPerSubmissionSen: 10_000 };

describe('money', () => {
  it('computes the exact reward in thousandths of a sen', () => {
    expect(exactRewardMilliSen(1, 500)).toBe(500); // 1 view at RM5/1,000 = 0.5 sen
    expect(exactRewardMilliSen(1000, 500)).toBe(500 * MILLI_PER_SEN);
    expect(exactRewardMilliSen(0, 500)).toBe(0);
    expect(exactRewardMilliSen(-5, 500)).toBe(0);
  });

  it('reproduces the approved cumulative rounding examples (D01)', () => {
    // "累计5.009计5.00，累计10.018计10.01，已占5.00时新增5.01"
    expect(cappedRewardSen(5009, RM1_PER_THOUSAND)).toBe(500); // RM5.009 → RM5.00
    expect(cappedRewardSen(10_018, RM1_PER_THOUSAND)).toBe(1001); // RM10.018 → RM10.01
    expect(claimableSen(1001, 500)).toBe(501); // occupied RM5.00 → new RM5.01
  });

  it('never rounds an increment on its own', () => {
    // Two increments of 5,009 views rounded separately would give 500 + 500 = 1000.
    const separately = cappedRewardSen(5009, RM1_PER_THOUSAND) * 2;
    const cumulative = cappedRewardSen(10_018, RM1_PER_THOUSAND);
    expect(separately).toBe(1000);
    expect(cumulative).toBe(1001);
  });

  it('applies the cap before flooring', () => {
    // 100,000 views at RM5/1,000 = RM500 exact, capped at RM100.
    expect(cappedRewardSen(100_000, DEFAULT_RULES)).toBe(10_000);
    expect(isCapReached(100_000, DEFAULT_RULES)).toBe(true);
    expect(isCapReached(1000, DEFAULT_RULES)).toBe(false);
  });

  it('uses the default rate for the spec main flow', () => {
    expect(cappedRewardSen(1000, DEFAULT_RULES)).toBe(500); // RM5
    expect(cappedRewardSen(20_000, DEFAULT_RULES)).toBe(10_000); // RM100 cap reached
  });

  it('never produces a negative claimable amount', () => {
    expect(claimableSen(500, 900)).toBe(0);
    expect(claimableSen(0, 0)).toBe(0);
  });
});
