// Read model. The UI reads the demo state ONLY through these selectors, so all three
// roles necessarily see the same numbers ("三端显示同一记录与正确金额").
//
// Every selector is pure and derives from state; nothing is cached in state.
// Amounts stay integer sen — formatting for display is the UI's job.

import { exactRewardMilliSen } from './money';
import { hrefFor } from './notifications';
import { checkPermission, resolveActor } from './permissions';
import {
  DEFAULT_RULES,
  OPEN_CASE_STATUSES,
  appealFor,
  attemptsFor,
  budgetOf,
  claimsForCampaign,
  claimsForSubmission,
  effectiveClaimDeadlineAt,
  evaluateClaimRequest,
  finalizeRejectionBlock,
  isClaimWindowOpen,
  isMeteringActive,
  lastSnapshot,
  lastTrustedSnapshot,
  obligationFor,
  occupancyOf,
  openCaseClaim,
  partialOfferStaleReason,
} from './rules';
import { calendarDaysAfter, isAfter, isAtOrAfter, maxIso } from './time';
import type {
  Actor,
  Appeal,
  AuditEntry,
  BudgetBuckets,
  Campaign,
  CampaignClosureView,
  Claim,
  CommandType,
  DemoState,
  IsoDateTime,
  Notification,
  Obligation,
  OpsQueueItem,
  PartialOffer,
  PayoutAttempt,
  Role,
  Sen,
  Submission,
  SubmissionDeadlinesView,
  SubmissionRewardView,
  WaitlistEntry,
} from './types';

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/** The four mutually exclusive buckets; they always sum to poolSen. */
export function selectBudget(state: DemoState, campaignId: string): BudgetBuckets {
  return budgetOf(state, campaignId);
}

// ---------------------------------------------------------------------------
// Submission reward and deadlines
// ---------------------------------------------------------------------------

/**
 * Everything the creator, merchant and ops need to explain one submission's money:
 * trusted data and its time, exact vs capped reward, occupancy, what is claimable
 * now and, when nothing is, the reason as an ErrorCode the UI can translate.
 */
export function selectSubmissionReward(
  state: DemoState,
  submissionId: string,
): SubmissionRewardView | null {
  const submission = state.submissions[submissionId];
  if (!submission) return null;
  const campaign = state.campaigns[submission.campaignId];
  const rules = campaign?.rules ?? DEFAULT_RULES;

  const trusted = lastTrustedSnapshot(submission);
  const qualifiedViews = trusted?.qualifiedViewsInWindow ?? null;
  const latest = lastSnapshot(submission);
  const dataStatus: SubmissionRewardView['dataStatus'] =
    trusted === null
      ? submission.acceptedAt === null
        ? 'no_baseline'
        : 'unavailable'
      : latest !== null && !latest.trusted
        ? 'unavailable'
        : 'trusted';

  const occupancy = occupancyOf(state, submissionId);
  const views = qualifiedViews ?? 0;
  const exactMilli = exactRewardMilliSen(views, rules.ratePerThousandSen);
  const capMilli = rules.capPerSubmissionSen * 1000;
  const cappedSen = Math.floor(Math.min(exactMilli, capMilli) / 1000);
  const claimable = Math.max(0, cappedSen - occupancy.occupiedSen);

  // One ladder for the engine and the UI: the block reason is the code the engine
  // would return for claim.request right now.
  const eligibility = evaluateClaimRequest(state, submissionId, submission.creatorId);
  const openCase = openCaseClaim(state, submissionId);

  return {
    submissionId,
    qualifiedViews,
    lastTrustedAt: trusted?.sourceTime ?? null,
    lastSnapshotVersion: trusted?.version ?? null,
    dataStatus,
    exactRewardMilliSen: exactMilli,
    cappedSen,
    capReached: exactMilli >= capMilli && capMilli > 0,
    reservedSen: occupancy.reservedSen,
    confirmedUnpaidSen: occupancy.confirmedUnpaidSen,
    paidSen: occupancy.paidSen,
    claimableSen: claimable,
    meetsMinClaim: claimable >= rules.minClaimSen,
    meetsViewThreshold: rules.viewThreshold === null || views >= rules.viewThreshold,
    pendingClaimId: openCase?.id ?? null,
    meteringActive: isMeteringActive(submission, state.clock.nowIso),
    claimWindowOpen: isClaimWindowOpen(submission, state.clock.nowIso),
    claimDeadlineAt: effectiveClaimDeadlineAt(submission),
    canClaim: eligibility.ok,
    blockReason: eligibility.ok ? null : eligibility.code,
  };
}

/**
 * Retention end (A13/A37/A38, approved 2026-09-15): the LATEST of the published
 * retention, the effective claim deadline, the resolution of submitted claims and
 * appeals, and the settlement of confirmed money — and "无案件或无已确认款时，不等待
 * 不存在的事件", so a submission with neither does not wait.
 */
export function selectSubmissionDeadlines(
  state: DemoState,
  submissionId: string,
): SubmissionDeadlinesView | null {
  const submission = state.submissions[submissionId];
  if (!submission) return null;
  const campaign = state.campaigns[submission.campaignId];
  const rules = campaign?.rules ?? DEFAULT_RULES;

  const effective = effectiveClaimDeadlineAt(submission);
  const publishedRetentionEnd =
    campaign?.publishedAt === null || campaign === undefined
      ? null
      : calendarDaysAfter(campaign.publishedAt, rules.retentionDays);

  const claims = claimsForSubmission(state, submissionId);
  let openCases = false;
  let confirmedUnpaid = false;
  let lastCaseResolvedAt: IsoDateTime | null = null;
  let lastSettlementAt: IsoDateTime | null = null;

  for (const claim of claims) {
    if (OPEN_CASE_STATUSES.includes(claim.status)) {
      const appeal = appealFor(state, claim.id);
      if (appeal && appeal.status !== 'open' && claim.status === 'rejected_appealable') {
        lastCaseResolvedAt = maxIso(lastCaseResolvedAt, appeal.resolvedAt);
      }
      openCases = true;
      continue;
    }
    if (claim.status === 'confirmed_unpaid') {
      confirmedUnpaid = true;
      continue;
    }
    // Resolved: rejected_final or paid.
    lastCaseResolvedAt = maxIso(lastCaseResolvedAt, claim.updatedAt);
    if (claim.status === 'paid') {
      const obligation = obligationFor(state, claim.id);
      lastSettlementAt = maxIso(lastSettlementAt, obligation?.providerAvailableAt ?? null);
    }
  }

  let retentionEndsAt: IsoDateTime | null;
  let retentionReason: SubmissionDeadlinesView['retentionReason'];
  if (openCases) {
    // An unresolved case has no end date yet; the UI says so instead of inventing one.
    retentionEndsAt = null;
    retentionReason = 'open_cases';
  } else if (confirmedUnpaid) {
    retentionEndsAt = null;
    retentionReason = 'confirmed_unpaid';
  } else {
    retentionEndsAt = maxIso(publishedRetentionEnd, effective, lastCaseResolvedAt, lastSettlementAt);
    retentionReason =
      retentionEndsAt !== null && effective !== null && retentionEndsAt === effective
        ? 'claim_deadline'
        : 'published_retention';
  }

  return {
    acceptedAt: submission.acceptedAt,
    meteringEndsAt: submission.meteringEndsAt,
    baseClaimDeadlineAt: submission.claimDeadlineAt,
    effectiveClaimDeadlineAt: effective,
    extensions: submission.extensions,
    retentionEndsAt,
    retentionReason,
  };
}

// ---------------------------------------------------------------------------
// Campaign closure
// ---------------------------------------------------------------------------

/**
 * Closure view. "仍有申诉或确认未付款时，不显示全部结清"; the unconfirmed tail below the
 * minimum is disclosed, and the refund of the unused pool is never automatic.
 */
export function selectCampaignClosure(
  state: DemoState,
  campaignId: string,
): CampaignClosureView | null {
  const campaign = state.campaigns[campaignId];
  if (!campaign) return null;

  const claims = claimsForCampaign(state, campaignId);
  const pendingClaims = claims.filter(
    (claim) => claim.status === 'pending_review' || claim.status === 'appealing' || claim.status === 'rejected_appealable',
  ).length;
  const confirmedUnpaidClaims = claims.filter((claim) => claim.status === 'confirmed_unpaid').length;
  const openAppeals = Object.values(state.appeals).filter((appeal) => {
    const claim = state.claims[appeal.claimId];
    return appeal.status === 'open' && claim?.campaignId === campaignId;
  }).length;
  const unresolvedPayouts = Object.values(state.payoutAttempts).filter((attempt) => {
    const obligation = state.obligations[attempt.obligationId];
    if (!obligation || obligation.campaignId !== campaignId) return false;
    return attempt.status === 'processing' || attempt.status === 'unknown';
  }).length;

  let unconfirmedTailSen = 0;
  for (const submission of Object.values(state.submissions)) {
    if (submission.campaignId !== campaignId) continue;
    if (submission.meteringEndsAt === null) continue;
    // Only after metering ended is a tail final.
    if (!isAtOrAfter(state.clock.nowIso, submission.meteringEndsAt)) continue;
    const reward = selectSubmissionReward(state, submission.id);
    if (!reward) continue;
    if (reward.claimableSen > 0 && reward.claimableSen < campaign.rules.minClaimSen) {
      unconfirmedTailSen += reward.claimableSen;
    }
  }

  return {
    campaignId,
    budget: budgetOf(state, campaignId),
    openAppeals,
    pendingClaims,
    confirmedUnpaidClaims,
    unresolvedPayouts,
    unconfirmedTailSen,
    canShowFullySettled:
      openAppeals === 0 && pendingClaims === 0 && confirmedUnpaidClaims === 0 && unresolvedPayouts === 0,
    refundStatus: 'pending_verification',
  };
}

// ---------------------------------------------------------------------------
// Ops queue
// ---------------------------------------------------------------------------

/** Work waiting for operations, reviewer items and finance items in one list. */
export function selectOpsQueue(state: DemoState): OpsQueueItem[] {
  const items: OpsQueueItem[] = [];

  for (const campaign of Object.values(state.campaigns)) {
    if (campaign.status !== 'draft') continue;
    if (campaign.readiness.fundingEvidence && campaign.readiness.dataSourceReady) continue;
    items.push({
      kind: 'readiness',
      targetType: 'campaign',
      targetId: campaign.id,
      campaignId: campaign.id,
      creatorId: null,
      since: campaign.updatedAt,
      href: `/ops/campaigns/${campaign.id}/readiness`,
    });
  }

  for (const submission of Object.values(state.submissions)) {
    if (submission.status !== 'data_unavailable' && submission.status !== 'baseline_unavailable') {
      continue;
    }
    items.push({
      kind: 'data_unavailable',
      targetType: 'submission',
      targetId: submission.id,
      campaignId: submission.campaignId,
      creatorId: submission.creatorId,
      since: lastSnapshot(submission)?.observedAt ?? submission.submittedAt,
      href: `/ops/submissions/${submission.id}`,
    });
  }

  for (const claim of Object.values(state.claims)) {
    if (claim.status === 'pending_review') {
      items.push({
        kind: claim.escalatedAt !== null ? 'escalated' : 'metering_review',
        targetType: 'claim',
        targetId: claim.id,
        campaignId: claim.campaignId,
        creatorId: claim.creatorId,
        since: claim.escalatedAt ?? claim.validAt,
        href: `/ops/claims/${claim.id}`,
      });
      continue;
    }
    if (claim.status === 'rejected_appealable' && finalizeRejectionBlock(state, claim) === null) {
      items.push({
        kind: 'finalize_rejection',
        targetType: 'claim',
        targetId: claim.id,
        campaignId: claim.campaignId,
        creatorId: claim.creatorId,
        since: claim.rejection?.decidedAt ?? claim.updatedAt,
        href: `/ops/claims/${claim.id}`,
      });
    }
  }

  for (const appeal of Object.values(state.appeals)) {
    if (appeal.status !== 'open') continue;
    const claim = state.claims[appeal.claimId];
    items.push({
      kind: 'appeal',
      targetType: 'appeal',
      targetId: appeal.id,
      campaignId: claim?.campaignId ?? '',
      creatorId: appeal.creatorId,
      since: appeal.filedAt,
      href: `/ops/appeals/${appeal.id}`,
    });
  }

  for (const obligation of Object.values(state.obligations)) {
    if (obligation.status !== 'open') continue;
    const attempts = attemptsFor(state, obligation.id);
    const unknown = attempts.find((attempt) => attempt.status === 'unknown');
    if (unknown) {
      items.push({
        kind: 'payout_unknown',
        targetType: 'payout_attempt',
        targetId: unknown.id,
        campaignId: obligation.campaignId,
        creatorId: obligation.creatorId,
        since: unknown.startedAt,
        href: `/ops/payouts/${unknown.id}`,
      });
      continue;
    }
    if (attempts.some((attempt) => attempt.status === 'processing')) continue;
    items.push({
      kind: 'payout',
      targetType: 'obligation',
      targetId: obligation.id,
      campaignId: obligation.campaignId,
      creatorId: obligation.creatorId,
      since: obligation.createdAt,
      href: `/ops/payouts/${obligation.id}`,
    });
  }

  return items.sort((a, b) => (isAfter(a.since, b.since) ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** One user's notifications, newest first; `role` narrows to one role context. */
export function selectNotificationsFor(
  state: DemoState,
  userId: string | null,
  role?: Exclude<Role, 'guest'>,
): Notification[] {
  if (userId === null || userId === '') return [];
  return Object.values(state.notifications)
    .filter(
      (notification) =>
        notification.recipientUserId === userId &&
        (role === undefined || notification.recipientRole === role),
    )
    .sort((a, b) => (isAfter(a.createdAt, b.createdAt) ? -1 : a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : 1));
}

export function selectUnreadCount(
  state: DemoState,
  userId: string | null,
  role?: Exclude<Role, 'guest'>,
): number {
  return selectNotificationsFor(state, userId, role).filter(
    (notification) => notification.readAt === null,
  ).length;
}

// ---------------------------------------------------------------------------
// Lists
//
// The creator-scoped selectors accept a nullable user id: the UI reads it from
// `session.userId`, which is null for a signed-out visitor, and a guest owns no
// records, so the answer is an empty list rather than a caller-side guard.
// ---------------------------------------------------------------------------

/** Campaigns a signed-out visitor may browse. Drafts are never public. */
export function selectPublicCampaigns(state: DemoState): Campaign[] {
  return Object.values(state.campaigns)
    .filter((campaign) => campaign.status !== 'draft')
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function selectCampaignsForOrg(state: DemoState, orgId: string): Campaign[] {
  return Object.values(state.campaigns)
    .filter((campaign) => campaign.orgId === orgId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function selectSubmissionsForCreator(
  state: DemoState,
  userId: string | null,
): Submission[] {
  if (userId === null || userId === '') return [];
  return Object.values(state.submissions)
    .filter((submission) => submission.creatorId === userId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function selectSubmissionsForCampaign(state: DemoState, campaignId: string): Submission[] {
  return Object.values(state.submissions)
    .filter((submission) => submission.campaignId === campaignId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function selectClaimsForCreator(state: DemoState, userId: string | null): Claim[] {
  if (userId === null || userId === '') return [];
  return Object.values(state.claims)
    .filter((claim) => claim.creatorId === userId)
    .sort((a, b) => a.seq - b.seq);
}

export function selectClaim(state: DemoState, claimId: string): Claim | null {
  return state.claims[claimId] ?? null;
}

export function selectAppealForClaim(state: DemoState, claimId: string): Appeal | null {
  return appealFor(state, claimId);
}

export function selectObligationForClaim(state: DemoState, claimId: string): Obligation | null {
  return obligationFor(state, claimId);
}

export function selectAttemptsForObligation(
  state: DemoState,
  obligationId: string,
): PayoutAttempt[] {
  return attemptsFor(state, obligationId);
}

/** One creator payment record: the claim, its obligation and every attempt. */
export interface PaymentRecordView {
  claimId: string;
  campaignId: string;
  campaignTitle: string;
  submissionId: string;
  amountSen: Sen;
  claimStatus: Claim['status'];
  obligation: Obligation | null;
  attempts: PayoutAttempt[];
  /** Funds available in the simulated provider account (D05 "已发放"). */
  providerAvailableAt: IsoDateTime | null;
  /** Separate, usually unknown fact; never inferred from provider success. */
  bankSettlement: 'unknown' | 'settled';
}

export function selectPaymentsForCreator(
  state: DemoState,
  userId: string | null,
): PaymentRecordView[] {
  return selectClaimsForCreator(state, userId)
    .filter((claim) => claim.status === 'confirmed_unpaid' || claim.status === 'paid')
    .map((claim) => {
      const obligation = obligationFor(state, claim.id);
      return {
        claimId: claim.id,
        campaignId: claim.campaignId,
        campaignTitle: state.campaigns[claim.campaignId]?.title ?? '',
        submissionId: claim.submissionId,
        amountSen: claim.amountSen,
        claimStatus: claim.status,
        obligation,
        attempts: obligation ? attemptsFor(state, obligation.id) : [],
        providerAvailableAt: obligation?.providerAvailableAt ?? null,
        bankSettlement: obligation?.bankSettlement ?? 'unknown',
      };
    });
}

export interface PartialOfferView {
  offer: PartialOffer;
  /** Null while the offer still stands; otherwise why it must be re-offered. */
  staleReason: string | null;
  isStale: boolean;
  /** What the creator must consent to, exactly. */
  consentSen: Sen;
  fullSen: Sen;
  unreservedRemainderSen: Sen;
}

function toOfferView(state: DemoState, offer: PartialOffer): PartialOfferView {
  const staleReason = partialOfferStaleReason(state, offer);
  return {
    offer,
    staleReason,
    isStale: staleReason !== null,
    consentSen: offer.offeredSen,
    fullSen: offer.fullSen,
    unreservedRemainderSen: offer.fullSen - offer.offeredSen,
  };
}

export function selectPartialOffer(state: DemoState, offerId: string): PartialOfferView | null {
  const offer = state.partialOffers[offerId];
  return offer ? toOfferView(state, offer) : null;
}

/** The offer the creator still has to answer for this submission, if any. */
export function selectOpenOfferForSubmission(
  state: DemoState,
  submissionId: string,
): PartialOfferView | null {
  const offer = Object.values(state.partialOffers).find(
    (entry) => entry.submissionId === submissionId && entry.status === 'open',
  );
  return offer ? toOfferView(state, offer) : null;
}

export function selectOffersForCreator(
  state: DemoState,
  userId: string | null,
): PartialOfferView[] {
  if (userId === null || userId === '') return [];
  return Object.values(state.partialOffers)
    .filter((offer) => offer.creatorId === userId)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((offer) => toOfferView(state, offer));
}

export function selectWaitlistForCreator(
  state: DemoState,
  userId: string | null,
): WaitlistEntry[] {
  if (userId === null || userId === '') return [];
  return Object.values(state.waitlist)
    .filter((entry) => entry.creatorId === userId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function selectWaitlistForCampaign(state: DemoState, campaignId: string): WaitlistEntry[] {
  return Object.values(state.waitlist)
    .filter((entry) => entry.campaignId === campaignId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function selectAuditFor(
  state: DemoState,
  targetType: AuditEntry['targetType'],
  targetId: string,
): AuditEntry[] {
  return state.audit.filter(
    (entry) => entry.targetType === targetType && entry.targetId === targetId,
  );
}

// ---------------------------------------------------------------------------
// Permissions for the UI
// ---------------------------------------------------------------------------

export interface PermissionFlags {
  actor: Actor;
  isSignedIn: boolean;
  workspace: DemoState['session']['workspace'];
  opsRole: DemoState['session']['opsRole'];
  canSwitchToMerchant: boolean;
  canCreateCampaign: boolean;
  canReviewContent: boolean;
  canConnectAccount: boolean;
  canSubmit: boolean;
  canRequestClaim: boolean;
  canReviewMetering: boolean;
  canFinalizeRejection: boolean;
  canResolveAppeal: boolean;
  canResyncSubmission: boolean;
  canStartPayout: boolean;
  canReconcilePayout: boolean;
  canRetryPayout: boolean;
  canFileAppeal: boolean;
  canMarkNotificationsRead: boolean;
  /** Demo tools are always available; they are labelled as simulation. */
  canUseDemoTools: boolean;
}

/**
 * What the current actor may do, as booleans for the UI. The engine re-checks every
 * command, so hiding a button is a convenience, not the control.
 */
export function selectPermissions(state: DemoState): PermissionFlags {
  const actor = resolveActor(state);
  const user = actor.userId === '' ? null : (state.users[actor.userId] ?? null);
  const allow = (type: CommandType): boolean => {
    // Probe commands: only the actor/role parts of the check matter here, so the
    // ids are placeholders and a missing target is not a permission failure.
    const probes: Partial<Record<CommandType, unknown>> = {
      'campaign.createDraft': { type, orgId: actor.orgId ?? '', title: 'probe', brief: '' },
      'submission.reviewContent': { type, submissionId: '', decision: 'approve', reason: null },
      'connection.connect': { type, platform: 'tiktok', handle: 'probe' },
      'submission.create': { type, campaignId: '', connectionId: '', url: '' },
      'claim.request': { type, submissionId: '' },
      'appeal.file': { type, claimId: '', reason: 'probe' },
      'claim.reviewMetering': { type, claimId: '', decision: 'approve', reason: null },
      'claim.finalizeRejection': { type, claimId: '', reason: 'probe' },
      'appeal.resolve': { type, appealId: '', decision: 'reject', note: 'probe' },
      'submission.resync': { type, submissionId: '', reason: 'probe' },
      'payout.start': { type, obligationId: '' },
      'payout.reconcile': { type, attemptId: '', outcome: 'still_unknown', note: 'probe' },
      'payout.retry': { type, obligationId: '', reason: 'probe' },
      'notification.markAllRead': { type },
      'session.switchWorkspace': { type, workspace: 'merchant' },
    };
    const probe = probes[type];
    if (probe === undefined) return false;
    return checkPermission(actor, probe as Parameters<typeof checkPermission>[1], state) === null;
  };

  return {
    actor,
    isSignedIn: actor.role !== 'guest',
    workspace: state.session.workspace,
    opsRole: state.session.opsRole,
    canSwitchToMerchant: (user?.orgIds.length ?? 0) > 0,
    canCreateCampaign: allow('campaign.createDraft'),
    canReviewContent: allow('submission.reviewContent'),
    canConnectAccount: allow('connection.connect'),
    canSubmit: allow('submission.create'),
    canRequestClaim: allow('claim.request'),
    canReviewMetering: allow('claim.reviewMetering'),
    canFinalizeRejection: allow('claim.finalizeRejection'),
    canResolveAppeal: allow('appeal.resolve'),
    canResyncSubmission: allow('submission.resync'),
    canStartPayout: allow('payout.start'),
    canReconcilePayout: allow('payout.reconcile'),
    canRetryPayout: allow('payout.retry'),
    canFileAppeal: allow('appeal.file'),
    canMarkNotificationsRead: allow('notification.markAllRead'),
    canUseDemoTools: true,
  };
}

/** Deep link for one notification in one role context (re-exported for the UI). */
export const notificationHref = hrefFor;
