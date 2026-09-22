import { describe, expect, it } from 'vitest';

import { applyCommand } from './engine';
import { effectiveClaimDeadlineAt, qualifiedViewsOf } from './rules';
import { SCENARIO_IDS, loadScenario } from './scenarios';
import { SEED_IDS, createSeedState } from './seed';
import {
  selectBudget,
  selectCampaignClosure,
  selectSubmissionReward,
  selectSubmissionsForCreator,
} from './selectors';
import type { Claim, DemoState, PartialOffer, ScenarioId, Submission, WaitlistEntry } from './types';

function load(scenarioId: ScenarioId): DemoState {
  return loadScenario(scenarioId);
}

function demoSubmissions(state: DemoState): Submission[] {
  return selectSubmissionsForCreator(state, SEED_IDS.userDemo);
}

function demoSubmission(state: DemoState): Submission {
  const submissions = demoSubmissions(state);
  const submission = submissions[submissions.length - 1];
  if (!submission) throw new Error('no submission for the demo user');
  return submission;
}

function claimsOf(state: DemoState, submissionId: string): Claim[] {
  return Object.values(state.claims)
    .filter((claim) => claim.submissionId === submissionId)
    .sort((a, b) => a.seq - b.seq);
}

describe('every scenario', () => {
  it.each(SCENARIO_IDS)('loads %s from the seed without error', (scenarioId) => {
    const state = load(scenarioId);
    expect(state.scenario).toBe(scenarioId);
    // Every scenario ends signed in as the demo user, in the relevant workspace.
    expect(state.session.userId).toBe(SEED_IDS.userDemo);
    expect(state.session.opsRole).toBeNull();
    // Buckets stay conserved in every scenario.
    for (const campaign of Object.values(state.campaigns)) {
      const budget = selectBudget(state, campaign.id);
      expect(
        budget.availableSen + budget.reservedSen + budget.confirmedUnpaidSen + budget.paidSen,
      ).toBe(campaign.rules.poolSen);
    }
  });

  it.each(SCENARIO_IDS)('is reproducible: %s replays to the same records', (scenarioId) => {
    const first = load(scenarioId);
    const second = load(scenarioId);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('is reachable through demo.loadScenario after a reset', () => {
    const start = createSeedState();
    const reset = applyCommand(start, { type: 'demo.reset' }, { commandId: 'r1' });
    expect(reset.ok).toBe(true);
    const loaded = applyCommand(
      reset.state,
      { type: 'demo.loadScenario', scenarioId: 'partial_budget' },
      { commandId: 'r2' },
    );
    expect(loaded.ok).toBe(true);
    expect(loaded.state.scenario).toBe('partial_budget');
    expect(Object.values(loaded.state.partialOffers)).toHaveLength(1);
    // Loading twice from the same state gives the same records again.
    const again = applyCommand(
      loaded.state,
      { type: 'demo.loadScenario', scenarioId: 'partial_budget' },
      { commandId: 'r3' },
    );
    expect(again.ok).toBe(true);
    expect(Object.values(again.state.partialOffers)).toHaveLength(1);
  });

  it('keeps the visitor language across a scenario load', () => {
    const start = createSeedState();
    const localed = applyCommand(
      start,
      { type: 'session.setLocale', locale: 'ms-MY', explicit: true },
      { commandId: 'l1' },
    );
    const loaded = applyCommand(
      localed.state,
      { type: 'demo.loadScenario', scenarioId: 'main_flow_ready' },
      { commandId: 'l2' },
    );
    expect(loaded.state.session.locale).toBe('ms-MY');
    expect(loaded.state.session.localePromptDone).toBe(true);
  });
});

describe('scenario end states', () => {
  it('baseline is the seed with the demo user signed in', () => {
    const state = load('baseline');
    expect(demoSubmissions(state)).toHaveLength(0);
    expect(Object.keys(state.claims)).toHaveLength(0);
    expect(state.session.workspace).toBe('creator');
  });

  it('main_flow_ready has one metering submission with 1,000 qualified views', () => {
    const state = load('main_flow_ready');
    const submission = demoSubmission(state);
    expect(submission.status).toBe('metering');
    expect(qualifiedViewsOf(submission)).toBe(1000);
    const reward = selectSubmissionReward(state, submission.id);
    expect(reward).toMatchObject({ claimableSen: 500, canClaim: true, capReached: false });
  });

  it('partial_budget offers RM50 of an RM60 claim', () => {
    const state = load('partial_budget');
    const submission = demoSubmission(state);
    const offers = Object.values(state.partialOffers) as PartialOffer[];
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      submissionId: submission.id,
      fullSen: 6000,
      offeredSen: 5000,
      status: 'open',
    });
    // Nothing is reserved before the creator consents.
    expect(selectBudget(state, offers[0].campaignId)).toMatchObject({
      availableSen: 5000,
      reservedSen: 0,
    });
  });

  it('waitlist leaves the demo user waiting with no reservation', () => {
    const state = load('waitlist');
    const submission = demoSubmission(state);
    const entries = Object.values(state.waitlist) as WaitlistEntry[];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      submissionId: submission.id,
      creatorId: SEED_IDS.userDemo,
      status: 'waiting',
      claimableSenAtEntry: 500,
      notifiedAt: null,
    });
    expect(selectBudget(state, entries[0].campaignId)).toMatchObject({
      availableSen: 400,
      reservedSen: 500, // Ben's claim
    });
  });

  it('rejection_appeal leaves a rejected claim with an open appeal window', () => {
    const state = load('rejection_appeal');
    const submission = demoSubmission(state);
    const claim = claimsOf(state, submission.id)[0];
    expect(claim.status).toBe('rejected_appealable');
    expect(claim.rejection).toMatchObject({
      source: 'metering',
      appealDeadlineAt: '2026-09-08T12:00:00+08:00',
    });
    // The reservation is still held.
    expect(selectBudget(state, claim.campaignId).reservedSen).toBe(500);
    expect(Object.keys(state.appeals)).toHaveLength(0);
  });

  it('payout_unknown leaves one unresolved attempt and no way to pay again', () => {
    const state = load('payout_unknown');
    const attempts = Object.values(state.payoutAttempts);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ status: 'unknown', resolvedAt: null });
    const obligation = state.obligations[attempts[0].obligationId];
    expect(obligation.status).toBe('open');
    expect(selectBudget(state, obligation.campaignId)).toMatchObject({
      confirmedUnpaidSen: 500,
      paidSen: 0,
    });
  });

  it('payout_failed leaves a confirmed failure that a retry may act on', () => {
    const state = load('payout_failed');
    const attempts = Object.values(state.payoutAttempts);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('failed');
    expect(attempts[0].failureReason).toBeTruthy();
    const obligation = state.obligations[attempts[0].obligationId];
    expect(obligation.status).toBe('open');
    expect(selectBudget(state, obligation.campaignId).confirmedUnpaidSen).toBe(500);
  });

  it('deadline_extension grants the published grace from the recovery time', () => {
    const state = load('deadline_extension');
    const submission = demoSubmission(state);
    expect(state.clock.nowIso).toBe('2026-09-09T12:00:00+08:00');
    expect(submission.extensions).toHaveLength(1);
    expect(submission.extensions[0]).toMatchObject({
      reason: 'data_outage',
      newDeadlineAt: '2026-09-16T12:00:00+08:00',
    });
    expect(effectiveClaimDeadlineAt(submission)).toBe('2026-09-16T12:00:00+08:00');
    expect(submission.meteringEndsAt).toBe('2026-09-08T12:00:00+08:00');
    expect(qualifiedViewsOf(submission)).toBe(1000);
  });

  it('campaign_closure cannot show fully settled', () => {
    const state = load('campaign_closure');
    expect(state.session.workspace).toBe('merchant');
    const campaign = Object.values(state.campaigns).find(
      (entry) => entry.title === 'Kopi Kita Closure Demo',
    );
    if (!campaign) throw new Error('closure campaign missing');
    expect(campaign.status).toBe('closed');
    const closure = selectCampaignClosure(state, campaign.id);
    expect(closure).toMatchObject({
      openAppeals: 1,
      confirmedUnpaidClaims: 1,
      canShowFullySettled: false,
      unconfirmedTailSen: 250,
      refundStatus: 'pending_verification',
    });
  });

  it('data_outage keeps the last trusted value and its time', () => {
    const state = load('data_outage');
    const submission = demoSubmission(state);
    expect(submission.status).toBe('data_unavailable');
    expect(submission.dataOutage).toBe(true);
    const reward = selectSubmissionReward(state, submission.id);
    expect(reward).toMatchObject({
      qualifiedViews: 1000,
      dataStatus: 'unavailable',
      lastTrustedAt: '2026-09-01T12:00:00+08:00',
    });
    // The failed read is recorded, not treated as zero views or as fraud.
    expect(submission.snapshots.at(-1)).toMatchObject({
      trusted: false,
      missingReason: 'source_unreachable',
      qualifiedViewsInWindow: null,
    });
  });
});

describe('scenario replay failures', () => {
  it('names the failing step', () => {
    expect(() => loadScenario('not_a_scenario' as ScenarioId)).toThrow(/unknown scenario/);
  });
});
