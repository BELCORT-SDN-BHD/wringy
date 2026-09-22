import { describe, expect, it } from 'vitest';

import { SEED_IDS } from './seed';
import { selectAuditFor, selectBudget, selectOpsQueue } from './selectors';
import {
  DAY_MS,
  HOUR_MS,
  URLS,
  appealOf,
  createHarness,
  findSubmissionByUrl,
  latestClaim,
  obligationOf,
  type Harness,
} from './test-utils';

/** Demo User has one metering submission with a pending RM5 claim. */
function claimed(): { harness: Harness; submissionId: string; claimId: string } {
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
  harness.ok({ type: 'claim.request', submissionId });
  return { harness, submissionId, claimId: latestClaim(harness.state, submissionId).id };
}

function asMerchant(harness: Harness): void {
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
  harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
}

function asReviewer(harness: Harness): void {
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
}

describe('two independent reviews', () => {
  it('does not confirm on content approval alone', () => {
    const { harness, submissionId, claimId } = claimed();
    asMerchant(harness);
    harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'approve', reason: null });
    expect(harness.state.claims[claimId].status).toBe('pending_review');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).reservedSen).toBe(500);
    expect(Object.keys(harness.state.obligations)).toHaveLength(0);
  });

  it('does not confirm on metering approval alone', () => {
    const { harness, claimId } = claimed();
    asReviewer(harness);
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null });
    expect(harness.state.claims[claimId].status).toBe('pending_review');
    expect(Object.keys(harness.state.obligations)).toHaveLength(0);
  });

  it('confirms once both reviews approved and creates one obligation', () => {
    const { harness, submissionId, claimId } = claimed();
    asMerchant(harness);
    harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'approve', reason: null });
    asReviewer(harness);
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null });

    expect(harness.state.claims[claimId].status).toBe('confirmed_unpaid');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya)).toMatchObject({
      availableSen: 199_500,
      reservedSen: 0,
      confirmedUnpaidSen: 500,
      paidSen: 0,
    });
    const obligation = obligationOf(harness.state, claimId);
    expect(obligation).toMatchObject({
      amountSen: 500,
      status: 'open',
      providerAvailableAt: null,
      bankSettlement: 'unknown',
    });
  });

  it('requires a readable reason to reject', () => {
    const { harness, submissionId, claimId } = claimed();
    asMerchant(harness);
    harness.fail(
      { type: 'submission.reviewContent', submissionId, decision: 'reject', reason: '  ' },
      'invalid_input',
    );
    asReviewer(harness);
    harness.fail({ type: 'claim.reviewMetering', claimId, decision: 'reject', reason: null }, 'invalid_input');
    harness.fail({ type: 'claim.reviewMetering', claimId, decision: 'hold', reason: null }, 'invalid_input');
  });

  it('holds metering without releasing the reservation', () => {
    const { harness, claimId } = claimed();
    asReviewer(harness);
    harness.ok({
      type: 'claim.reviewMetering',
      claimId,
      decision: 'hold',
      reason: 'waiting for the platform to re-publish the window',
    });
    expect(harness.state.claims[claimId].status).toBe('pending_review');
    expect(harness.state.claims[claimId].meteringReview.status).toBe('held');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).reservedSen).toBe(500);
    expect(
      Object.values(harness.state.notifications).some((entry) => entry.kind === 'metering.held'),
    ).toBe(true);
    // A held review can still be approved later.
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null });
    expect(harness.state.claims[claimId].meteringReview.status).toBe('approved');
  });

  it('refuses controlled actions from a role without the capability', () => {
    const { harness, submissionId, claimId } = claimed();
    // The creator cannot review their own metering.
    harness.fail({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null }, 'forbidden');
    // Finance is not a reviewer.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsFinance });
    harness.fail({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null }, 'forbidden');
    // A merchant from another org cannot decide this content.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    harness.fail(
      { type: 'submission.reviewContent', submissionId, decision: 'approve', reason: null },
      'forbidden',
    );
  });
});

describe('rejection holds the reservation', () => {
  it('moves every open claim of a rejected submission to appealable', () => {
    const { harness, submissionId, claimId } = claimed();
    asMerchant(harness);
    harness.ok({
      type: 'submission.reviewContent',
      submissionId,
      decision: 'reject',
      reason: 'the blend name is never mentioned',
    });
    const claim = harness.state.claims[claimId];
    expect(claim.status).toBe('rejected_appealable');
    expect(claim.rejection).toMatchObject({
      source: 'content',
      reason: 'the blend name is never mentioned',
      appealDeadlineAt: '2026-09-08T12:00:00+08:00',
    });
    // The reservation is held, not returned to available.
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya)).toMatchObject({
      availableSen: 199_500,
      reservedSen: 500,
    });
  });

  it('refuses release while the appeal window is open and after an appeal is filed', () => {
    const { harness, claimId } = claimed();
    asReviewer(harness);
    harness.ok({
      type: 'claim.reviewMetering',
      claimId,
      decision: 'reject',
      reason: 'the views fall outside the window',
    });
    expect(
      harness.fail({ type: 'claim.finalizeRejection', claimId, reason: 'release' }, 'release_not_allowed')
        .detail,
    ).toBe('appeal_window_open');

    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'appeal.file', claimId, reason: 'the views were inside the window' });
    asReviewer(harness);
    expect(
      harness.fail({ type: 'claim.finalizeRejection', claimId, reason: 'release' }, 'release_not_allowed')
        .detail,
    ).toBe('appeal_open');
  });

  it('releases the reservation only after an explicit finalisation', () => {
    const { harness, claimId } = claimed();
    asReviewer(harness);
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'reject', reason: 'not verifiable' });
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    harness.ok({ type: 'claim.finalizeRejection', claimId, reason: 'appeal window closed with no appeal' });

    expect(harness.state.claims[claimId].status).toBe('rejected_final');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya)).toMatchObject({
      availableSen: 200_000,
      reservedSen: 0,
    });
    expect(
      harness.state.ledger.filter((entry) => entry.reason === 'rejection_released'),
    ).toHaveLength(1);
  });
});

describe('appeals', () => {
  it('keeps the reservation while an appeal is open', () => {
    const { harness, claimId } = claimed();
    asReviewer(harness);
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'reject', reason: 'not verifiable' });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'appeal.file', claimId, reason: 'the source shows the views in the window' });
    expect(harness.state.claims[claimId].status).toBe('appealing');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).reservedSen).toBe(500);
    expect(selectOpsQueue(harness.state).some((item) => item.kind === 'appeal')).toBe(true);
  });

  it('refuses a second appeal and an appeal after the window', () => {
    const { harness, claimId } = claimed();
    asReviewer(harness);
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'reject', reason: 'not verifiable' });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'appeal.file', claimId, reason: 'first appeal' });
    harness.fail({ type: 'appeal.file', claimId, reason: 'second appeal' }, 'invalid_transition');

    const late = claimed();
    late.harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    late.harness.ok({
      type: 'claim.reviewMetering',
      claimId: late.claimId,
      decision: 'reject',
      reason: 'not verifiable',
    });
    late.harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    late.harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    late.harness.fail(
      { type: 'appeal.file', claimId: late.claimId, reason: 'too late' },
      'appeal_window_closed',
    );
  });

  it('upheld: back to verification with the same queue position and amount', () => {
    const { harness, claimId } = claimed();
    const before = latestClaim(harness.state, harness.state.claims[claimId].submissionId);
    asReviewer(harness);
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'reject', reason: 'not verifiable' });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'appeal.file', claimId, reason: 'please re-check' });
    const appeal = appealOf(harness.state, claimId);
    asReviewer(harness);
    harness.ok({ type: 'appeal.resolve', appealId: appeal.id, decision: 'uphold', note: 'source confirms' });

    const after = harness.state.claims[claimId];
    expect(after.status).toBe('pending_review');
    expect(after.seq).toBe(before.seq);
    expect(after.validAt).toBe(before.validAt);
    expect(after.amountSen).toBe(before.amountSen);
    expect(after.rejection).toBeNull();
    // The rejecting review goes back to pending so verification continues.
    expect(after.meteringReview.status).toBe('pending');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).reservedSen).toBe(500);
  });

  it('upheld after a content rejection resets the content review', () => {
    const { harness, submissionId, claimId } = claimed();
    asMerchant(harness);
    harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'reject', reason: 'off brief' });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'appeal.file', claimId, reason: 'the brief is followed at 0:05' });
    const appeal = appealOf(harness.state, claimId);
    asReviewer(harness);
    harness.ok({ type: 'appeal.resolve', appealId: appeal.id, decision: 'uphold', note: 'brief is met' });
    expect(harness.state.submissions[submissionId].contentReview.status).toBe('pending');
    expect(harness.state.claims[claimId].status).toBe('pending_review');
  });

  it('rejected: the reservation still needs an explicit release', () => {
    const { harness, claimId } = claimed();
    asReviewer(harness);
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'reject', reason: 'not verifiable' });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'appeal.file', claimId, reason: 'please re-check' });
    const appeal = appealOf(harness.state, claimId);
    asReviewer(harness);
    harness.ok({
      type: 'appeal.resolve',
      appealId: appeal.id,
      decision: 'reject',
      note: 'the evidence does not support the claim',
    });
    expect(harness.state.claims[claimId].status).toBe('rejected_appealable');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).reservedSen).toBe(500);
    // A decided appeal allows the release without waiting for the window.
    harness.ok({ type: 'claim.finalizeRejection', claimId, reason: 'appeal rejected' });
    expect(harness.state.claims[claimId].status).toBe('rejected_final');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).availableSen).toBe(200_000);
  });

  it('requires a note on resolution and refuses resolving twice', () => {
    const { harness, claimId } = claimed();
    asReviewer(harness);
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'reject', reason: 'not verifiable' });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'appeal.file', claimId, reason: 'please re-check' });
    const appeal = appealOf(harness.state, claimId);
    asReviewer(harness);
    harness.fail(
      { type: 'appeal.resolve', appealId: appeal.id, decision: 'reject', note: ' ' },
      'invalid_input',
    );
    harness.ok({ type: 'appeal.resolve', appealId: appeal.id, decision: 'reject', note: 'no' });
    harness.fail(
      { type: 'appeal.resolve', appealId: appeal.id, decision: 'uphold', note: 'again' },
      'invalid_transition',
    );
  });
});

describe('48 hour review target', () => {
  it('escalates without approving', () => {
    const { harness, claimId } = claimed();
    harness.ok({ type: 'demo.advanceClock', byMs: 49 * HOUR_MS });
    const claim = harness.state.claims[claimId];
    expect(claim.escalatedAt).toBe('2026-09-03T13:00:00+08:00');
    expect(claim.status).toBe('pending_review'); // never auto-approved
    expect(claim.meteringReview.status).toBe('pending');
    const escalations = Object.values(harness.state.notifications).filter(
      (entry) => entry.kind === 'claim.escalated',
    );
    expect(escalations).toHaveLength(1);
    expect(escalations[0].recipientUserId).toBe(SEED_IDS.userOpsReviewer);
    expect(selectOpsQueue(harness.state).some((item) => item.kind === 'escalated')).toBe(true);
  });

  it('escalates only once', () => {
    const { harness, claimId } = claimed();
    harness.ok({ type: 'demo.advanceClock', byMs: 49 * HOUR_MS });
    harness.ok({ type: 'demo.advanceClock', byMs: 24 * HOUR_MS });
    expect(harness.state.claims[claimId].escalatedAt).toBe('2026-09-03T13:00:00+08:00');
    expect(
      Object.values(harness.state.notifications).filter((entry) => entry.kind === 'claim.escalated'),
    ).toHaveLength(1);
  });
});

describe('audit trail', () => {
  it('records the actor, the reason and the before/after of every decision', () => {
    const { harness, submissionId, claimId } = claimed();
    asMerchant(harness);
    harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'reject', reason: 'off brief' });
    const entries = selectAuditFor(harness.state, 'submission', submissionId);
    const decision = entries.find((entry) => entry.action === 'submission.reviewContent');
    expect(decision).toMatchObject({
      actorUserId: SEED_IDS.userDemo,
      role: 'merchant',
      reason: 'off brief',
      before: 'pending',
      after: 'rejected',
    });
    expect(decision?.commandId).toBeTruthy();

    // A failed command writes nothing.
    const auditLength = harness.state.audit.length;
    harness.fail({ type: 'claim.finalizeRejection', claimId, reason: 'nope' }, 'forbidden');
    expect(harness.state.audit).toHaveLength(auditLength);
  });
});
