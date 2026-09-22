import { describe, expect, it } from 'vitest';

import { can, resolveActor } from './permissions';
import { createSeedState, SEED_IDS } from './seed';
import { selectPermissions } from './selectors';
import { createHarness } from './test-utils';
import type { Command, DemoState } from './types';

function signedIn(userId: string, workspace: 'creator' | 'merchant' = 'creator'): DemoState {
  const harness = createHarness();
  harness.ok({ type: 'session.signIn', userId });
  if (workspace === 'merchant') harness.ok({ type: 'session.switchWorkspace', workspace });
  return harness.state;
}

const CLAIM: Command = { type: 'claim.request', submissionId: SEED_IDS.submissionBenFit };
const PUBLISH: Command = { type: 'campaign.publish', campaignId: SEED_IDS.campaignKopiDraft };
const REVIEW_METERING: Command = {
  type: 'claim.reviewMetering',
  claimId: 'cl_000001',
  decision: 'approve',
  reason: null,
};
const PAYOUT: Command = { type: 'payout.start', obligationId: 'obl_000001' };

describe('resolveActor', () => {
  it('treats a signed-out visitor as a guest', () => {
    expect(resolveActor(createSeedState())).toEqual({ userId: '', role: 'guest', orgId: null });
  });

  it('resolves the merchant org from the membership', () => {
    expect(resolveActor(signedIn(SEED_IDS.userDemo, 'merchant'))).toEqual({
      userId: SEED_IDS.userDemo,
      role: 'merchant',
      orgId: SEED_IDS.orgKopi,
    });
  });

  it('grants an ops role only to a user carrying that capability', () => {
    expect(resolveActor(signedIn(SEED_IDS.userOpsReviewer)).role).toBe('ops_reviewer');
    expect(resolveActor(signedIn(SEED_IDS.userOpsFinance)).role).toBe('ops_finance');
    // Forcing the session flag without the capability does not grant the role.
    const forced = createSeedState();
    forced.session.userId = SEED_IDS.userDemo;
    forced.session.opsRole = 'ops_finance';
    expect(resolveActor(forced).role).toBe('creator');
  });
});

describe('can', () => {
  it('lets a guest only sign in, set the locale and dismiss the prompt', () => {
    const state = createSeedState();
    const guest = resolveActor(state);
    expect(can(guest, { type: 'session.signIn', userId: SEED_IDS.userDemo }, state)).toBe(true);
    expect(can(guest, { type: 'session.setLocale', locale: 'ms-MY', explicit: true }, state)).toBe(true);
    expect(can(guest, { type: 'session.dismissLocalePrompt' }, state)).toBe(true);
    expect(can(guest, CLAIM, state)).toBe(false);
    expect(can(guest, PUBLISH, state)).toBe(false);
    // Demo tools stay available: they are an explicitly simulated panel.
    expect(can(guest, { type: 'demo.advanceClock', byMs: 1000 }, state)).toBe(true);
  });

  it('separates creator, merchant, reviewer and finance capabilities', () => {
    const creator = signedIn(SEED_IDS.userDemo);
    const merchant = signedIn(SEED_IDS.userDemo, 'merchant');
    const reviewer = signedIn(SEED_IDS.userOpsReviewer);
    const finance = signedIn(SEED_IDS.userOpsFinance);

    expect(can(resolveActor(creator), CLAIM, creator)).toBe(true);
    expect(can(resolveActor(creator), PUBLISH, creator)).toBe(false);
    expect(can(resolveActor(merchant), PUBLISH, merchant)).toBe(true);
    expect(can(resolveActor(merchant), CLAIM, merchant)).toBe(false);

    expect(can(resolveActor(reviewer), REVIEW_METERING, reviewer)).toBe(true);
    // Finance is not a reviewer and a reviewer is not finance.
    expect(can(resolveActor(reviewer), PAYOUT, reviewer)).toBe(false);
    expect(can(resolveActor(finance), PAYOUT, finance)).toBe(true);
    expect(can(resolveActor(finance), REVIEW_METERING, finance)).toBe(false);
  });

  it('refuses a merchant command for another org', () => {
    const merchant = signedIn(SEED_IDS.userDemo, 'merchant');
    const otherOrgCampaign: Command = {
      type: 'campaign.pause',
      campaignId: SEED_IDS.campaignOtherFit,
    };
    expect(can(resolveActor(merchant), otherOrgCampaign, merchant)).toBe(false);
  });
});

describe('selectPermissions', () => {
  it('reports guest flags', () => {
    const flags = selectPermissions(createSeedState());
    expect(flags.isSignedIn).toBe(false);
    expect(flags.canRequestClaim).toBe(false);
    expect(flags.canCreateCampaign).toBe(false);
    expect(flags.canUseDemoTools).toBe(true);
  });

  it('reports the creator and merchant surfaces for the same user', () => {
    const creator = selectPermissions(signedIn(SEED_IDS.userDemo));
    expect(creator.canSubmit).toBe(true);
    expect(creator.canCreateCampaign).toBe(false);
    expect(creator.canSwitchToMerchant).toBe(true);

    const merchant = selectPermissions(signedIn(SEED_IDS.userDemo, 'merchant'));
    expect(merchant.canCreateCampaign).toBe(true);
    expect(merchant.canReviewContent).toBe(true);
    expect(merchant.canSubmit).toBe(false);
  });

  it('reports the two ops surfaces separately', () => {
    const reviewer = selectPermissions(signedIn(SEED_IDS.userOpsReviewer));
    expect(reviewer.canReviewMetering).toBe(true);
    expect(reviewer.canResolveAppeal).toBe(true);
    expect(reviewer.canStartPayout).toBe(false);

    const finance = selectPermissions(signedIn(SEED_IDS.userOpsFinance));
    expect(finance.canStartPayout).toBe(true);
    expect(finance.canReconcilePayout).toBe(true);
    expect(finance.canRetryPayout).toBe(true);
    expect(finance.canReviewMetering).toBe(false);
  });
});
