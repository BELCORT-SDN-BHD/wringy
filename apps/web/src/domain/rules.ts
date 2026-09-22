// Rule evaluation shared by the engine and the selectors.
//
// The engine and the UI must never disagree about whether a claim is possible, so
// the eligibility ladder lives here once and both import it: `applyCommand` turns a
// failure into an `ErrorCode`, `selectSubmissionReward` turns the same failure into
// `blockReason` for the UI.
//
// Sources: campaign-defaults-v1.md (defaults, 门槛必须能达到, 申请、排队与预留, 申请期限),
// implementation-spec-content-rewards-v1.md §7 D01–D06.

import { cappedRewardSen, claimableSen, exactRewardMilliSen, isCapReached } from './money';
import { calendarDaysAfter, diffMs, isAfter, isAtOrBefore, maxIso } from './time';
import type {
  Appeal,
  BudgetBuckets,
  Campaign,
  CampaignRules,
  Claim,
  ClaimStatus,
  DemoState,
  ErrorCode,
  IsoDateTime,
  MetricSnapshot,
  PartialOffer,
  Platform,
  Sen,
  Submission,
} from './types';

/**
 * Approved defaults (campaign-defaults-v1.md, founder "ok" 2026-09-14):
 * pool RM2,000, RM5 per 1,000 qualified views, minimum claim RM5 with no extra view
 * threshold, RM100 cumulative cap per submission, 14 days submissions, 7 days
 * metering, 7 calendar days claim grace, 30 days retention, no cross-platform
 * independent cap unless the merchant allows it, global audience, EN/MS/ZH.
 */
export const DEFAULT_RULES: CampaignRules = {
  poolSen: 200_000,
  ratePerThousandSen: 500,
  minClaimSen: 500,
  viewThreshold: null,
  capPerSubmissionSen: 10_000,
  submissionWindowDays: 14,
  meteringDays: 7,
  claimGraceDays: 7,
  retentionDays: 30,
  crossPlatformIndependentCap: false,
  platforms: ['tiktok', 'instagram', 'youtube'],
  contentLanguages: ['en', 'ms', 'zh'],
  audienceRegion: 'global',
};

/** Simulated baseline reading recorded when a link is accepted. */
export const BASELINE_VIEWS = 1200;

/** 48h review target: escalation only, never auto-approval. */
export const REVIEW_TARGET_HOURS = 48;

/** Appeal window after a rejection: 7 calendar days (approved 2026-09-14). */
export const APPEAL_WINDOW_DAYS = 7;

/** Claim statuses that hold an open case on the submission (block a new claim). */
export const OPEN_CASE_STATUSES: readonly ClaimStatus[] = [
  'pending_review',
  'appealing',
  'rejected_appealable',
];

/**
 * Statuses that hold money in one of the three mutually exclusive budget buckets
 * ("新申请扣除互斥分类的预留、确认未付及已付金额（同笔不能重复计入）").
 * `rejected_final` is excluded: its reservation really was released to the pool.
 * It is still deducted from what is newly CLAIMABLE, separately — see
 * `Occupancy.finallyRejectedSen`, which is about an amount already claimed rather
 * than money currently held.
 */
export const OCCUPYING_STATUSES: readonly ClaimStatus[] = [
  'pending_review',
  'appealing',
  'rejected_appealable',
  'confirmed_unpaid',
  'paid',
];

export function claimsForSubmission(state: DemoState, submissionId: string): Claim[] {
  return Object.values(state.claims)
    .filter((claim) => claim.submissionId === submissionId)
    .sort((a, b) => a.seq - b.seq);
}

export function claimsForCampaign(state: DemoState, campaignId: string): Claim[] {
  return Object.values(state.claims)
    .filter((claim) => claim.campaignId === campaignId)
    .sort((a, b) => a.seq - b.seq);
}

export interface Occupancy {
  reservedSen: Sen;
  confirmedUnpaidSen: Sen;
  paidSen: Sen;
  /**
   * Amounts a finally rejected claim already put through the process. The
   * reservation itself WAS released back to the pool for other creators (that is
   * what `rejected_final` means and why it is not in `OCCUPYING_STATUSES`), but the
   * amount was still claimed once, and campaign-defaults-v1.md 门槛必须能达到 says
   * "追加申请仍须新增奖励≥RM5，不能重复使用已申请的金额" — a further claim needs a NEW
   * amount and may not re-use an amount already claimed. Without this the identical
   * frozen evidence could be re-filed the moment operations released it, and
   * "最终拒绝" would decide nothing.
   */
  finallyRejectedSen: Sen;
  /** reserved + confirmedUnpaid + paid + finallyRejected */
  occupiedSen: Sen;
}

export function occupancyOf(state: DemoState, submissionId: string): Occupancy {
  let reservedSen = 0;
  let confirmedUnpaidSen = 0;
  let paidSen = 0;
  let finallyRejectedSen = 0;
  for (const claim of claimsForSubmission(state, submissionId)) {
    if (claim.status === 'paid') paidSen += claim.amountSen;
    else if (claim.status === 'confirmed_unpaid') confirmedUnpaidSen += claim.amountSen;
    else if (claim.status === 'rejected_final') finallyRejectedSen += claim.amountSen;
    else if (OPEN_CASE_STATUSES.includes(claim.status)) reservedSen += claim.amountSen;
  }
  return {
    reservedSen,
    confirmedUnpaidSen,
    paidSen,
    finallyRejectedSen,
    occupiedSen: reservedSen + confirmedUnpaidSen + paidSen + finallyRejectedSen,
  };
}

/** The one open case blocking new claims on this submission, if any. */
export function openCaseClaim(state: DemoState, submissionId: string): Claim | null {
  return (
    claimsForSubmission(state, submissionId).find((claim) =>
      OPEN_CASE_STATUSES.includes(claim.status),
    ) ?? null
  );
}

export function lastTrustedSnapshot(submission: Submission): MetricSnapshot | null {
  for (let i = submission.snapshots.length - 1; i >= 0; i -= 1) {
    const snapshot = submission.snapshots[i];
    if (snapshot.trusted && snapshot.qualifiedViewsInWindow !== null) return snapshot;
  }
  return null;
}

export function lastSnapshot(submission: Submission): MetricSnapshot | null {
  return submission.snapshots[submission.snapshots.length - 1] ?? null;
}

/**
 * Latest trusted qualified increment inside the window, or null when the source was
 * never readable. Never 0 for a missing read: "数据缺失不显示0观看或直接判作弊".
 */
export function qualifiedViewsOf(submission: Submission): number | null {
  return lastTrustedSnapshot(submission)?.qualifiedViewsInWindow ?? null;
}

export function nextSnapshotVersion(submission: Submission): number {
  return submission.snapshots.reduce((max, snapshot) => Math.max(max, snapshot.version), 0) + 1;
}

/**
 * Effective claim deadline = max(base deadline, granted extensions).
 * campaign-defaults-v1.md 申请期限: an extension "使用商家已公布宽限" and never
 * shortens or re-opens anything.
 */
export function effectiveClaimDeadlineAt(submission: Submission): IsoDateTime | null {
  return maxIso(
    submission.claimDeadlineAt,
    ...submission.extensions.map((extension) => extension.newDeadlineAt),
  );
}

export function isMeteringActive(submission: Submission, nowIso: IsoDateTime): boolean {
  if (submission.meteringEndsAt === null) return false;
  return isAfter(submission.meteringEndsAt, nowIso);
}

export function isClaimWindowOpen(submission: Submission, nowIso: IsoDateTime): boolean {
  const deadline = effectiveClaimDeadlineAt(submission);
  if (deadline === null) return false;
  return isAtOrBefore(nowIso, deadline);
}

/** Buckets derived from the append-only ledger; available starts at the whole pool. */
export function budgetOf(state: DemoState, campaignId: string): BudgetBuckets {
  const campaign = state.campaigns[campaignId];
  const poolSen = campaign?.rules.poolSen ?? 0;
  let availableSen = poolSen;
  let reservedSen = 0;
  let confirmedUnpaidSen = 0;
  let paidSen = 0;
  const add = (bucket: string, amount: number) => {
    if (bucket === 'available') availableSen += amount;
    else if (bucket === 'reserved') reservedSen += amount;
    else if (bucket === 'confirmed_unpaid') confirmedUnpaidSen += amount;
    else if (bucket === 'paid') paidSen += amount;
  };
  for (const entry of state.ledger) {
    if (entry.campaignId !== campaignId) continue;
    add(entry.from, -entry.amountSen);
    add(entry.to, entry.amountSen);
  }
  return { poolSen, availableSen, reservedSen, confirmedUnpaidSen, paidSen };
}

// ---------------------------------------------------------------------------
// Post URL normalisation
// ---------------------------------------------------------------------------

export type NormalizedPost =
  | {
      ok: true;
      platform: Platform;
      postId: string;
      /**
       * The input as an absolute `https://` address.
       *
       * A creator may paste `tiktok.com/@x/video/123`, which this function already
       * accepted by prefixing a scheme to read the post id from. The prefix used to
       * be thrown away, so the raw input was what got stored and what the creator's
       * and the merchant's "Open the post" anchors used as `href` — a scheme-less
       * string is a *relative* href, so the link navigated inside the prototype
       * instead of out to the platform. The canonical form is stored instead; the
       * scheme is forced to `https:` because every accepted host is https-only and
       * the post id (which is what dedup keys on) does not depend on the scheme.
       */
      canonicalUrl: string;
    }
  | { ok: false; detail: 'short_link_unresolvable' | 'unsupported_url' | 'malformed_url' };

/**
 * Stable platform post id. Ticket #4: "演示数据按稳定平台发布ID去重，换同ID链接不新增".
 * TikTok short links (vm.tiktok.com) cannot be resolved without a network call, so
 * they are rejected with a reason rather than guessed at.
 */
export function normalizePostUrl(url: string): NormalizedPost {
  const raw = url.trim();
  if (raw === '') return { ok: false, detail: 'malformed_url' };

  let parsed: URL;
  try {
    parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return { ok: false, detail: 'malformed_url' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, detail: 'malformed_url' };
  }
  parsed.protocol = 'https:';
  const canonicalUrl = parsed.href;

  const host = parsed.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const segments = parsed.pathname.split('/').filter((segment) => segment !== '');

  if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
    return { ok: false, detail: 'short_link_unresolvable' };
  }
  if (host === 'tiktok.com') {
    const videoIndex = segments.indexOf('video');
    const id = videoIndex >= 0 ? segments[videoIndex + 1] : undefined;
    if (id && /^\d+$/.test(id)) return { ok: true, platform: 'tiktok', postId: id, canonicalUrl };
    return { ok: false, detail: 'unsupported_url' };
  }
  if (host === 'instagram.com') {
    const kind = segments[0];
    const code = segments[1];
    if ((kind === 'reel' || kind === 'reels' || kind === 'p') && code && /^[\w-]+$/.test(code)) {
      return { ok: true, platform: 'instagram', postId: code, canonicalUrl };
    }
    return { ok: false, detail: 'unsupported_url' };
  }
  if (host === 'youtu.be') {
    const code = segments[0];
    if (code && /^[\w-]+$/.test(code)) return { ok: true, platform: 'youtube', postId: code, canonicalUrl };
    return { ok: false, detail: 'unsupported_url' };
  }
  if (host === 'youtube.com') {
    if (segments[0] === 'watch') {
      const code = parsed.searchParams.get('v');
      if (code && /^[\w-]+$/.test(code)) return { ok: true, platform: 'youtube', postId: code, canonicalUrl };
      return { ok: false, detail: 'unsupported_url' };
    }
    if (segments[0] === 'shorts' && segments[1] && /^[\w-]+$/.test(segments[1])) {
      return { ok: true, platform: 'youtube', postId: segments[1], canonicalUrl };
    }
    return { ok: false, detail: 'unsupported_url' };
  }
  return { ok: false, detail: 'unsupported_url' };
}

/**
 * D06 cross-campaign reuse: the same platform post id may only enter another
 * campaign once the first one ended in a FINAL rejection —
 * "原活动未最终拒绝时禁止重复纳入".
 */
export function isFinallyRejected(state: DemoState, submission: Submission): boolean {
  const claims = claimsForSubmission(state, submission.id);
  const alive = claims.some((claim) => claim.status !== 'rejected_final');
  if (alive) return false;
  if (claims.length > 0) return true;
  // No claim was ever filed: only an explicit content rejection ends the submission.
  return submission.contentReview.status === 'rejected';
}

// ---------------------------------------------------------------------------
// Claim eligibility
// ---------------------------------------------------------------------------

export interface ClaimMath {
  qualifiedViews: number;
  snapshotVersion: number;
  exactRewardMilliSen: number;
  cappedSen: Sen;
  capReached: boolean;
  occupancy: Occupancy;
  claimableSen: Sen;
}

export type ClaimEligibility =
  | { ok: true; math: ClaimMath; submission: Submission; campaign: Campaign }
  | { ok: false; code: ErrorCode; detail?: string };

/**
 * The single eligibility ladder for a new claim. Order follows the approved rules:
 * data trust → window → one open case per submission → cap/floor/occupancy →
 * view threshold → minimum new amount. Budget allocation is decided by the caller
 * (full claim / partial offer / waitlist).
 */
export function evaluateClaimRequest(
  state: DemoState,
  submissionId: string,
  actorUserId: string,
): ClaimEligibility {
  const submission = state.submissions[submissionId];
  if (!submission) return { ok: false, code: 'not_found', detail: 'submission' };
  if (submission.creatorId !== actorUserId) {
    return { ok: false, code: 'forbidden', detail: 'not_the_creator' };
  }
  const campaign = state.campaigns[submission.campaignId];
  if (!campaign) return { ok: false, code: 'not_found', detail: 'campaign' };

  const nowIso = state.clock.nowIso;

  // No accepted baseline → nothing was ever metered; never fabricate acceptance.
  if (submission.acceptedAt === null) {
    return { ok: false, code: 'data_unavailable', detail: 'baseline_unavailable' };
  }

  // Content compliance is a precondition of the whole example, not only of payment:
  // campaign-defaults-v1.md 一条视频的例子 — "以上均以内容合规、观看有效、预算可分配及最终
  // 核验通过为前提". A claim filed against rejected content can never confirm
  // (`confirmIfReady` needs an approved content review) and a content decision is
  // one-shot, so accepting it would only mint a reservation with no way out.
  if (submission.contentReview.status === 'rejected') {
    return { ok: false, code: 'content_rejected', detail: submission.id };
  }

  // D06 as a standing invariant and not only a submit-time gate:
  // campaign-defaults-v1.md 复用 — "同一平台发布ID默认不能跨活动重复计奖". Once the post
  // has legitimately entered another campaign, a further claim here would make one
  // post id earn in two campaigns at the same time.
  const elsewhere = Object.values(state.submissions).find(
    (entry) =>
      entry.id !== submission.id &&
      entry.platform === submission.platform &&
      entry.postId === submission.postId &&
      entry.acceptedAt !== null &&
      !isFinallyRejected(state, entry),
  );
  if (elsewhere) return { ok: false, code: 'cross_campaign_blocked', detail: elsewhere.id };

  const deadline = effectiveClaimDeadlineAt(submission);
  if (deadline !== null && isAfter(nowIso, deadline)) {
    return { ok: false, code: 'claim_deadline_passed', detail: deadline };
  }

  // An unreadable source cannot support a new claim, however good the last trusted
  // reading was: campaign-defaults-v1.md 申请、排队与预留 — "有效申请须满足资格、门槛和可
  // 核验数据条件". prd-content-rewards-v2.md says the same from the creator's side:
  // "来源延迟使资格暂不可核验时显示待数据，不冒称已进入有预留队列". This is also what makes
  // the data-outage deadline extension honest, because the outage really did block
  // new claims while it ran.
  if (submission.dataOutage) {
    return { ok: false, code: 'data_unavailable', detail: 'source_unreachable' };
  }

  const trusted = lastTrustedSnapshot(submission);
  if (trusted === null || trusted.qualifiedViewsInWindow === null) {
    return { ok: false, code: 'data_unavailable', detail: 'never_trusted' };
  }

  const openCase = openCaseClaim(state, submissionId);
  if (openCase) return { ok: false, code: 'pending_claim_exists', detail: openCase.id };

  const qualifiedViews = trusted.qualifiedViewsInWindow;
  const occupancy = occupancyOf(state, submissionId);
  const cappedSen = cappedRewardSen(qualifiedViews, campaign.rules);
  const claimable = claimableSen(cappedSen, occupancy.occupiedSen);
  const math: ClaimMath = {
    qualifiedViews,
    snapshotVersion: trusted.version,
    exactRewardMilliSen: exactRewardMilliSen(qualifiedViews, campaign.rules.ratePerThousandSen),
    cappedSen,
    capReached: isCapReached(qualifiedViews, campaign.rules),
    occupancy,
    claimableSen: claimable,
  };

  if (claimable <= 0) return { ok: false, code: 'nothing_claimable', detail: String(cappedSen) };

  // 门槛: when the merchant set a view threshold both conditions must hold (D02).
  if (campaign.rules.viewThreshold !== null && qualifiedViews < campaign.rules.viewThreshold) {
    return { ok: false, code: 'view_threshold_not_met', detail: String(campaign.rules.viewThreshold) };
  }

  // 最低资格比较: the NEW claimable increment must reach the minimum (D02).
  if (claimable < campaign.rules.minClaimSen) {
    return { ok: false, code: 'below_min_claim', detail: String(claimable) };
  }

  return { ok: true, math, submission, campaign };
}

/**
 * Why an open partial offer can no longer be consented to, or null when it still
 * stands. D03: "余额或相关规则／快照版本改变则旧报价失效，重新展示并取得同意." Derived, so
 * the UI cannot show a consent button for an offer the engine would refuse.
 */
export function partialOfferStaleReason(state: DemoState, offer: PartialOffer): string | null {
  if (offer.status === 'stale') return 'offer_already_stale';
  if (offer.status !== 'open') return null;
  const campaign = state.campaigns[offer.campaignId];
  const submission = state.submissions[offer.submissionId];
  if (!campaign || !submission) return 'record_missing';
  if (campaign.budgetVersion !== offer.budgetVersion) return 'budget_version_changed';
  const trusted = lastTrustedSnapshot(submission);
  if (trusted === null || trusted.version !== offer.snapshotVersion) {
    return 'snapshot_version_changed';
  }
  if (budgetOf(state, campaign.id).availableSen < offer.offeredSen) return 'available_below_offer';
  return null;
}

/**
 * Release of a held reservation after a rejection. campaign-defaults-v1.md:
 * "拒绝后等待申诉期结束；若已申诉，则待处理结束才释放相应预留" and
 * "最终拒绝释放须检查申诉已结束，不能定时任务到点盲目释放".
 */
export function finalizeRejectionBlock(state: DemoState, claim: Claim): string | null {
  const appeal = currentAppealFor(state, claim);
  // An active appeal is the most specific reason, and it is checked first because
  // the claim then sits in 'appealing': "若已申诉，则待处理结束才释放相应预留".
  if (appeal && appeal.status === 'open') return 'appeal_open';
  if (claim.status !== 'rejected_appealable') return 'claim_not_rejected_appealable';
  if (claim.rejection === null) return 'no_rejection_record';
  // The appeal against THIS rejection has concluded either way, so the pending
  // handling has ended: "若已申诉，则待处理结束才释放相应预留". An upheld appeal from an
  // earlier round is not this rejection's business.
  if (appeal !== null) return null;
  // No appeal was filed against this rejection: wait for the window to run out.
  if (isAtOrBefore(state.clock.nowIso, claim.rejection.appealDeadlineAt)) {
    return 'appeal_window_open';
  }
  return null;
}

/** Every appeal ever filed against this claim, oldest first. */
export function appealsForClaim(state: DemoState, claimId: string): Appeal[] {
  return Object.values(state.appeals)
    .filter((appeal) => appeal.claimId === claimId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The appeal that belongs to the claim's CURRENT rejection round, or null when this
 * rejection has not been appealed.
 *
 * A claim can be rejected more than once, because an upheld appeal returns it to
 * verification ("成立后继续核验") where approve, hold and reject are all available
 * again. The appeal right is attached to the rejection — campaign-defaults-v1.md
 * 审核与申诉 "拒绝后7个日历日可申诉" — so it is looked up through the rejection record
 * rather than by claim id. When no rejection stands (an upheld appeal put the claim
 * back into review) the most recent appeal is returned so its outcome stays readable.
 */
export function currentAppealFor(state: DemoState, claim: Claim): Appeal | null {
  if (claim.rejection !== null) {
    const id = claim.rejection.appealId;
    return id === null ? null : (state.appeals[id] ?? null);
  }
  return appealsForClaim(state, claim.id).at(-1) ?? null;
}

export function appealFor(state: DemoState, claimId: string) {
  const claim = state.claims[claimId];
  return claim ? currentAppealFor(state, claim) : null;
}

export function obligationFor(state: DemoState, claimId: string) {
  return Object.values(state.obligations).find((obligation) => obligation.claimId === claimId) ?? null;
}

export function attemptsFor(state: DemoState, obligationId: string) {
  // Attempt ids are minted from the monotonic clock sequence, so id order is
  // start order even when two attempts share a simulated timestamp.
  return Object.values(state.payoutAttempts)
    .filter((attempt) => attempt.obligationId === obligationId)
    .sort((a, b) => diffMs(a.startedAt, b.startedAt) || a.id.localeCompare(b.id));
}

export function latestAttempt(state: DemoState, obligationId: string) {
  const attempts = attemptsFor(state, obligationId);
  return attempts[attempts.length - 1] ?? null;
}

export function appealDeadlineFrom(nowIso: IsoDateTime): IsoDateTime {
  return calendarDaysAfter(nowIso, APPEAL_WINDOW_DAYS);
}
