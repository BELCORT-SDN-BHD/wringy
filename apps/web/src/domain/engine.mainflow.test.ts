import { describe, expect, it } from 'vitest';

import { SEED_IDS } from './seed';
import {
  selectBudget,
  selectCampaignsForOrg,
  selectClaimsForCreator,
  selectPaymentsForCreator,
  selectSubmissionReward,
  selectSubmissionsForCampaign,
} from './selectors';
import {
  URLS,
  createHarness,
  findSubmissionByUrl,
  latestAttemptOf,
  latestClaim,
  obligationOf,
} from './test-utils';
import type { BudgetBuckets, DemoState } from './types';

/**
 * The main flow from prototype-spec-v1.md "一条主流程", step by step, with the four
 * budget columns after each step:
 *   2000/0/0/0 → 1995/5/0/0 → 1995/0/5/0 → 1995/0/0/5 (RM available/reserved/
 *   confirmed unpaid/paid), i.e. 200000/0/0/0 → 199500/500/0/0 → … in sen.
 */
const RM = (sen: number): number => sen / 100;

function buckets(state: DemoState, campaignId: string): number[] {
  const budget = selectBudget(state, campaignId);
  return [budget.availableSen, budget.reservedSen, budget.confirmedUnpaidSen, budget.paidSen];
}

/** The same budget read while signed in as each role. */
function budgetFromEveryRole(state: DemoState, campaignId: string): BudgetBuckets[] {
  const roles: DemoState[] = [
    { ...state, session: { ...state.session, userId: SEED_IDS.userDemo, workspace: 'creator', opsRole: null } },
    { ...state, session: { ...state.session, userId: SEED_IDS.userDemo, workspace: 'merchant', opsRole: null } },
    {
      ...state,
      session: { ...state.session, userId: SEED_IDS.userOpsReviewer, workspace: 'creator', opsRole: 'ops_reviewer' },
    },
    {
      ...state,
      session: { ...state.session, userId: SEED_IDS.userOpsFinance, workspace: 'creator', opsRole: 'ops_finance' },
    },
  ];
  return roles.map((roleState) => selectBudget(roleState, campaignId));
}

describe('main flow (P01)', () => {
  it('runs merchant → creator → ops → finance on one record set', () => {
    const harness = createHarness();

    // 1. The merchant creates the campaign with the approved numbers.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({
      type: 'campaign.createDraft',
      orgId: SEED_IDS.orgKopi,
      title: 'Main flow',
      brief: 'Brew Kopi Kita at home.',
      rules: { poolSen: 200_000, ratePerThousandSen: 500, minClaimSen: 500, capPerSubmissionSen: 10_000 },
    });
    const campaignId = selectCampaignsForOrg(harness.state, SEED_IDS.orgKopi).find(
      (entry) => entry.title === 'Main flow',
    )?.id;
    if (!campaignId) throw new Error('campaign missing');
    expect(harness.state.campaigns[campaignId].serviceFee).toBe('pending_config');

    // 2. Simulated funding and data readiness, then publish.
    harness.ok({
      type: 'demo.setReadiness',
      campaignId,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    harness.ok({ type: 'campaign.publish', campaignId });
    expect(buckets(harness.state, campaignId)).toEqual([200_000, 0, 0, 0]);
    expect(buckets(harness.state, campaignId).map(RM)).toEqual([2000, 0, 0, 0]);

    // 3. The creator joins from the public detail page and submits a link.
    harness.ok({ type: 'session.switchWorkspace', workspace: 'creator' });
    harness.ok({
      type: 'submission.create',
      campaignId,
      connectionId: SEED_IDS.connectionDemoTiktok,
      url: URLS.demoTiktok,
    });
    const submissionId = findSubmissionByUrl(harness.state, URLS.demoTiktok).id;

    // 4. The simulated clock records the baseline at acceptance.
    expect(harness.state.submissions[submissionId]).toMatchObject({
      acceptedAt: '2026-09-01T12:00:00+08:00',
      baselineViews: 1200,
      meteringEndsAt: '2026-09-08T12:00:00+08:00',
    });

    // 5. 1,000 qualified views → RM5 claimable → one claim reserved.
    harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 1000 });
    expect(selectSubmissionReward(harness.state, submissionId)).toMatchObject({
      qualifiedViews: 1000,
      exactRewardMilliSen: 500_000,
      cappedSen: 500,
      claimableSen: 500,
      meetsMinClaim: true,
      canClaim: true,
    });
    harness.ok({ type: 'claim.request', submissionId });
    const claimId = latestClaim(harness.state, submissionId).id;
    expect(buckets(harness.state, campaignId)).toEqual([199_500, 500, 0, 0]);
    expect(buckets(harness.state, campaignId).map(RM)).toEqual([1995, 5, 0, 0]);

    // 6a. Content and metering both approved → confirmed unpaid.
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'approve', reason: null });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null });
    expect(buckets(harness.state, campaignId)).toEqual([199_500, 0, 500, 0]);
    expect(buckets(harness.state, campaignId).map(RM)).toEqual([1995, 0, 5, 0]);

    // 6b. Simulated finance processing → paid, with bank settlement still unknown.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsFinance });
    const obligationId = obligationOf(harness.state, claimId).id;
    harness.ok({ type: 'payout.start', obligationId });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'succeeded',
    });
    expect(buckets(harness.state, campaignId)).toEqual([199_500, 0, 0, 500]);
    expect(buckets(harness.state, campaignId).map(RM)).toEqual([1995, 0, 0, 5]);
    expect(harness.state.obligations[obligationId].bankSettlement).toBe('unknown');

    // 7. Every role reads the same four columns and the same record.
    const fromRoles = budgetFromEveryRole(harness.state, campaignId);
    expect(new Set(fromRoles.map((entry) => JSON.stringify(entry))).size).toBe(1);
    expect(fromRoles[0]).toEqual({
      poolSen: 200_000,
      availableSen: 199_500,
      reservedSen: 0,
      confirmedUnpaidSen: 0,
      paidSen: 500,
    });

    // The same claim is visible to the creator, the merchant and finance.
    expect(selectClaimsForCreator(harness.state, SEED_IDS.userDemo).map((entry) => entry.id)).toEqual([
      claimId,
    ]);
    expect(selectSubmissionsForCampaign(harness.state, campaignId).map((entry) => entry.id)).toEqual([
      submissionId,
    ]);
    const payments = selectPaymentsForCreator(harness.state, SEED_IDS.userDemo);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      claimId,
      amountSen: 500,
      claimStatus: 'paid',
      providerAvailableAt: '2026-09-01T12:00:00+08:00',
      bankSettlement: 'unknown',
    });

    // And the reward view agrees from the submission's side.
    expect(selectSubmissionReward(harness.state, submissionId)).toMatchObject({
      paidSen: 500,
      reservedSen: 0,
      confirmedUnpaidSen: 0,
      claimableSen: 0,
    });
  });
});
