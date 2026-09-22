import { describe, expect, it } from 'vitest';

import { SEED_IDS } from '@/domain/seed';
import {
  DAY_MS,
  URLS,
  createHarness,
  findSubmissionByUrl,
  latestAttemptOf,
  latestClaim,
  obligationOf,
  type Harness,
} from '@/domain/test-utils';

import { selectUnresolvedPayoutAttempts } from './selectors';

/** Demo User has one confirmed obligation ready for a payout attempt. */
function readyForPayout(): { harness: Harness; obligationId: string } {
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
  return { harness, obligationId: obligationOf(harness.state, claimId).id };
}

describe('selectUnresolvedPayoutAttempts', () => {
  /**
   * The demo tools are the simulated provider, and `demo.setPayoutOutcome` accepts
   * only a `processing` attempt. An attempt that came back unknown is reconciled
   * against the original transaction from the operations payout page ("未知结果先对账，
   * 不能重复付款"), so offering it three buttons the engine refuses would be a dead
   * control on the one state ticket #7 exists to demonstrate.
   */
  it('offers the attempt the provider has not answered yet', () => {
    const { harness, obligationId } = readyForPayout();
    harness.ok({ type: 'payout.start', obligationId });
    const attempt = latestAttemptOf(harness.state, obligationId);
    expect(attempt.status).toBe('processing');
    expect(selectUnresolvedPayoutAttempts(harness.state).map((entry) => entry.id)).toEqual([
      attempt.id,
    ]);
  });

  it('offers nothing once the answer came back unknown', () => {
    const { harness, obligationId } = readyForPayout();
    harness.ok({ type: 'payout.start', obligationId });
    const attemptId = latestAttemptOf(harness.state, obligationId).id;
    harness.ok({ type: 'demo.setPayoutOutcome', attemptId, outcome: 'unknown' });

    expect(harness.state.payoutAttempts[attemptId].status).toBe('unknown');
    expect(selectUnresolvedPayoutAttempts(harness.state)).toEqual([]);
    // And the engine would have refused every one of the three outcomes anyway.
    for (const outcome of ['succeeded', 'failed', 'unknown'] as const) {
      harness.fail(
        { type: 'demo.setPayoutOutcome', attemptId, outcome, reason: 'demo' },
        'invalid_transition',
      );
    }
  });

  it('offers nothing once the attempt succeeded or failed', () => {
    const { harness, obligationId } = readyForPayout();
    harness.ok({ type: 'payout.start', obligationId });
    harness.ok({
      type: 'demo.setPayoutOutcome',
      attemptId: latestAttemptOf(harness.state, obligationId).id,
      outcome: 'failed',
      reason: 'bank rejected the transfer',
    });
    expect(selectUnresolvedPayoutAttempts(harness.state)).toEqual([]);

    harness.ok({ type: 'demo.advanceClock', byMs: DAY_MS });
    harness.ok({ type: 'payout.retry', obligationId, reason: 'details corrected' });
    const retry = latestAttemptOf(harness.state, obligationId);
    expect(selectUnresolvedPayoutAttempts(harness.state).map((entry) => entry.id)).toEqual([
      retry.id,
    ]);
  });
});
