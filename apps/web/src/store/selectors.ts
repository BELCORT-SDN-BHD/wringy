/**
 * Read side of the store.
 *
 * Components never index into `DemoState` themselves: they call a selector from
 * here. Almost everything is the engine's own selector, re-exported so `@/store`
 * is the single import site for the UI. The additions below are adapters only:
 * null-safe lookups for a guest actor, whole-collection lists the demo tools
 * need, and one ordering the notification centre wants. Nothing here derives
 * money or eligibility; that all stays in the engine so the UI cannot disagree
 * with it.
 */

import {
  claimsForCampaign,
  claimsForSubmission,
  finalizeRejectionBlock,
  lastSnapshot,
  latestAttempt,
  selectAppealForClaim,
  selectAttemptsForObligation,
  selectAuditFor,
  selectBudget,
  selectCampaignClosure,
  selectCampaignsForOrg,
  selectClaim,
  selectClaimsForCreator,
  selectNotificationsFor,
  selectObligationForClaim,
  selectOffersForCreator,
  selectOpenOfferForSubmission,
  selectOpsQueue,
  selectPartialOffer,
  selectPaymentsForCreator,
  selectPermissions,
  selectPublicCampaigns,
  selectSubmissionDeadlines,
  selectSubmissionReward,
  selectSubmissionsForCampaign,
  selectSubmissionsForCreator,
  selectUnreadCount as engineUnreadCount,
  selectWaitlistForCampaign,
  selectWaitlistForCreator,
  notificationHref,
} from '@/domain';
import type { PartialOfferView, PaymentRecordView, PermissionFlags } from '@/domain';
import type {
  AccountConnection,
  Actor,
  Appeal,
  Campaign,
  Claim,
  DemoState,
  MetricSnapshot,
  Notification,
  Obligation,
  Org,
  PayoutAttempt,
  Role,
  Submission,
  User,
} from '@/domain/types';

export {
  selectAppealForClaim,
  selectAttemptsForObligation,
  selectAuditFor,
  selectBudget,
  selectCampaignClosure,
  selectCampaignsForOrg,
  selectClaim,
  selectClaimsForCreator,
  selectNotificationsFor,
  selectObligationForClaim,
  selectOffersForCreator,
  selectOpenOfferForSubmission,
  selectOpsQueue,
  selectPartialOffer,
  selectPaymentsForCreator,
  selectPermissions,
  selectPublicCampaigns,
  selectSubmissionDeadlines,
  selectSubmissionReward,
  selectSubmissionsForCampaign,
  selectSubmissionsForCreator,
  selectWaitlistForCampaign,
  selectWaitlistForCreator,
  notificationHref,
};
export type { PartialOfferView, PaymentRecordView, PermissionFlags };

// ---------------------------------------------------------------------------
// Null-safe lookups. The engine's selectors take a concrete id; the UI often
// has a guest actor whose `userId` is empty, so these return null or an empty
// list instead of making every call site branch.
// ---------------------------------------------------------------------------

export function selectCampaign(state: DemoState, campaignId: string): Campaign | null {
  return state.campaigns[campaignId] ?? null;
}

export function selectOrg(state: DemoState, orgId: string): Org | null {
  return state.orgs[orgId] ?? null;
}

export function selectUser(state: DemoState, userId: string | null): User | null {
  return userId ? (state.users[userId] ?? null) : null;
}

export function selectSubmission(state: DemoState, submissionId: string): Submission | null {
  return state.submissions[submissionId] ?? null;
}

// ---------------------------------------------------------------------------
// Claim, appeal, snapshot and payout lookups.
//
// These are the engine's own `rules.ts` helpers, re-exposed here so a role
// feature never reaches past the store adapter into `@/domain` for a read. The
// bodies are one line each on purpose: when M2 replaces the engine call with a
// Fastify call, this file is the seam that changes, and a feature that imported
// the helper directly would have been a second seam nobody remembered.
// ---------------------------------------------------------------------------

/** Every claim in a campaign, in queue order. */
export function selectClaimsForCampaign(state: DemoState, campaignId: string): Claim[] {
  return claimsForCampaign(state, campaignId);
}

/** Every claim against one submission, in queue order. */
export function selectClaimsForSubmission(state: DemoState, submissionId: string): Claim[] {
  return claimsForSubmission(state, submissionId);
}

/** Every claim in the demo, in queue order. Only a cross-campaign view needs this. */
export function selectAllClaims(state: DemoState): Claim[] {
  return Object.values(state.claims).sort((a, b) => a.seq - b.seq);
}

export function selectAllAppeals(state: DemoState): Appeal[] {
  return Object.values(state.appeals).sort((a, b) => a.id.localeCompare(b.id));
}

export function selectAppeal(state: DemoState, appealId: string): Appeal | null {
  return state.appeals[appealId] ?? null;
}

/**
 * Why a held reservation may not be released yet, or null when it may be.
 *
 * The string is a reason code, not a message: the UI maps it to copy. A release
 * is never a timer — the engine re-checks the appeal state every time.
 */
export function selectFinalizeRejectionBlock(state: DemoState, claim: Claim): string | null {
  return finalizeRejectionBlock(state, claim);
}

/** The most recent read of a submission, trusted or not. Null before the first. */
export function selectLastSnapshot(submission: Submission): MetricSnapshot | null {
  return lastSnapshot(submission);
}

/** The newest payout attempt against one obligation, or null when none started. */
export function selectLatestPayoutAttempt(
  state: DemoState,
  obligationId: string,
): PayoutAttempt | null {
  return latestAttempt(state, obligationId);
}

/** The publishing org's name for a campaign, or null when either is unknown. */
export function selectCampaignOrgName(state: DemoState, campaignId: string): string | null {
  const campaign = state.campaigns[campaignId];
  return campaign ? (state.orgs[campaign.orgId]?.name ?? null) : null;
}

/**
 * Alias kept for call sites that hold a possibly-absent actor id. The engine's
 * selector already treats null and '' as "no submissions", so this only names
 * the intent.
 */
export function selectSubmissionsForUser(
  state: DemoState,
  userId: string | null,
): Submission[] {
  return selectSubmissionsForCreator(state, userId);
}

export function selectConnectionsForUser(
  state: DemoState,
  userId: string | null,
): AccountConnection[] {
  if (!userId) return [];
  return Object.values(state.connections)
    .filter((connection) => connection.userId === userId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Campaigns the actor's merchant org owns. Empty for any other role. */
export function selectOrgCampaigns(state: DemoState, actor: Actor): Campaign[] {
  return actor.orgId ? selectCampaignsForOrg(state, actor.orgId) : [];
}

// ---------------------------------------------------------------------------
// Whole-collection lists. Only the demo tools and the placeholder overviews
// need these; a role page should use the scoped engine selector instead.
// ---------------------------------------------------------------------------

export function selectAllCampaigns(state: DemoState): Campaign[] {
  return Object.values(state.campaigns).sort((a, b) => a.id.localeCompare(b.id));
}

export function selectAllSubmissions(state: DemoState): Submission[] {
  return Object.values(state.submissions).sort((a, b) => a.id.localeCompare(b.id));
}

export function selectObligations(state: DemoState): Obligation[] {
  return Object.values(state.obligations).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Payout attempts the demo tools can still give an outcome to: the simulated
 * provider has not answered, or answered "unknown". A succeeded or confirmed
 * failed attempt is final and is not offered here.
 */
export function selectUnresolvedPayoutAttempts(state: DemoState): PayoutAttempt[] {
  return Object.values(state.payoutAttempts)
    .filter((attempt) => attempt.status === 'processing' || attempt.status === 'unknown')
    .sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * Unread first, then newest first, for one role's notification centre.
 *
 * The role argument is not optional here, and that is the point: a row exists per
 * (event, recipient, role), so Demo User holding both the creator workspace and
 * the Kopi Kita org has a creator row AND a merchant row for the same event, each
 * with its own link. Omitting the role would render both and look duplicated.
 */
export function selectNotificationsSorted(
  state: DemoState,
  userId: string | null,
  role: Role,
): Notification[] {
  if (role === 'guest') return [];
  const list = selectNotificationsFor(state, userId, role);
  return [...list].sort((a, b) => {
    if (!a.readAt !== !b.readAt) return a.readAt ? 1 : -1;
    return 0; // the engine already ordered newest first
  });
}

/** Unread count for the header bell, scoped to the role that is acting now. */
export function selectUnreadCount(state: DemoState, userId: string | null, role: Role): number {
  if (role === 'guest') return 0;
  return engineUnreadCount(state, userId, role);
}

export function selectNowIso(state: DemoState): string {
  return state.clock.nowIso;
}
