import { describe, expect, it } from 'vitest';

import { applyCommand, migrate } from './engine';
import { EMAIL_KINDS } from './notifications';
import { SEED_IDS, createSeedState } from './seed';
import { selectNotificationsFor, selectUnreadCount } from './selectors';
import { URLS, createHarness, findSubmissionByUrl, latestClaim, type Harness } from './test-utils';
import { SCHEMA_VERSION, type Notification } from './types';

/** Ben submits to the Kopi Kita campaign, so creator and merchant are different people. */
function benInKopiCampaign(): { harness: Harness; submissionId: string } {
  const harness = createHarness();
  harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
  harness.ok({
    type: 'submission.create',
    campaignId: SEED_IDS.campaignKopiRaya,
    connectionId: SEED_IDS.connectionBenTiktok,
    url: URLS.benTiktok,
  });
  const submissionId = findSubmissionByUrl(harness.state, URLS.benTiktok).id;
  harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 1000 });
  return { harness, submissionId };
}

function byKind(harness: Harness, kind: Notification['kind']): Notification[] {
  return Object.values(harness.state.notifications)
    .filter((entry) => entry.kind === kind)
    .sort((a, b) => a.recipientUserId.localeCompare(b.recipientUserId));
}

describe('notification routing', () => {
  it('tells the creator and the merchant that a link was accepted', () => {
    const { harness, submissionId } = benInKopiCampaign();
    const accepted = byKind(harness, 'submission.accepted');
    expect(accepted).toHaveLength(2);
    expect(accepted[0]).toMatchObject({
      recipientUserId: SEED_IDS.userBen,
      recipientRole: 'creator',
      href: `/creator/submissions/${submissionId}`,
    });
    expect(accepted[1]).toMatchObject({
      recipientUserId: SEED_IDS.userDemo,
      recipientRole: 'merchant',
      href: `/merchant/submissions/${submissionId}`,
    });
    // Important events carry a simulated email preview and nothing is sent.
    expect(accepted[0].email).toEqual({ to: 'ben.tan@wringy.test' });
    expect(accepted[1].email).toEqual({ to: 'demo.user@wringy.test' });
  });

  it('routes a reservation to the creator, the merchant and the reviewer', () => {
    const { harness, submissionId } = benInKopiCampaign();
    harness.ok({ type: 'claim.request', submissionId });
    const claimId = latestClaim(harness.state, submissionId).id;
    const reserved = byKind(harness, 'claim.reserved');
    expect(reserved.map((entry) => entry.recipientUserId)).toEqual([
      SEED_IDS.userBen,
      SEED_IDS.userDemo,
      SEED_IDS.userOpsReviewer,
    ]);
    // Each role gets its own side of the same record: the creator the claim, the
    // merchant the campaign where the four budget columns are, ops the review item.
    expect(reserved.map((entry) => entry.href)).toEqual([
      `/creator/claims/${claimId}`,
      `/merchant/campaigns/${SEED_IDS.campaignKopiRaya}`,
      `/ops/claims/${claimId}`,
    ]);
    expect(reserved.every((entry) => entry.params.amountSen === 500)).toBe(true);
  });

  it('keeps payout events with finance and the creator only', () => {
    const { harness, submissionId } = benInKopiCampaign();
    harness.ok({ type: 'claim.request', submissionId });
    const claimId = latestClaim(harness.state, submissionId).id;
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({ type: 'submission.reviewContent', submissionId, decision: 'approve', reason: null });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({ type: 'claim.reviewMetering', claimId, decision: 'approve', reason: null });

    const confirmed = byKind(harness, 'claim.confirmed');
    expect(confirmed.map((entry) => entry.recipientUserId)).toEqual([
      SEED_IDS.userBen,
      SEED_IDS.userDemo,
      SEED_IDS.userOpsFinance,
    ]);

    const obligation = Object.values(harness.state.obligations)[0];
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsFinance });
    harness.ok({ type: 'payout.start', obligationId: obligation.id });
    const processing = byKind(harness, 'payout.processing');
    expect(processing.map((entry) => entry.recipientUserId)).toEqual([
      SEED_IDS.userBen,
      SEED_IDS.userOpsFinance,
    ]);
    expect(processing[0].href).toBe('/creator/payments');
    // No reviewer is notified about money movement.
    expect(processing.some((entry) => entry.recipientUserId === SEED_IDS.userOpsReviewer)).toBe(false);
  });

  it('gives a partial offer to the creator alone and without an email', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({
      type: 'campaign.createDraft',
      orgId: SEED_IDS.orgKopi,
      title: 'Offer routing',
      brief: '',
      rules: { poolSen: 5000 },
    });
    const campaign = Object.values(harness.state.campaigns).find(
      (entry) => entry.title === 'Offer routing',
    );
    if (!campaign) throw new Error('campaign missing');
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: campaign.id,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    harness.ok({ type: 'campaign.publish', campaignId: campaign.id });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    harness.ok({
      type: 'submission.create',
      campaignId: campaign.id,
      connectionId: SEED_IDS.connectionBenTiktok,
      url: URLS.benTiktok,
    });
    const submissionId = findSubmissionByUrl(harness.state, URLS.benTiktok).id;
    harness.ok({ type: 'demo.addQualifiedViews', submissionId, views: 12_000 });
    harness.ok({ type: 'claim.request', submissionId });

    const offers = byKind(harness, 'claim.partial_offer');
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ recipientUserId: SEED_IDS.userBen, email: null });
    expect(EMAIL_KINDS).not.toContain('claim.partial_offer');
  });

  it('never writes two rows for the same event and recipient', () => {
    const { harness, submissionId } = benInKopiCampaign();
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * 24 * 60 * 60 * 1000 });
    harness.ok({ type: 'demo.advanceClock', byMs: 24 * 60 * 60 * 1000 });
    const keys = Object.values(harness.state.notifications).map(
      (entry) => `${entry.eventId}:${entry.recipientUserId}:${entry.recipientRole}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      byKind(harness, 'deadline.metering_ended').filter(
        (entry) => entry.params.submissionId === submissionId,
      ),
    ).toHaveLength(2); // creator Ben and merchant Demo User, once each
  });
});

describe('dual-role recipients', () => {
  it('gives a person who is both creator and merchant one row per role', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({
      type: 'submission.create',
      campaignId: SEED_IDS.campaignKopiRaya,
      connectionId: SEED_IDS.connectionDemoTiktok,
      url: URLS.demoTiktok,
    });
    const submissionId = findSubmissionByUrl(harness.state, URLS.demoTiktok).id;
    const accepted = byKind(harness, 'submission.accepted');
    // Demo User owns the creator workspace and the Kopi Kita org.
    expect(accepted).toHaveLength(2);
    expect(accepted.map((entry) => entry.recipientRole).sort()).toEqual(['creator', 'merchant']);
    expect(accepted.every((entry) => entry.recipientUserId === SEED_IDS.userDemo)).toBe(true);
    const creatorRow = accepted.find((entry) => entry.recipientRole === 'creator');
    const merchantRow = accepted.find((entry) => entry.recipientRole === 'merchant');
    expect(creatorRow?.href).toBe(`/creator/submissions/${submissionId}`);
    expect(merchantRow?.href).toBe(`/merchant/submissions/${submissionId}`);
    // Same business event, so the two rows share one eventId.
    expect(creatorRow?.eventId).toBe(merchantRow?.eventId);

    // markRead is idempotent per ROW: reading the creator row leaves the merchant
    // row unread, and each role view counts its own.
    harness.ok({ type: 'notification.markRead', notificationId: creatorRow?.id ?? '' });
    harness.ok({ type: 'notification.markRead', notificationId: creatorRow?.id ?? '' });
    expect(harness.state.notifications[creatorRow?.id ?? ''].readAt).toBe(
      '2026-09-01T12:00:00+08:00',
    );
    expect(harness.state.notifications[merchantRow?.id ?? ''].readAt).toBeNull();
    // Each role view shows its own row and not the other one.
    const creatorView = selectNotificationsFor(harness.state, SEED_IDS.userDemo, 'creator');
    const merchantView = selectNotificationsFor(harness.state, SEED_IDS.userDemo, 'merchant');
    expect(creatorView.map((entry) => entry.id)).toContain(creatorRow?.id);
    expect(creatorView.map((entry) => entry.id)).not.toContain(merchantRow?.id);
    expect(merchantView.map((entry) => entry.id)).toContain(merchantRow?.id);
    expect(merchantView.map((entry) => entry.id)).not.toContain(creatorRow?.id);
  });
});

describe('read state', () => {
  it('marks one notification read, idempotently', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'notification.markRead', notificationId: 'nt-seed-1' });
    expect(harness.state.notifications['nt-seed-1'].readAt).toBe('2026-09-01T12:00:00+08:00');
    harness.ok({ type: 'demo.advanceClock', byMs: 60_000 });
    harness.ok({ type: 'notification.markRead', notificationId: 'nt-seed-1' });
    // The first read time persists.
    expect(harness.state.notifications['nt-seed-1'].readAt).toBe('2026-09-01T12:00:00+08:00');
  });

  it('refuses to touch someone else notification', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    harness.fail({ type: 'notification.markRead', notificationId: 'nt-seed-1' }, 'forbidden');
  });

  it('marks all read for the current user only', () => {
    const { harness } = benInKopiCampaign();
    expect(selectUnreadCount(harness.state, SEED_IDS.userBen)).toBeGreaterThan(0);
    harness.ok({ type: 'notification.markAllRead' });
    expect(selectUnreadCount(harness.state, SEED_IDS.userBen)).toBe(0);
    // Demo User's unread merchant notifications are untouched.
    expect(selectUnreadCount(harness.state, SEED_IDS.userDemo)).toBeGreaterThan(0);
  });

  it('filters by role context', () => {
    const { harness } = benInKopiCampaign();
    const merchantOnly = selectNotificationsFor(harness.state, SEED_IDS.userDemo, 'merchant');
    expect(merchantOnly.length).toBeGreaterThan(0);
    expect(merchantOnly.every((entry) => entry.recipientRole === 'merchant')).toBe(true);
    // Ben is the creator here, so the demo user's only creator row is the seed preset.
    const creatorOnly = selectNotificationsFor(harness.state, SEED_IDS.userDemo, 'creator');
    expect(creatorOnly.map((entry) => entry.id)).toEqual(['nt-seed-3']);
    expect(creatorOnly.every((entry) => entry.recipientRole === 'creator')).toBe(true);
  });

  it('writes no audit entry for session or notification commands', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'session.setLocale', locale: 'ms-MY', explicit: true });
    harness.ok({ type: 'notification.markRead', notificationId: 'nt-seed-1' });
    harness.ok({ type: 'notification.markAllRead' });
    expect(harness.state.audit).toHaveLength(0);
  });
});

describe('session', () => {
  it('records the language choice and answers the first-visit prompt', () => {
    const harness = createHarness();
    expect(harness.state.session.localePromptDone).toBe(false);
    harness.ok({ type: 'session.setLocale', locale: 'zh-Hans-MY', explicit: true });
    expect(harness.state.session).toMatchObject({
      locale: 'zh-Hans-MY',
      localeExplicit: true,
      localePromptDone: true,
    });
  });

  it('can skip the prompt without choosing explicitly', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.dismissLocalePrompt' });
    expect(harness.state.session).toMatchObject({
      locale: 'en-MY',
      localeExplicit: false,
      localePromptDone: true,
    });
  });

  it('refuses an unknown locale', () => {
    const harness = createHarness();
    harness.fail(
      { type: 'session.setLocale', locale: 'fr-FR' as never, explicit: true },
      'invalid_input',
    );
  });

  it('refuses the merchant workspace without a membership', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userBen });
    harness.fail({ type: 'session.switchWorkspace', workspace: 'merchant' }, 'forbidden');
  });

  it('refuses an ops role the user does not carry', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.fail({ type: 'session.setOpsRole', role: 'ops_finance' }, 'forbidden');
  });

  it('signs out without losing the language choice', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.setLocale', locale: 'ms-MY', explicit: true });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({ type: 'session.signOut' });
    expect(harness.state.session).toMatchObject({
      userId: null,
      opsRole: null,
      locale: 'ms-MY',
    });
  });
});

describe('purity and persistence', () => {
  it('never mutates the state handed to applyCommand', () => {
    const before = createSeedState();
    const snapshot = JSON.stringify(before);
    const result = applyCommand(
      before,
      { type: 'session.signIn', userId: SEED_IDS.userDemo },
      { commandId: 'purity-1' },
    );
    expect(result.ok).toBe(true);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('returns the same state object on an idempotent replay', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    const first = harness.state;
    const replay = applyCommand(
      first,
      { type: 'session.signIn', userId: SEED_IDS.userDemo },
      { commandId: 'replay-1' },
    );
    const again = applyCommand(
      replay.state,
      { type: 'session.signIn', userId: SEED_IDS.userDemo },
      { commandId: 'replay-1' },
    );
    expect(again.ok && again.outcome).toBe('idempotent_replay');
    expect(again.ok && again.events).toHaveLength(0);
  });

  it('requires a command id', () => {
    const state = createSeedState();
    const result = applyCommand(state, { type: 'session.signOut' }, { commandId: '' });
    expect(result.ok).toBe(false);
  });

  it('migrates a state of the current schema and rejects anything else', () => {
    const state = createSeedState();
    expect(migrate(JSON.parse(JSON.stringify(state)))).not.toBeNull();
    expect(migrate({ ...state, schemaVersion: SCHEMA_VERSION + 1 })).toBeNull();
    expect(migrate({ schemaVersion: SCHEMA_VERSION })).toBeNull();
    expect(migrate(null)).toBeNull();
    expect(migrate('{}')).toBeNull();
    const brokenClock = JSON.parse(JSON.stringify(state));
    brokenClock.clock.nowIso = 'not a time';
    expect(migrate(brokenClock)).toBeNull();
  });

  it('resets to the seed while keeping the language choice', () => {
    const harness = createHarness();
    harness.ok({ type: 'session.setLocale', locale: 'zh-Hans-MY', explicit: true });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({
      type: 'submission.create',
      campaignId: SEED_IDS.campaignKopiRaya,
      connectionId: SEED_IDS.connectionDemoTiktok,
      url: URLS.demoTiktok,
    });
    harness.ok({ type: 'demo.reset' });
    expect(Object.keys(harness.state.submissions)).toEqual([SEED_IDS.submissionBenFit]);
    expect(harness.state.session.locale).toBe('zh-Hans-MY');
    expect(harness.state.session.userId).toBeNull();
    expect(harness.state.scenario).toBe('baseline');
    // The reset itself is recorded.
    expect(harness.state.audit.some((entry) => entry.action === 'demo.reset')).toBe(true);
  });
});
