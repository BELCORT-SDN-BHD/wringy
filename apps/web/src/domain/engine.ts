// The demo engine: `applyCommand(state, command, meta)`.
//
// Pure: the input state is never mutated (a structural copy is taken first), there is
// no Date.now, no Math.random, no console output and no I/O. Every mutation in the
// prototype goes through here so that the three roles always read one record set.
//
// Guarantees, in this order:
//   1. idempotency on meta.commandId — a replayed command returns the current state
//      with outcome 'idempotent_replay' and emits nothing (ticket #5: "重复点击或同视频
//      已有待处理申请不新增记录");
//   2. permission check in the engine, not only in the UI (kickoff decision 7);
//   3. rule check against the approved sources (campaign-defaults-v1.md, D01–D06);
//   4. state change + ledger movement in one step;
//   5. audit entry for every successful command except session.*/notification.*;
//   6. domain events, from which notifications are derived and deduped.

import { createIdMinter, eventId as stableEventId, type IdMinter, type IdPrefix } from './ids';
import { isNonNegativeInteger, isPositiveInteger } from './money';
import { deriveNotificationDrafts, type NotificationContext } from './notifications';
import { checkPermission, isUnauditedCommand, resolveActor } from './permissions';
import {
  APPEAL_WINDOW_DAYS,
  BASELINE_VIEWS,
  DEFAULT_RULES,
  REVIEW_TARGET_HOURS,
  appealDeadlineFrom,
  appealFor,
  attemptsFor,
  budgetOf,
  claimsForSubmission,
  effectiveClaimDeadlineAt,
  evaluateClaimRequest,
  finalizeRejectionBlock,
  isFinallyRejected,
  latestAttempt,
  lastTrustedSnapshot,
  nextSnapshotVersion,
  normalizePostUrl,
  openCaseClaim,
} from './rules';
import { replayScenario } from './scenario-steps';
import { createSeedState } from './seed';
import {
  MS_PER_HOUR,
  addMs,
  calendarDaysAfter,
  isAfter,
  isAtOrAfter,
  isAtOrBefore,
  isBefore,
  isIsoDateTime,
} from './time';
import {
  LOCALES,
  SCHEMA_VERSION,
  type Actor,
  type AuditEntry,
  type Bucket,
  type Campaign,
  type CampaignRules,
  type Claim,
  type Command,
  type CommandMeta,
  type CommandResult,
  type ContentLanguage,
  type DemoEngine,
  type DemoState,
  type DomainEvent,
  type ErrorCode,
  type IsoDateTime,
  type LedgerReason,
  type MetricSnapshot,
  type NotificationKind,
  type Platform,
  type Sen,
  type Submission,
} from './types';

const PLATFORMS: readonly Platform[] = ['tiktok', 'instagram', 'youtube'];
const CONTENT_LANGUAGES: readonly ContentLanguage[] = ['en', 'ms', 'zh'];

// ---------------------------------------------------------------------------
// Command context
// ---------------------------------------------------------------------------

interface AuditDraft {
  targetType: AuditEntry['targetType'];
  targetId: string;
  reason?: string | null;
  before?: string | null;
  after?: string | null;
}

interface Ctx {
  state: DemoState;
  actor: Actor;
  commandId: string;
  now: IsoDateTime;
  events: DomainEvent[];
  minter: IdMinter;
}

type Outcome = 'claim' | 'partial_offer' | 'waitlisted';

type HandlerResult =
  | { ok: true; outcome?: Outcome; audit?: AuditDraft | AuditDraft[] }
  | {
      ok: false;
      code: ErrorCode;
      detail?: string;
      /**
       * Keep the draft state although the command failed. Used only to record that
       * a partial offer went stale: "余额或相关规则／快照版本改变则旧报价失效，重新展示
       * 并取得同意". It is a derived correction, so it still writes no audit entry and
       * no notification, and the command id stays unused so a retry re-evaluates.
       */
      persist?: boolean;
    };

function fail(code: ErrorCode, detail?: string): HandlerResult {
  return { ok: false, code, detail };
}

function failStale(detail: string): HandlerResult {
  return { ok: false, code: 'offer_stale', detail, persist: true };
}

function mint(c: Ctx, prefix: IdPrefix): string {
  return c.minter.mint(prefix);
}

interface EmitOptions {
  kind: NotificationKind;
  targetType: AuditEntry['targetType'];
  targetId: string;
  /** Ids used for routing and deep links. */
  refs: NotificationContext;
  params?: Record<string, string | number>;
  /**
   * Stable id for facts that may be re-derived (clock effects). Same fact → same
   * id → the (eventId, recipient) dedup collapses the repeat.
   */
  eventId?: string;
}

function emit(c: Ctx, options: EmitOptions): void {
  const id = options.eventId ?? `ev:${mint(c, 'ev')}`;
  const params = options.params ?? {};
  c.events.push({
    id,
    at: c.now,
    kind: options.kind,
    targetType: options.targetType,
    targetId: options.targetId,
    params,
  });

  for (const draft of deriveNotificationDrafts(c.state, options.kind, options.refs)) {
    const duplicate = Object.values(c.state.notifications).some(
      (notification) =>
        notification.eventId === id &&
        notification.recipientUserId === draft.recipientUserId &&
        notification.recipientRole === draft.recipientRole,
    );
    if (duplicate) continue;
    const notificationId = mint(c, 'nt');
    c.state.notifications[notificationId] = {
      id: notificationId,
      eventId: id,
      recipientUserId: draft.recipientUserId,
      recipientRole: draft.recipientRole,
      kind: draft.kind,
      params,
      href: draft.href,
      createdAt: c.now,
      readAt: null,
      email: draft.email,
    };
  }
}

interface LedgerMove {
  campaign: Campaign;
  claimId: string | null;
  from: Bucket;
  to: Bucket;
  amountSen: Sen;
  reason: LedgerReason;
}

/**
 * The only path that moves money between buckets. Appends to the append-only ledger
 * and bumps `budgetVersion` so any open partial offer becomes stale
 * ("余额或相关规则／快照版本改变则旧报价失效").
 */
function moveLedger(c: Ctx, move: LedgerMove): void {
  const id = mint(c, 'lg');
  c.state.ledger.push({
    id,
    campaignId: move.campaign.id,
    claimId: move.claimId,
    from: move.from,
    to: move.to,
    amountSen: move.amountSen,
    reason: move.reason,
    at: c.now,
    by: c.actor.userId,
    commandId: c.commandId,
  });
  move.campaign.budgetVersion += 1;
  c.events.push({
    id: `ev:${mint(c, 'ev')}`,
    at: c.now,
    kind: 'ledger.moved',
    targetType: 'campaign',
    targetId: move.campaign.id,
    params: { from: move.from, to: move.to, amountSen: move.amountSen, reason: move.reason },
  });
  if (move.to === 'available') runBudgetRecovery(c, move.campaign);
}

/**
 * Budget recovery: money back in `available` notifies everyone waiting on this
 * campaign. "额度恢复后通知重提，取得新的有效时间，不继承旧优先级" — the notification
 * reserves nothing and grants no priority.
 */
function runBudgetRecovery(c: Ctx, campaign: Campaign): void {
  for (const entry of Object.values(c.state.waitlist)) {
    if (entry.campaignId !== campaign.id || entry.status !== 'waiting') continue;
    entry.status = 'notified';
    entry.notifiedAt = c.now;
    emit(c, {
      kind: 'waitlist.budget_available',
      targetType: 'campaign',
      targetId: campaign.id,
      refs: {
        campaignId: campaign.id,
        submissionId: entry.submissionId,
        creatorId: entry.creatorId,
      },
      params: { entryId: entry.id, campaignTitle: campaign.title },
    });
  }
}

// ---------------------------------------------------------------------------
// Shared state transitions
// ---------------------------------------------------------------------------

function appendSnapshot(
  c: Ctx,
  submission: Submission,
  snapshot: Omit<MetricSnapshot, 'id' | 'version' | 'observedAt'>,
): MetricSnapshot {
  const entry: MetricSnapshot = {
    id: mint(c, 'snap'),
    version: nextSnapshotVersion(submission),
    observedAt: c.now,
    ...snapshot,
  };
  submission.snapshots.push(entry);
  return entry;
}

function statusAfterOutage(c: Ctx, submission: Submission): Submission['status'] {
  if (submission.acceptedAt === null) return 'baseline_unavailable';
  if (submission.meteringEndsAt !== null && isAtOrAfter(c.now, submission.meteringEndsAt)) {
    return 'metering_ended';
  }
  return 'metering';
}

function acceptSubmission(c: Ctx, submission: Submission, campaign: Campaign): void {
  const meteringEndsAt = calendarDaysAfter(c.now, campaign.rules.meteringDays);
  submission.status = 'metering';
  submission.acceptedAt = c.now;
  submission.baselineViews = BASELINE_VIEWS;
  submission.meteringEndsAt = meteringEndsAt;
  // 申请期限 (approved 2026-09-14): metering end + claimGraceDays calendar days.
  submission.claimDeadlineAt = calendarDaysAfter(meteringEndsAt, campaign.rules.claimGraceDays);
  appendSnapshot(c, submission, {
    sourceTime: c.now,
    totalViews: BASELINE_VIEWS,
    qualifiedViewsInWindow: 0,
    missingReason: null,
    trusted: true,
  });
  emit(c, {
    kind: 'submission.accepted',
    targetType: 'submission',
    targetId: submission.id,
    refs: {
      campaignId: campaign.id,
      submissionId: submission.id,
      creatorId: submission.creatorId,
    },
    params: {
      submissionId: submission.id,
      campaignTitle: campaign.title,
      meteringEndsAt,
      claimDeadlineAt: submission.claimDeadlineAt,
    },
  });
}

/**
 * A claim confirms only when BOTH reviews approved
 * ("内容审核与计量审核分开，单一通过不直接显示付款；双方通过才进入确认未付").
 */
function confirmIfReady(c: Ctx, claim: Claim): void {
  if (claim.status !== 'pending_review') return;
  const submission = c.state.submissions[claim.submissionId];
  const campaign = c.state.campaigns[claim.campaignId];
  if (!submission || !campaign) return;
  if (submission.contentReview.status !== 'approved') return;
  if (claim.meteringReview.status !== 'approved') return;

  claim.status = 'confirmed_unpaid';
  claim.updatedAt = c.now;
  moveLedger(c, {
    campaign,
    claimId: claim.id,
    from: 'reserved',
    to: 'confirmed_unpaid',
    amountSen: claim.amountSen,
    reason: 'claim_confirmed',
  });
  const obligationId = mint(c, 'obl');
  c.state.obligations[obligationId] = {
    id: obligationId,
    claimId: claim.id,
    campaignId: claim.campaignId,
    creatorId: claim.creatorId,
    amountSen: claim.amountSen,
    status: 'open',
    providerAvailableAt: null,
    bankSettlement: 'unknown',
    createdAt: c.now,
  };
  emit(c, {
    kind: 'claim.confirmed',
    targetType: 'claim',
    targetId: claim.id,
    refs: {
      campaignId: claim.campaignId,
      submissionId: claim.submissionId,
      claimId: claim.id,
      obligationId,
      creatorId: claim.creatorId,
    },
    params: { claimId: claim.id, amountSen: claim.amountSen, obligationId },
  });
  maybeGrantPendingCaseExtension(c, submission);
}

/**
 * Claim deadline extension after a blocking case clears.
 * campaign-defaults-v1.md 申请期限: "同视频既有待审／申诉阻挡新增申请时，在最终计量数据
 * 可用且阻挡解除后仍有完整公布宽限，记录原因并通知具体截止时间；不增加计量窗口、不补旧队列、
 * 不保证预算."
 *
 * Called when a case on the submission closes. The case was open until `now`, so if
 * the metering window has already ended it blocked new claims after the metering end
 * by definition, and the creator gets the full published grace from this moment.
 */
function maybeGrantPendingCaseExtension(c: Ctx, submission: Submission): void {
  const campaign = c.state.campaigns[submission.campaignId];
  if (!campaign) return;
  if (submission.meteringEndsAt === null) return;
  // Before the metering end nothing was lost: the creator can still claim later.
  if (isBefore(c.now, submission.meteringEndsAt)) return;
  // Another case is still blocking; the unblock has not happened yet.
  if (openCaseClaim(c.state, submission.id) !== null) return;
  // Only a case that actually existed can justify an extension.
  if (claimsForSubmission(c.state, submission.id).length === 0) return;

  grantExtension(c, submission, campaign, 'pending_case', submission.meteringEndsAt);
}

function grantExtension(
  c: Ctx,
  submission: Submission,
  campaign: Campaign,
  reason: 'data_outage' | 'pending_case',
  blockedFrom: IsoDateTime,
): void {
  const current = effectiveClaimDeadlineAt(submission);
  const newDeadlineAt = calendarDaysAfter(c.now, campaign.rules.claimGraceDays);
  // Extensions never shorten a deadline and never re-open metering.
  if (current !== null && isAtOrBefore(newDeadlineAt, current)) return;
  submission.extensions.push({
    id: mint(c, 'ext'),
    reason,
    blockedFrom,
    unblockedAt: c.now,
    newDeadlineAt,
    notifiedAt: c.now,
  });
  // types.ts: outageStartedAt is "cleared on extension" — only the outage clears it.
  if (reason === 'data_outage') submission.outageStartedAt = null;
  emit(c, {
    kind: 'deadline.claim_deadline_extended',
    targetType: 'submission',
    targetId: submission.id,
    refs: {
      campaignId: campaign.id,
      submissionId: submission.id,
      creatorId: submission.creatorId,
    },
    params: { submissionId: submission.id, reason, newDeadlineAt },
  });
}

function rejectOpenClaims(
  c: Ctx,
  submission: Submission,
  source: 'content' | 'metering',
  reason: string,
): void {
  for (const claim of claimsForSubmission(c.state, submission.id)) {
    if (claim.status !== 'pending_review') continue;
    applyRejection(c, claim, source, reason);
  }
}

/** Rejection HOLDS the reservation until ops finalises it (no ledger movement here). */
function applyRejection(
  c: Ctx,
  claim: Claim,
  source: 'content' | 'metering',
  reason: string,
): void {
  claim.status = 'rejected_appealable';
  claim.updatedAt = c.now;
  claim.rejection = {
    source,
    reason,
    decidedBy: c.actor.userId,
    decidedAt: c.now,
    appealDeadlineAt: appealDeadlineFrom(c.now),
  };
  emit(c, {
    kind: 'claim.rejected',
    targetType: 'claim',
    targetId: claim.id,
    refs: {
      campaignId: claim.campaignId,
      submissionId: claim.submissionId,
      claimId: claim.id,
      creatorId: claim.creatorId,
    },
    params: {
      claimId: claim.id,
      source,
      reason,
      appealDeadlineAt: claim.rejection.appealDeadlineAt,
      appealWindowDays: APPEAL_WINDOW_DAYS,
    },
  });
}

// ---------------------------------------------------------------------------
// Clock effects
// ---------------------------------------------------------------------------

/**
 * Deterministic consequences of the simulated clock moving forward. No auto-approval
 * anywhere: "超时升级，不自动通过". Every notification here carries a stable event id
 * so re-running the effects cannot duplicate it.
 */
function runClockEffects(c: Ctx): void {
  // 1. Metering windows that closed.
  for (const submission of Object.values(c.state.submissions)) {
    if (submission.meteringEndsAt === null) continue;
    if (isBefore(c.now, submission.meteringEndsAt)) continue;
    if (submission.status === 'metering') submission.status = 'metering_ended';
    else if (submission.status !== 'data_unavailable' && submission.status !== 'metering_ended') {
      continue;
    }
    const campaign = c.state.campaigns[submission.campaignId];
    emit(c, {
      kind: 'deadline.metering_ended',
      targetType: 'submission',
      targetId: submission.id,
      refs: {
        campaignId: submission.campaignId,
        submissionId: submission.id,
        creatorId: submission.creatorId,
      },
      params: {
        submissionId: submission.id,
        meteringEndsAt: submission.meteringEndsAt,
        claimDeadlineAt: effectiveClaimDeadlineAt(submission) ?? '',
        campaignTitle: campaign?.title ?? '',
      },
      eventId: stableEventId('metering_ended', submission.id),
    });
  }

  // 2. 48h review target: escalate, never approve.
  for (const claim of Object.values(c.state.claims)) {
    if (claim.status !== 'pending_review' || claim.escalatedAt !== null) continue;
    if (isBefore(c.now, addMs(claim.validAt, REVIEW_TARGET_HOURS * MS_PER_HOUR))) continue;
    claim.escalatedAt = c.now;
    claim.updatedAt = c.now;
    emit(c, {
      kind: 'claim.escalated',
      targetType: 'claim',
      targetId: claim.id,
      refs: {
        campaignId: claim.campaignId,
        submissionId: claim.submissionId,
        claimId: claim.id,
        creatorId: claim.creatorId,
      },
      params: { claimId: claim.id, targetHours: REVIEW_TARGET_HOURS },
      eventId: stableEventId('claim_escalated', claim.id),
    });
  }

  // 3. Claim deadlines that passed. Submitted claims and confirmed rewards are NOT
  //    cleared: "及时提交申请及已确认奖励不因截止清除".
  for (const submission of Object.values(c.state.submissions)) {
    const deadline = effectiveClaimDeadlineAt(submission);
    if (deadline === null || isBefore(c.now, deadline)) continue;
    emit(c, {
      kind: 'deadline.claim_deadline_passed',
      targetType: 'submission',
      targetId: submission.id,
      refs: {
        campaignId: submission.campaignId,
        submissionId: submission.id,
        creatorId: submission.creatorId,
      },
      params: { submissionId: submission.id, claimDeadlineAt: deadline },
      eventId: stableEventId('claim_deadline_passed', submission.id, deadline),
    });
  }

  // 4. Submission windows that closed.
  for (const campaign of Object.values(c.state.campaigns)) {
    if (campaign.submissionsCloseAt === null) continue;
    if (campaign.status !== 'published' && campaign.status !== 'paused') continue;
    if (isBefore(c.now, campaign.submissionsCloseAt)) continue;
    campaign.status = 'submissions_closed';
    campaign.updatedAt = c.now;
    emit(c, {
      kind: 'campaign.submissions_closed',
      targetType: 'campaign',
      targetId: campaign.id,
      refs: { campaignId: campaign.id },
      params: { campaignId: campaign.id, campaignTitle: campaign.title },
      eventId: stableEventId('submissions_closed', campaign.id),
    });
  }
}

// ---------------------------------------------------------------------------
// Rules validation (merchant input)
// ---------------------------------------------------------------------------

function validateRulesPatch(patch: Partial<CampaignRules>): string | null {
  const senFields: (keyof CampaignRules)[] = [
    'poolSen',
    'ratePerThousandSen',
    'minClaimSen',
    'capPerSubmissionSen',
  ];
  for (const field of senFields) {
    if (field in patch && !isNonNegativeInteger(patch[field])) return `${field}_must_be_whole_sen`;
  }
  const dayFields: (keyof CampaignRules)[] = [
    'submissionWindowDays',
    'meteringDays',
    'claimGraceDays',
    'retentionDays',
  ];
  for (const field of dayFields) {
    // "商家可在发布前设置正的明确时长" — a duration must be an explicit positive number.
    if (field in patch && !isPositiveInteger(patch[field])) return `${field}_must_be_positive_days`;
  }
  if ('viewThreshold' in patch) {
    const value = patch.viewThreshold;
    if (value !== null && !isPositiveInteger(value)) return 'viewThreshold_must_be_positive_or_null';
  }
  if ('crossPlatformIndependentCap' in patch && typeof patch.crossPlatformIndependentCap !== 'boolean') {
    return 'crossPlatformIndependentCap_must_be_boolean';
  }
  if ('platforms' in patch) {
    const platforms = patch.platforms;
    if (!Array.isArray(platforms) || platforms.length === 0) return 'platforms_required';
    if (platforms.some((platform) => !PLATFORMS.includes(platform))) return 'unknown_platform';
    if (new Set(platforms).size !== platforms.length) return 'duplicate_platform';
  }
  if ('contentLanguages' in patch) {
    const languages = patch.contentLanguages;
    if (!Array.isArray(languages) || languages.length === 0) return 'contentLanguages_required';
    if (languages.some((language) => !CONTENT_LANGUAGES.includes(language))) {
      return 'unknown_content_language';
    }
  }
  if ('audienceRegion' in patch && patch.audienceRegion !== 'global') {
    // "地区实际计费须先验证数据能力" — only 'global' is verified for M1.
    return 'audience_region_not_verified';
  }
  return null;
}

/** Merge that copies the list-valued rules so no two campaigns share an array. */
function mergeRules(base: CampaignRules, patch: Partial<CampaignRules>): CampaignRules {
  const merged = { ...base, ...patch };
  return {
    ...merged,
    platforms: [...merged.platforms],
    contentLanguages: [...merged.contentLanguages],
  };
}

// ---------------------------------------------------------------------------
// Handlers: session
// ---------------------------------------------------------------------------

function handleSession(c: Ctx, command: Command): HandlerResult {
  switch (command.type) {
    case 'session.signIn': {
      const user = c.state.users[command.userId];
      if (!user) return fail('not_found', 'user');
      c.state.session.userId = user.id;
      c.state.session.workspace = 'creator';
      // The demo toolbar reaches ops users by signing in as them.
      c.state.session.opsRole = user.opsCapability;
      return { ok: true };
    }
    case 'session.signOut': {
      c.state.session.userId = null;
      c.state.session.opsRole = null;
      c.state.session.workspace = 'creator';
      return { ok: true };
    }
    case 'session.setLocale': {
      if (!LOCALES.includes(command.locale)) return fail('invalid_input', 'unknown_locale');
      c.state.session.locale = command.locale;
      c.state.session.localeExplicit = command.explicit;
      if (command.explicit) c.state.session.localePromptDone = true;
      return { ok: true };
    }
    case 'session.dismissLocalePrompt': {
      c.state.session.localePromptDone = true;
      return { ok: true };
    }
    case 'session.switchWorkspace': {
      if (command.workspace !== 'creator' && command.workspace !== 'merchant') {
        return fail('invalid_input', 'unknown_workspace');
      }
      c.state.session.workspace = command.workspace;
      // Leaving the ops context is explicit: an ops override would mask the switch.
      c.state.session.opsRole = null;
      return { ok: true };
    }
    case 'session.setOpsRole': {
      c.state.session.opsRole = command.role;
      return { ok: true };
    }
    default:
      return fail('invalid_input', 'not_a_session_command');
  }
}

// ---------------------------------------------------------------------------
// Handlers: demo tools
// ---------------------------------------------------------------------------

function handleDemo(c: Ctx, command: Command): HandlerResult {
  switch (command.type) {
    case 'demo.advanceClock': {
      if (!Number.isFinite(command.byMs) || command.byMs <= 0) {
        return fail('invalid_input', 'byMs_must_be_positive');
      }
      const before = c.now;
      c.now = addMs(before, command.byMs);
      c.state.clock.nowIso = c.now;
      runClockEffects(c);
      return {
        ok: true,
        audit: { targetType: 'demo', targetId: 'clock', before, after: c.now },
      };
    }
    case 'demo.setClock': {
      if (!isIsoDateTime(command.toIso)) return fail('invalid_input', 'not_an_iso_datetime');
      if (isBefore(command.toIso, c.now)) {
        // Moving the simulated clock backwards would invalidate queue order and
        // frozen evidence, so the demo tool only moves forward.
        return fail('invalid_input', 'clock_cannot_move_backwards');
      }
      const before = c.now;
      c.now = command.toIso;
      c.state.clock.nowIso = c.now;
      runClockEffects(c);
      return {
        ok: true,
        audit: { targetType: 'demo', targetId: 'clock', before, after: c.now },
      };
    }
    case 'demo.addQualifiedViews': {
      const submission = c.state.submissions[command.submissionId];
      if (!submission) return fail('not_found', 'submission');
      if (!isPositiveInteger(command.views)) return fail('invalid_input', 'views_must_be_positive');
      if (submission.acceptedAt === null || submission.meteringEndsAt === null) {
        return fail('invalid_transition', 'submission_has_no_baseline');
      }
      // Views before acceptance never count, and views after the metering end never
      // count: "计量结束后不加计奖观看".
      if (isAtOrAfter(c.now, submission.meteringEndsAt)) {
        return {
          ok: true,
          audit: {
            targetType: 'submission',
            targetId: submission.id,
            reason: 'ignored_after_metering_end',
            before: String(lastTrustedSnapshot(submission)?.qualifiedViewsInWindow ?? 0),
            after: String(lastTrustedSnapshot(submission)?.qualifiedViewsInWindow ?? 0),
          },
        };
      }
      if (submission.dataOutage) {
        // Unreadable source: record the failed read, keep the last trusted value.
        appendSnapshot(c, submission, {
          sourceTime: null,
          totalViews: null,
          qualifiedViewsInWindow: null,
          missingReason: 'source_unreachable',
          trusted: false,
        });
        emit(c, {
          kind: 'submission.data_unavailable',
          targetType: 'submission',
          targetId: submission.id,
          refs: {
            campaignId: submission.campaignId,
            submissionId: submission.id,
            creatorId: submission.creatorId,
          },
          params: { submissionId: submission.id, missingReason: 'source_unreachable' },
          eventId: stableEventId(
            'data_unavailable',
            submission.id,
            submission.outageStartedAt ?? c.now,
          ),
        });
        return {
          ok: true,
          audit: {
            targetType: 'submission',
            targetId: submission.id,
            reason: 'read_failed_source_unreachable',
          },
        };
      }
      const previous = lastTrustedSnapshot(submission)?.qualifiedViewsInWindow ?? 0;
      const qualified = previous + command.views;
      appendSnapshot(c, submission, {
        sourceTime: c.now,
        totalViews: (submission.baselineViews ?? 0) + qualified,
        qualifiedViewsInWindow: qualified,
        missingReason: null,
        trusted: true,
      });
      return {
        ok: true,
        audit: {
          targetType: 'submission',
          targetId: submission.id,
          reason: 'qualified_views_added',
          before: String(previous),
          after: String(qualified),
        },
      };
    }
    case 'demo.setDataOutage': {
      const submission = c.state.submissions[command.submissionId];
      if (!submission) return fail('not_found', 'submission');
      const campaign = c.state.campaigns[submission.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      const before = submission.status;

      if (command.outage) {
        submission.dataOutage = true;
        if (submission.outageStartedAt === null) submission.outageStartedAt = c.now;
        if (submission.status === 'metering' || submission.status === 'metering_ended') {
          submission.status = 'data_unavailable';
        }
        appendSnapshot(c, submission, {
          sourceTime: null,
          totalViews: null,
          qualifiedViewsInWindow: null,
          missingReason: 'source_unreachable',
          trusted: false,
        });
        emit(c, {
          kind: 'submission.data_unavailable',
          targetType: 'submission',
          targetId: submission.id,
          refs: {
            campaignId: submission.campaignId,
            submissionId: submission.id,
            creatorId: submission.creatorId,
          },
          params: { submissionId: submission.id, missingReason: 'source_unreachable' },
          eventId: stableEventId('data_unavailable', submission.id, submission.outageStartedAt),
        });
        return {
          ok: true,
          audit: {
            targetType: 'submission',
            targetId: submission.id,
            reason: 'data_outage_started',
            before,
            after: submission.status,
          },
        };
      }

      const outageStartedAt = submission.outageStartedAt;
      submission.dataOutage = false;
      submission.status = statusAfterOutage(c, submission);
      if (submission.acceptedAt !== null) {
        // Final metering data becomes available again: restate the last trusted
        // numbers with a fresh source time (never invent new views).
        const trusted = lastTrustedSnapshot(submission);
        appendSnapshot(c, submission, {
          sourceTime: c.now,
          totalViews: trusted?.totalViews ?? submission.baselineViews,
          qualifiedViewsInWindow: trusted?.qualifiedViewsInWindow ?? 0,
          missingReason: null,
          trusted: true,
        });
      }

      // Extension (a): the outage blocked claims across the deadline or the metering
      // end. Full published grace from the unblock time.
      if (outageStartedAt !== null && submission.meteringEndsAt !== null) {
        const deadline = effectiveClaimDeadlineAt(submission);
        const startedBeforeDeadline = deadline === null || isBefore(outageStartedAt, deadline);
        const spannedDeadline =
          deadline !== null && isAtOrBefore(outageStartedAt, deadline) && isAtOrAfter(c.now, deadline);
        const meteringEnded = isAtOrAfter(c.now, submission.meteringEndsAt);
        if (startedBeforeDeadline && (meteringEnded || spannedDeadline)) {
          grantExtension(c, submission, campaign, 'data_outage', outageStartedAt);
        }
      }
      emit(c, {
        kind: 'submission.resynced',
        targetType: 'submission',
        targetId: submission.id,
        refs: {
          campaignId: submission.campaignId,
          submissionId: submission.id,
          creatorId: submission.creatorId,
        },
        params: { submissionId: submission.id, result: 'recovered' },
      });
      return {
        ok: true,
        audit: {
          targetType: 'submission',
          targetId: submission.id,
          reason: 'data_outage_cleared',
          before,
          after: submission.status,
        },
      };
    }
    case 'demo.setReadiness': {
      const campaign = c.state.campaigns[command.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      const before = `funding=${campaign.readiness.fundingEvidence},data=${campaign.readiness.dataSourceReady}`;
      if (typeof command.fundingEvidence === 'boolean') {
        campaign.readiness.fundingEvidence = command.fundingEvidence;
      }
      if (typeof command.dataSourceReady === 'boolean') {
        campaign.readiness.dataSourceReady = command.dataSourceReady;
      }
      campaign.updatedAt = c.now;
      const blocked: string[] = [];
      if (!campaign.readiness.fundingEvidence) blocked.push('funding_evidence');
      if (!campaign.readiness.dataSourceReady) blocked.push('data_source');
      if (blocked.length > 0) {
        emit(c, {
          kind: 'campaign.readiness_blocked',
          targetType: 'campaign',
          targetId: campaign.id,
          refs: { campaignId: campaign.id },
          params: { campaignId: campaign.id, campaignTitle: campaign.title, blocked: blocked.join(',') },
        });
      }
      return {
        ok: true,
        audit: {
          targetType: 'campaign',
          targetId: campaign.id,
          reason: 'readiness_set',
          before,
          after: `funding=${campaign.readiness.fundingEvidence},data=${campaign.readiness.dataSourceReady}`,
        },
      };
    }
    case 'demo.setPayoutOutcome': {
      const attempt = c.state.payoutAttempts[command.attemptId];
      if (!attempt) return fail('not_found', 'payout_attempt');
      if (attempt.status !== 'processing') {
        // A resolved attempt is never re-decided; unknown results are reconciled.
        return fail('invalid_transition', `attempt_${attempt.status}`);
      }
      const obligation = c.state.obligations[attempt.obligationId];
      if (!obligation) return fail('not_found', 'obligation');
      const before = attempt.status;

      if (command.outcome === 'succeeded') {
        settleObligation(c, attempt.id);
        return {
          ok: true,
          audit: {
            targetType: 'payout_attempt',
            targetId: attempt.id,
            reason: 'simulated_provider_success',
            before,
            after: 'succeeded',
          },
        };
      }
      if (command.outcome === 'failed') {
        const reason = (command.reason ?? '').trim();
        if (reason === '') return fail('invalid_input', 'reason_required');
        attempt.status = 'failed';
        attempt.resolvedAt = c.now;
        attempt.failureReason = reason;
        emit(c, {
          kind: 'payout.failed',
          targetType: 'payout_attempt',
          targetId: attempt.id,
          refs: {
            campaignId: obligation.campaignId,
            claimId: obligation.claimId,
            obligationId: obligation.id,
            attemptId: attempt.id,
            creatorId: obligation.creatorId,
          },
          params: { attemptId: attempt.id, failureReason: reason, amountSen: obligation.amountSen },
        });
        return {
          ok: true,
          audit: {
            targetType: 'payout_attempt',
            targetId: attempt.id,
            reason,
            before,
            after: 'failed',
          },
        };
      }
      // unknown: stays unresolved on purpose. "未知结果先对账，不能重复付款."
      attempt.status = 'unknown';
      attempt.resolvedAt = null;
      emit(c, {
        kind: 'payout.unknown',
        targetType: 'payout_attempt',
        targetId: attempt.id,
        refs: {
          campaignId: obligation.campaignId,
          claimId: obligation.claimId,
          obligationId: obligation.id,
          attemptId: attempt.id,
          creatorId: obligation.creatorId,
        },
        params: { attemptId: attempt.id, amountSen: obligation.amountSen },
      });
      return {
        ok: true,
        audit: {
          targetType: 'payout_attempt',
          targetId: attempt.id,
          reason: command.reason ?? 'simulated_provider_timeout',
          before,
          after: 'unknown',
        },
      };
    }
    default:
      return fail('invalid_input', 'not_a_demo_command');
  }
}

/**
 * Settlement, used by both the simulated provider callback and reconciliation.
 * D05: "已发放" means the money is available in the creator's provider account;
 * bank settlement stays a separate, unknown fact.
 */
function settleObligation(c: Ctx, attemptId: string): void {
  const attempt = c.state.payoutAttempts[attemptId];
  if (!attempt) return;
  const obligation = c.state.obligations[attempt.obligationId];
  if (!obligation) return;
  const claim = c.state.claims[obligation.claimId];
  const campaign = c.state.campaigns[obligation.campaignId];
  attempt.status = 'succeeded';
  attempt.resolvedAt = c.now;
  obligation.status = 'settled';
  obligation.providerAvailableAt = c.now;
  // bankSettlement deliberately stays 'unknown' until separate evidence arrives.
  if (claim && campaign) {
    claim.status = 'paid';
    claim.updatedAt = c.now;
    moveLedger(c, {
      campaign,
      claimId: claim.id,
      from: 'confirmed_unpaid',
      to: 'paid',
      amountSen: claim.amountSen,
      reason: 'payout_settled',
    });
  }
  emit(c, {
    kind: 'payout.paid',
    targetType: 'payout_attempt',
    targetId: attempt.id,
    refs: {
      campaignId: obligation.campaignId,
      submissionId: claim?.submissionId,
      claimId: obligation.claimId,
      obligationId: obligation.id,
      attemptId: attempt.id,
      creatorId: obligation.creatorId,
    },
    params: {
      attemptId: attempt.id,
      amountSen: obligation.amountSen,
      providerAvailableAt: c.now,
      bankSettlement: obligation.bankSettlement,
    },
  });
}

// ---------------------------------------------------------------------------
// Handlers: merchant
// ---------------------------------------------------------------------------

function handleMerchant(c: Ctx, command: Command): HandlerResult {
  switch (command.type) {
    case 'campaign.createDraft': {
      if (!c.state.orgs[command.orgId]) return fail('not_found', 'org');
      if (command.title.trim() === '') return fail('invalid_input', 'title_required');
      const patch = command.rules ?? {};
      const invalid = validateRulesPatch(patch);
      if (invalid) return fail('invalid_input', invalid);
      const id = mint(c, 'cmp');
      c.state.campaigns[id] = {
        id,
        orgId: command.orgId,
        title: command.title.trim(),
        brief: command.brief,
        status: 'draft',
        rules: mergeRules(DEFAULT_RULES, patch),
        rulesVersion: 1,
        serviceFee: 'pending_config',
        readiness: { fundingEvidence: false, dataSourceReady: false },
        budgetVersion: 0,
        nextClaimSeq: 1,
        publishedAt: null,
        submissionsCloseAt: null,
        closedAt: null,
        createdAt: c.now,
        updatedAt: c.now,
      };
      return {
        ok: true,
        audit: { targetType: 'campaign', targetId: id, before: null, after: 'draft' },
      };
    }
    case 'campaign.updateDraft': {
      const campaign = c.state.campaigns[command.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      // Published rules are immutable in M1; pausing keeps the rules as published.
      if (campaign.status !== 'draft') return fail('invalid_transition', `campaign_${campaign.status}`);
      const patch = command.patch.rules ?? {};
      const invalid = validateRulesPatch(patch);
      if (invalid) return fail('invalid_input', invalid);
      if (command.patch.title !== undefined) {
        if (command.patch.title.trim() === '') return fail('invalid_input', 'title_required');
        campaign.title = command.patch.title.trim();
      }
      if (command.patch.brief !== undefined) campaign.brief = command.patch.brief;
      campaign.rules = mergeRules(campaign.rules, patch);
      campaign.updatedAt = c.now;
      return {
        ok: true,
        audit: { targetType: 'campaign', targetId: campaign.id, reason: 'draft_updated' },
      };
    }
    case 'campaign.publish': {
      const campaign = c.state.campaigns[command.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      if (campaign.status !== 'draft') return fail('invalid_transition', `campaign_${campaign.status}`);
      const blocked: string[] = [];
      if (!campaign.readiness.fundingEvidence) blocked.push('funding_evidence');
      if (!campaign.readiness.dataSourceReady) blocked.push('data_source');
      if (blocked.length > 0) return fail('campaign_not_ready', blocked.join(','));
      // "单条上限不能低于最低申请金额" — a minimum above the cap can never be met.
      if (campaign.rules.minClaimSen > campaign.rules.capPerSubmissionSen) {
        return fail('min_claim_above_cap', `${campaign.rules.minClaimSen}>${campaign.rules.capPerSubmissionSen}`);
      }
      if (campaign.rules.poolSen <= 0) return fail('invalid_input', 'pool_must_be_positive');
      if (campaign.rules.ratePerThousandSen <= 0) return fail('invalid_input', 'rate_must_be_positive');
      if (campaign.rules.platforms.length === 0) return fail('invalid_input', 'platforms_required');

      campaign.status = 'published';
      campaign.publishedAt = c.now;
      campaign.submissionsCloseAt = calendarDaysAfter(c.now, campaign.rules.submissionWindowDays);
      campaign.updatedAt = c.now;
      emit(c, {
        kind: 'campaign.published',
        targetType: 'campaign',
        targetId: campaign.id,
        refs: { campaignId: campaign.id },
        params: {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          poolSen: campaign.rules.poolSen,
          submissionsCloseAt: campaign.submissionsCloseAt,
        },
      });
      return {
        ok: true,
        audit: {
          targetType: 'campaign',
          targetId: campaign.id,
          before: 'draft',
          after: 'published',
        },
      };
    }
    case 'campaign.pause': {
      const campaign = c.state.campaigns[command.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      if (campaign.status !== 'published') return fail('invalid_transition', `campaign_${campaign.status}`);
      campaign.status = 'paused';
      campaign.updatedAt = c.now;
      // "pause不清债" — reservations, obligations and deadlines are untouched.
      return {
        ok: true,
        audit: { targetType: 'campaign', targetId: campaign.id, before: 'published', after: 'paused' },
      };
    }
    case 'campaign.resume': {
      const campaign = c.state.campaigns[command.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      if (campaign.status !== 'paused') return fail('invalid_transition', `campaign_${campaign.status}`);
      const closed =
        campaign.submissionsCloseAt !== null && isAtOrAfter(c.now, campaign.submissionsCloseAt);
      campaign.status = closed ? 'submissions_closed' : 'published';
      campaign.updatedAt = c.now;
      return {
        ok: true,
        audit: {
          targetType: 'campaign',
          targetId: campaign.id,
          before: 'paused',
          after: campaign.status,
        },
      };
    }
    case 'campaign.closeSubmissions': {
      const campaign = c.state.campaigns[command.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      if (campaign.status !== 'published' && campaign.status !== 'paused') {
        return fail('invalid_transition', `campaign_${campaign.status}`);
      }
      // The merchant has to say why intake is closing: the campaign's history is
      // the only place a creator who can no longer submit can read the reason.
      const closeSubmissionsReason = command.reason.trim();
      if (closeSubmissionsReason === '') return fail('invalid_input', 'reason_required');
      const before = campaign.status;
      campaign.status = 'submissions_closed';
      // Closing intake early never truncates an accepted link's metering window:
      // "最后一天接受的链接仍有完整追踪期".
      campaign.submissionsCloseAt = c.now;
      campaign.updatedAt = c.now;
      emit(c, {
        kind: 'campaign.submissions_closed',
        targetType: 'campaign',
        targetId: campaign.id,
        refs: { campaignId: campaign.id },
        params: { campaignId: campaign.id, campaignTitle: campaign.title },
      });
      return {
        ok: true,
        audit: {
          targetType: 'campaign',
          targetId: campaign.id,
          reason: closeSubmissionsReason,
          before,
          after: campaign.status,
        },
      };
    }
    case 'campaign.close': {
      const campaign = c.state.campaigns[command.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      if (campaign.status === 'draft' || campaign.status === 'closed') {
        return fail('invalid_transition', `campaign_${campaign.status}`);
      }
      const closeReason = command.reason.trim();
      if (closeReason === '') return fail('invalid_input', 'reason_required');
      const before = campaign.status;
      campaign.status = 'closed';
      campaign.closedAt = c.now;
      campaign.updatedAt = c.now;
      emit(c, {
        kind: 'campaign.closed',
        targetType: 'campaign',
        targetId: campaign.id,
        refs: { campaignId: campaign.id },
        params: { campaignId: campaign.id, campaignTitle: campaign.title },
      });
      return {
        ok: true,
        audit: {
          targetType: 'campaign',
          targetId: campaign.id,
          reason: closeReason,
          before,
          after: 'closed',
        },
      };
    }
    case 'submission.reviewContent': {
      const submission = c.state.submissions[command.submissionId];
      if (!submission) return fail('not_found', 'submission');
      if (submission.contentReview.status !== 'pending') {
        return fail('invalid_transition', `content_review_${submission.contentReview.status}`);
      }
      const before = submission.contentReview.status;
      if (command.decision === 'reject') {
        const reason = (command.reason ?? '').trim();
        if (reason === '') return fail('invalid_input', 'reason_required');
        submission.contentReview = {
          status: 'rejected',
          reason,
          decidedBy: c.actor.userId,
          decidedAt: c.now,
        };
        emit(c, {
          kind: 'content.rejected',
          targetType: 'submission',
          targetId: submission.id,
          refs: {
            campaignId: submission.campaignId,
            submissionId: submission.id,
            creatorId: submission.creatorId,
          },
          params: { submissionId: submission.id, reason },
        });
        rejectOpenClaims(c, submission, 'content', reason);
        return {
          ok: true,
          audit: {
            targetType: 'submission',
            targetId: submission.id,
            reason,
            before,
            after: 'rejected',
          },
        };
      }
      if (command.decision !== 'approve') return fail('invalid_input', 'unknown_decision');
      submission.contentReview = {
        status: 'approved',
        reason: command.reason,
        decidedBy: c.actor.userId,
        decidedAt: c.now,
      };
      emit(c, {
        kind: 'content.approved',
        targetType: 'submission',
        targetId: submission.id,
        refs: {
          campaignId: submission.campaignId,
          submissionId: submission.id,
          creatorId: submission.creatorId,
        },
        params: { submissionId: submission.id },
      });
      for (const claim of claimsForSubmission(c.state, submission.id)) confirmIfReady(c, claim);
      return {
        ok: true,
        audit: {
          targetType: 'submission',
          targetId: submission.id,
          reason: command.reason,
          before,
          after: 'approved',
        },
      };
    }
    default:
      return fail('invalid_input', 'not_a_merchant_command');
  }
}

// ---------------------------------------------------------------------------
// Handlers: creator
// ---------------------------------------------------------------------------

function handleCreator(c: Ctx, command: Command): HandlerResult {
  switch (command.type) {
    case 'connection.connect': {
      if (!PLATFORMS.includes(command.platform)) return fail('unsupported_platform', command.platform);
      const handle = command.handle.trim();
      if (handle === '') return fail('invalid_input', 'handle_required');
      const existing = Object.values(c.state.connections).find(
        (connection) =>
          connection.userId === c.actor.userId && connection.platform === command.platform,
      );
      if (existing) {
        const before = existing.status;
        existing.handle = handle;
        existing.status = 'valid';
        existing.invalidReason = null;
        existing.updatedAt = c.now;
        return {
          ok: true,
          audit: {
            targetType: 'session',
            targetId: existing.id,
            reason: 'connection_reconnected',
            before,
            after: 'valid',
          },
        };
      }
      const id = mint(c, 'cn');
      c.state.connections[id] = {
        id,
        userId: c.actor.userId,
        platform: command.platform,
        handle,
        accountId: `${command.platform}-acc-${c.actor.userId}`,
        status: 'valid',
        invalidReason: null,
        updatedAt: c.now,
      };
      return {
        ok: true,
        audit: { targetType: 'session', targetId: id, before: 'unlinked', after: 'valid' },
      };
    }
    case 'connection.reconnect': {
      const connection = c.state.connections[command.connectionId];
      if (!connection) return fail('not_found', 'connection');
      if (connection.userId !== c.actor.userId) return fail('forbidden', 'connection_not_owned');
      const before = connection.status;
      connection.status = 'valid';
      connection.invalidReason = null;
      connection.updatedAt = c.now;
      return {
        ok: true,
        audit: {
          targetType: 'session',
          targetId: connection.id,
          reason: 'connection_reconnected',
          before,
          after: 'valid',
        },
      };
    }
    case 'submission.create': {
      const campaign = c.state.campaigns[command.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      if (
        campaign.status !== 'published' ||
        campaign.submissionsCloseAt === null ||
        isAtOrAfter(c.now, campaign.submissionsCloseAt)
      ) {
        return fail('campaign_not_open', `campaign_${campaign.status}`);
      }
      const connection = c.state.connections[command.connectionId];
      if (!connection) return fail('not_found', 'connection');
      if (connection.userId !== c.actor.userId) return fail('forbidden', 'connection_not_owned');
      if (!campaign.rules.platforms.includes(connection.platform)) {
        return fail('unsupported_platform', connection.platform);
      }
      if (connection.status !== 'valid') {
        return fail('connection_invalid', connection.invalidReason ?? connection.status);
      }
      const normalized = normalizePostUrl(command.url);
      if (!normalized.ok) return fail('invalid_input', normalized.detail);
      if (normalized.platform !== connection.platform) {
        return fail('invalid_input', 'platform_mismatch');
      }

      const duplicate = Object.values(c.state.submissions).find(
        (entry) =>
          entry.campaignId === campaign.id &&
          entry.platform === normalized.platform &&
          entry.postId === normalized.postId,
      );
      if (duplicate) return fail('duplicate_post', duplicate.id);

      // D06: the same platform post id cannot earn in a second campaign unless the
      // first one ended in a final rejection.
      const elsewhere = Object.values(c.state.submissions).find(
        (entry) =>
          entry.campaignId !== campaign.id &&
          entry.platform === normalized.platform &&
          entry.postId === normalized.postId &&
          !isFinallyRejected(c.state, entry),
      );
      if (elsewhere) return fail('cross_campaign_blocked', elsewhere.id);

      const id = mint(c, 'sub');
      const submission: Submission = {
        id,
        campaignId: campaign.id,
        orgId: campaign.orgId,
        creatorId: c.actor.userId,
        connectionId: connection.id,
        platform: normalized.platform,
        postId: normalized.postId,
        url: command.url.trim(),
        rulesVersion: campaign.rulesVersion,
        status: 'pending_baseline',
        submittedAt: c.now,
        acceptedAt: null,
        baselineViews: null,
        meteringEndsAt: null,
        claimDeadlineAt: null,
        extensions: [],
        snapshots: [],
        dataOutage: false,
        outageStartedAt: null,
        contentReview: { status: 'pending', reason: null, decidedBy: null, decidedAt: null },
      };
      c.state.submissions[id] = submission;

      if (campaign.readiness.dataSourceReady) {
        acceptSubmission(c, submission, campaign);
      } else {
        // No trusted baseline: never fabricate an acceptance time.
        submission.status = 'baseline_unavailable';
        appendSnapshot(c, submission, {
          sourceTime: null,
          totalViews: null,
          qualifiedViewsInWindow: null,
          missingReason: 'source_unreachable',
          trusted: false,
        });
        emit(c, {
          kind: 'submission.baseline_unavailable',
          targetType: 'submission',
          targetId: id,
          refs: { campaignId: campaign.id, submissionId: id, creatorId: c.actor.userId },
          params: { submissionId: id, missingReason: 'source_unreachable' },
        });
      }
      return {
        ok: true,
        audit: {
          targetType: 'submission',
          targetId: id,
          reason: `post:${normalized.platform}:${normalized.postId}`,
          before: null,
          after: submission.status,
        },
      };
    }
    case 'claim.request': {
      return requestClaim(c, command.submissionId);
    }
    case 'claim.consentPartial': {
      const offer = c.state.partialOffers[command.offerId];
      if (!offer) return fail('not_found', 'partial_offer');
      if (offer.creatorId !== c.actor.userId) return fail('forbidden', 'not_the_creator');
      if (offer.status === 'stale') return fail('offer_stale', 'offer_already_stale');
      if (offer.status !== 'open') return fail('invalid_transition', `offer_${offer.status}`);
      const campaign = c.state.campaigns[offer.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      const submission = c.state.submissions[offer.submissionId];
      if (!submission) return fail('not_found', 'submission');

      // "创作者确认服务端确切金额及快照版本" — amount AND both versions must match.
      if (command.snapshotVersion !== offer.snapshotVersion) {
        offer.status = 'stale';
        return failStale('snapshot_version_changed');
      }
      if (command.budgetVersion !== offer.budgetVersion || campaign.budgetVersion !== offer.budgetVersion) {
        offer.status = 'stale';
        return failStale('budget_version_changed');
      }
      if (command.consentedSen !== offer.offeredSen) {
        return fail('offer_amount_mismatch', `${command.consentedSen}!=${offer.offeredSen}`);
      }
      const budget = budgetOf(c.state, campaign.id);
      if (budget.availableSen < offer.offeredSen) {
        offer.status = 'stale';
        return failStale('available_below_offer');
      }
      // Full verification happens at consent time, not at offer time.
      const eligibility = evaluateClaimRequest(c.state, offer.submissionId, c.actor.userId);
      if (!eligibility.ok) return fail(eligibility.code, eligibility.detail);
      if (eligibility.math.claimableSen !== offer.fullSen) {
        offer.status = 'stale';
        return failStale(`claimable_changed:${eligibility.math.claimableSen}`);
      }

      const claim = createClaim(c, {
        campaign,
        submission,
        amountSen: offer.offeredSen,
        snapshotVersion: offer.snapshotVersion,
        qualifiedViews: eligibility.math.qualifiedViews,
        isPartial: true,
        unreservedRemainderSen: offer.fullSen - offer.offeredSen,
        reason: 'partial_claim_reserved',
      });
      offer.status = 'consented';
      return {
        ok: true,
        outcome: 'claim',
        audit: {
          targetType: 'claim',
          targetId: claim.id,
          reason: `partial_consent:${offer.id}`,
          before: null,
          after: 'pending_review',
        },
      };
    }
    case 'claim.declinePartial': {
      const offer = c.state.partialOffers[command.offerId];
      if (!offer) return fail('not_found', 'partial_offer');
      if (offer.creatorId !== c.actor.userId) return fail('forbidden', 'not_the_creator');
      if (offer.status !== 'open' && offer.status !== 'stale') {
        return fail('invalid_transition', `offer_${offer.status}`);
      }
      const before = offer.status;
      offer.status = 'declined';
      return {
        ok: true,
        audit: {
          targetType: 'claim',
          targetId: offer.id,
          reason: 'partial_offer_declined',
          before,
          after: 'declined',
        },
      };
    }
    case 'waitlist.resubmit': {
      const entry = c.state.waitlist[command.entryId];
      if (!entry) return fail('not_found', 'waitlist_entry');
      if (entry.creatorId !== c.actor.userId) return fail('forbidden', 'not_the_creator');
      if (entry.status !== 'waiting' && entry.status !== 'notified') {
        return fail('invalid_transition', `entry_${entry.status}`);
      }
      // "通知后重提取得新优先级" — the resubmit time is the new queue time.
      const result = requestClaim(c, entry.submissionId);
      if (!result.ok) return result;
      // Still nothing allocatable: the entry stays on the waitlist (requestClaim
      // refreshed it) rather than being marked resubmitted and lost.
      if (result.outcome !== 'waitlisted') entry.status = 'resubmitted';
      return result;
    }
    case 'appeal.file': {
      const claim = c.state.claims[command.claimId];
      if (!claim) return fail('not_found', 'claim');
      if (claim.creatorId !== c.actor.userId) return fail('forbidden', 'not_the_creator');
      if (claim.status !== 'rejected_appealable' || claim.rejection === null) {
        return fail('invalid_transition', `claim_${claim.status}`);
      }
      if (isAfter(c.now, claim.rejection.appealDeadlineAt)) {
        return fail('appeal_window_closed', claim.rejection.appealDeadlineAt);
      }
      if (appealFor(c.state, claim.id) !== null) return fail('appeal_already_filed', claim.id);
      const reason = command.reason.trim();
      if (reason === '') return fail('invalid_input', 'reason_required');
      const id = mint(c, 'ap');
      c.state.appeals[id] = {
        id,
        claimId: claim.id,
        creatorId: claim.creatorId,
        reason,
        filedAt: c.now,
        status: 'open',
        resolvedBy: null,
        resolvedAt: null,
        note: null,
      };
      claim.status = 'appealing'; // reservation stays held
      claim.updatedAt = c.now;
      emit(c, {
        kind: 'appeal.filed',
        targetType: 'appeal',
        targetId: id,
        refs: {
          campaignId: claim.campaignId,
          submissionId: claim.submissionId,
          claimId: claim.id,
          appealId: id,
          creatorId: claim.creatorId,
        },
        params: { appealId: id, claimId: claim.id, reason },
      });
      return {
        ok: true,
        audit: {
          targetType: 'appeal',
          targetId: id,
          reason,
          before: 'rejected_appealable',
          after: 'appealing',
        },
      };
    }
    default:
      return fail('invalid_input', 'not_a_creator_command');
  }
}

interface CreateClaimInput {
  campaign: Campaign;
  submission: Submission;
  amountSen: Sen;
  snapshotVersion: number;
  qualifiedViews: number;
  isPartial: boolean;
  unreservedRemainderSen: Sen;
  reason: Extract<LedgerReason, 'claim_reserved' | 'partial_claim_reserved'>;
}

function createClaim(c: Ctx, input: CreateClaimInput): Claim {
  const { campaign, submission } = input;
  const id = mint(c, 'cl');
  const claim: Claim = {
    id,
    campaignId: campaign.id,
    orgId: campaign.orgId,
    submissionId: submission.id,
    creatorId: submission.creatorId,
    // Queue order comes from the simulated server clock, never from user input.
    seq: campaign.nextClaimSeq,
    validAt: c.now,
    amountSen: input.amountSen,
    snapshotVersion: input.snapshotVersion,
    qualifiedViewsAtClaim: input.qualifiedViews,
    rulesVersion: submission.rulesVersion,
    meteringCutoffAt: submission.meteringEndsAt ?? c.now,
    isPartial: input.isPartial,
    unreservedRemainderSen: input.unreservedRemainderSen,
    status: 'pending_review',
    meteringReview: { status: 'pending', reason: null, decidedBy: null, decidedAt: null },
    rejection: null,
    escalatedAt: null,
    createdAt: c.now,
    updatedAt: c.now,
  };
  campaign.nextClaimSeq += 1;
  c.state.claims[id] = claim;
  moveLedger(c, {
    campaign,
    claimId: id,
    from: 'available',
    to: 'reserved',
    amountSen: input.amountSen,
    reason: input.reason,
  });
  emit(c, {
    kind: 'claim.reserved',
    targetType: 'claim',
    targetId: id,
    refs: {
      campaignId: campaign.id,
      submissionId: submission.id,
      claimId: id,
      creatorId: submission.creatorId,
    },
    params: {
      claimId: id,
      amountSen: input.amountSen,
      seq: claim.seq,
      isPartial: String(input.isPartial),
      unreservedRemainderSen: input.unreservedRemainderSen,
    },
  });
  return claim;
}

/**
 * One claim path shared by `claim.request` and `waitlist.resubmit`.
 * A21/A28: a claim is always for the WHOLE claimable amount; only the budget decides
 * between a claim, a partial offer and the waitlist.
 */
function requestClaim(c: Ctx, submissionId: string): HandlerResult {
  const eligibility = evaluateClaimRequest(c.state, submissionId, c.actor.userId);
  if (!eligibility.ok) return fail(eligibility.code, eligibility.detail);
  const { campaign, submission, math } = eligibility;
  const budget = budgetOf(c.state, campaign.id);

  if (budget.availableSen >= math.claimableSen) {
    const claim = createClaim(c, {
      campaign,
      submission,
      amountSen: math.claimableSen,
      snapshotVersion: math.snapshotVersion,
      qualifiedViews: math.qualifiedViews,
      isPartial: false,
      unreservedRemainderSen: 0,
      reason: 'claim_reserved',
    });
    return {
      ok: true,
      outcome: 'claim',
      audit: {
        targetType: 'claim',
        targetId: claim.id,
        reason: `claimable:${math.claimableSen}`,
        before: null,
        after: 'pending_review',
      },
    };
  }

  if (budget.availableSen >= campaign.rules.minClaimSen) {
    // Partial offer: no reservation, no queue position, no countdown.
    for (const existing of Object.values(c.state.partialOffers)) {
      if (existing.submissionId === submission.id && existing.status === 'open') {
        existing.status = 'stale';
      }
    }
    const id = mint(c, 'off');
    c.state.partialOffers[id] = {
      id,
      campaignId: campaign.id,
      submissionId: submission.id,
      creatorId: submission.creatorId,
      fullSen: math.claimableSen,
      offeredSen: budget.availableSen,
      snapshotVersion: math.snapshotVersion,
      budgetVersion: campaign.budgetVersion,
      status: 'open',
      createdAt: c.now,
    };
    emit(c, {
      kind: 'claim.partial_offer',
      targetType: 'claim',
      targetId: id,
      refs: {
        campaignId: campaign.id,
        submissionId: submission.id,
        creatorId: submission.creatorId,
      },
      params: {
        offerId: id,
        fullSen: math.claimableSen,
        offeredSen: budget.availableSen,
        snapshotVersion: math.snapshotVersion,
        budgetVersion: campaign.budgetVersion,
      },
    });
    return {
      ok: true,
      outcome: 'partial_offer',
      audit: {
        targetType: 'claim',
        targetId: id,
        reason: `offer:${budget.availableSen}/${math.claimableSen}`,
        before: null,
        after: 'open',
      },
    };
  }

  // Below the minimum: waitlist, with no reservation and no payment promise.
  // An existing entry is reused (never a second row for the same submission) and
  // its queue time is refreshed, because a resubmit "取得新的有效时间".
  const existingEntry = Object.values(c.state.waitlist).find(
    (entry) =>
      entry.submissionId === submission.id &&
      (entry.status === 'waiting' || entry.status === 'notified'),
  );
  if (existingEntry) {
    const before = existingEntry.status;
    existingEntry.status = 'waiting';
    existingEntry.notifiedAt = null;
    existingEntry.createdAt = c.now;
    existingEntry.claimableSenAtEntry = math.claimableSen;
    return {
      ok: true,
      outcome: 'waitlisted',
      audit: {
        targetType: 'claim',
        targetId: existingEntry.id,
        reason: `waitlisted:${math.claimableSen}`,
        before,
        after: 'waiting',
      },
    };
  }
  const id = mint(c, 'wl');
  c.state.waitlist[id] = {
    id,
    campaignId: campaign.id,
    submissionId: submission.id,
    creatorId: submission.creatorId,
    claimableSenAtEntry: math.claimableSen,
    status: 'waiting',
    createdAt: c.now,
    notifiedAt: null,
  };
  emit(c, {
    kind: 'claim.waitlisted',
    targetType: 'claim',
    targetId: id,
    refs: {
      campaignId: campaign.id,
      submissionId: submission.id,
      creatorId: submission.creatorId,
    },
    params: {
      entryId: id,
      claimableSen: math.claimableSen,
      availableSen: budget.availableSen,
      minClaimSen: campaign.rules.minClaimSen,
    },
  });
  return {
    ok: true,
    outcome: 'waitlisted',
    audit: {
      targetType: 'claim',
      targetId: id,
      reason: `waitlisted:${math.claimableSen}`,
      before: null,
      after: 'waiting',
    },
  };
}

// ---------------------------------------------------------------------------
// Handlers: ops reviewer
// ---------------------------------------------------------------------------

function handleOpsReviewer(c: Ctx, command: Command): HandlerResult {
  switch (command.type) {
    case 'submission.resync': {
      const submission = c.state.submissions[command.submissionId];
      if (!submission) return fail('not_found', 'submission');
      const campaign = c.state.campaigns[submission.campaignId];
      if (!campaign) return fail('not_found', 'campaign');
      const reason = command.reason.trim();
      if (reason === '') return fail('invalid_input', 'reason_required');
      const before = submission.status;

      if (submission.dataOutage) {
        // Still unreadable: record the failure, keep the status and the last trusted data.
        appendSnapshot(c, submission, {
          sourceTime: null,
          totalViews: null,
          qualifiedViewsInWindow: null,
          missingReason: 'source_unreachable',
          trusted: false,
        });
        submission.status = submission.acceptedAt === null ? 'baseline_unavailable' : 'data_unavailable';
        emit(c, {
          kind: 'submission.resynced',
          targetType: 'submission',
          targetId: submission.id,
          refs: {
            campaignId: submission.campaignId,
            submissionId: submission.id,
            creatorId: submission.creatorId,
          },
          params: { submissionId: submission.id, result: 'failed', reason },
        });
        return {
          ok: true,
          audit: {
            targetType: 'submission',
            targetId: submission.id,
            reason,
            before,
            after: `${submission.status}:resync_failed`,
          },
        };
      }

      if (submission.acceptedAt === null) {
        if (!campaign.readiness.dataSourceReady) {
          appendSnapshot(c, submission, {
            sourceTime: null,
            totalViews: null,
            qualifiedViewsInWindow: null,
            missingReason: 'source_unreachable',
            trusted: false,
          });
          emit(c, {
            kind: 'submission.resynced',
            targetType: 'submission',
            targetId: submission.id,
            refs: {
              campaignId: submission.campaignId,
              submissionId: submission.id,
              creatorId: submission.creatorId,
            },
            params: { submissionId: submission.id, result: 'failed', reason },
          });
          return {
            ok: true,
            audit: {
              targetType: 'submission',
              targetId: submission.id,
              reason,
              before,
              after: 'baseline_unavailable:resync_failed',
            },
          };
        }
        // The source can answer now: record the baseline at THIS time, not earlier.
        acceptSubmission(c, submission, campaign);
      } else {
        const trusted = lastTrustedSnapshot(submission);
        appendSnapshot(c, submission, {
          sourceTime: c.now,
          totalViews: trusted?.totalViews ?? submission.baselineViews,
          qualifiedViewsInWindow: trusted?.qualifiedViewsInWindow ?? 0,
          missingReason: null,
          trusted: true,
        });
        submission.status = statusAfterOutage(c, submission);
      }
      emit(c, {
        kind: 'submission.resynced',
        targetType: 'submission',
        targetId: submission.id,
        refs: {
          campaignId: submission.campaignId,
          submissionId: submission.id,
          creatorId: submission.creatorId,
        },
        params: { submissionId: submission.id, result: 'ok', reason },
      });
      return {
        ok: true,
        audit: {
          targetType: 'submission',
          targetId: submission.id,
          reason,
          before,
          after: submission.status,
        },
      };
    }
    case 'claim.reviewMetering': {
      const claim = c.state.claims[command.claimId];
      if (!claim) return fail('not_found', 'claim');
      if (claim.status !== 'pending_review') return fail('invalid_transition', `claim_${claim.status}`);
      const before = `${claim.status}/${claim.meteringReview.status}`;
      const reason = (command.reason ?? '').trim();

      if (command.decision === 'approve') {
        claim.meteringReview = {
          status: 'approved',
          reason: reason === '' ? null : reason,
          decidedBy: c.actor.userId,
          decidedAt: c.now,
        };
        claim.updatedAt = c.now;
        confirmIfReady(c, claim);
        return {
          ok: true,
          audit: {
            targetType: 'claim',
            targetId: claim.id,
            reason: reason === '' ? null : reason,
            before,
            after: `${claim.status}/approved`,
          },
        };
      }
      if (command.decision === 'hold') {
        if (reason === '') return fail('invalid_input', 'reason_required');
        claim.meteringReview = {
          status: 'held',
          reason,
          decidedBy: c.actor.userId,
          decidedAt: c.now,
        };
        claim.updatedAt = c.now;
        emit(c, {
          kind: 'metering.held',
          targetType: 'claim',
          targetId: claim.id,
          refs: {
            campaignId: claim.campaignId,
            submissionId: claim.submissionId,
            claimId: claim.id,
            creatorId: claim.creatorId,
          },
          params: { claimId: claim.id, reason },
        });
        return {
          ok: true,
          audit: {
            targetType: 'claim',
            targetId: claim.id,
            reason,
            before,
            after: 'pending_review/held',
          },
        };
      }
      if (command.decision !== 'reject') return fail('invalid_input', 'unknown_decision');
      if (reason === '') return fail('invalid_input', 'reason_required');
      claim.meteringReview = {
        status: 'rejected',
        reason,
        decidedBy: c.actor.userId,
        decidedAt: c.now,
      };
      applyRejection(c, claim, 'metering', reason);
      return {
        ok: true,
        audit: {
          targetType: 'claim',
          targetId: claim.id,
          reason,
          before,
          after: 'rejected_appealable/rejected',
        },
      };
    }
    case 'claim.finalizeRejection': {
      const claim = c.state.claims[command.claimId];
      if (!claim) return fail('not_found', 'claim');
      const reason = command.reason.trim();
      if (reason === '') return fail('invalid_input', 'reason_required');
      const block = finalizeRejectionBlock(c.state, claim);
      if (block !== null) return fail('release_not_allowed', block);
      const campaign = c.state.campaigns[claim.campaignId];
      if (!campaign) return fail('not_found', 'campaign');

      claim.status = 'rejected_final';
      claim.updatedAt = c.now;
      moveLedger(c, {
        campaign,
        claimId: claim.id,
        from: 'reserved',
        to: 'available',
        amountSen: claim.amountSen,
        reason: 'rejection_released',
      });
      emit(c, {
        kind: 'claim.rejection_finalized',
        targetType: 'claim',
        targetId: claim.id,
        refs: {
          campaignId: claim.campaignId,
          submissionId: claim.submissionId,
          claimId: claim.id,
          creatorId: claim.creatorId,
        },
        params: { claimId: claim.id, amountSen: claim.amountSen, reason },
      });
      const submission = c.state.submissions[claim.submissionId];
      if (submission) maybeGrantPendingCaseExtension(c, submission);
      return {
        ok: true,
        audit: {
          targetType: 'claim',
          targetId: claim.id,
          reason,
          before: 'rejected_appealable',
          after: 'rejected_final',
        },
      };
    }
    case 'appeal.resolve': {
      const appeal = c.state.appeals[command.appealId];
      if (!appeal) return fail('not_found', 'appeal');
      if (appeal.status !== 'open') return fail('invalid_transition', `appeal_${appeal.status}`);
      const note = command.note.trim();
      if (note === '') return fail('invalid_input', 'note_required');
      const claim = c.state.claims[appeal.claimId];
      if (!claim) return fail('not_found', 'claim');
      const submission = c.state.submissions[claim.submissionId];
      if (!submission) return fail('not_found', 'submission');

      if (command.decision === 'uphold') {
        appeal.status = 'upheld';
        appeal.resolvedBy = c.actor.userId;
        appeal.resolvedAt = c.now;
        appeal.note = note;
        const source = claim.rejection?.source ?? 'metering';
        // Back to verification keeping seq, validAt, amount and the reservation:
        // "成立后继续核验，不重排".
        claim.status = 'pending_review';
        claim.rejection = null;
        claim.updatedAt = c.now;
        if (source === 'metering') {
          claim.meteringReview = { status: 'pending', reason: null, decidedBy: null, decidedAt: null };
        } else {
          submission.contentReview = { status: 'pending', reason: null, decidedBy: null, decidedAt: null };
        }
        emit(c, {
          kind: 'appeal.upheld',
          targetType: 'appeal',
          targetId: appeal.id,
          refs: {
            campaignId: claim.campaignId,
            submissionId: claim.submissionId,
            claimId: claim.id,
            appealId: appeal.id,
            creatorId: claim.creatorId,
          },
          params: { appealId: appeal.id, claimId: claim.id, note, resumedReview: source },
        });
        return {
          ok: true,
          audit: {
            targetType: 'appeal',
            targetId: appeal.id,
            reason: note,
            before: 'open',
            after: 'upheld',
          },
        };
      }
      if (command.decision !== 'reject') return fail('invalid_input', 'unknown_decision');
      appeal.status = 'rejected';
      appeal.resolvedBy = c.actor.userId;
      appeal.resolvedAt = c.now;
      appeal.note = note;
      // Reservation still held: release needs an explicit finalizeRejection.
      claim.status = 'rejected_appealable';
      claim.updatedAt = c.now;
      emit(c, {
        kind: 'appeal.rejected',
        targetType: 'appeal',
        targetId: appeal.id,
        refs: {
          campaignId: claim.campaignId,
          submissionId: claim.submissionId,
          claimId: claim.id,
          appealId: appeal.id,
          creatorId: claim.creatorId,
        },
        params: { appealId: appeal.id, claimId: claim.id, note },
      });
      return {
        ok: true,
        audit: {
          targetType: 'appeal',
          targetId: appeal.id,
          reason: note,
          before: 'open',
          after: 'rejected',
        },
      };
    }
    default:
      return fail('invalid_input', 'not_an_ops_reviewer_command');
  }
}

// ---------------------------------------------------------------------------
// Handlers: ops finance
// ---------------------------------------------------------------------------

function startAttempt(c: Ctx, obligationId: string, note: string): string {
  const id = mint(c, 'pa');
  const obligation = c.state.obligations[obligationId];
  c.state.payoutAttempts[id] = {
    id,
    obligationId,
    requestKey: `rk_${id}`,
    status: 'processing',
    startedAt: c.now,
    startedBy: c.actor.userId,
    resolvedAt: null,
    failureReason: null,
    providerRef: `sim_${id}`,
    reconciliations: [],
  };
  if (obligation) {
    const claim = c.state.claims[obligation.claimId];
    emit(c, {
      kind: 'payout.processing',
      targetType: 'payout_attempt',
      targetId: id,
      refs: {
        campaignId: obligation.campaignId,
        submissionId: claim?.submissionId,
        claimId: obligation.claimId,
        obligationId: obligation.id,
        attemptId: id,
        creatorId: obligation.creatorId,
      },
      params: { attemptId: id, amountSen: obligation.amountSen, note },
    });
  }
  return id;
}

function handleOpsFinance(c: Ctx, command: Command): HandlerResult {
  switch (command.type) {
    case 'payout.start': {
      const obligation = c.state.obligations[command.obligationId];
      if (!obligation) return fail('not_found', 'obligation');
      if (obligation.status === 'settled') return fail('already_settled', obligation.id);
      const attempts = attemptsFor(c.state, obligation.id);
      const unresolved = attempts.find(
        (attempt) => attempt.status === 'processing' || attempt.status === 'unknown',
      );
      if (unresolved) return fail('attempt_unresolved', unresolved.id);
      const last = attempts[attempts.length - 1];
      if (last && last.status === 'succeeded') return fail('already_settled', obligation.id);
      if (last && last.status === 'failed') return fail('retry_not_allowed', 'use_payout_retry');
      const id = startAttempt(c, obligation.id, 'first_attempt');
      return {
        ok: true,
        audit: {
          targetType: 'payout_attempt',
          targetId: id,
          reason: 'payout_started',
          before: null,
          after: 'processing',
        },
      };
    }
    case 'payout.reconcile': {
      const attempt = c.state.payoutAttempts[command.attemptId];
      if (!attempt) return fail('not_found', 'payout_attempt');
      // Reconciliation follows the ORIGINAL transaction; it is not a second payment.
      if (attempt.status !== 'unknown') return fail('invalid_transition', `attempt_${attempt.status}`);
      const obligation = c.state.obligations[attempt.obligationId];
      if (!obligation) return fail('not_found', 'obligation');
      const note = command.note.trim();
      if (note === '') return fail('invalid_input', 'note_required');
      const before = attempt.status;
      attempt.reconciliations.push({
        at: c.now,
        by: c.actor.userId,
        outcome: command.outcome,
        note,
      });

      if (command.outcome === 'confirmed_succeeded') {
        if (obligation.status === 'settled') return fail('already_settled', obligation.id);
        settleObligation(c, attempt.id);
      } else if (command.outcome === 'confirmed_failed') {
        attempt.status = 'failed';
        attempt.resolvedAt = c.now;
        attempt.failureReason = note;
        const claim = c.state.claims[obligation.claimId];
        emit(c, {
          kind: 'payout.failed',
          targetType: 'payout_attempt',
          targetId: attempt.id,
          refs: {
            campaignId: obligation.campaignId,
            submissionId: claim?.submissionId,
            claimId: obligation.claimId,
            obligationId: obligation.id,
            attemptId: attempt.id,
            creatorId: obligation.creatorId,
          },
          params: { attemptId: attempt.id, failureReason: note, amountSen: obligation.amountSen },
        });
      } else if (command.outcome !== 'still_unknown') {
        return fail('invalid_input', 'unknown_outcome');
      }

      const claim = c.state.claims[obligation.claimId];
      emit(c, {
        kind: 'payout.reconciled',
        targetType: 'payout_attempt',
        targetId: attempt.id,
        refs: {
          campaignId: obligation.campaignId,
          submissionId: claim?.submissionId,
          claimId: obligation.claimId,
          obligationId: obligation.id,
          attemptId: attempt.id,
          creatorId: obligation.creatorId,
        },
        params: { attemptId: attempt.id, outcome: command.outcome, note },
      });
      return {
        ok: true,
        audit: {
          targetType: 'payout_attempt',
          targetId: attempt.id,
          reason: `${command.outcome}: ${note}`,
          before,
          after: attempt.status,
        },
      };
    }
    case 'payout.retry': {
      const obligation = c.state.obligations[command.obligationId];
      if (!obligation) return fail('not_found', 'obligation');
      const reason = command.reason.trim();
      if (reason === '') return fail('invalid_input', 'reason_required');
      if (obligation.status === 'settled') return fail('already_settled', obligation.id);
      const attempts = attemptsFor(c.state, obligation.id);
      const unresolved = attempts.find(
        (attempt) => attempt.status === 'processing' || attempt.status === 'unknown',
      );
      if (unresolved) return fail('attempt_unresolved', unresolved.id);
      const last = latestAttempt(c.state, obligation.id);
      // Controlled retry needs confirmed-failure evidence.
      if (!last || last.status !== 'failed') return fail('retry_not_allowed', last?.status ?? 'no_attempt');
      const id = startAttempt(c, obligation.id, reason);
      return {
        ok: true,
        audit: {
          targetType: 'payout_attempt',
          targetId: id,
          reason,
          before: `retry_of:${last.id}`,
          after: 'processing',
        },
      };
    }
    default:
      return fail('invalid_input', 'not_an_ops_finance_command');
  }
}

// ---------------------------------------------------------------------------
// Handlers: notifications
// ---------------------------------------------------------------------------

function handleNotification(c: Ctx, command: Command): HandlerResult {
  switch (command.type) {
    case 'notification.markRead': {
      const notification = c.state.notifications[command.notificationId];
      if (!notification) return fail('not_found', 'notification');
      if (notification.recipientUserId !== c.actor.userId) return fail('forbidden', 'not_the_recipient');
      if (notification.readAt === null) notification.readAt = c.now; // idempotent
      return { ok: true };
    }
    case 'notification.markAllRead': {
      for (const notification of Object.values(c.state.notifications)) {
        if (notification.recipientUserId !== c.actor.userId) continue;
        if (notification.readAt === null) notification.readAt = c.now;
      }
      return { ok: true };
    }
    default:
      return fail('invalid_input', 'not_a_notification_command');
  }
}

// ---------------------------------------------------------------------------
// applyCommand
// ---------------------------------------------------------------------------

function route(c: Ctx, command: Command): HandlerResult {
  const type = command.type;
  if (type.startsWith('session.')) return handleSession(c, command);
  if (type.startsWith('demo.')) return handleDemo(c, command);
  if (type.startsWith('notification.')) return handleNotification(c, command);
  switch (type) {
    case 'campaign.createDraft':
    case 'campaign.updateDraft':
    case 'campaign.publish':
    case 'campaign.pause':
    case 'campaign.resume':
    case 'campaign.closeSubmissions':
    case 'campaign.close':
    case 'submission.reviewContent':
      return handleMerchant(c, command);
    case 'connection.connect':
    case 'connection.reconnect':
    case 'submission.create':
    case 'claim.request':
    case 'claim.consentPartial':
    case 'claim.declinePartial':
    case 'waitlist.resubmit':
    case 'appeal.file':
      return handleCreator(c, command);
    case 'submission.resync':
    case 'claim.reviewMetering':
    case 'claim.finalizeRejection':
    case 'appeal.resolve':
      return handleOpsReviewer(c, command);
    case 'payout.start':
    case 'payout.reconcile':
    case 'payout.retry':
      return handleOpsFinance(c, command);
    default:
      return fail('invalid_input', 'unknown_command');
  }
}

function copyState(state: DemoState): DemoState {
  // Plain JSON data: a structural copy keeps `applyCommand` pure without asking
  // every handler to clone by hand.
  return structuredClone(state);
}

function appendAudit(c: Ctx, command: Command, draft: AuditDraft): void {
  const id = mint(c, 'ad');
  c.state.audit.push({
    id,
    at: c.now,
    actorUserId: c.actor.userId,
    role: c.actor.role,
    action: command.type,
    targetType: draft.targetType,
    targetId: draft.targetId,
    reason: draft.reason ?? null,
    before: draft.before ?? null,
    after: draft.after ?? null,
    commandId: c.commandId,
  });
}

function defaultAuditTarget(command: Command): AuditDraft {
  switch (command.type) {
    case 'campaign.createDraft':
      return { targetType: 'campaign', targetId: command.orgId };
    case 'campaign.updateDraft':
    case 'campaign.publish':
    case 'campaign.pause':
    case 'campaign.resume':
    case 'campaign.closeSubmissions':
    case 'campaign.close':
    case 'demo.setReadiness':
      return { targetType: 'campaign', targetId: command.campaignId };
    case 'submission.create':
      return { targetType: 'submission', targetId: command.campaignId };
    case 'submission.reviewContent':
    case 'submission.resync':
    case 'demo.addQualifiedViews':
    case 'demo.setDataOutage':
      return { targetType: 'submission', targetId: command.submissionId };
    case 'claim.request':
      return { targetType: 'claim', targetId: command.submissionId };
    case 'claim.reviewMetering':
    case 'claim.finalizeRejection':
      return { targetType: 'claim', targetId: command.claimId };
    case 'appeal.file':
      return { targetType: 'appeal', targetId: command.claimId };
    case 'appeal.resolve':
      return { targetType: 'appeal', targetId: command.appealId };
    case 'payout.start':
    case 'payout.retry':
      return { targetType: 'obligation', targetId: command.obligationId };
    case 'payout.reconcile':
    case 'demo.setPayoutOutcome':
      return { targetType: 'payout_attempt', targetId: command.attemptId };
    default:
      return { targetType: 'demo', targetId: command.type };
  }
}

/**
 * Rebuilds state from the seed. `demo.reset` and `demo.loadScenario` replace the
 * whole record set, so they run outside the normal pipeline; the visitor's language
 * choice survives because it is a preference, not a demo record.
 */
function rebuildFromSeed(
  state: DemoState,
  command: Command,
  meta: CommandMeta,
  actor: Actor,
): CommandResult {
  const fresh = createSeedState();
  fresh.session.locale = state.session.locale;
  fresh.session.localeExplicit = state.session.localeExplicit;
  fresh.session.localePromptDone = state.session.localePromptDone;

  let next = fresh;
  if (command.type === 'demo.loadScenario') {
    try {
      next = replayScenario(fresh, command.scenarioId, applyCommand);
    } catch (error) {
      return {
        ok: false,
        state,
        code: 'invalid_input',
        detail: error instanceof Error ? error.message : 'scenario_failed',
      };
    }
  }

  const minter = createIdMinter(next.clock.seq);
  const auditId = minter.mint('ad');
  next.audit.push({
    id: auditId,
    at: next.clock.nowIso,
    actorUserId: actor.userId,
    role: actor.role,
    action: command.type,
    targetType: 'demo',
    targetId: command.type === 'demo.loadScenario' ? command.scenarioId : 'reset',
    reason: null,
    before: state.scenario,
    after: next.scenario,
    commandId: meta.commandId,
  });
  next.clock.seq = minter.seq;
  next.processedCommands[meta.commandId] = { at: next.clock.nowIso, outcome: 'ok' };
  return { ok: true, state: next, events: [] };
}

/**
 * The only mutation entry point. See the file header for the guarantees.
 */
export function applyCommand(
  state: DemoState,
  command: Command,
  meta: CommandMeta,
): CommandResult {
  if (typeof meta.commandId !== 'string' || meta.commandId === '') {
    return { ok: false, state, code: 'invalid_input', detail: 'commandId_required' };
  }
  // Idempotency: the same user intent replayed (double click, retry) changes nothing.
  if (state.processedCommands[meta.commandId]) {
    return { ok: true, state, events: [], outcome: 'idempotent_replay' };
  }

  const actor = resolveActor(state);
  const denial = checkPermission(actor, command, state);
  if (denial) return { ok: false, state, code: denial.code, detail: denial.detail };

  if (command.type === 'demo.reset' || command.type === 'demo.loadScenario') {
    return rebuildFromSeed(state, command, meta, actor);
  }

  const draft = copyState(state);
  const minter = createIdMinter(draft.clock.seq);
  const c: Ctx = {
    state: draft,
    actor,
    commandId: meta.commandId,
    now: draft.clock.nowIso,
    events: [],
    minter,
  };

  const result = route(c, command);
  if (!result.ok) {
    // Failed commands change nothing: no state, no audit, no notification.
    // The one exception is a partial offer that has just been found stale; see
    // HandlerResult.persist. The command id is deliberately left unused.
    if (result.persist) {
      draft.clock.seq = minter.seq;
      return { ok: false, state: draft, code: result.code, detail: result.detail };
    }
    return { ok: false, state, code: result.code, detail: result.detail };
  }

  if (!isUnauditedCommand(command.type)) {
    const drafts = result.audit
      ? Array.isArray(result.audit)
        ? result.audit
        : [result.audit]
      : [defaultAuditTarget(command)];
    for (const entry of drafts) appendAudit(c, command, entry);
  }

  draft.clock.seq = minter.seq;
  draft.processedCommands[meta.commandId] = {
    at: c.now,
    outcome: result.outcome ?? 'ok',
  };
  return { ok: true, state: draft, events: c.events, outcome: result.outcome };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const REQUIRED_KEYS = [
  'clock',
  'session',
  'users',
  'orgs',
  'campaigns',
  'connections',
  'submissions',
  'claims',
  'partialOffers',
  'waitlist',
  'appeals',
  'obligations',
  'payoutAttempts',
  'ledger',
  'notifications',
  'audit',
  'processedCommands',
] as const;

/**
 * Returns the persisted state when this build can read it, otherwise null so the UI
 * can offer a reset ("a schema change bumps the version and the app offers reset
 * instead of failing").
 */
export function migrate(persisted: unknown): DemoState | null {
  if (typeof persisted !== 'object' || persisted === null) return null;
  const candidate = persisted as Record<string, unknown>;
  if (candidate.schemaVersion !== SCHEMA_VERSION) return null;
  for (const key of REQUIRED_KEYS) {
    if (!(key in candidate) || candidate[key] === null) return null;
  }
  const clock = candidate.clock as Record<string, unknown> | undefined;
  if (!clock || !isIsoDateTime(clock.nowIso) || typeof clock.seq !== 'number') return null;
  if (!Array.isArray(candidate.ledger) || !Array.isArray(candidate.audit)) return null;
  return candidate as unknown as DemoState;
}

/** The engine surface declared in types.ts; the store holds only this. */
export const demoEngine: DemoEngine = {
  createSeedState,
  applyCommand,
  migrate,
};
