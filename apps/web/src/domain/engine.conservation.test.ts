import { describe, expect, it } from 'vitest';

import { applyCommand } from './engine';
import { cappedRewardSen } from './money';
import { OCCUPYING_STATUSES, budgetOf, claimsForSubmission, qualifiedViewsOf } from './rules';
import { SEED_IDS, createSeedState } from './seed';
import type { Command, DemoState } from './types';

/** Deterministic PRNG: the engine itself never uses randomness. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const USERS = [
  SEED_IDS.userDemo,
  SEED_IDS.userBen,
  SEED_IDS.userOpsReviewer,
  SEED_IDS.userOpsFinance,
];

const URL_POOL = [
  'https://www.tiktok.com/@demouser/video/7400000000000000001',
  'https://www.tiktok.com/@demouser/video/7400000000000000002',
  'https://www.tiktok.com/@bentan/video/7400000000000000101',
  'https://www.tiktok.com/@bentan/video/7400000000000000102',
  'https://www.youtube.com/watch?v=randomWalk01',
  'https://www.instagram.com/reel/randomWalk02/',
];

/** Builds one plausible command for the current state. */
function nextCommand(state: DemoState, random: () => number): Command {
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
  const submissions = Object.values(state.submissions);
  const claims = Object.values(state.claims);
  const roll = random();

  if (roll < 0.08) return { type: 'session.signIn', userId: pick(USERS) };
  if (roll < 0.12) return { type: 'session.switchWorkspace', workspace: pick(['creator', 'merchant']) };
  if (roll < 0.2) return { type: 'demo.advanceClock', byMs: Math.ceil(random() * 40) * 60 * 60 * 1000 };
  if (roll < 0.3 && submissions.length > 0) {
    return {
      type: 'demo.addQualifiedViews',
      submissionId: pick(submissions).id,
      views: Math.ceil(random() * 8000),
    };
  }
  if (roll < 0.34 && submissions.length > 0) {
    return { type: 'demo.setDataOutage', submissionId: pick(submissions).id, outage: random() < 0.5 };
  }
  if (roll < 0.42) {
    const campaign = pick(Object.values(state.campaigns));
    const connection = pick(Object.values(state.connections));
    return {
      type: 'submission.create',
      campaignId: campaign.id,
      connectionId: connection.id,
      url: pick(URL_POOL),
    };
  }
  if (roll < 0.52 && submissions.length > 0) {
    return { type: 'claim.request', submissionId: pick(submissions).id };
  }
  if (roll < 0.56) {
    const offers = Object.values(state.partialOffers).filter((offer) => offer.status === 'open');
    if (offers.length > 0) {
      const offer = pick(offers);
      return {
        type: 'claim.consentPartial',
        offerId: offer.id,
        consentedSen: offer.offeredSen,
        snapshotVersion: offer.snapshotVersion,
        budgetVersion: offer.budgetVersion,
      };
    }
  }
  if (roll < 0.6) {
    const entries = Object.values(state.waitlist).filter(
      (entry) => entry.status === 'waiting' || entry.status === 'notified',
    );
    if (entries.length > 0) return { type: 'waitlist.resubmit', entryId: pick(entries).id };
  }
  if (roll < 0.68 && submissions.length > 0) {
    return {
      type: 'submission.reviewContent',
      submissionId: pick(submissions).id,
      decision: random() < 0.6 ? 'approve' : 'reject',
      reason: 'random walk reason',
    };
  }
  if (roll < 0.78 && claims.length > 0) {
    return {
      type: 'claim.reviewMetering',
      claimId: pick(claims).id,
      decision: pick(['approve', 'hold', 'reject']),
      reason: 'random walk reason',
    };
  }
  if (roll < 0.82 && claims.length > 0) {
    return { type: 'appeal.file', claimId: pick(claims).id, reason: 'random walk appeal' };
  }
  if (roll < 0.86) {
    const appeals = Object.values(state.appeals);
    if (appeals.length > 0) {
      return {
        type: 'appeal.resolve',
        appealId: pick(appeals).id,
        decision: random() < 0.5 ? 'uphold' : 'reject',
        note: 'random walk note',
      };
    }
  }
  if (roll < 0.9 && claims.length > 0) {
    return { type: 'claim.finalizeRejection', claimId: pick(claims).id, reason: 'random walk release' };
  }
  if (roll < 0.95) {
    const obligations = Object.values(state.obligations);
    if (obligations.length > 0) {
      const obligation = pick(obligations);
      return random() < 0.7
        ? { type: 'payout.start', obligationId: obligation.id }
        : { type: 'payout.retry', obligationId: obligation.id, reason: 'random walk retry' };
    }
  }
  const attempts = Object.values(state.payoutAttempts);
  if (attempts.length > 0) {
    const attempt = pick(attempts);
    return random() < 0.6
      ? {
          type: 'demo.setPayoutOutcome',
          attemptId: attempt.id,
          outcome: pick(['succeeded', 'failed', 'unknown']),
          reason: 'random walk outcome',
        }
      : {
          type: 'payout.reconcile',
          attemptId: attempt.id,
          outcome: pick(['still_unknown', 'confirmed_succeeded', 'confirmed_failed']),
          note: 'random walk reconciliation',
        };
  }
  return { type: 'demo.advanceClock', byMs: 60 * 60 * 1000 };
}

/** Invariants that must hold after every command, successful or refused. */
function checkInvariants(state: DemoState, step: number): void {
  for (const campaign of Object.values(state.campaigns)) {
    const budget = budgetOf(state, campaign.id);
    const sum =
      budget.availableSen + budget.reservedSen + budget.confirmedUnpaidSen + budget.paidSen;
    expect(sum, `step ${step}: buckets must sum to the pool for ${campaign.id}`).toBe(
      campaign.rules.poolSen,
    );
    for (const [bucket, value] of Object.entries(budget)) {
      expect(value, `step ${step}: ${bucket} must not be negative for ${campaign.id}`).toBeGreaterThanOrEqual(
        0,
      );
    }
  }

  for (const claim of Object.values(state.claims)) {
    const campaign = state.campaigns[claim.campaignId];
    expect(claim.amountSen, `step ${step}: claim ${claim.id} above the cap`).toBeLessThanOrEqual(
      campaign.rules.capPerSubmissionSen,
    );
    expect(claim.amountSen, `step ${step}: claim ${claim.id} not positive`).toBeGreaterThan(0);
  }

  for (const submission of Object.values(state.submissions)) {
    const campaign = state.campaigns[submission.campaignId];
    const occupied = claimsForSubmission(state, submission.id)
      .filter((claim) => OCCUPYING_STATUSES.includes(claim.status))
      .reduce((total, claim) => total + claim.amountSen, 0);
    expect(occupied, `step ${step}: submission ${submission.id} above the cap`).toBeLessThanOrEqual(
      campaign.rules.capPerSubmissionSen,
    );
    const views = qualifiedViewsOf(submission);
    if (views !== null) {
      expect(
        occupied,
        `step ${step}: submission ${submission.id} claims more than its metered reward`,
      ).toBeLessThanOrEqual(cappedRewardSen(views, campaign.rules));
    }
    // One open case per submission at most.
    const open = claimsForSubmission(state, submission.id).filter(
      (claim) =>
        claim.status === 'pending_review' ||
        claim.status === 'appealing' ||
        claim.status === 'rejected_appealable',
    );
    expect(open.length, `step ${step}: submission ${submission.id} has two open cases`).toBeLessThanOrEqual(
      1,
    );
  }

  // Money is only ever paid once per obligation.
  for (const obligation of Object.values(state.obligations)) {
    const settlements = state.ledger.filter(
      (entry) => entry.claimId === obligation.claimId && entry.reason === 'payout_settled',
    );
    expect(settlements.length, `step ${step}: obligation ${obligation.id} settled twice`).toBeLessThanOrEqual(
      1,
    );
  }
}

/** Every walk starts from a real reservation so the money paths are always exercised. */
const PROLOGUE: Command[] = [
  { type: 'session.signIn', userId: SEED_IDS.userDemo },
  {
    type: 'submission.create',
    campaignId: SEED_IDS.campaignKopiRaya,
    connectionId: SEED_IDS.connectionDemoTiktok,
    url: URL_POOL[0],
  },
  { type: 'demo.addQualifiedViews', submissionId: '', views: 4000 },
  { type: 'claim.request', submissionId: '' },
];

function runPrologue(initial: DemoState): DemoState {
  let state = initial;
  PROLOGUE.forEach((command, index) => {
    let resolved = command;
    if (command.type === 'demo.addQualifiedViews' || command.type === 'claim.request') {
      const submission = Object.values(state.submissions).find(
        (entry) => entry.url === URL_POOL[0],
      );
      if (!submission) throw new Error('prologue submission missing');
      resolved = { ...command, submissionId: submission.id };
    }
    const result = applyCommand(state, resolved, { commandId: `prologue-${index}` });
    if (!result.ok) throw new Error(`prologue step ${index} failed: ${result.code}`);
    state = result.state;
  });
  return state;
}

describe('conservation under random valid command sequences', () => {
  it.each([1, 7, 13, 42, 99])('holds for seed %i', (seed) => {
    const random = mulberry32(seed);
    let state = runPrologue(createSeedState());
    checkInvariants(state, -1);
    for (let step = 0; step < 240; step += 1) {
      const command = nextCommand(state, random);
      const result = applyCommand(state, command, { commandId: `walk-${seed}-${step}` });
      state = result.state; // failures return the unchanged state
      checkInvariants(state, step);
    }
    // The walk must actually have exercised the money paths.
    expect(state.ledger.length).toBeGreaterThan(0);
  });
});
