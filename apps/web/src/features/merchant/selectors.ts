/**
 * The merchant read model.
 *
 * Every number on a merchant page comes from the engine's own selectors, so the
 * merchant, the creator and operations necessarily read the same record
 * (three-role-flows-v1 §1: "商家看到'待付款RM100'，创作者也应看到同一笔已确认待付款").
 * This module only scopes those selectors to the acting org and shapes them into
 * the rows a page renders; it derives no money and no eligibility of its own.
 *
 * Every read goes through `@/store/selectors`, including the campaign-scoped
 * claim list: the store adapter is the single seam M2 replaces with a Fastify
 * call, so a feature that imported an engine helper directly would be a second
 * seam nobody would remember to change.
 */

import {
  selectBudget,
  selectCampaign,
  selectCampaignClosure,
  selectClaimsForCampaign,
  selectOrgCampaigns,
  selectSubmissionDeadlines,
  selectSubmissionReward,
  selectSubmissionsForCampaign,
} from '@/store/selectors';
import type {
  Actor,
  BudgetBuckets,
  Campaign,
  CampaignClosureView,
  Claim,
  DemoState,
  IsoDateTime,
  Sen,
  Submission,
  SubmissionDeadlinesView,
  SubmissionRewardView,
} from '@/domain/types';

/** Statuses in which a campaign is still taking part in the market. */
const OPEN_STATUSES: readonly Campaign['status'][] = ['published', 'paused'];

export interface MerchantCampaignRow {
  campaign: Campaign;
  budget: BudgetBuckets;
  submissionCount: number;
  /** Submissions still waiting for the merchant's own content decision. */
  pendingContentReviews: number;
  claimCount: number;
}

export function selectMerchantCampaignRows(
  state: DemoState,
  actor: Actor,
): MerchantCampaignRow[] {
  return selectOrgCampaigns(state, actor).map((campaign) => {
    const submissions = selectSubmissionsForCampaign(state, campaign.id);
    return {
      campaign,
      budget: selectBudget(state, campaign.id),
      submissionCount: submissions.length,
      pendingContentReviews: submissions.filter(
        (submission) => submission.contentReview.status === 'pending',
      ).length,
      claimCount: selectClaimsForCampaign(state, campaign.id).length,
    };
  });
}

export interface MerchantStatusCount {
  status: Campaign['status'];
  count: number;
}

const STATUS_ORDER: readonly Campaign['status'][] = [
  'draft',
  'published',
  'paused',
  'submissions_closed',
  'settling',
  'closed',
];

/** Every status in a fixed order, so the row does not reflow as counts change. */
export function selectMerchantStatusCounts(state: DemoState, actor: Actor): MerchantStatusCount[] {
  const campaigns = selectOrgCampaigns(state, actor);
  return STATUS_ORDER.map((status) => ({
    status,
    count: campaigns.filter((campaign) => campaign.status === status).length,
  }));
}

/**
 * A campaign the acting merchant may open, or null. The engine re-checks every
 * command, so this is the read-side half of the same rule: guessing another
 * org's campaign id must not show its records
 * (three-role-flows-v1 §6: "禁止通过改链接查看其他商家…的私密资料").
 */
export function selectOwnCampaign(
  state: DemoState,
  actor: Actor,
  campaignId: string,
): Campaign | null {
  const campaign = selectCampaign(state, campaignId);
  if (!campaign) return null;
  if (actor.orgId === null || campaign.orgId !== actor.orgId) return null;
  return campaign;
}

export interface MerchantSubmissionRow {
  submission: Submission;
  campaign: Campaign;
  creatorName: string;
  reward: SubmissionRewardView | null;
  /** The open or latest claim on this submission, for the metering column. */
  claim: Claim | null;
}

function rowFor(state: DemoState, submission: Submission, campaign: Campaign): MerchantSubmissionRow {
  const claims = selectClaimsForCampaign(state, campaign.id).filter(
    (claim) => claim.submissionId === submission.id,
  );
  return {
    submission,
    campaign,
    creatorName: state.users[submission.creatorId]?.displayName ?? submission.creatorId,
    reward: selectSubmissionReward(state, submission.id),
    claim: claims[claims.length - 1] ?? null,
  };
}

export function selectMerchantSubmissionRows(
  state: DemoState,
  actor: Actor,
  campaignId?: string,
): MerchantSubmissionRow[] {
  const campaigns = selectOrgCampaigns(state, actor).filter(
    (campaign) => campaignId === undefined || campaign.id === campaignId,
  );
  return campaigns.flatMap((campaign) =>
    selectSubmissionsForCampaign(state, campaign.id).map((submission) =>
      rowFor(state, submission, campaign),
    ),
  );
}

/** One submission the acting merchant may review, with everything the page shows. */
export interface MerchantSubmissionDetail extends MerchantSubmissionRow {
  deadlines: SubmissionDeadlinesView | null;
}

export function selectOwnSubmission(
  state: DemoState,
  actor: Actor,
  submissionId: string,
): MerchantSubmissionDetail | null {
  const submission = state.submissions[submissionId];
  if (!submission) return null;
  const campaign = selectOwnCampaign(state, actor, submission.campaignId);
  if (!campaign) return null;
  return {
    ...rowFor(state, submission, campaign),
    deadlines: selectSubmissionDeadlines(state, submissionId),
  };
}

export interface MerchantCampaignReport {
  campaign: Campaign;
  budget: BudgetBuckets;
  closure: CampaignClosureView | null;
  submissionCount: number;
  claimCount: number;
  /** Sum of the latest trusted qualified views across the campaign's submissions. */
  qualifiedViews: number;
  /** Null when no submission has ever produced a trusted read. */
  lastTrustedAt: IsoDateTime | null;
  /** True when at least one submission's source cannot be read right now. */
  hasUnreadableSource: boolean;
  confirmedUnpaidSen: Sen;
  paidSen: Sen;
}

/**
 * The campaign report. Confirmed-unpaid and paid come from the ledger buckets, so
 * "确认应付不是已付" holds by construction: they are two columns, never one total.
 */
export function selectMerchantCampaignReport(
  state: DemoState,
  actor: Actor,
  campaignId: string,
): MerchantCampaignReport | null {
  const campaign = selectOwnCampaign(state, actor, campaignId);
  if (!campaign) return null;

  const submissions = selectSubmissionsForCampaign(state, campaign.id);
  const budget = selectBudget(state, campaign.id);
  let qualifiedViews = 0;
  let lastTrustedAt: IsoDateTime | null = null;
  let hasUnreadableSource = false;

  for (const submission of submissions) {
    const reward = selectSubmissionReward(state, submission.id);
    if (!reward) continue;
    qualifiedViews += reward.qualifiedViews ?? 0;
    if (reward.dataStatus !== 'trusted') hasUnreadableSource = true;
    if (
      reward.lastTrustedAt !== null &&
      (lastTrustedAt === null || reward.lastTrustedAt > lastTrustedAt)
    ) {
      lastTrustedAt = reward.lastTrustedAt;
    }
  }

  return {
    campaign,
    budget,
    closure: selectCampaignClosure(state, campaign.id),
    submissionCount: submissions.length,
    claimCount: selectClaimsForCampaign(state, campaign.id).length,
    qualifiedViews,
    lastTrustedAt,
    hasUnreadableSource,
    confirmedUnpaidSen: budget.confirmedUnpaidSen,
    paidSen: budget.paidSen,
  };
}

/** Every campaign the org owns, reported. Used by the cross-campaign report page. */
export function selectMerchantCampaignReports(
  state: DemoState,
  actor: Actor,
): MerchantCampaignReport[] {
  return selectOrgCampaigns(state, actor)
    .map((campaign) => selectMerchantCampaignReport(state, actor, campaign.id))
    .filter((report): report is MerchantCampaignReport => report !== null);
}

export function selectMerchantClaims(state: DemoState, campaignId: string): Claim[] {
  return selectClaimsForCampaign(state, campaignId);
}

export function isCampaignOpen(campaign: Campaign): boolean {
  return OPEN_STATUSES.includes(campaign.status);
}
