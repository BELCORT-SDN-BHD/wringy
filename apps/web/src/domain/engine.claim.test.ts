import { describe, expect, it } from 'vitest';

import { SEED_IDS } from './seed';
import { selectBudget, selectSubmissionReward } from './selectors';
import {
  DAY_MS,
  URLS,
  claimsOf,
  createHarness,
  findSubmissionByUrl,
  latestClaim,
  onlyOffer,
  onlyWaitlistEntry,
  type Harness,
} from './test-utils';

/** A published campaign in org-kopi with the given rule overrides. */
function publishCampaign(
  harness: Harness,
  title: string,
  rules?: Record<string, unknown>,
): string {
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
  harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
  harness.ok({
    type: 'campaign.createDraft',
    orgId: SEED_IDS.orgKopi,
    title,
    brief: '',
    rules: rules as never,
  });
  const campaign = Object.values(harness.state.campaigns).find((entry) => entry.title === title);
  if (!campaign) throw new Error('campaign not created');
  harness.ok({
    type: 'demo.setReadiness',
    campaignId: campaign.id,
    fundingEvidence: true,
    dataSourceReady: true,
  });
  harness.ok({ type: 'campaign.publish', campaignId: campaign.id });
  harness.ok({ type: 'session.switchWorkspace', workspace: 'creator' });
  return campaign.id;
}

function submitAndMeter(
  harness: Harness,
  campaignId: string,
  connectionId: string,
  url: string,
  views: number,
): string {
  harness.ok({ type: 'submission.create', campaignId, connectionId, url });
  const submission = findSubmissionByUrl(harness.state, url);
  if (views > 0) {
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: submission.id, views });
  }
  return submission.id;
}

/** Signed-in Demo User with one metering submission in the seed campaign. */
function readyCreator(views = 1000): { harness: Harness; submissionId: string } {
  const harness = createHarness();
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
  const submissionId = submitAndMeter(
    harness,
    SEED_IDS.campaignKopiRaya,
    SEED_IDS.connectionDemoTiktok,
    URLS.demoTiktok,
    views,
  );
  return { harness, submissionId };
}

function confirmClaim(harness: Harness, submissionId: string): void {
  const claim = latestClaim(harness.state, submissionId);
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
  harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
  if (harness.state.submissions[submissionId].contentReview.status === 'pending') {
    harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'approve', reason: null });
  }
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
  harness.ok({ type: 'claim.reviewMetering', claimId: claim.id, decision: 'approve', reason: null });
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
}

describe('claim.request', () => {
  it('reserves the whole claimable amount and freezes the evidence', () => {
    const { harness, submissionId } = readyCreator();
    const result = harness.ok({ type: 'claim.request', submissionId });
    expect(result.outcome).toBe('claim');

    const claim = latestClaim(harness.state, submissionId);
    expect(claim.amountSen).toBe(500);
    expect(claim.seq).toBe(1);
    expect(claim.validAt).toBe('2026-09-01T12:00:00+08:00');
    expect(claim.qualifiedViewsAtClaim).toBe(1000);
    expect(claim.snapshotVersion).toBe(2);
    expect(claim.meteringCutoffAt).toBe('2026-09-08T12:00:00+08:00');
    expect(claim.status).toBe('pending_review');
    expect(claim.isPartial).toBe(false);
    expect(claim.unreservedRemainderSen).toBe(0);

    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya)).toEqual({
      poolSen: 200_000,
      availableSen: 199_500,
      reservedSen: 500,
      confirmedUnpaidSen: 0,
      paidSen: 0,
    });
  });

  it('never creates a second record for a double click', () => {
    const { harness, submissionId } = readyCreator();
    harness.ok({ type: 'claim.request', submissionId }, 'one-click');
    const replay = harness.apply({ type: 'claim.request', submissionId }, 'one-click');
    expect(replay.ok && replay.outcome).toBe('idempotent_replay');
    expect(claimsOf(harness.state, submissionId)).toHaveLength(1);
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).reservedSen).toBe(500);
  });

  it('allows only one open case per submission', () => {
    const { harness, submissionId } = readyCreator();
    harness.ok({ type: 'claim.request', submissionId });
    harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 1000 });
    const failure = harness.fail({ type: 'claim.request', submissionId }, 'pending_claim_exists');
    expect(failure.detail).toBe(latestClaim(harness.state, submissionId).id);
    expect(claimsOf(harness.state, submissionId)).toHaveLength(1);
  });

  it('refuses a new amount below the minimum', () => {
    const { harness, submissionId } = readyCreator(500); // RM2.50
    const failure = harness.fail({ type: 'claim.request', submissionId }, 'below_min_claim');
    expect(failure.detail).toBe('250');
    expect(selectSubmissionReward(harness.state, submissionId)?.meetsMinClaim).toBe(false);
  });

  it('accepts exactly the minimum and refuses one sen less (D02)', () => {
    const exact = readyCreator(1000);
    expect(exact.harness.ok({ type: 'claim.request', submissionId: exact.submissionId }).outcome).toBe('claim');
    const short = readyCreator(999); // 999 × 0.5 sen = 499.5 → floor 499
    short.harness.fail({ type: 'claim.request', submissionId: short.submissionId }, 'below_min_claim');
  });

  it('requires both the view threshold and the amount when a threshold is set (D02)', () => {
    const harness = createHarness();
    const campaignId = publishCampaign(harness, 'Threshold', { viewThreshold: 2000 });
    const submissionId = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      1000,
    );
    // RM5 is claimable but the view threshold is not met.
    const reward = selectSubmissionReward(harness.state, submissionId);
    expect(reward?.claimableSen).toBe(500);
    expect(reward?.meetsViewThreshold).toBe(false);
    harness.fail({ type: 'claim.request', submissionId }, 'view_threshold_not_met');

    harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 1000 });
    expect(harness.ok({ type: 'claim.request', submissionId }).outcome).toBe('claim');
  });

  it('caps the cumulative reward and then has nothing more to claim', () => {
    const harness = createHarness();
    const campaignId = publishCampaign(harness, 'Cap');
    const submissionId = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      30_000, // RM150 exact, capped at RM100
    );
    const reward = selectSubmissionReward(harness.state, submissionId);
    expect(reward?.exactRewardMilliSen).toBe(15_000_000);
    expect(reward?.cappedSen).toBe(10_000);
    expect(reward?.capReached).toBe(true);

    harness.ok({ type: 'claim.request', submissionId });
    expect(latestClaim(harness.state, submissionId).amountSen).toBe(10_000);
    confirmClaim(harness, submissionId);
    harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 50_000 });
    harness.fail({ type: 'claim.request', submissionId }, 'nothing_claimable');
  });

  it('reproduces the approved cumulative rounding chain through the engine (D01)', () => {
    const harness = createHarness();
    // RM1 per 1,000 views so the source examples land on exact decimals.
    const campaignId = publishCampaign(harness, 'Rounding', { ratePerThousandSen: 100 });
    const submissionId = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      5009,
    );
    expect(selectSubmissionReward(harness.state, submissionId)?.cappedSen).toBe(500); // RM5.009 → RM5.00
    harness.ok({ type: 'claim.request', submissionId });
    expect(latestClaim(harness.state, submissionId).amountSen).toBe(500);
    confirmClaim(harness, submissionId);

    harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 5009 }); // 10,018 cumulative
    const reward = selectSubmissionReward(harness.state, submissionId);
    expect(reward?.cappedSen).toBe(1001); // RM10.018 → RM10.01
    expect(reward?.confirmedUnpaidSen).toBe(500);
    expect(reward?.claimableSen).toBe(501); // 已占5.00时新增5.01
    harness.ok({ type: 'claim.request', submissionId });
    expect(latestClaim(harness.state, submissionId).amountSen).toBe(501);
    // Total never exceeds the cumulative rounding of the final view count.
    const total = claimsOf(harness.state, submissionId).reduce((sum, claim) => sum + claim.amountSen, 0);
    expect(total).toBe(1001);
  });

  it('refuses a claim after the effective deadline but keeps what was submitted', () => {
    const { harness, submissionId } = readyCreator();
    harness.ok({ type: 'claim.request', submissionId });
    confirmClaim(harness, submissionId);
    harness.ok({ type: 'demo.advanceClock', byMs: 15 * DAY_MS });
    const failure = harness.fail({ type: 'claim.request', submissionId }, 'claim_deadline_passed');
    expect(failure.detail).toBe('2026-09-15T12:00:00+08:00');
    // The confirmed claim is untouched by the deadline.
    expect(latestClaim(harness.state, submissionId).status).toBe('confirmed_unpaid');
  });

  it('refuses a claim without trusted data', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: SEED_IDS.campaignKopiRaya,
      dataSourceReady: false,
    });
    const submissionId = submitAndMeter(
      harness,
      SEED_IDS.campaignKopiRaya,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      0,
    );
    const failure = harness.fail({ type: 'claim.request', submissionId }, 'data_unavailable');
    expect(failure.detail).toBe('baseline_unavailable');
  });

  it('refuses a claim on someone else submission', () => {
    const { harness, submissionId } = readyCreator();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    harness.fail({ type: 'claim.request', submissionId }, 'forbidden');
  });
});

describe('partial offers', () => {
  function partialSetup(): { harness: Harness; submissionId: string; campaignId: string } {
    const harness = createHarness();
    const campaignId = publishCampaign(harness, 'Small pool', { poolSen: 5000 });
    const submissionId = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      12_000, // RM60 claimable against RM50 available
    );
    return { harness, submissionId, campaignId };
  }

  it('offers the allocatable amount without reserving anything', () => {
    const { harness, submissionId, campaignId } = partialSetup();
    const result = harness.ok({ type: 'claim.request', submissionId });
    expect(result.outcome).toBe('partial_offer');
    const offer = onlyOffer(harness.state, submissionId);
    expect(offer.fullSen).toBe(6000);
    expect(offer.offeredSen).toBe(5000);
    expect(claimsOf(harness.state, submissionId)).toHaveLength(0);
    expect(selectBudget(harness.state, campaignId)).toEqual({
      poolSen: 5000,
      availableSen: 5000,
      reservedSen: 0,
      confirmedUnpaidSen: 0,
      paidSen: 0,
    });
  });

  it('requires the exact amount and the exact versions', () => {
    const { harness, submissionId } = partialSetup();
    harness.ok({ type: 'claim.request', submissionId });
    const offer = onlyOffer(harness.state, submissionId);
    harness.fail(
      {
        type: 'claim.consentPartial',
        offerId: offer.id,
        consentedSen: 6000,
        snapshotVersion: offer.snapshotVersion,
        budgetVersion: offer.budgetVersion,
      },
      'offer_amount_mismatch',
    );
    harness.fail(
      {
        type: 'claim.consentPartial',
        offerId: offer.id,
        consentedSen: offer.offeredSen,
        snapshotVersion: offer.snapshotVersion + 1,
        budgetVersion: offer.budgetVersion,
      },
      'offer_stale',
    );
  });

  it('reserves and starts the queue only at consent time', () => {
    const { harness, submissionId, campaignId } = partialSetup();
    harness.ok({ type: 'claim.request', submissionId });
    const offer = onlyOffer(harness.state, submissionId);
    harness.ok({ type: 'demo.advanceClock', byMs: 2 * 60 * 60 * 1000 });
    harness.ok({
      type: 'claim.consentPartial',
      offerId: offer.id,
      consentedSen: offer.offeredSen,
      snapshotVersion: offer.snapshotVersion,
      budgetVersion: offer.budgetVersion,
    });
    const claim = latestClaim(harness.state, submissionId);
    expect(claim.isPartial).toBe(true);
    expect(claim.amountSen).toBe(5000);
    expect(claim.unreservedRemainderSen).toBe(1000);
    // The queue time is the consent time, not the offer time.
    expect(claim.validAt).toBe('2026-09-01T14:00:00+08:00');
    expect(harness.state.partialOffers[offer.id].status).toBe('consented');
    expect(selectBudget(harness.state, campaignId).reservedSen).toBe(5000);
    expect(
      harness.state.ledger.filter((entry) => entry.reason === 'partial_claim_reserved'),
    ).toHaveLength(1);
  });

  it('goes stale when the budget moves and re-offers the new amount', () => {
    const { harness, submissionId, campaignId } = partialSetup();
    harness.ok({ type: 'claim.request', submissionId });
    const offer = onlyOffer(harness.state, submissionId);

    // Another creator claims RM5 from the same pool.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    const benSubmission = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionBenTiktok,
      URLS.benTiktok,
      1000,
    );
    harness.ok({ type: 'claim.request', submissionId: benSubmission });

    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.fail(
      {
        type: 'claim.consentPartial',
        offerId: offer.id,
        consentedSen: offer.offeredSen,
        snapshotVersion: offer.snapshotVersion,
        budgetVersion: offer.budgetVersion,
      },
      'offer_stale',
    );
    expect(harness.state.partialOffers[offer.id].status).toBe('stale');

    // Re-offering shows the smaller amount.
    harness.ok({ type: 'claim.request', submissionId });
    expect(onlyOffer(harness.state, submissionId).offeredSen).toBe(4500);
  });

  it('can be declined, leaving the budget untouched', () => {
    const { harness, submissionId, campaignId } = partialSetup();
    harness.ok({ type: 'claim.request', submissionId });
    const offer = onlyOffer(harness.state, submissionId);
    harness.ok({ type: 'claim.declinePartial', offerId: offer.id });
    expect(harness.state.partialOffers[offer.id].status).toBe('declined');
    expect(selectBudget(harness.state, campaignId).availableSen).toBe(5000);
  });
});

describe('waitlist and budget recovery', () => {
  function waitlistSetup() {
    const harness = createHarness();
    const campaignId = publishCampaign(harness, 'Tiny pool', { poolSen: 900 });
    // Ben claims RM5 first, leaving RM4 — below the RM5 minimum.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    const benSubmission = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionBenTiktok,
      URLS.benTiktok,
      1000,
    );
    harness.ok({ type: 'claim.request', submissionId: benSubmission });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    const demoSubmission = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      1000,
    );
    return { harness, campaignId, benSubmission, demoSubmission };
  }

  it('waitlists without reserving anything', () => {
    const { harness, campaignId, demoSubmission } = waitlistSetup();
    const result = harness.ok({ type: 'claim.request', submissionId: demoSubmission });
    expect(result.outcome).toBe('waitlisted');
    const entry = onlyWaitlistEntry(harness.state, demoSubmission);
    expect(entry.status).toBe('waiting');
    expect(entry.claimableSenAtEntry).toBe(500);
    expect(selectBudget(harness.state, campaignId)).toMatchObject({
      availableSen: 400,
      reservedSen: 500,
    });
  });

  it('notifies waiting entries when money returns, then grants a new queue time', () => {
    const { harness, campaignId, benSubmission, demoSubmission } = waitlistSetup();
    harness.ok({ type: 'claim.request', submissionId: demoSubmission });
    const benClaim = latestClaim(harness.state, benSubmission);

    // Ben's claim is rejected and finally released after the appeal window.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({
      type: 'claim.reviewMetering',
      claimId: benClaim.id,
      decision: 'reject',
      reason: 'views outside the window',
    });
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    harness.ok({ type: 'claim.finalizeRejection', claimId: benClaim.id, reason: 'no appeal filed' });

    const entry = onlyWaitlistEntry(harness.state, demoSubmission);
    expect(entry.status).toBe('notified');
    expect(entry.notifiedAt).toBe('2026-09-09T12:00:00+08:00');
    expect(
      Object.values(harness.state.notifications).some(
        (notification) =>
          notification.kind === 'waitlist.budget_available' &&
          notification.recipientUserId === SEED_IDS.userDemo,
      ),
    ).toBe(true);
    expect(selectBudget(harness.state, campaignId).availableSen).toBe(900);

    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'waitlist.resubmit', entryId: entry.id });
    const claim = latestClaim(harness.state, demoSubmission);
    expect(claim.amountSen).toBe(500);
    // A new sequence number and the resubmit time: no inherited priority.
    expect(claim.seq).toBe(2);
    expect(claim.validAt).toBe('2026-09-09T12:00:00+08:00');
    expect(harness.state.waitlist[entry.id].status).toBe('resubmitted');
  });

  it('keeps the entry waiting when the budget is still short', () => {
    const { harness, demoSubmission } = waitlistSetup();
    harness.ok({ type: 'claim.request', submissionId: demoSubmission });
    const entry = onlyWaitlistEntry(harness.state, demoSubmission);
    const result = harness.ok({ type: 'waitlist.resubmit', entryId: entry.id });
    expect(result.outcome).toBe('waitlisted');
    expect(harness.state.waitlist[entry.id].status).toBe('waiting');
    expect(Object.keys(harness.state.waitlist)).toHaveLength(1);
  });
});

describe('content review as a claim precondition', () => {
  /**
   * campaign-defaults-v1.md 一条视频的例子: "以上均以内容合规、观看有效、预算可分配及最终
   * 核验通过为前提". A claim against rejected content could never confirm
   * (`confirmIfReady` needs an approved content review) and a content decision is
   * one-shot, so accepting one would only mint a reservation with no exit.
   */
  function contentRejected(): { harness: Harness; submissionId: string } {
    const { harness, submissionId } = readyCreator();
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({
      type: 'submission.reviewContent',
      submissionId,
      decision: 'reject',
      reason: 'off brief',
    });
    harness.ok({ type: 'session.switchWorkspace', workspace: 'creator' });
    return { harness, submissionId };
  }

  it('refuses a new claim and says why on the page', () => {
    const { harness, submissionId } = contentRejected();
    harness.fail({ type: 'claim.request', submissionId }, 'content_rejected');
    expect(claimsOf(harness.state, submissionId)).toHaveLength(0);
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya)).toMatchObject({
      availableSen: 200_000,
      reservedSen: 0,
    });
    expect(selectSubmissionReward(harness.state, submissionId)).toMatchObject({
      canClaim: false,
      blockReason: 'content_rejected',
    });
  });

  it('allows the claim again once an upheld appeal reopens the content review', () => {
    const { harness, submissionId } = readyCreator();
    harness.ok({ type: 'claim.request', submissionId });
    const claimId = latestClaim(harness.state, submissionId).id;
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({
      type: 'submission.reviewContent',
      submissionId,
      decision: 'reject',
      reason: 'off brief',
    });
    harness.ok({ type: 'session.switchWorkspace', workspace: 'creator' });
    harness.ok({ type: 'appeal.file', claimId, reason: 'it follows the brief' });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    const appealId = Object.values(harness.state.appeals)[0].id;
    harness.ok({ type: 'appeal.resolve', appealId, decision: 'uphold', note: 'agreed' });
    expect(harness.state.submissions[submissionId].contentReview.status).toBe('pending');
    // Back in review, so the block is the one-pending-claim rule, not the content.
    expect(selectSubmissionReward(harness.state, submissionId)?.blockReason).toBe(
      'pending_claim_exists',
    );
  });
});

describe('a finalised rejection is final for the evidence it judged', () => {
  /**
   * campaign-defaults-v1.md 门槛必须能达到: "追加申请仍须新增奖励≥RM5，不能重复使用已申请
   * 的金额". Releasing the reservation returns the budget to the pool for other
   * creators, but the amount was claimed once, so a further claim on this post needs
   * qualified views the rejected claim did not already cover.
   */
  function rejectAndRelease(harness: Harness, submissionId: string): void {
    const claimId = latestClaim(harness.state, submissionId).id;
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({
      type: 'claim.reviewMetering',
      claimId,
      decision: 'reject',
      reason: 'views not verifiable',
    });
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    harness.ok({ type: 'claim.finalizeRejection', claimId, reason: 'appeal window closed' });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
  }

  it('releases the reservation but does not re-offer the same amount', () => {
    const { harness, submissionId } = readyCreator();
    harness.ok({ type: 'claim.request', submissionId });
    rejectAndRelease(harness, submissionId);

    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya)).toMatchObject({
      availableSen: 200_000,
      reservedSen: 0,
    });
    expect(selectSubmissionReward(harness.state, submissionId)).toMatchObject({
      cappedSen: 500,
      claimableSen: 0,
      blockReason: 'nothing_claimable',
    });
    harness.fail({ type: 'claim.request', submissionId }, 'nothing_claimable');
  });

  it('allows a claim for qualified views the rejected claim did not cover', () => {
    const harness = createHarness();
    // A long metering window, so the 7-day appeal window closes while it is open.
    const campaignId = publishCampaign(harness, 'Long window', { meteringDays: 30 });
    const submissionId = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      1000,
    );
    harness.ok({ type: 'claim.request', submissionId });
    rejectAndRelease(harness, submissionId);
    expect(selectSubmissionReward(harness.state, submissionId)?.claimableSen).toBe(0);

    harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 1000 });
    expect(selectSubmissionReward(harness.state, submissionId)).toMatchObject({
      cappedSen: 1000,
      claimableSen: 500,
    });
    const again = harness.ok({ type: 'claim.request', submissionId });
    expect(again.outcome).toBe('claim');
    expect(latestClaim(harness.state, submissionId).amountSen).toBe(500);
  });

  it('keeps the uncovered remainder of a partly rejected claim claimable', () => {
    const harness = createHarness();
    const campaignId = publishCampaign(harness, 'Tight pool', { poolSen: 1000 });

    // Ben takes RM5 of the RM10 pool first.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    const bensId = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionBenTiktok,
      URLS.benTiktok,
      1000,
    );
    harness.ok({ type: 'claim.request', submissionId: bensId });

    // Demo User can claim RM10 but only RM5 is allocatable, so consents to RM5.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    const submissionId = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      2000,
    );
    expect(harness.ok({ type: 'claim.request', submissionId }).outcome).toBe('partial_offer');
    const offer = onlyOffer(harness.state, submissionId);
    harness.ok({
      type: 'claim.consentPartial',
      offerId: offer.id,
      consentedSen: offer.offeredSen,
      snapshotVersion: offer.snapshotVersion,
      budgetVersion: offer.budgetVersion,
    });
    expect(latestClaim(harness.state, submissionId)).toMatchObject({
      amountSen: 500,
      unreservedRemainderSen: 500,
    });

    rejectAndRelease(harness, submissionId);
    // The RM5 that was adjudicated is spent; the RM5 that never was is not.
    expect(selectSubmissionReward(harness.state, submissionId)).toMatchObject({
      cappedSen: 1000,
      claimableSen: 500,
      canClaim: true,
    });
    expect(harness.ok({ type: 'claim.request', submissionId }).outcome).toBe('claim');
  });
});

describe('D06 as a standing invariant', () => {
  /**
   * campaign-defaults-v1.md 复用: "同一平台发布ID默认不能跨活动重复计奖". The submit-time
   * gate alone is not enough — once the post has legitimately entered a second
   * campaign, a further claim in the first one would make one post id earn in two
   * campaigns at the same time.
   */
  it('refuses a claim in the original campaign once the post entered another one', () => {
    const harness = createHarness();
    const campaignId = publishCampaign(harness, 'Long window', { meteringDays: 30 });
    const submissionId = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      1000,
    );
    harness.ok({ type: 'claim.request', submissionId });
    const claimId = latestClaim(harness.state, submissionId).id;
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({
      type: 'claim.reviewMetering',
      claimId,
      decision: 'reject',
      reason: 'views not verifiable',
    });
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    harness.ok({ type: 'claim.finalizeRejection', claimId, reason: 'appeal window closed' });

    // A finally rejected post may enter a second campaign; D06 allows that reuse.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    const second = publishCampaign(harness, 'Second campaign');
    harness.ok({
      type: 'submission.create',
      campaignId: second,
      connectionId: SEED_IDS.connectionDemoTiktok,
      url: URLS.demoTiktok,
    });
    // And the original campaign must not resurrect it.
    expect(selectSubmissionReward(harness.state, submissionId)?.blockReason).toBe(
      'cross_campaign_blocked',
    );
    harness.fail({ type: 'claim.request', submissionId }, 'cross_campaign_blocked');
  });
});

describe('a data outage blocks a new claim', () => {
  /**
   * campaign-defaults-v1.md 申请、排队与预留: "有效申请须满足资格、门槛和可核验数据条件",
   * and prd-content-rewards-v2.md: "来源延迟使资格暂不可核验时显示待数据，不冒称已进入有
   * 预留队列". It is also the premise the outage deadline extension rests on.
   */
  it('refuses while the source is unreadable and allows it again once cleared', () => {
    const { harness, submissionId } = readyCreator();
    harness.ok({ type: 'demo.setDataOutage', submissionId, outage: true });
    expect(selectSubmissionReward(harness.state, submissionId)).toMatchObject({
      canClaim: false,
      blockReason: 'data_unavailable',
      // The last trusted reading stays on screen; unknown is never read as zero.
      qualifiedViews: 1000,
    });
    harness.fail({ type: 'claim.request', submissionId }, 'data_unavailable');
    expect(claimsOf(harness.state, submissionId)).toHaveLength(0);

    harness.ok({ type: 'demo.setDataOutage', submissionId, outage: false });
    expect(selectSubmissionReward(harness.state, submissionId)?.canClaim).toBe(true);
    expect(harness.ok({ type: 'claim.request', submissionId }).outcome).toBe('claim');
  });
});

describe('the waitlist entry a claim supersedes', () => {
  it('closes when the claim is filed from the submission page', () => {
    const harness = createHarness();
    const campaignId = publishCampaign(harness, 'Tight pool', { poolSen: 900 });

    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    const bensId = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionBenTiktok,
      URLS.benTiktok,
      1000,
    );
    harness.ok({ type: 'claim.request', submissionId: bensId });

    // RM4 left against an RM5 minimum: the waitlist, with no reservation.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    const mine = submitAndMeter(
      harness,
      campaignId,
      SEED_IDS.connectionDemoTiktok,
      URLS.demoTiktok,
      1000,
    );
    expect(harness.ok({ type: 'claim.request', submissionId: mine }).outcome).toBe('waitlisted');
    expect(onlyWaitlistEntry(harness.state, mine).status).toBe('waiting');

    // Ben's claim is finally rejected, so the budget comes back and the entry is notified.
    const bensClaim = latestClaim(harness.state, bensId).id;
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({
      type: 'claim.reviewMetering',
      claimId: bensClaim,
      decision: 'reject',
      reason: 'not eligible',
    });
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    harness.ok({ type: 'claim.finalizeRejection', claimId: bensClaim, reason: 'window closed' });
    expect(onlyWaitlistEntry(harness.state, mine).status).toBe('notified');

    // The creator uses the claim button rather than the entry's resubmit button.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    expect(harness.ok({ type: 'claim.request', submissionId: mine }).outcome).toBe('claim');
    expect(onlyWaitlistEntry(harness.state, mine).status).toBe('resubmitted');
    // So the entry no longer offers a control the one-pending-claim rule must refuse.
    expect(
      Object.values(harness.state.waitlist).filter(
        (entry) => entry.status === 'waiting' || entry.status === 'notified',
      ),
    ).toHaveLength(0);
  });
});
