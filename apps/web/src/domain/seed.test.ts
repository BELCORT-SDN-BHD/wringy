import { describe, expect, it } from 'vitest';

import { DEFAULT_RULES } from './rules';
import { SEED_CLOCK_ISO, SEED_IDS, createSeedState } from './seed';
import { selectNotificationsFor, selectPublicCampaigns, selectSubmissionsForCreator } from './selectors';
import { SCHEMA_VERSION } from './types';

describe('createSeedState', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(createSeedState())).toBe(JSON.stringify(createSeedState()));
  });

  it('starts at the base clock, signed out, with the prompt unanswered', () => {
    const state = createSeedState();
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.clock).toEqual({ nowIso: SEED_CLOCK_ISO, seq: 0 });
    expect(state.clock.nowIso).toBe('2026-09-01T12:00:00+08:00');
    expect(state.session).toEqual({
      userId: null,
      workspace: 'creator',
      opsRole: null,
      locale: 'en-MY',
      localePromptDone: false,
      localeExplicit: false,
    });
    expect(state.scenario).toBe('baseline');
    expect(state.ledger).toHaveLength(0);
    expect(state.audit).toHaveLength(0);
    expect(state.processedCommands).toEqual({});
  });

  it('has the four demo users with separate ops capabilities', () => {
    const { users } = createSeedState();
    expect(Object.keys(users).sort()).toEqual([
      SEED_IDS.userBen,
      SEED_IDS.userDemo,
      SEED_IDS.userOpsFinance,
      SEED_IDS.userOpsReviewer,
    ]);
    expect(users[SEED_IDS.userDemo]).toMatchObject({
      displayName: 'Demo User',
      orgIds: [SEED_IDS.orgKopi],
      opsCapability: null,
    });
    expect(users[SEED_IDS.userBen].orgIds).toEqual([]);
    expect(users[SEED_IDS.userOpsReviewer].opsCapability).toBe('ops_reviewer');
    expect(users[SEED_IDS.userOpsFinance].opsCapability).toBe('ops_finance');
  });

  it('has two orgs and three campaigns, two published and one draft', () => {
    const state = createSeedState();
    expect(Object.keys(state.orgs).sort()).toEqual([SEED_IDS.orgKopi, SEED_IDS.orgOther]);
    expect(state.campaigns[SEED_IDS.campaignKopiRaya]).toMatchObject({
      orgId: SEED_IDS.orgKopi,
      status: 'published',
      publishedAt: SEED_CLOCK_ISO,
      submissionsCloseAt: '2026-09-15T12:00:00+08:00',
      rulesVersion: 1,
      budgetVersion: 0,
      nextClaimSeq: 1,
      serviceFee: 'pending_config',
    });
    expect(state.campaigns[SEED_IDS.campaignKopiRaya].rules).toEqual(DEFAULT_RULES);
    expect(state.campaigns[SEED_IDS.campaignOtherFit].orgId).toBe(SEED_IDS.orgOther);
    expect(state.campaigns[SEED_IDS.campaignKopiDraft]).toMatchObject({
      status: 'draft',
      publishedAt: null,
      readiness: { fundingEvidence: false, dataSourceReady: false },
    });
    expect(selectPublicCampaigns(state).map((entry) => entry.id)).toEqual([
      SEED_IDS.campaignKopiRaya,
      SEED_IDS.campaignOtherFit,
    ]);
  });

  it('has a valid and an invalid connection for the demo user', () => {
    const { connections } = createSeedState();
    expect(connections[SEED_IDS.connectionDemoTiktok]).toMatchObject({
      platform: 'tiktok',
      status: 'valid',
      invalidReason: null,
    });
    expect(connections[SEED_IDS.connectionDemoInstagram]).toMatchObject({
      platform: 'instagram',
      status: 'invalid',
      invalidReason: 'token_expired',
    });
    expect(connections[SEED_IDS.connectionBenTiktok]).toMatchObject({
      userId: SEED_IDS.userBen,
      status: 'valid',
    });
  });

  it('gives Ben one metering submission in the other org and the demo user none', () => {
    const state = createSeedState();
    expect(selectSubmissionsForCreator(state, SEED_IDS.userDemo)).toHaveLength(0);
    const ben = selectSubmissionsForCreator(state, SEED_IDS.userBen);
    expect(ben).toHaveLength(1);
    expect(ben[0]).toMatchObject({
      id: SEED_IDS.submissionBenFit,
      campaignId: SEED_IDS.campaignOtherFit,
      orgId: SEED_IDS.orgOther,
      status: 'metering',
      acceptedAt: SEED_CLOCK_ISO,
      baselineViews: 1200,
      meteringEndsAt: '2026-09-08T12:00:00+08:00',
      claimDeadlineAt: '2026-09-15T12:00:00+08:00',
    });
    expect(ben[0].snapshots).toHaveLength(1);
    expect(ben[0].snapshots[0]).toMatchObject({ trusted: true, qualifiedViewsInWindow: 0 });
  });

  it('presets notifications for both of the demo user role contexts', () => {
    const state = createSeedState();
    const notifications = selectNotificationsFor(state, SEED_IDS.userDemo);
    expect(notifications).toHaveLength(3);

    // Two merchant rows: one read, one unread.
    const merchant = selectNotificationsFor(state, SEED_IDS.userDemo, 'merchant');
    expect(merchant).toHaveLength(2);
    expect(merchant.filter((entry) => entry.readAt === null)).toHaveLength(1);
    expect(merchant.filter((entry) => entry.readAt !== null)).toHaveLength(1);

    // One unread creator row, so the first landing after sign-in is not empty.
    const creator = selectNotificationsFor(state, SEED_IDS.userDemo, 'creator');
    expect(creator).toHaveLength(1);
    expect(creator[0]).toMatchObject({
      kind: 'campaign.published',
      recipientRole: 'creator',
      href: `/campaigns/${SEED_IDS.campaignKopiRaya}`,
      readAt: null,
      email: { to: 'demo.user@wringy.test' },
    });

    // Every preset points at a record that exists.
    for (const notification of notifications) {
      const campaignId = String(notification.params.campaignId);
      expect(state.campaigns[campaignId]).toBeDefined();
    }
    // Nobody else starts with notifications.
    expect(selectNotificationsFor(state, SEED_IDS.userBen)).toHaveLength(0);
  });

  it('has no claims, offers, waitlist, appeals, obligations or attempts', () => {
    const state = createSeedState();
    expect(Object.keys(state.claims)).toHaveLength(0);
    expect(Object.keys(state.partialOffers)).toHaveLength(0);
    expect(Object.keys(state.waitlist)).toHaveLength(0);
    expect(Object.keys(state.appeals)).toHaveLength(0);
    expect(Object.keys(state.obligations)).toHaveLength(0);
    expect(Object.keys(state.payoutAttempts)).toHaveLength(0);
  });
});
