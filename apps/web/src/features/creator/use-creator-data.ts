'use client';

/**
 * Read side of the creator workspace.
 *
 * Every number on a creator page comes from an engine selector through one of
 * these hooks, so the creator, the merchant and operations can never disagree
 * about the same record. Nothing here derives money or eligibility: the reward
 * view, the deadlines and the block reason are the engine's own answers.
 *
 * `selectSubmissionReward` and friends build a fresh object per call, so the
 * hooks take the whole state by reference (`useDemoSnapshot`) and memoise on it;
 * the reference changes exactly when a command is applied.
 */

import { useMemo } from 'react';

import { useActor } from '@/store/actor';
import { useDemoSnapshot } from '@/store/demo-store';
import {
  selectAppealForClaim,
  selectAttemptsForObligation,
  selectAuditFor,
  selectBudget,
  selectCampaign,
  selectClaimsForCreator,
  selectConnectionsForUser,
  selectObligationForClaim,
  selectOffersForCreator,
  selectOpenOfferForSubmission,
  selectPaymentsForCreator,
  selectSubmission,
  selectSubmissionDeadlines,
  selectSubmissionReward,
  selectSubmissionsForUser,
  selectUser,
  selectWaitlistForCreator,
  type PartialOfferView,
  type PaymentRecordView,
} from '@/store/selectors';
import type {
  AccountConnection,
  Appeal,
  AuditEntry,
  BudgetBuckets,
  Campaign,
  Claim,
  Obligation,
  PayoutAttempt,
  Submission,
  SubmissionDeadlinesView,
  SubmissionRewardView,
  WaitlistEntry,
} from '@/domain/types';

/** The signed-in creator's own id, or null when nobody is signed in. */
export function useCreatorId(): string | null {
  const actor = useActor();
  return actor.userId === '' ? null : actor.userId;
}

export interface SubmissionRow {
  submission: Submission;
  campaign: Campaign | null;
  reward: SubmissionRewardView | null;
}

export function useCreatorSubmissions(): SubmissionRow[] {
  const state = useDemoSnapshot();
  const creatorId = useCreatorId();

  return useMemo(
    () =>
      selectSubmissionsForUser(state, creatorId).map((submission) => ({
        submission,
        campaign: selectCampaign(state, submission.campaignId),
        reward: selectSubmissionReward(state, submission.id),
      })),
    [state, creatorId],
  );
}

export function useCreatorConnections(): AccountConnection[] {
  const state = useDemoSnapshot();
  const creatorId = useCreatorId();
  return useMemo(() => selectConnectionsForUser(state, creatorId), [state, creatorId]);
}

export interface SubmissionView {
  submission: Submission;
  campaign: Campaign | null;
  connection: AccountConnection | null;
  reward: SubmissionRewardView | null;
  deadlines: SubmissionDeadlinesView | null;
  budget: BudgetBuckets | null;
  openOffer: PartialOfferView | null;
  claims: Claim[];
  /** True when the record exists but belongs to someone else. */
  foreign: boolean;
}

/** One submission with everything the detail page explains. Null when unknown. */
export function useSubmissionView(submissionId: string): SubmissionView | null {
  const state = useDemoSnapshot();
  const creatorId = useCreatorId();

  return useMemo(() => {
    const submission = selectSubmission(state, submissionId);
    if (!submission) return null;
    const campaign = selectCampaign(state, submission.campaignId);
    return {
      submission,
      campaign,
      connection: state.connections[submission.connectionId] ?? null,
      reward: selectSubmissionReward(state, submissionId),
      deadlines: selectSubmissionDeadlines(state, submissionId),
      budget: campaign ? selectBudget(state, campaign.id) : null,
      openOffer: selectOpenOfferForSubmission(state, submissionId),
      claims: selectClaimsForCreator(state, creatorId).filter(
        (claim) => claim.submissionId === submissionId,
      ),
      foreign: creatorId === null || submission.creatorId !== creatorId,
    };
  }, [state, submissionId, creatorId]);
}

export interface ClaimRow {
  claim: Claim;
  campaign: Campaign | null;
  submission: Submission | null;
}

export function useCreatorClaims(): ClaimRow[] {
  const state = useDemoSnapshot();
  const creatorId = useCreatorId();

  return useMemo(
    () =>
      selectClaimsForCreator(state, creatorId).map((claim) => ({
        claim,
        campaign: selectCampaign(state, claim.campaignId),
        submission: selectSubmission(state, claim.submissionId),
      })),
    [state, creatorId],
  );
}

export function useCreatorOffers(): PartialOfferView[] {
  const state = useDemoSnapshot();
  const creatorId = useCreatorId();
  return useMemo(() => selectOffersForCreator(state, creatorId), [state, creatorId]);
}

export interface WaitlistRow {
  entry: WaitlistEntry;
  campaign: Campaign | null;
}

export function useCreatorWaitlist(): WaitlistRow[] {
  const state = useDemoSnapshot();
  const creatorId = useCreatorId();

  return useMemo(
    () =>
      selectWaitlistForCreator(state, creatorId).map((entry) => ({
        entry,
        campaign: selectCampaign(state, entry.campaignId),
      })),
    [state, creatorId],
  );
}

export function useCreatorPayments(): PaymentRecordView[] {
  const state = useDemoSnapshot();
  const creatorId = useCreatorId();
  return useMemo(() => selectPaymentsForCreator(state, creatorId), [state, creatorId]);
}

export interface ClaimView {
  claim: Claim;
  campaign: Campaign | null;
  submission: Submission | null;
  appeal: Appeal | null;
  obligation: Obligation | null;
  attempts: PayoutAttempt[];
  audit: AuditEntry[];
  /** Display names for the recorded actors, by user id. */
  actorNames: Record<string, string>;
  foreign: boolean;
}

export function useClaimView(claimId: string): ClaimView | null {
  const state = useDemoSnapshot();
  const creatorId = useCreatorId();

  return useMemo(() => {
    const claim = state.claims[claimId];
    if (!claim) return null;
    const obligation = selectObligationForClaim(state, claim.id);
    const audit = selectAuditFor(state, 'claim', claim.id);
    const appeal = selectAppealForClaim(state, claim.id);
    const appealAudit = appeal ? selectAuditFor(state, 'appeal', appeal.id) : [];
    const actorNames: Record<string, string> = {};
    for (const entry of [...audit, ...appealAudit]) {
      actorNames[entry.actorUserId] =
        selectUser(state, entry.actorUserId)?.displayName ?? entry.actorUserId;
    }
    return {
      claim,
      campaign: selectCampaign(state, claim.campaignId),
      submission: selectSubmission(state, claim.submissionId),
      appeal,
      obligation,
      attempts: obligation ? selectAttemptsForObligation(state, obligation.id) : [],
      audit: [...audit, ...appealAudit],
      actorNames,
      foreign: creatorId === null || claim.creatorId !== creatorId,
    };
  }, [state, claimId, creatorId]);
}

/** The simulated server clock, for "as of" lines. */
export function useNowIso(): string {
  const state = useDemoSnapshot();
  return state.clock.nowIso;
}
