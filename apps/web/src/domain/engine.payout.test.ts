import { describe, expect, it } from 'vitest';

import { SEED_IDS } from './seed';
import { selectBudget, selectOpsQueue, selectPaymentsForCreator } from './selectors';
import {
  URLS,
  createHarness,
  findSubmissionByUrl,
  latestAttemptOf,
  latestClaim,
  obligationOf,
  type Harness,
} from './test-utils';

/** A confirmed RM5 claim with an open obligation, signed in as finance. */
function confirmed(): { harness: Harness; claimId: string; obligationId: string } {
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
  const claimId = latestClaim(harness.state, submissionId).id;
  harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
  harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'approve', reason: null });
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
  harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null });
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsFinance });
  return { harness, claimId, obligationId: obligationOf(harness.state, claimId).id };
}

describe('payout.start', () => {
  it('is finance-only and leaves the budget in confirmed unpaid', () => {
    const { harness, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    const attempt = latestAttemptOf(harness.state, obligationId);
    expect(attempt).toMatchObject({ status: 'processing', startedBy: SEED_IDS.userOpsFinance });
    expect(attempt.requestKey).toBeTruthy();
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya)).toMatchObject({
      confirmedUnpaidSen: 500,
      paidSen: 0,
    });
    expect(
      Object.values(harness.state.notifications).some((entry) => entry.kind === 'payout.processing'),
    ).toBe(true);
  });

  it('refuses a reviewer and a creator', () => {
    const { harness, obligationId } = confirmed();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.fail({ type: 'payout.start', obligationId }, 'forbidden');
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.fail({ type: 'payout.start', obligationId }, 'forbidden');
  });

  it('refuses a second attempt while one is unresolved', () => {
    const { harness, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    expect(harness.fail({ type: 'payout.start', obligationId }, 'attempt_unresolved').detail).toBe(
      latestAttemptOf(harness.state, obligationId).id,
    );
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'unknown',
    });
    harness.fail({ type: 'payout.start', obligationId }, 'attempt_unresolved');
  });

  it('sends a failed attempt to the retry path instead of a new start', () => {
    const { harness, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'failed',
      reason: 'account number rejected',
    });
    expect(harness.fail({ type: 'payout.start', obligationId }, 'retry_not_allowed').detail).toBe(
      'use_payout_retry',
    );
  });
});

describe('simulated payout outcomes', () => {
  it('paid means funds available in the provider account, bank settlement unknown', () => {
    const { harness, claimId, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'succeeded',
    });

    expect(harness.state.claims[claimId].status).toBe('paid');
    expect(harness.state.obligations[obligationId]).toMatchObject({
      status: 'settled',
      providerAvailableAt: '2026-09-01T12:00:00+08:00',
      bankSettlement: 'unknown', // never inferred from provider success (D05)
    });
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya)).toEqual({
      poolSen: 200_000,
      availableSen: 199_500,
      reservedSen: 0,
      confirmedUnpaidSen: 0,
      paidSen: 500,
    });

    const payments = selectPaymentsForCreator(harness.state, SEED_IDS.userDemo);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      amountSen: 500,
      claimStatus: 'paid',
      bankSettlement: 'unknown',
    });
  });

  it('never pays the same obligation twice', () => {
    const { harness, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    const attemptId = latestAttemptOf(harness.state, obligationId).id;
    harness.ok({ type: 'demo.setPayoutOutcome', attemptId, outcome: 'succeeded' });
    harness.fail({ type: 'payout.start', obligationId }, 'already_settled');
    harness.fail({ type: 'payout.retry', obligationId, reason: 'try again' }, 'already_settled');
    harness.fail({ type: 'demo.setPayoutOutcome', attemptId, outcome: 'succeeded' }, 'invalid_transition');
    expect(harness.state.ledger.filter((entry) => entry.reason === 'payout_settled')).toHaveLength(1);
  });

  it('keeps a failed attempt out of the ledger', () => {
    const { harness, claimId, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'failed',
      reason: 'account number rejected',
    });
    expect(harness.state.claims[claimId].status).toBe('confirmed_unpaid');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).confirmedUnpaidSen).toBe(500);
    expect(latestAttemptOf(harness.state, obligationId).failureReason).toBe('account number rejected');
  });

  it('requires a reason for a simulated failure', () => {
    const { harness, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    harness.fail(
      {
        type: 'demo.setPayoutOutcome',
        attemptId: latestAttemptOf(harness.state, obligationId).id,
        outcome: 'failed',
      },
      'invalid_input',
    );
  });

  it('leaves an unknown result unresolved and visible to finance', () => {
    const { harness, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'unknown',
    });
    const attempt = latestAttemptOf(harness.state, obligationId);
    expect(attempt.status).toBe('unknown');
    expect(attempt.resolvedAt).toBeNull();
    expect(harness.state.obligations[obligationId].status).toBe('open');
    const unknowns = Object.values(harness.state.notifications).filter(
      (entry) => entry.kind === 'payout.unknown',
    );
    expect(unknowns.map((entry) => entry.recipientUserId)).toEqual([SEED_IDS.userOpsFinance]);
    expect(selectOpsQueue(harness.state).some((item) => item.kind === 'payout_unknown')).toBe(true);
  });
});

describe('payout.reconcile', () => {
  function unknownAttempt() {
    const setup = confirmed();
    setup.harness.ok({ type: 'payout.start', obligationId: setup.obligationId });
    const attemptId = latestAttemptOf(setup.harness.state, setup.obligationId).id;
    setup.harness.ok({ type: 'demo.setPayoutOutcome', attemptId, outcome: 'unknown' });
    return { ...setup, attemptId };
  }

  it('only works on the original unknown attempt', () => {
    const { harness, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    const processing = latestAttemptOf(harness.state, obligationId).id;
    harness.fail(
      { type: 'payout.reconcile', attemptId: processing, outcome: 'still_unknown', note: 'checking' },
      'invalid_transition',
    );
  });

  it('records still_unknown without changing the money', () => {
    const { harness, attemptId, obligationId } = unknownAttempt();
    harness.ok({
      type: 'payout.reconcile',
      attemptId,
      outcome: 'still_unknown',
      note: 'provider has not answered',
    });
    const attempt = latestAttemptOf(harness.state, obligationId);
    expect(attempt.status).toBe('unknown');
    expect(attempt.reconciliations).toHaveLength(1);
    expect(attempt.reconciliations[0]).toMatchObject({
      by: SEED_IDS.userOpsFinance,
      outcome: 'still_unknown',
      note: 'provider has not answered',
    });
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).confirmedUnpaidSen).toBe(500);
  });

  it('settles on a confirmed success, exactly once', () => {
    const { harness, attemptId, claimId, obligationId } = unknownAttempt();
    harness.ok({
      type: 'payout.reconcile',
      attemptId,
      outcome: 'confirmed_succeeded',
      note: 'provider statement shows the transfer',
    });
    expect(harness.state.claims[claimId].status).toBe('paid');
    expect(harness.state.obligations[obligationId].status).toBe('settled');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).paidSen).toBe(500);
    expect(harness.state.ledger.filter((entry) => entry.reason === 'payout_settled')).toHaveLength(1);
    harness.fail(
      { type: 'payout.reconcile', attemptId, outcome: 'confirmed_succeeded', note: 'again' },
      'invalid_transition',
    );
  });

  it('marks a confirmed failure, which is the only evidence a retry accepts', () => {
    const { harness, attemptId, obligationId } = unknownAttempt();
    harness.ok({
      type: 'payout.reconcile',
      attemptId,
      outcome: 'confirmed_failed',
      note: 'provider confirms no transfer happened',
    });
    expect(latestAttemptOf(harness.state, obligationId).status).toBe('failed');
    harness.ok({ type: 'payout.retry', obligationId, reason: 'corrected account number' });
    const attempts = Object.values(harness.state.payoutAttempts).filter(
      (attempt) => attempt.obligationId === obligationId,
    );
    expect(attempts).toHaveLength(2);
    const retry = latestAttemptOf(harness.state, obligationId);
    expect(retry.status).toBe('processing');
    expect(retry.requestKey).not.toBe(attemptId);
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).confirmedUnpaidSen).toBe(500);
  });

  it('requires a note', () => {
    const { harness, attemptId } = unknownAttempt();
    harness.fail(
      { type: 'payout.reconcile', attemptId, outcome: 'still_unknown', note: '   ' },
      'invalid_input',
    );
  });
});

describe('payout.retry', () => {
  it('refuses a retry without a confirmed failure', () => {
    const { harness, obligationId } = confirmed();
    expect(
      harness.fail({ type: 'payout.retry', obligationId, reason: 'just in case' }, 'retry_not_allowed')
        .detail,
    ).toBe('no_attempt');
    harness.ok({ type: 'payout.start', obligationId });
    harness.fail({ type: 'payout.retry', obligationId, reason: 'hurry' }, 'attempt_unresolved');
  });

  it('pays at most once across a retry chain', () => {
    const { harness, obligationId } = confirmed();
    harness.ok({ type: 'payout.start', obligationId });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'failed',
      reason: 'wrong account',
    });
    harness.ok({ type: 'payout.retry', obligationId, reason: 'fixed the account' });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'succeeded',
    });
    harness.fail({ type: 'payout.retry', obligationId, reason: 'again' }, 'already_settled');
    expect(selectBudget(harness.state, SEED_IDS.campaignKopiRaya).paidSen).toBe(500);
    expect(harness.state.ledger.filter((entry) => entry.reason === 'payout_settled')).toHaveLength(1);
  });
});
