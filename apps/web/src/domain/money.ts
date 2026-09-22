// Reward arithmetic. Integers only — never a float, never a currency string.
//
// Rule source (campaign-defaults-v1.md "补充业务规则（2026-09-15已批准）", D01):
//   "累计精确奖励先应用单条上限，再向下取整到分，扣除互斥的预留、确认未付、已付金额；
//    不对每次增量单独取整。累计5.009计5.00，累计10.018计10.01，已占5.00时新增5.01。"
//
// Order is therefore fixed: cap first → floor to sen → subtract exclusive occupancy.
// Working unit is MILLI-SEN (thousandths of a sen) so that a rate of N sen per 1,000
// views is exact: exactMilliSen = views × ratePerThousandSen.
//   1 view at RM5/1,000 views (500 sen) = 500 milli-sen = 0.5 sen.
//   1,000 views at 500 = 500,000 milli-sen = 500 sen = RM5.

import type { CampaignRules, Sen } from './types';

export const MILLI_PER_SEN = 1000;

/** Exact cumulative reward in thousandths of a sen. No rounding here. */
export function exactRewardMilliSen(views: number, ratePerThousandSen: Sen): number {
  if (!Number.isFinite(views) || views <= 0) return 0;
  return Math.trunc(views) * ratePerThousandSen;
}

export function capMilliSen(rules: Pick<CampaignRules, 'capPerSubmissionSen'>): number {
  return rules.capPerSubmissionSen * MILLI_PER_SEN;
}

/**
 * Cumulative reward for a submission: min(cap, exact) floored to whole sen.
 * D01 examples (rate 100 sen / 1,000 views, i.e. RM1 per 1,000 views):
 *   5,009 views  → 500,900 milli → 500 sen  (RM5.009 → RM5.00)
 *   10,018 views → 1,001,800 milli → 1,001 sen (RM10.018 → RM10.01)
 */
export function cappedRewardSen(
  views: number,
  rules: Pick<CampaignRules, 'ratePerThousandSen' | 'capPerSubmissionSen'>,
): Sen {
  const exact = exactRewardMilliSen(views, rules.ratePerThousandSen);
  const capped = Math.min(exact, capMilliSen(rules));
  return Math.floor(capped / MILLI_PER_SEN);
}

/** True once the exact cumulative reward has reached the per-submission cap. */
export function isCapReached(
  views: number,
  rules: Pick<CampaignRules, 'ratePerThousandSen' | 'capPerSubmissionSen'>,
): boolean {
  return exactRewardMilliSen(views, rules.ratePerThousandSen) >= capMilliSen(rules);
}

/**
 * New claimable amount = capped cumulative − exclusive occupancy
 * (reserved + confirmed unpaid + paid of the same submission). Never negative:
 * "计量回落进入复核，不自动生成负申请".
 */
export function claimableSen(cappedSen: Sen, occupiedSen: Sen): Sen {
  return Math.max(0, cappedSen - occupiedSen);
}

/** Guard for values that must be whole non-negative sen. */
export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
