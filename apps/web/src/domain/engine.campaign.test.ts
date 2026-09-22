import { describe, expect, it } from 'vitest';

import { DEFAULT_RULES } from './rules';
import { SEED_IDS } from './seed';
import { selectBudget, selectPublicCampaigns } from './selectors';
import { createHarness, type Harness } from './test-utils';

function merchant(): Harness {
  const harness = createHarness();
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
  harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
  return harness;
}

function draft(harness: Harness, title = 'New Campaign', rules?: Record<string, unknown>): string {
  harness.ok({
    type: 'campaign.createDraft',
    orgId: SEED_IDS.orgKopi,
    title,
    brief: 'brief',
    rules: rules as never,
  });
  const campaign = Object.values(harness.state.campaigns).find((entry) => entry.title === title);
  if (!campaign) throw new Error('draft not created');
  return campaign.id;
}

describe('campaign.createDraft', () => {
  it('applies the approved defaults and starts not ready', () => {
    const harness = merchant();
    const id = draft(harness);
    const campaign = harness.state.campaigns[id];
    expect(campaign.status).toBe('draft');
    expect(campaign.rules).toEqual(DEFAULT_RULES);
    expect(campaign.readiness).toEqual({ fundingEvidence: false, dataSourceReady: false });
    expect(campaign.serviceFee).toBe('pending_config');
    expect(campaign.publishedAt).toBeNull();
    expect(campaign.nextClaimSeq).toBe(1);
    expect(campaign.budgetVersion).toBe(0);
  });

  it('does not share rule arrays between campaigns', () => {
    const harness = merchant();
    const first = draft(harness, 'First');
    const second = draft(harness, 'Second');
    expect(harness.state.campaigns[first].rules.platforms).not.toBe(
      harness.state.campaigns[second].rules.platforms,
    );
  });

  it('rejects impossible rule values', () => {
    const harness = merchant();
    harness.fail(
      {
        type: 'campaign.createDraft',
        orgId: SEED_IDS.orgKopi,
        title: 'Bad',
        brief: '',
        rules: { poolSen: 10.5 },
      },
      'invalid_input',
    );
    harness.fail(
      {
        type: 'campaign.createDraft',
        orgId: SEED_IDS.orgKopi,
        title: 'Bad',
        brief: '',
        rules: { meteringDays: 0 },
      },
      'invalid_input',
    );
    harness.fail(
      {
        type: 'campaign.createDraft',
        orgId: SEED_IDS.orgKopi,
        title: 'Bad',
        brief: '',
        rules: { platforms: [] },
      },
      'invalid_input',
    );
    harness.fail(
      { type: 'campaign.createDraft', orgId: SEED_IDS.orgKopi, title: '  ', brief: '' },
      'invalid_input',
    );
  });
});

describe('campaign.updateDraft', () => {
  it('edits a draft', () => {
    const harness = merchant();
    const id = draft(harness);
    harness.ok({
      type: 'campaign.updateDraft',
      campaignId: id,
      patch: { title: 'Renamed', rules: { ratePerThousandSen: 700 } },
    });
    expect(harness.state.campaigns[id].title).toBe('Renamed');
    expect(harness.state.campaigns[id].rules.ratePerThousandSen).toBe(700);
  });

  it('refuses to change published rules (immutable in M1)', () => {
    const harness = merchant();
    harness.fail(
      {
        type: 'campaign.updateDraft',
        campaignId: SEED_IDS.campaignKopiRaya,
        patch: { rules: { poolSen: 1 } },
      },
      'invalid_transition',
    );
  });
});

describe('campaign.publish', () => {
  it('blocks publication while readiness is missing and names what is missing', () => {
    const harness = merchant();
    const id = draft(harness);
    const failure = harness.fail({ type: 'campaign.publish', campaignId: id }, 'campaign_not_ready');
    expect(failure.detail).toBe('funding_evidence,data_source');

    harness.ok({ type: 'demo.setReadiness', campaignId: id, fundingEvidence: true });
    const second = harness.fail({ type: 'campaign.publish', campaignId: id }, 'campaign_not_ready');
    expect(second.detail).toBe('data_source');
  });

  it('blocks a minimum claim above the cap', () => {
    const harness = merchant();
    const id = draft(harness, 'Min above cap', { minClaimSen: 20_000, capPerSubmissionSen: 10_000 });
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: id,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    harness.fail({ type: 'campaign.publish', campaignId: id }, 'min_claim_above_cap');
  });

  it('accepts a high view threshold with a low cap', () => {
    // campaign-defaults-v1.md: 100,000 views × RM5/1,000 = RM500 capped to RM100 is a
    // valid configuration that must be explained, not called unreachable.
    const harness = merchant();
    const id = draft(harness, 'High threshold', { viewThreshold: 100_000 });
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: id,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    harness.ok({ type: 'campaign.publish', campaignId: id });
    expect(harness.state.campaigns[id].status).toBe('published');
    expect(harness.state.campaigns[id].rules.viewThreshold).toBe(100_000);
  });

  it('requires a positive pool, a positive rate and at least one platform', () => {
    const harness = merchant();
    const zeroPool = draft(harness, 'Zero pool', { poolSen: 0 });
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: zeroPool,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    expect(harness.fail({ type: 'campaign.publish', campaignId: zeroPool }, 'invalid_input').detail).toBe(
      'pool_must_be_positive',
    );

    const zeroRate = draft(harness, 'Zero rate', { ratePerThousandSen: 0 });
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: zeroRate,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    expect(harness.fail({ type: 'campaign.publish', campaignId: zeroRate }, 'invalid_input').detail).toBe(
      'rate_must_be_positive',
    );
  });

  it('opens submissions for the published window and starts the pool available', () => {
    const harness = merchant();
    const id = draft(harness, 'Ready');
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: id,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    harness.ok({ type: 'campaign.publish', campaignId: id });
    const campaign = harness.state.campaigns[id];
    expect(campaign.publishedAt).toBe('2026-09-01T12:00:00+08:00');
    expect(campaign.submissionsCloseAt).toBe('2026-09-15T12:00:00+08:00');
    expect(selectBudget(harness.state, id)).toEqual({
      poolSen: 200_000,
      availableSen: 200_000,
      reservedSen: 0,
      confirmedUnpaidSen: 0,
      paidSen: 0,
    });
    expect(selectPublicCampaigns(harness.state).map((entry) => entry.id)).toContain(id);
  });

  it('never publishes the same campaign twice', () => {
    const harness = merchant();
    const id = draft(harness, 'Once');
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: id,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    harness.ok({ type: 'campaign.publish', campaignId: id }, 'publish-once');
    // Same intent replayed: idempotent, no second campaign and no second event.
    const replay = harness.apply({ type: 'campaign.publish', campaignId: id }, 'publish-once');
    expect(replay.ok && replay.outcome).toBe('idempotent_replay');
    // A genuinely new command is an invalid transition.
    harness.fail({ type: 'campaign.publish', campaignId: id }, 'invalid_transition');
    expect(Object.values(harness.state.campaigns).filter((entry) => entry.title === 'Once')).toHaveLength(1);
  });

  it('keeps drafts out of the public catalogue', () => {
    const harness = merchant();
    expect(selectPublicCampaigns(harness.state).map((entry) => entry.id)).not.toContain(
      SEED_IDS.campaignKopiDraft,
    );
  });
});

describe('campaign lifecycle', () => {
  it('pauses and resumes without touching the rules or the budget', () => {
    const harness = merchant();
    const before = harness.state.campaigns[SEED_IDS.campaignKopiRaya].rules;
    harness.ok({ type: 'campaign.pause', campaignId: SEED_IDS.campaignKopiRaya });
    expect(harness.state.campaigns[SEED_IDS.campaignKopiRaya].status).toBe('paused');
    expect(harness.state.campaigns[SEED_IDS.campaignKopiRaya].rules).toEqual(before);
    harness.ok({ type: 'campaign.resume', campaignId: SEED_IDS.campaignKopiRaya });
    expect(harness.state.campaigns[SEED_IDS.campaignKopiRaya].status).toBe('published');
  });

  it('closes submissions at the current simulated time', () => {
    const harness = merchant();
    harness.ok({ ...{ type: 'campaign.closeSubmissions', campaignId: SEED_IDS.campaignKopiRaya }, reason: 'Intake target met.' });
    const campaign = harness.state.campaigns[SEED_IDS.campaignKopiRaya];
    expect(campaign.status).toBe('submissions_closed');
    expect(campaign.submissionsCloseAt).toBe('2026-09-01T12:00:00+08:00');
  });

  it('closes the campaign and records when', () => {
    const harness = merchant();
    harness.ok({ ...{ type: 'campaign.close', campaignId: SEED_IDS.campaignKopiRaya }, reason: 'Campaign period finished.' });
    expect(harness.state.campaigns[SEED_IDS.campaignKopiRaya].status).toBe('closed');
    expect(harness.state.campaigns[SEED_IDS.campaignKopiRaya].closedAt).toBe('2026-09-01T12:00:00+08:00');
    harness.fail({ ...{ type: 'campaign.close', campaignId: SEED_IDS.campaignKopiRaya }, reason: 'Again.' }, 'invalid_transition');
  });

  // Both closes end something a creator is relying on, so the reason is part of
  // the command and is stored where the campaign's history can render it.
  it('refuses a close without a reason and stores the one it is given', () => {
    const harness = merchant();
    harness.fail({ ...{ type: 'campaign.closeSubmissions', campaignId: SEED_IDS.campaignKopiRaya }, reason: '   ' }, 'invalid_input');
    harness.fail({ ...{ type: 'campaign.close', campaignId: SEED_IDS.campaignKopiRaya }, reason: '' }, 'invalid_input');
    expect(harness.state.campaigns[SEED_IDS.campaignKopiRaya].status).toBe('published');

    harness.ok({ ...{ type: 'campaign.closeSubmissions', campaignId: SEED_IDS.campaignKopiRaya }, reason: '  Intake target met.  ' });
    harness.ok({ ...{ type: 'campaign.close', campaignId: SEED_IDS.campaignKopiRaya }, reason: 'Budget committed elsewhere.' });

    const reasons = harness.state.audit
      .filter((entry) => entry.action.startsWith('campaign.close'))
      .map((entry) => [entry.action, entry.reason]);
    expect(reasons).toEqual([
      ['campaign.closeSubmissions', 'Intake target met.'],
      ['campaign.close', 'Budget committed elsewhere.'],
    ]);
  });
});
