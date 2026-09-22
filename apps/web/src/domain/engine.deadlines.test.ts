import { describe, expect, it } from 'vitest';

import { SEED_IDS } from './seed';
import {
  selectCampaignClosure,
  selectSubmissionDeadlines,
  selectSubmissionReward,
} from './selectors';
import {
  DAY_MS,
  URLS,
  appealOf,
  createHarness,
  findSubmissionByUrl,
  latestAttemptOf,
  latestClaim,
  obligationOf,
  type Harness,
} from './test-utils';

function creatorWithSubmission(): { harness: Harness; submissionId: string } {
  const harness = createHarness();
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
  harness.ok({
    type: 'submission.create',
    campaignId: SEED_IDS.campaignKopiRaya,
    connectionId: SEED_IDS.connectionDemoTiktok,
    url: URLS.demoTiktok,
  });
  const submissionId = findSubmissionByUrl(harness.state, URLS.demoTiktok).id;
  harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 1000 });
  return { harness, submissionId };
}

describe('windows and deadlines', () => {
  it('runs 7 days of metering and 7 calendar days of grace from acceptance', () => {
    const { harness, submissionId } = creatorWithSubmission();
    const deadlines = selectSubmissionDeadlines(harness.state, submissionId);
    expect(deadlines).toMatchObject({
      acceptedAt: '2026-09-01T12:00:00+08:00',
      meteringEndsAt: '2026-09-08T12:00:00+08:00',
      baseClaimDeadlineAt: '2026-09-15T12:00:00+08:00',
      effectiveClaimDeadlineAt: '2026-09-15T12:00:00+08:00',
    });
  });

  it('gives a link accepted on the last day a full metering window', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'demo.advanceClock', byMs: 13 * DAY_MS }); // 2026-09-14, one day before close
    harness.ok({
      type: 'submission.create',
      campaignId: SEED_IDS.campaignKopiRaya,
      connectionId: SEED_IDS.connectionDemoTiktok,
      url: URLS.demoTiktok,
    });
    const submission = findSubmissionByUrl(harness.state, URLS.demoTiktok);
    // The metering window is not truncated by the campaign closing intake.
    expect(submission.meteringEndsAt).toBe('2026-09-21T12:00:00+08:00');
    expect(submission.claimDeadlineAt).toBe('2026-09-28T12:00:00+08:00');
  });

  it('closes the metering window once and tells both sides', () => {
    const { harness, submissionId } = creatorWithSubmission();
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    expect(harness.state.submissions[submissionId].status).toBe('metering_ended');
    const notices = Object.values(harness.state.notifications).filter(
      (entry) => entry.kind === 'deadline.metering_ended' && entry.params.submissionId === submissionId,
    );
    // Demo User is both the creator and the Kopi Kita merchant, and rows are unique
    // per (eventId, recipient, role), so each side gets its own row and its own link.
    expect(notices).toHaveLength(2);
    expect(notices.every((entry) => entry.recipientUserId === SEED_IDS.userDemo)).toBe(true);
    expect(notices.map((entry) => entry.recipientRole).sort()).toEqual(['creator', 'merchant']);
    expect(notices.find((entry) => entry.recipientRole === 'creator')?.href).toBe(
      `/creator/submissions/${submissionId}`,
    );
    expect(notices.find((entry) => entry.recipientRole === 'merchant')?.href).toBe(
      `/merchant/submissions/${submissionId}`,
    );
    // Advancing again does not repeat the announcement.
    harness.ok({ type: 'demo.advanceClock', byMs: DAY_MS });
    expect(
      Object.values(harness.state.notifications).filter(
        (entry) => entry.kind === 'deadline.metering_ended' && entry.params.submissionId === submissionId,
      ),
    ).toHaveLength(2);
  });

  it('announces a passed claim deadline once without clearing anything', () => {
    const { harness, submissionId } = creatorWithSubmission();
    harness.ok({ type: 'claim.request', submissionId });
    harness.ok({ type: 'demo.advanceClock', byMs: 15 * DAY_MS });
    const passedFor = (state: typeof harness.state) =>
      Object.values(state.notifications).filter(
        (entry) =>
          entry.kind === 'deadline.claim_deadline_passed' &&
          entry.params.submissionId === submissionId,
      );
    expect(passedFor(harness.state)).toHaveLength(1);
    harness.ok({ type: 'demo.advanceClock', byMs: DAY_MS });
    expect(passedFor(harness.state)).toHaveLength(1);
    // The submitted claim survives the deadline.
    expect(latestClaim(harness.state, submissionId).status).toBe('pending_review');
  });

  it('refuses to move the simulated clock backwards', () => {
    const { harness } = creatorWithSubmission();
    harness.fail({ type: 'demo.setClock', toIso: '2026-08-01T12:00:00+08:00' }, 'invalid_input');
    harness.fail({ type: 'demo.setClock', toIso: 'yesterday' }, 'invalid_input');
    harness.ok({ type: 'demo.setClock', toIso: '2026-09-02T12:00:00+08:00' });
    expect(harness.state.clock.nowIso).toBe('2026-09-02T12:00:00+08:00');
  });
});

describe('claim deadline extensions', () => {
  it('grants the full published grace after a data outage spanning the metering end', () => {
    const { harness, submissionId } = creatorWithSubmission();
    harness.ok({ type: 'demo.setDataOutage', submissionId, outage: true });
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS }); // 2026-09-09, metering over
    harness.ok({ type: 'demo.setDataOutage', submissionId, outage: false });

    const submission = harness.state.submissions[submissionId];
    expect(submission.extensions).toHaveLength(1);
    expect(submission.extensions[0]).toMatchObject({
      reason: 'data_outage',
      blockedFrom: '2026-09-01T12:00:00+08:00',
      unblockedAt: '2026-09-09T12:00:00+08:00',
      newDeadlineAt: '2026-09-16T12:00:00+08:00',
      notifiedAt: '2026-09-09T12:00:00+08:00',
    });
    // Metering is not re-opened and the frozen numbers do not change.
    expect(submission.meteringEndsAt).toBe('2026-09-08T12:00:00+08:00');
    expect(selectSubmissionReward(harness.state, submissionId)?.qualifiedViews).toBe(1000);
    const deadlines = selectSubmissionDeadlines(harness.state, submissionId);
    expect(deadlines?.baseClaimDeadlineAt).toBe('2026-09-15T12:00:00+08:00');
    expect(deadlines?.effectiveClaimDeadlineAt).toBe('2026-09-16T12:00:00+08:00');
    // Everyone who needs the new date is told, with the date in the message.
    const notices = Object.values(harness.state.notifications).filter(
      (entry) => entry.kind === 'deadline.claim_deadline_extended',
    );
    expect(notices.map((entry) => `${entry.recipientUserId}:${entry.recipientRole}`).sort()).toEqual([
      `${SEED_IDS.userDemo}:creator`,
      `${SEED_IDS.userDemo}:merchant`,
      `${SEED_IDS.userOpsReviewer}:ops_reviewer`,
    ]);
    expect(notices.every((entry) => entry.params.newDeadlineAt === '2026-09-16T12:00:00+08:00')).toBe(
      true,
    );
    expect(notices.every((entry) => entry.params.reason === 'data_outage')).toBe(true);
    // Views after the metering end still never count.
    harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 4000 });
    expect(selectSubmissionReward(harness.state, submissionId)?.qualifiedViews).toBe(1000);
  });

  it('claims are possible again inside the extension', () => {
    const { harness, submissionId } = creatorWithSubmission();
    harness.ok({ type: 'demo.setDataOutage', submissionId, outage: true });
    harness.ok({ type: 'demo.advanceClock', byMs: 15 * DAY_MS }); // past the original deadline
    harness.ok({ type: 'demo.setDataOutage', submissionId, outage: false });
    expect(selectSubmissionDeadlines(harness.state, submissionId)?.effectiveClaimDeadlineAt).toBe(
      '2026-09-23T12:00:00+08:00',
    );
    harness.ok({ type: 'claim.request', submissionId });
    expect(latestClaim(harness.state, submissionId).amountSen).toBe(500);
  });

  it('does not extend when the outage cleared before the metering end', () => {
    const { harness, submissionId } = creatorWithSubmission();
    harness.ok({ type: 'demo.setDataOutage', submissionId, outage: true });
    harness.ok({ type: 'demo.advanceClock', byMs: DAY_MS });
    harness.ok({ type: 'demo.setDataOutage', submissionId, outage: false });
    expect(harness.state.submissions[submissionId].extensions).toHaveLength(0);
  });

  it('grants a grace when an open case blocked the submission past the metering end', () => {
    const { harness, submissionId } = creatorWithSubmission();
    harness.ok({ type: 'claim.request', submissionId });
    const claimId = latestClaim(harness.state, submissionId).id;
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });

    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'approve', reason: null });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null });

    const submission = harness.state.submissions[submissionId];
    expect(submission.extensions).toHaveLength(1);
    expect(submission.extensions[0]).toMatchObject({
      reason: 'pending_case',
      unblockedAt: '2026-09-09T12:00:00+08:00',
      newDeadlineAt: '2026-09-16T12:00:00+08:00',
    });
    // The confirmed amount is untouched by the extension.
    expect(harness.state.claims[claimId].amountSen).toBe(500);
    expect(harness.state.claims[claimId].validAt).toBe('2026-09-01T12:00:00+08:00');
  });
});

describe('retention end', () => {
  it('waits for the later of the published retention and the claim deadline', () => {
    const { harness, submissionId } = creatorWithSubmission();
    // Published 2026-09-01 + 30 days retention = 2026-10-01, later than the deadline.
    expect(selectSubmissionDeadlines(harness.state, submissionId)).toMatchObject({
      retentionEndsAt: '2026-10-01T12:00:00+08:00',
      retentionReason: 'published_retention',
    });
  });

  it('follows the claim deadline when it is later than the published retention', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({
      type: 'campaign.createDraft',
      orgId: SEED_IDS.orgKopi,
      title: 'Short retention',
      brief: '',
      rules: { retentionDays: 5 },
    });
    const campaign = Object.values(harness.state.campaigns).find(
      (entry) => entry.title === 'Short retention',
    );
    if (!campaign) throw new Error('campaign missing');
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: campaign.id,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    harness.ok({ type: 'campaign.publish', campaignId: campaign.id });
    harness.ok({ type: 'session.switchWorkspace', workspace: 'creator' });
    harness.ok({
      type: 'submission.create',
      campaignId: campaign.id,
      connectionId: SEED_IDS.connectionDemoTiktok,
      url: URLS.demoTiktok,
    });
    const submissionId = findSubmissionByUrl(harness.state, URLS.demoTiktok).id;
    expect(selectSubmissionDeadlines(harness.state, submissionId)).toMatchObject({
      retentionEndsAt: '2026-09-15T12:00:00+08:00',
      retentionReason: 'claim_deadline',
    });
  });

  it('has no end date while a case is open or money is confirmed unpaid', () => {
    const { harness, submissionId } = creatorWithSubmission();
    harness.ok({ type: 'claim.request', submissionId });
    expect(selectSubmissionDeadlines(harness.state, submissionId)).toMatchObject({
      retentionEndsAt: null,
      retentionReason: 'open_cases',
    });

    const claimId = latestClaim(harness.state, submissionId).id;
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'approve', reason: null });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null });
    expect(selectSubmissionDeadlines(harness.state, submissionId)).toMatchObject({
      retentionEndsAt: null,
      retentionReason: 'confirmed_unpaid',
    });

    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsFinance });
    const obligationId = obligationOf(harness.state, claimId).id;
    harness.ok({ type: 'payout.start', obligationId });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'succeeded',
    });
    // Settled: the retention end exists again and does not wait for anything else.
    expect(selectSubmissionDeadlines(harness.state, submissionId)?.retentionEndsAt).not.toBeNull();
  });
});

describe('campaign closure', () => {
  function closureSetup() {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    // Demo User: a confirmed unpaid claim.
    harness.ok({
      type: 'submission.create',
      campaignId: SEED_IDS.campaignKopiRaya,
      connectionId: SEED_IDS.connectionDemoTiktok,
      url: URLS.demoTiktok,
    });
    const demoSubmission = findSubmissionByUrl(harness.state, URLS.demoTiktok).id;
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: demoSubmission, views: 1000 });
    harness.ok({ type: 'claim.request', submissionId: demoSubmission });
    const demoClaim = latestClaim(harness.state, demoSubmission).id;
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({
      type: 'submission.reviewContent',
      submissionId: demoSubmission,
      decision: 'approve',
      reason: null,
    });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({ type: 'claim.reviewMetering', claimId: demoClaim, decision: 'approve', reason: null });

    // Ben: a rejected claim under appeal.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    harness.ok({
      type: 'submission.create',
      campaignId: SEED_IDS.campaignKopiRaya,
      connectionId: SEED_IDS.connectionBenTiktok,
      url: URLS.benTiktok,
    });
    const benSubmission = findSubmissionByUrl(harness.state, URLS.benTiktok).id;
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: benSubmission, views: 1000 });
    harness.ok({ type: 'claim.request', submissionId: benSubmission });
    const benClaim = latestClaim(harness.state, benSubmission).id;
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({
      type: 'claim.reviewMetering',
      claimId: benClaim,
      decision: 'reject',
      reason: 'window mismatch',
    });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    harness.ok({ type: 'appeal.file', claimId: benClaim, reason: 'inside the window' });

    // Demo User: a second post whose tail stays below the minimum.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'connection.connect', platform: 'youtube', handle: '@demouser' });
    const youtube = Object.values(harness.state.connections).find(
      (entry) => entry.userId === SEED_IDS.userDemo && entry.platform === 'youtube',
    );
    if (!youtube) throw new Error('youtube connection missing');
    harness.ok({
      type: 'submission.create',
      campaignId: SEED_IDS.campaignKopiRaya,
      connectionId: youtube.id,
      url: URLS.demoYoutube,
    });
    const tailSubmission = findSubmissionByUrl(harness.state, URLS.demoYoutube).id;
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: tailSubmission, views: 500 });
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    return { harness, demoClaim, benClaim, tailSubmission };
  }

  it('never shows fully settled while an appeal or confirmed money is open', () => {
    const { harness } = closureSetup();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({ ...{ type: 'campaign.close', campaignId: SEED_IDS.campaignKopiRaya }, reason: 'Campaign period finished.' });

    const closure = selectCampaignClosure(harness.state, SEED_IDS.campaignKopiRaya);
    expect(closure).toMatchObject({
      openAppeals: 1,
      confirmedUnpaidClaims: 1,
      canShowFullySettled: false,
      refundStatus: 'pending_verification',
      unconfirmedTailSen: 250, // RM2.50 disclosed, not paid
    });
    expect(closure?.budget).toMatchObject({
      poolSen: 200_000,
      reservedSen: 500, // Ben's held reservation
      confirmedUnpaidSen: 500,
    });
    expect(harness.state.campaigns[SEED_IDS.campaignKopiRaya].status).toBe('closed');
  });

  it('shows fully settled only once every case and payout is resolved', () => {
    const { harness, demoClaim, benClaim } = closureSetup();
    // Ben's appeal is rejected and the rejection is finalised.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    const appeal = appealOf(harness.state, benClaim);
    harness.ok({
      type: 'appeal.resolve',
      appealId: appeal.id,
      decision: 'reject',
      note: 'evidence does not support the claim',
    });
    harness.ok({ type: 'claim.finalizeRejection', claimId: benClaim, reason: 'appeal rejected' });
    // Demo User's confirmed claim is paid.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsFinance });
    const obligationId = obligationOf(harness.state, demoClaim).id;
    harness.ok({ type: 'payout.start', obligationId });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'succeeded',
    });

    const closure = selectCampaignClosure(harness.state, SEED_IDS.campaignKopiRaya);
    expect(closure).toMatchObject({
      openAppeals: 0,
      pendingClaims: 0,
      confirmedUnpaidClaims: 0,
      unresolvedPayouts: 0,
      canShowFullySettled: true,
      unconfirmedTailSen: 250, // still disclosed
      refundStatus: 'pending_verification',
    });
    expect(closure?.budget).toEqual({
      poolSen: 200_000,
      availableSen: 199_500,
      reservedSen: 0,
      confirmedUnpaidSen: 0,
      paidSen: 500,
    });
  });
});
