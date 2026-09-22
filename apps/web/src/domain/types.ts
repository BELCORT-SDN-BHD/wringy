// M1 demo domain contract — apps/web/src/domain/types.ts
//
// Pure data types shared by the demo engine, the store and every UI feature.
// No React, no browser APIs. All money is integer sen (MYR minor units).
// All timestamps are ISO 8601 strings with an explicit offset; display uses Asia/Kuala_Lumpur.
//
// Business source of truth for values and transitions:
//   phase-0/foundation/campaign-defaults-v1.md  (rules, defaults, approved supplements)
//   phase-0/foundation/implementation-spec-content-rewards-v1.md  (D01–D06)
//   phase-0/foundation/milestones/prototype-spec-v1.md  (M1 scope, main flow, exceptions, P01–P11)
// This file does not redefine those rules; it names the data the M1 demo keeps.

export const CURRENCY = 'MYR' as const;
export const TIMEZONE = 'Asia/Kuala_Lumpur' as const;
export const SCHEMA_VERSION = 1;

/** Integer minor units of MYR (1 RM = 100 sen). Never a float. */
export type Sen = number;
/** ISO 8601 with offset, e.g. "2026-09-01T12:00:00+08:00". */
export type IsoDateTime = string;

export type Locale = 'en-MY' | 'ms-MY' | 'zh-Hans-MY';
export const LOCALES: readonly Locale[] = ['en-MY', 'ms-MY', 'zh-Hans-MY'];

export type Platform = 'tiktok' | 'instagram' | 'youtube';
export type ContentLanguage = 'en' | 'ms' | 'zh';

// ---------------------------------------------------------------------------
// Identity (all simulated; role switching is a demo tool, not authorisation)
// ---------------------------------------------------------------------------

export type Role = 'guest' | 'creator' | 'merchant' | 'ops_reviewer' | 'ops_finance';
export type Workspace = 'creator' | 'merchant';

export interface User {
  id: string;
  displayName: string;
  email: string; // simulated, used only for "simulated email preview" recipients
  /** Org memberships (merchant workspace). Empty for pure creators. */
  orgIds: string[];
  /** Ops capability the demo grants when the demo toolbar selects this user. */
  opsCapability: 'ops_reviewer' | 'ops_finance' | null;
}

export interface Org {
  id: string;
  name: string;
}

/** Who is acting right now, resolved from the session by `resolveActor`. */
export interface Actor {
  userId: string;
  role: Role;
  orgId: string | null; // set when role === 'merchant'
}

export interface Session {
  /** null = signed-out guest. */
  userId: string | null;
  workspace: Workspace;
  /** Set only through the demo toolbar. Overrides workspace role while non-null. */
  opsRole: 'ops_reviewer' | 'ops_finance' | null;
  locale: Locale;
  /** True once the first-visit language prompt was answered or skipped. */
  localePromptDone: boolean;
  /** True once the user explicitly chose a language (vs. the suggested default). */
  localeExplicit: boolean;
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export type CampaignStatus =
  | 'draft'
  | 'published'
  | 'paused'
  | 'submissions_closed'
  | 'settling'
  | 'closed';

export interface CampaignRules {
  /** Reward pool. Default 200_000 (RM2,000). */
  poolSen: Sen;
  /** Reward per 1,000 qualified views. Default 500 (RM5). */
  ratePerThousandSen: Sen;
  /** Minimum NEW claimable increment per claim. Default 500 (RM5). Not a wallet threshold. */
  minClaimSen: Sen;
  /** Optional extra qualified-view threshold; when set both conditions must hold. Default null. */
  viewThreshold: number | null;
  /** Cumulative cap per submission (per platform post). Default 10_000 (RM100). */
  capPerSubmissionSen: Sen;
  /** Submissions open for this many days after publish. Default 14. */
  submissionWindowDays: number;
  /** Metering window after acceptance. Default 7. Views before acceptance never count. */
  meteringDays: number;
  /** Calendar days after metering end during which a claim may still be filed. Default 7. */
  claimGraceDays: number;
  /** Content retention after publish. Default 30. Effective end is computed (see selectors). */
  retentionDays: number;
  /** Merchant must explicitly allow independent per-platform caps for the same content. Default false. */
  crossPlatformIndependentCap: boolean;
  platforms: Platform[];
  contentLanguages: ContentLanguage[];
  /** Only 'global' is supported in M1; regional billing is not verified. */
  audienceRegion: 'global';
}

export interface Campaign {
  id: string;
  orgId: string;
  title: string;
  brief: string;
  status: CampaignStatus;
  rules: CampaignRules;
  /** Increments on every published rules change; submissions keep the version they joined under. */
  rulesVersion: number;
  /** Service fee is not decided. Never a number in M1; the UI shows "pending configuration, not charged in demo". */
  serviceFee: 'pending_config';
  readiness: {
    /** Simulated funding evidence. Publishing is blocked while false. */
    fundingEvidence: boolean;
    /** Simulated data-source readiness for the selected platforms. Publishing is blocked while false. */
    dataSourceReady: boolean;
  };
  /** Bumps on every ledger movement; partial offers are stale when it changes. */
  budgetVersion: number;
  /** Next claim sequence number (campaign-monotonic queue order). */
  nextClaimSeq: number;
  publishedAt: IsoDateTime | null;
  submissionsCloseAt: IsoDateTime | null;
  closedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Accounts, submissions, metering
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'valid' | 'invalid' | 'unlinked';

export interface AccountConnection {
  id: string;
  userId: string;
  platform: Platform;
  handle: string;
  /** Stable platform account id used for ownership checks. */
  accountId: string;
  status: ConnectionStatus;
  /** Human-readable reason when status === 'invalid' (e.g. token expired). */
  invalidReason: 'token_expired' | 'permission_revoked' | null;
  updatedAt: IsoDateTime;
}

export type SubmissionStatus =
  | 'pending_baseline' // URL accepted for checks; no trusted baseline yet — no metering
  | 'baseline_unavailable' // source could not provide a baseline; wait, do not fabricate
  | 'metering' // baseline recorded; window open
  | 'data_unavailable' // window open but source currently unreadable; last trusted data kept
  | 'metering_ended'; // window closed; only window increments count

export type MissingReason = 'source_unreachable' | 'permission_revoked' | 'post_private';

export interface MetricSnapshot {
  id: string;
  /** Monotonic per submission; claims freeze the version they used. */
  version: number;
  observedAt: IsoDateTime;
  /** Time the source says the numbers are as of. Null when the read failed. */
  sourceTime: IsoDateTime | null;
  /** Raw total views reported by the source. Null when missing. */
  totalViews: number | null;
  /** Qualified increment inside the metering window since baseline. Null when missing. */
  qualifiedViewsInWindow: number | null;
  missingReason: MissingReason | null;
  /** True when the snapshot was read successfully and inside the window. */
  trusted: boolean;
}

export interface ContentReview {
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  decidedBy: string | null;
  decidedAt: IsoDateTime | null;
}

export interface ClaimDeadlineExtension {
  id: string;
  reason: 'data_outage' | 'pending_case';
  blockedFrom: IsoDateTime;
  unblockedAt: IsoDateTime;
  /** unblockedAt + claimGraceDays (or the merchant's published grace). */
  newDeadlineAt: IsoDateTime;
  notifiedAt: IsoDateTime;
}

export interface Submission {
  id: string;
  campaignId: string;
  orgId: string;
  creatorId: string;
  connectionId: string;
  platform: Platform;
  /** Stable platform post id; unique per (campaignId, platform, postId). */
  postId: string;
  url: string;
  rulesVersion: number;
  status: SubmissionStatus;
  submittedAt: IsoDateTime;
  acceptedAt: IsoDateTime | null;
  baselineViews: number | null;
  /** acceptedAt + meteringDays. Null until accepted. */
  meteringEndsAt: IsoDateTime | null;
  /** Base claim deadline: meteringEndsAt + claimGraceDays. Null until accepted. */
  claimDeadlineAt: IsoDateTime | null;
  extensions: ClaimDeadlineExtension[];
  snapshots: MetricSnapshot[];
  /** Demo toggle: while true, new reads fail with 'source_unreachable'. */
  dataOutage: boolean;
  /** Set when an outage started while the window/grace was running; cleared on extension. */
  outageStartedAt: IsoDateTime | null;
  contentReview: ContentReview;
}

// ---------------------------------------------------------------------------
// Claims, offers, waitlist, appeals
// ---------------------------------------------------------------------------

export type ClaimStatus =
  | 'pending_review' // reserved; awaiting content + metering approval
  | 'confirmed_unpaid' // both approved; obligation created; awaiting payout
  | 'rejected_appealable' // rejected; reservation HELD during the appeal window
  | 'appealing' // appeal filed; reservation HELD
  | 'rejected_final' // ops confirmed final rejection; reservation released
  | 'paid'; // obligation settled (provider account funds available)

export interface MeteringReview {
  status: 'pending' | 'approved' | 'held' | 'rejected';
  reason: string | null;
  decidedBy: string | null;
  decidedAt: IsoDateTime | null;
}

export interface Claim {
  id: string;
  campaignId: string;
  orgId: string;
  submissionId: string;
  creatorId: string;
  /** Campaign-monotonic queue order assigned from the simulated server clock. */
  seq: number;
  validAt: IsoDateTime;
  amountSen: Sen;
  /** Frozen evidence. */
  snapshotVersion: number;
  qualifiedViewsAtClaim: number;
  rulesVersion: number;
  meteringCutoffAt: IsoDateTime;
  /** True when the creator consented to a partial amount. */
  isPartial: boolean;
  /** For partial claims: fullSen - amountSen, recorded as NOT reserved and NOT forfeited. */
  unreservedRemainderSen: Sen;
  status: ClaimStatus;
  meteringReview: MeteringReview;
  rejection: {
    source: 'content' | 'metering';
    reason: string;
    decidedBy: string;
    decidedAt: IsoDateTime;
    /** decidedAt + 7 calendar days. */
    appealDeadlineAt: IsoDateTime;
  } | null;
  /** Set when pending_review exceeded the 48h target; escalation only, never auto-approval. */
  escalatedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface PartialOffer {
  id: string;
  campaignId: string;
  submissionId: string;
  creatorId: string;
  /** What the submission could claim in full right now. */
  fullSen: Sen;
  /** What the budget can allocate (>= minClaimSen). */
  offeredSen: Sen;
  snapshotVersion: number;
  budgetVersion: number;
  status: 'open' | 'stale' | 'consented' | 'declined';
  createdAt: IsoDateTime;
}

export interface WaitlistEntry {
  id: string;
  campaignId: string;
  submissionId: string;
  creatorId: string;
  /** Claimable at the time of waitlisting (informational only; no reservation). */
  claimableSenAtEntry: Sen;
  status: 'waiting' | 'notified' | 'resubmitted' | 'withdrawn';
  createdAt: IsoDateTime;
  notifiedAt: IsoDateTime | null;
}

export interface Appeal {
  id: string;
  claimId: string;
  creatorId: string;
  reason: string;
  filedAt: IsoDateTime;
  status: 'open' | 'upheld' | 'rejected';
  resolvedBy: string | null;
  resolvedAt: IsoDateTime | null;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Obligations, payouts, ledger
// ---------------------------------------------------------------------------

export interface Obligation {
  id: string;
  claimId: string;
  campaignId: string;
  creatorId: string;
  amountSen: Sen;
  status: 'open' | 'settled';
  /** Set only when the simulated provider confirms funds are available in the creator's account. */
  providerAvailableAt: IsoDateTime | null;
  /** Bank settlement is a separate, often unknown fact. Never inferred from provider success. */
  bankSettlement: 'unknown' | 'settled';
  createdAt: IsoDateTime;
}

export type PayoutAttemptStatus = 'processing' | 'succeeded' | 'failed' | 'unknown';

export interface Reconciliation {
  at: IsoDateTime;
  by: string;
  outcome: 'still_unknown' | 'confirmed_succeeded' | 'confirmed_failed';
  note: string;
}

export interface PayoutAttempt {
  id: string;
  obligationId: string;
  requestKey: string;
  status: PayoutAttemptStatus;
  startedAt: IsoDateTime;
  startedBy: string;
  resolvedAt: IsoDateTime | null;
  failureReason: string | null;
  /** Simulated provider reference. */
  providerRef: string;
  reconciliations: Reconciliation[];
}

export type Bucket = 'available' | 'reserved' | 'confirmed_unpaid' | 'paid';

export type LedgerReason =
  | 'claim_reserved'
  | 'partial_claim_reserved'
  | 'claim_confirmed'
  | 'rejection_released'
  | 'payout_settled';

export interface LedgerEntry {
  id: string;
  campaignId: string;
  claimId: string | null;
  from: Bucket;
  to: Bucket;
  amountSen: Sen;
  reason: LedgerReason;
  at: IsoDateTime;
  by: string;
  commandId: string;
}

/** Four mutually exclusive buckets; always sum to poolSen. */
export interface BudgetBuckets {
  poolSen: Sen;
  availableSen: Sen;
  reservedSen: Sen;
  confirmedUnpaidSen: Sen;
  paidSen: Sen;
}

// ---------------------------------------------------------------------------
// Notifications and audit
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'campaign.published'
  | 'campaign.readiness_blocked'
  | 'campaign.submissions_closed'
  | 'campaign.closed'
  | 'submission.accepted'
  | 'submission.baseline_unavailable'
  | 'submission.data_unavailable'
  | 'submission.resynced'
  | 'content.approved'
  | 'content.rejected'
  | 'claim.reserved'
  | 'claim.partial_offer'
  | 'claim.waitlisted'
  | 'waitlist.budget_available'
  | 'claim.confirmed'
  | 'claim.rejected'
  | 'claim.escalated'
  | 'claim.rejection_finalized'
  | 'metering.held'
  | 'appeal.filed'
  | 'appeal.upheld'
  | 'appeal.rejected'
  | 'payout.processing'
  | 'payout.paid'
  | 'payout.failed'
  | 'payout.unknown'
  | 'payout.reconciled'
  | 'deadline.metering_ended'
  | 'deadline.claim_deadline_extended'
  | 'deadline.claim_deadline_passed';

export interface Notification {
  id: string;
  /** Same business event → same eventId; (eventId, recipientUserId, recipientRole) is unique. */
  eventId: string;
  recipientUserId: string;
  /** Which role context the recipient receives it in (drives the link). */
  recipientRole: Exclude<Role, 'guest'>;
  kind: NotificationKind;
  /** Interpolation values for messages `notifications.<kind>.*` (amounts already formatted by the UI from Sen). */
  params: Record<string, string | number>;
  /** In-app deep link. */
  href: string | null;
  createdAt: IsoDateTime;
  readAt: IsoDateTime | null;
  /** Present for important events: rendered as "simulated email preview", never sent. */
  email: { to: string } | null;
}

export interface AuditEntry {
  id: string;
  at: IsoDateTime;
  actorUserId: string;
  role: Role;
  action: string; // command type
  targetType: 'campaign' | 'submission' | 'claim' | 'appeal' | 'obligation' | 'payout_attempt' | 'session' | 'demo';
  targetId: string;
  reason: string | null;
  before: string | null; // short status summary
  after: string | null;
  commandId: string;
}

// ---------------------------------------------------------------------------
// Root state
// ---------------------------------------------------------------------------

export type ScenarioId =
  | 'baseline'
  | 'main_flow_ready' // campaign published, creator connected, one submission metering with 1,000 qualified views
  | 'partial_budget' // RM60 claimable, RM50 available
  | 'waitlist' // available below minimum claim
  | 'rejection_appeal' // claim rejected with reason, appeal window open
  | 'payout_unknown' // confirmed claim with an unknown payout attempt
  | 'payout_failed' // confirmed claim with a confirmed failed attempt
  | 'deadline_extension' // metering ended during a data outage; extension granted on recovery
  | 'campaign_closure' // campaign closing with an open appeal, a confirmed unpaid claim and an unconfirmed tail
  | 'data_outage'; // submission with source unreachable, last trusted data kept

export interface DemoState {
  schemaVersion: number;
  /** Simulated server clock. Advanced only by demo commands. seq is monotonic across all commands. */
  clock: { nowIso: IsoDateTime; seq: number };
  session: Session;
  scenario: ScenarioId;
  users: Record<string, User>;
  orgs: Record<string, Org>;
  campaigns: Record<string, Campaign>;
  connections: Record<string, AccountConnection>;
  submissions: Record<string, Submission>;
  claims: Record<string, Claim>;
  partialOffers: Record<string, PartialOffer>;
  waitlist: Record<string, WaitlistEntry>;
  appeals: Record<string, Appeal>;
  obligations: Record<string, Obligation>;
  payoutAttempts: Record<string, PayoutAttempt>;
  ledger: LedgerEntry[];
  notifications: Record<string, Notification>;
  audit: AuditEntry[];
  /** Idempotency: commandId → summary of the first result. Same id again returns the original outcome. */
  processedCommands: Record<string, { at: IsoDateTime; outcome: string }>;
}

// ---------------------------------------------------------------------------
// Commands (every mutation goes through `applyCommand`)
// ---------------------------------------------------------------------------

export interface CommandMeta {
  /** Idempotency key generated by the UI per user intent (one per button press, not per render). */
  commandId: string;
}

export type Command =
  // session (demo identity; not authorisation)
  | { type: 'session.signIn'; userId: string }
  | { type: 'session.signOut' }
  | { type: 'session.setLocale'; locale: Locale; explicit: boolean }
  | { type: 'session.dismissLocalePrompt' }
  | { type: 'session.switchWorkspace'; workspace: Workspace }
  | { type: 'session.setOpsRole'; role: 'ops_reviewer' | 'ops_finance' | null }
  // demo tools (independent panel; never inside the creator UI)
  | { type: 'demo.advanceClock'; byMs: number }
  | { type: 'demo.setClock'; toIso: IsoDateTime }
  | { type: 'demo.addQualifiedViews'; submissionId: string; views: number }
  | { type: 'demo.setDataOutage'; submissionId: string; outage: boolean }
  | { type: 'demo.setReadiness'; campaignId: string; fundingEvidence?: boolean; dataSourceReady?: boolean }
  | { type: 'demo.setPayoutOutcome'; attemptId: string; outcome: 'succeeded' | 'failed' | 'unknown'; reason?: string }
  | { type: 'demo.loadScenario'; scenarioId: ScenarioId }
  | { type: 'demo.reset' }
  // merchant
  | { type: 'campaign.createDraft'; orgId: string; title: string; brief: string; rules?: Partial<CampaignRules> }
  | { type: 'campaign.updateDraft'; campaignId: string; patch: { title?: string; brief?: string; rules?: Partial<CampaignRules> } }
  | { type: 'campaign.publish'; campaignId: string }
  | { type: 'campaign.pause'; campaignId: string }
  | { type: 'campaign.resume'; campaignId: string }
  /** Why intake is closing. Recorded on the audit entry; non-empty is enforced. */
  | { type: 'campaign.closeSubmissions'; campaignId: string; reason: string }
  /** Why the campaign is closing. Recorded on the audit entry; non-empty is enforced. */
  | { type: 'campaign.close'; campaignId: string; reason: string }
  | { type: 'submission.reviewContent'; submissionId: string; decision: 'approve' | 'reject'; reason: string | null }
  // creator
  | { type: 'connection.connect'; platform: Platform; handle: string }
  | { type: 'connection.reconnect'; connectionId: string }
  | { type: 'submission.create'; campaignId: string; connectionId: string; url: string }
  | { type: 'claim.request'; submissionId: string }
  | { type: 'claim.consentPartial'; offerId: string; consentedSen: Sen; snapshotVersion: number; budgetVersion: number }
  | { type: 'claim.declinePartial'; offerId: string }
  | { type: 'waitlist.resubmit'; entryId: string }
  | { type: 'appeal.file'; claimId: string; reason: string }
  // ops reviewer
  | { type: 'submission.resync'; submissionId: string; reason: string }
  | { type: 'claim.reviewMetering'; claimId: string; decision: 'approve' | 'hold' | 'reject'; reason: string | null }
  | { type: 'claim.finalizeRejection'; claimId: string; reason: string }
  | { type: 'appeal.resolve'; appealId: string; decision: 'uphold' | 'reject'; note: string }
  // ops finance
  | { type: 'payout.start'; obligationId: string }
  | { type: 'payout.reconcile'; attemptId: string; outcome: 'still_unknown' | 'confirmed_succeeded' | 'confirmed_failed'; note: string }
  | { type: 'payout.retry'; obligationId: string; reason: string }
  // any signed-in user
  | { type: 'notification.markRead'; notificationId: string }
  | { type: 'notification.markAllRead' };

export type CommandType = Command['type'];

export type ErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'not_signed_in'
  | 'campaign_not_ready'
  | 'campaign_not_open'
  | 'min_claim_above_cap'
  | 'connection_invalid'
  | 'unsupported_platform'
  | 'duplicate_post'
  | 'cross_campaign_blocked'
  | 'pending_claim_exists'
  | 'below_min_claim'
  | 'view_threshold_not_met'
  | 'nothing_claimable'
  | 'data_unavailable'
  | 'claim_deadline_passed'
  | 'offer_stale'
  | 'offer_amount_mismatch'
  | 'appeal_window_closed'
  | 'appeal_already_filed'
  | 'release_not_allowed'
  | 'attempt_unresolved'
  | 'retry_not_allowed'
  | 'already_settled'
  | 'invalid_transition';

export type DomainEvent = {
  id: string;
  at: IsoDateTime;
  kind: NotificationKind | 'ledger.moved' | 'audit.recorded';
  targetType: AuditEntry['targetType'];
  targetId: string;
  params: Record<string, string | number>;
};

export type CommandResult =
  | { ok: true; state: DemoState; events: DomainEvent[]; /** Set when a claim.request produced an offer or waitlist entry instead of a claim. */ outcome?: 'claim' | 'partial_offer' | 'waitlisted' | 'idempotent_replay' }
  | { ok: false; state: DemoState; code: ErrorCode; detail?: string };

// ---------------------------------------------------------------------------
// Engine surface (implemented in ./engine.ts; the store is the only caller of applyCommand)
// ---------------------------------------------------------------------------

export interface DemoEngine {
  /** Baseline state; deterministic; contains the seed described in docs/m1-prototype/kickoff.md. */
  createSeedState(): DemoState;
  /** Pure: never mutates input; validates permissions from state.session; idempotent on meta.commandId. */
  applyCommand(state: DemoState, command: Command, meta: CommandMeta): CommandResult;
  /** Migrates a persisted state from an older schemaVersion or returns null when it cannot (UI then offers reset). */
  migrate(persisted: unknown): DemoState | null;
}

// ---------------------------------------------------------------------------
// Selector result shapes (implemented in ./selectors.ts; UI reads only through these)
// ---------------------------------------------------------------------------

export interface SubmissionRewardView {
  submissionId: string;
  /** Latest trusted qualified increment inside the window, or null when never trusted. */
  qualifiedViews: number | null;
  lastTrustedAt: IsoDateTime | null;
  lastSnapshotVersion: number | null;
  dataStatus: 'trusted' | 'unavailable' | 'no_baseline';
  /** Exact cumulative reward before cap, in thousandths of a sen (integer arithmetic). */
  exactRewardMilliSen: number;
  /** min(cap, exact) floored to sen. */
  cappedSen: Sen;
  capReached: boolean;
  reservedSen: Sen;
  confirmedUnpaidSen: Sen;
  paidSen: Sen;
  /** cappedSen − (reserved + confirmedUnpaid + paid); never negative. */
  claimableSen: Sen;
  meetsMinClaim: boolean;
  meetsViewThreshold: boolean;
  pendingClaimId: string | null;
  meteringActive: boolean;
  claimWindowOpen: boolean;
  /** Effective deadline including extensions. */
  claimDeadlineAt: IsoDateTime | null;
  canClaim: boolean;
  blockReason: ErrorCode | null;
}

export interface SubmissionDeadlinesView {
  acceptedAt: IsoDateTime | null;
  meteringEndsAt: IsoDateTime | null;
  baseClaimDeadlineAt: IsoDateTime | null;
  effectiveClaimDeadlineAt: IsoDateTime | null;
  extensions: ClaimDeadlineExtension[];
  /** Latest of: publish + retentionDays, effective claim deadline, open cases resolved, confirmed payouts settled. */
  retentionEndsAt: IsoDateTime | null;
  retentionReason: 'published_retention' | 'claim_deadline' | 'open_cases' | 'confirmed_unpaid';
}

export interface CampaignClosureView {
  campaignId: string;
  budget: BudgetBuckets;
  openAppeals: number;
  pendingClaims: number;
  confirmedUnpaidClaims: number;
  unresolvedPayouts: number;
  /** Sum of unconfirmed claimable tails below minClaimSen across submissions after metering ended. */
  unconfirmedTailSen: Sen;
  /** True only when no open appeals, no pending claims, no confirmed-unpaid and no unresolved payouts. */
  canShowFullySettled: boolean;
  /** Refund of the unused pool is never automatic in M1. */
  refundStatus: 'pending_verification';
}

export interface OpsQueueItem {
  kind: 'readiness' | 'metering_review' | 'escalated' | 'appeal' | 'payout' | 'payout_unknown' | 'data_unavailable' | 'finalize_rejection';
  targetType: AuditEntry['targetType'];
  targetId: string;
  campaignId: string;
  creatorId: string | null;
  since: IsoDateTime;
  href: string;
}
