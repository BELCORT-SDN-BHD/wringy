import { describe, expect, it } from 'vitest';

import { SEED_IDS } from './seed';
import { selectOpsQueue, selectSubmissionReward } from './selectors';
import { DAY_MS, URLS, createHarness, findSubmissionByUrl, type Harness } from './test-utils';

function creator(userId = SEED_IDS.userDemo): Harness {
  const harness = createHarness();
  harness.ok({ type: 'session.signIn', userId });
  return harness;
}

function submitDemoTiktok(harness: Harness, url = URLS.demoTiktok) {
  harness.ok({
    type: 'submission.create',
    campaignId: SEED_IDS.campaignKopiRaya,
    connectionId: SEED_IDS.connectionDemoTiktok,
    url,
  });
  return findSubmissionByUrl(harness.state, url);
}

describe('submission.create', () => {
  it('accepts a link, records the baseline and opens the windows', () => {
    const harness = creator();
    const submission = submitDemoTiktok(harness);
    expect(submission.status).toBe('metering');
    expect(submission.acceptedAt).toBe('2026-09-01T12:00:00+08:00');
    expect(submission.baselineViews).toBe(1200);
    expect(submission.meteringEndsAt).toBe('2026-09-08T12:00:00+08:00');
    expect(submission.claimDeadlineAt).toBe('2026-09-15T12:00:00+08:00');
    expect(submission.snapshots).toHaveLength(1);
    expect(submission.snapshots[0]).toMatchObject({
      version: 1,
      trusted: true,
      qualifiedViewsInWindow: 0,
    });
    expect(submission.rulesVersion).toBe(1);
  });

  it('refuses a submission when the creator is signed out', () => {
    const harness = createHarness();
    harness.fail(
      {
        type: 'submission.create',
        campaignId: SEED_IDS.campaignKopiRaya,
        connectionId: SEED_IDS.connectionDemoTiktok,
        url: URLS.demoTiktok,
      },
      'not_signed_in',
    );
  });

  it('refuses a connection that is not the creator own, invalid, or off-platform', () => {
    const harness = creator();
    harness.fail(
      {
        type: 'submission.create',
        campaignId: SEED_IDS.campaignKopiRaya,
        connectionId: SEED_IDS.connectionBenTiktok,
        url: URLS.benTiktok,
      },
      'forbidden',
    );
    const invalid = harness.fail(
      {
        type: 'submission.create',
        campaignId: SEED_IDS.campaignKopiRaya,
        connectionId: SEED_IDS.connectionDemoInstagram,
        url: URLS.demoInstagram,
      },
      'connection_invalid',
    );
    expect(invalid.detail).toBe('token_expired');
  });

  it('explains an unusable URL instead of accepting it', () => {
    const harness = creator();
    expect(
      harness.fail(
        {
          type: 'submission.create',
          campaignId: SEED_IDS.campaignKopiRaya,
          connectionId: SEED_IDS.connectionDemoTiktok,
          url: URLS.demoTiktokAlt,
        },
        'invalid_input',
      ).detail,
    ).toBe('short_link_unresolvable');
    expect(
      harness.fail(
        {
          type: 'submission.create',
          campaignId: SEED_IDS.campaignKopiRaya,
          connectionId: SEED_IDS.connectionDemoTiktok,
          url: URLS.demoYoutube,
        },
        'invalid_input',
      ).detail,
    ).toBe('platform_mismatch');
  });

  it('dedups on the stable post id and returns the existing submission', () => {
    const harness = creator();
    const first = submitDemoTiktok(harness);
    const failure = harness.fail(
      {
        type: 'submission.create',
        campaignId: SEED_IDS.campaignKopiRaya,
        connectionId: SEED_IDS.connectionDemoTiktok,
        url: URLS.demoTiktokSame, // different link shape, same post id
      },
      'duplicate_post',
    );
    expect(failure.detail).toBe(first.id);
    expect(Object.keys(harness.state.submissions)).toHaveLength(2); // seed + this one
  });

  it('stores a scheme-less paste as an absolute https URL and dedups against the schemed form', () => {
    // `normalizePostUrl` has always prefixed a scheme to read the post id, but the
    // engine used to store `command.url` verbatim — so a scheme-less paste became a
    // RELATIVE href on the creator's and merchant's "Open the post" anchors and
    // navigated inside the prototype instead of out to the platform.
    const harness = creator();
    harness.ok({
      type: 'submission.create',
      campaignId: SEED_IDS.campaignKopiRaya,
      connectionId: SEED_IDS.connectionDemoTiktok,
      url: 'tiktok.com/@demouser/video/7400000000000000001',
    });
    const stored = findSubmissionByUrl(
      harness.state,
      'https://tiktok.com/@demouser/video/7400000000000000001',
    );
    expect(stored.url.startsWith('https://')).toBe(true);
    expect(stored.postId).toBe('7400000000000000001');

    // The same post pasted with its scheme is the same post, not a second one.
    const failure = harness.fail(
      {
        type: 'submission.create',
        campaignId: SEED_IDS.campaignKopiRaya,
        connectionId: SEED_IDS.connectionDemoTiktok,
        url: URLS.demoTiktok,
      },
      'duplicate_post',
    );
    expect(failure.detail).toBe(stored.id);
    expect(Object.keys(harness.state.submissions)).toHaveLength(2); // seed + this one
  });

  it('blocks the same post in a second campaign while the first is not finally rejected (D06)', () => {
    const harness = creator();
    const first = submitDemoTiktok(harness);
    // Publish a second campaign in the same org.
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({
      type: 'campaign.createDraft',
      orgId: SEED_IDS.orgKopi,
      title: 'Second campaign',
      brief: '',
    });
    const second = Object.values(harness.state.campaigns).find(
      (entry) => entry.title === 'Second campaign',
    );
    if (!second) throw new Error('missing second campaign');
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: second.id,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    harness.ok({ type: 'campaign.publish', campaignId: second.id });
    harness.ok({ type: 'session.switchWorkspace', workspace: 'creator' });

    const failure = harness.fail(
      {
        type: 'submission.create',
        campaignId: second.id,
        connectionId: SEED_IDS.connectionDemoTiktok,
        url: URLS.demoTiktok,
      },
      'cross_campaign_blocked',
    );
    expect(failure.detail).toBe(first.id);
  });

  it('refuses a campaign that is not open', () => {
    const harness = creator();
    harness.fail(
      {
        type: 'submission.create',
        campaignId: SEED_IDS.campaignKopiDraft,
        connectionId: SEED_IDS.connectionDemoTiktok,
        url: URLS.demoTiktok,
      },
      'campaign_not_open',
    );
  });

  it('never fabricates an acceptance when the data source is not ready', () => {
    const harness = creator();
    harness.ok({ type: 'demo.setReadiness', campaignId: SEED_IDS.campaignKopiRaya, dataSourceReady: false });
    const submission = submitDemoTiktok(harness);
    expect(submission.status).toBe('baseline_unavailable');
    expect(submission.acceptedAt).toBeNull();
    expect(submission.meteringEndsAt).toBeNull();
    expect(submission.snapshots[0]).toMatchObject({ trusted: false, missingReason: 'source_unreachable' });
    const reward = selectSubmissionReward(harness.state, submission.id);
    expect(reward?.dataStatus).toBe('no_baseline');
    expect(reward?.qualifiedViews).toBeNull();
    expect(reward?.blockReason).toBe('data_unavailable');
    // Operations can see it in the queue.
    expect(selectOpsQueue(harness.state).some((item) => item.targetId === submission.id)).toBe(true);
  });
});

describe('submission window closing', () => {
  it('closes intake once when the clock passes the close time and refuses new links', () => {
    const harness = creator();
    harness.ok({ type: 'demo.advanceClock', byMs: 15 * DAY_MS });
    const campaign = harness.state.campaigns[SEED_IDS.campaignKopiRaya];
    expect(campaign.status).toBe('submissions_closed');
    const notices = Object.values(harness.state.notifications).filter(
      (entry) =>
        entry.kind === 'campaign.submissions_closed' &&
        entry.params.campaignId === SEED_IDS.campaignKopiRaya,
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].recipientRole).toBe('merchant');
    harness.fail(
      {
        type: 'submission.create',
        campaignId: SEED_IDS.campaignKopiRaya,
        connectionId: SEED_IDS.connectionDemoTiktok,
        url: URLS.demoTiktok,
      },
      'campaign_not_open',
    );
    // Advancing further does not repeat the announcement.
    harness.ok({ type: 'demo.advanceClock', byMs: DAY_MS });
    expect(
      Object.values(harness.state.notifications).filter(
        (entry) =>
          entry.kind === 'campaign.submissions_closed' &&
          entry.params.campaignId === SEED_IDS.campaignKopiRaya,
      ),
    ).toHaveLength(1);
  });
});

describe('cross-campaign reuse after a final rejection (D06)', () => {
  it('lets the same post enter another campaign only once the first is finally rejected', () => {
    const harness = creator();
    const first = submitDemoTiktok(harness);
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: first.id, views: 1000 });
    harness.ok({ type: 'claim.request', submissionId: first.id });
    const claim = Object.values(harness.state.claims).find(
      (entry) => entry.submissionId === first.id,
    );
    if (!claim) throw new Error('claim missing');

    // A second campaign in the same org, published at the same time.
    harness.ok({ type: 'session.switchWorkspace', workspace: 'merchant' });
    harness.ok({
      type: 'campaign.createDraft',
      orgId: SEED_IDS.orgKopi,
      title: 'Reuse target',
      brief: '',
    });
    const second = Object.values(harness.state.campaigns).find(
      (entry) => entry.title === 'Reuse target',
    );
    if (!second) throw new Error('second campaign missing');
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: second.id,
      fundingEvidence: true,
      dataSourceReady: true,
    });
    harness.ok({ type: 'campaign.publish', campaignId: second.id });

    // Blocked while the first campaign still holds a live claim.
    harness.ok({ type: 'session.switchWorkspace', workspace: 'creator' });
    harness.fail(
      {
        type: 'submission.create',
        campaignId: second.id,
        connectionId: SEED_IDS.connectionDemoTiktok,
        url: URLS.demoTiktok,
      },
      'cross_campaign_blocked',
    );

    // Final rejection in the first campaign.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({
      type: 'claim.reviewMetering',
      claimId: claim.id,
      decision: 'reject',
      reason: 'views outside the window',
    });
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    harness.ok({ type: 'claim.finalizeRejection', claimId: claim.id, reason: 'no appeal filed' });
    expect(harness.state.claims[claim.id].status).toBe('rejected_final');

    // Now the post may take part in the new campaign, with a fresh baseline and no
    // migrated views or eligibility.
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userDemo });
    harness.ok({
      type: 'submission.create',
      campaignId: second.id,
      connectionId: SEED_IDS.connectionDemoTiktok,
      url: URLS.demoTiktok,
    });
    const reused = Object.values(harness.state.submissions).find(
      (entry) => entry.campaignId === second.id && entry.postId === first.postId,
    );
    expect(reused).toMatchObject({
      status: 'metering',
      acceptedAt: '2026-09-09T12:00:00+08:00',
      meteringEndsAt: '2026-09-16T12:00:00+08:00',
    });
    expect(selectSubmissionReward(harness.state, reused?.id ?? '')?.qualifiedViews).toBe(0);
  });
});

describe('demo.addQualifiedViews', () => {
  it('adds trusted qualified views inside the window', () => {
    const harness = creator();
    const submission = submitDemoTiktok(harness);
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: submission.id, views: 1000 });
    const reward = selectSubmissionReward(harness.state, submission.id);
    expect(reward?.qualifiedViews).toBe(1000);
    expect(reward?.cappedSen).toBe(500);
    expect(reward?.lastTrustedAt).toBe('2026-09-01T12:00:00+08:00');
    expect(reward?.dataStatus).toBe('trusted');
  });

  it('ignores views after the metering end and records why', () => {
    const harness = creator();
    const submission = submitDemoTiktok(harness);
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: submission.id, views: 1000 });
    harness.ok({ type: 'demo.advanceClock', byMs: 8 * DAY_MS });
    expect(harness.state.submissions[submission.id].status).toBe('metering_ended');
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: submission.id, views: 5000 });
    expect(selectSubmissionReward(harness.state, submission.id)?.qualifiedViews).toBe(1000);
    const note = harness.state.audit.find((entry) => entry.reason === 'ignored_after_metering_end');
    expect(note).toBeDefined();
  });

  it('refuses positive-only integers', () => {
    const harness = creator();
    const submission = submitDemoTiktok(harness);
    harness.fail({ type: 'demo.addQualifiedViews', submissionId: submission.id, views: 0 }, 'invalid_input');
    harness.fail(
      { type: 'demo.addQualifiedViews', submissionId: submission.id, views: 1.5 },
      'invalid_input',
    );
  });
});

describe('data outage', () => {
  it('keeps the last trusted value and never shows zero or fraud', () => {
    const harness = creator();
    const submission = submitDemoTiktok(harness);
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: submission.id, views: 1000 });
    harness.ok({ type: 'demo.setDataOutage', submissionId: submission.id, outage: true });
    expect(harness.state.submissions[submission.id].status).toBe('data_unavailable');

    harness.ok({ type: 'demo.addQualifiedViews', submissionId: submission.id, views: 500 });
    const reward = selectSubmissionReward(harness.state, submission.id);
    expect(reward?.qualifiedViews).toBe(1000); // unchanged
    expect(reward?.dataStatus).toBe('unavailable');
    expect(reward?.lastTrustedAt).toBe('2026-09-01T12:00:00+08:00');
    const last = harness.state.submissions[submission.id].snapshots.at(-1);
    expect(last).toMatchObject({ trusted: false, missingReason: 'source_unreachable' });
  });

  it('lets operations resync, recording the reason and the result', () => {
    const harness = creator();
    const submission = submitDemoTiktok(harness);
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: submission.id, views: 1000 });
    harness.ok({ type: 'demo.setDataOutage', submissionId: submission.id, outage: true });

    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({ type: 'submission.resync', submissionId: submission.id, reason: 'creator reported a gap' });
    // Outage still on: the failure is recorded and the status stays unavailable.
    expect(harness.state.submissions[submission.id].status).toBe('data_unavailable');
    expect(
      harness.state.audit.some(
        (entry) => entry.action === 'submission.resync' && entry.reason === 'creator reported a gap',
      ),
    ).toBe(true);

    harness.ok({ type: 'demo.setDataOutage', submissionId: submission.id, outage: false });
    harness.ok({ type: 'submission.resync', submissionId: submission.id, reason: 'source back' });
    const after = harness.state.submissions[submission.id];
    expect(after.status).toBe('metering');
    expect(after.snapshots.at(-1)).toMatchObject({ trusted: true, qualifiedViewsInWindow: 1000 });
  });

  it('refuses a resync without a reason', () => {
    const harness = creator();
    const submission = submitDemoTiktok(harness);
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.fail({ type: 'submission.resync', submissionId: submission.id, reason: '  ' }, 'invalid_input');
  });

  it('accepts a baseline on resync once the source is ready', () => {
    const harness = creator();
    harness.ok({ type: 'demo.setReadiness', campaignId: SEED_IDS.campaignKopiRaya, dataSourceReady: false });
    const submission = submitDemoTiktok(harness);
    expect(submission.acceptedAt).toBeNull();

    harness.ok({ type: 'demo.setReadiness', campaignId: SEED_IDS.campaignKopiRaya, dataSourceReady: true });
    harness.ok({ type: 'session.signIn', userId: SEED_IDS.userOpsReviewer });
    harness.ok({ type: 'submission.resync', submissionId: submission.id, reason: 'source ready' });
    const after = harness.state.submissions[submission.id];
    expect(after.status).toBe('metering');
    expect(after.acceptedAt).toBe('2026-09-01T12:00:00+08:00');
    expect(after.meteringEndsAt).toBe('2026-09-08T12:00:00+08:00');
  });
});

describe('money derived from a reading that never existed', () => {
  /**
   * prototype-spec-v1.md 必须提供的异常场景: "数据缺失不显示0观看或直接判作弊", and
   * localization-v1.md: "已知零、未知、未填写与不适用分别表达；未知金额／费用不得显示
   * MYR 0.00". A submission with no trusted reading has an UNKNOWN reward, not a
   * zero one, so the derived money is null and the UI renders the word for unknown.
   */
  it('reports the reward as unknown rather than zero', () => {
    const harness = creator();
    harness.ok({
      type: 'demo.setReadiness',
      campaignId: SEED_IDS.campaignKopiRaya,
      dataSourceReady: false,
    });
    const submission = submitDemoTiktok(harness);
    expect(submission.status).toBe('baseline_unavailable');

    expect(selectSubmissionReward(harness.state, submission.id)).toMatchObject({
      dataStatus: 'no_baseline',
      qualifiedViews: null,
      lastTrustedAt: null,
      exactRewardMilliSen: null,
      cappedSen: null,
      claimableSen: null,
      capReached: false,
      meetsMinClaim: false,
      canClaim: false,
      blockReason: 'data_unavailable',
      // The recorded amounts are known zeros, read from the claims, not readings.
      reservedSen: 0,
      confirmedUnpaidSen: 0,
      paidSen: 0,
    });
  });

  it('keeps the last trusted reading and its money through a later outage', () => {
    const harness = creator();
    const submission = submitDemoTiktok(harness);
    harness.ok({ type: 'demo.addQualifiedViews', submissionId: submission.id, views: 1000 });
    harness.ok({ type: 'demo.setDataOutage', submissionId: submission.id, outage: true });

    expect(selectSubmissionReward(harness.state, submission.id)).toMatchObject({
      dataStatus: 'unavailable',
      qualifiedViews: 1000,
      cappedSen: 500,
      claimableSen: 500,
    });
  });
});
