// Baseline demo records. Deterministic: same bytes on every call.
//
// Exactly the seed described in docs/m1-prototype/kickoff.md "Seed (baseline state)":
// four users, two orgs, three campaigns (one published by Kopi Kita, one by
// Nusantara Fit, one draft), Demo User's TikTok valid and Instagram invalid, Ben's
// TikTok valid, one metering submission owned by Ben in the other org's campaign
// (isolation demo), Demo User with no submissions (empty states), two preset
// notifications (one unread, one read), signed out, locale en-MY, prompt not answered.

import { calendarDaysAfter } from './time';
import { DEFAULT_RULES, BASELINE_VIEWS } from './rules';
import { SCHEMA_VERSION } from './types';
import type {
  AccountConnection,
  Campaign,
  CampaignRules,
  DemoState,
  IsoDateTime,
  Notification,
  Org,
  Submission,
  User,
} from './types';

/** Simulated server clock at rest (Asia/Kuala_Lumpur). */
export const SEED_CLOCK_ISO: IsoDateTime = '2026-09-01T12:00:00+08:00';

export const SEED_IDS = {
  userDemo: 'user-demo',
  userBen: 'user-ben',
  userOpsReviewer: 'user-ops-reviewer',
  userOpsFinance: 'user-ops-finance',
  orgKopi: 'org-kopi',
  orgOther: 'org-other',
  campaignKopiRaya: 'cmp-kopi-raya',
  campaignOtherFit: 'cmp-other-fit',
  campaignKopiDraft: 'cmp-kopi-draft',
  connectionDemoTiktok: 'conn-demo-tiktok',
  connectionDemoInstagram: 'conn-demo-instagram',
  connectionBenTiktok: 'conn-ben-tiktok',
  submissionBenFit: 'sub-ben-fit',
} as const;

function rules(overrides: Partial<CampaignRules> = {}): CampaignRules {
  return { ...DEFAULT_RULES, ...overrides, platforms: [...(overrides.platforms ?? DEFAULT_RULES.platforms)], contentLanguages: [...(overrides.contentLanguages ?? DEFAULT_RULES.contentLanguages)] };
}

function user(
  id: string,
  displayName: string,
  email: string,
  orgIds: string[],
  opsCapability: User['opsCapability'],
): User {
  return { id, displayName, email, orgIds, opsCapability };
}

export function createSeedState(): DemoState {
  const now = SEED_CLOCK_ISO;
  const submissionsCloseAt = calendarDaysAfter(now, DEFAULT_RULES.submissionWindowDays);
  const meteringEndsAt = calendarDaysAfter(now, DEFAULT_RULES.meteringDays);
  const claimDeadlineAt = calendarDaysAfter(meteringEndsAt, DEFAULT_RULES.claimGraceDays);

  const users: Record<string, User> = {
    [SEED_IDS.userDemo]: user(
      SEED_IDS.userDemo,
      'Demo User',
      'demo.user@wringy.test',
      [SEED_IDS.orgKopi],
      null,
    ),
    [SEED_IDS.userBen]: user(SEED_IDS.userBen, 'Ben Tan', 'ben.tan@wringy.test', [], null),
    [SEED_IDS.userOpsReviewer]: user(
      SEED_IDS.userOpsReviewer,
      'Ops Reviewer',
      'ops.reviewer@wringy.test',
      [],
      'ops_reviewer',
    ),
    [SEED_IDS.userOpsFinance]: user(
      SEED_IDS.userOpsFinance,
      'Ops Finance',
      'ops.finance@wringy.test',
      [],
      'ops_finance',
    ),
  };

  const orgs: Record<string, Org> = {
    [SEED_IDS.orgKopi]: { id: SEED_IDS.orgKopi, name: 'Kopi Kita' },
    [SEED_IDS.orgOther]: { id: SEED_IDS.orgOther, name: 'Nusantara Fit' },
  };

  const publishedCampaign = (
    id: string,
    orgId: string,
    title: string,
    brief: string,
  ): Campaign => ({
    id,
    orgId,
    title,
    brief,
    status: 'published',
    rules: rules(),
    rulesVersion: 1,
    serviceFee: 'pending_config',
    readiness: { fundingEvidence: true, dataSourceReady: true },
    budgetVersion: 0,
    nextClaimSeq: 1,
    publishedAt: now,
    submissionsCloseAt,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const campaigns: Record<string, Campaign> = {
    [SEED_IDS.campaignKopiRaya]: publishedCampaign(
      SEED_IDS.campaignKopiRaya,
      SEED_IDS.orgKopi,
      'Kopi Raya 2026',
      'Show how you brew Kopi Kita at home for Raya. Mention the blend name in the first ten seconds.',
    ),
    [SEED_IDS.campaignOtherFit]: publishedCampaign(
      SEED_IDS.campaignOtherFit,
      SEED_IDS.orgOther,
      'Nusantara Fit 30-Day Challenge',
      'Document one workout using the Nusantara Fit app and tag the challenge.',
    ),
    [SEED_IDS.campaignKopiDraft]: {
      id: SEED_IDS.campaignKopiDraft,
      orgId: SEED_IDS.orgKopi,
      title: 'Kopi Kita Cold Brew (draft)',
      brief: 'Draft brief: cold brew launch. Funding evidence and data source are not confirmed yet.',
      status: 'draft',
      rules: rules(),
      rulesVersion: 1,
      serviceFee: 'pending_config',
      readiness: { fundingEvidence: false, dataSourceReady: false },
      budgetVersion: 0,
      nextClaimSeq: 1,
      publishedAt: null,
      submissionsCloseAt: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  };

  const connections: Record<string, AccountConnection> = {
    [SEED_IDS.connectionDemoTiktok]: {
      id: SEED_IDS.connectionDemoTiktok,
      userId: SEED_IDS.userDemo,
      platform: 'tiktok',
      handle: '@demouser',
      accountId: 'tiktok-acc-demo',
      status: 'valid',
      invalidReason: null,
      updatedAt: now,
    },
    [SEED_IDS.connectionDemoInstagram]: {
      id: SEED_IDS.connectionDemoInstagram,
      userId: SEED_IDS.userDemo,
      platform: 'instagram',
      handle: '@demouser',
      accountId: 'instagram-acc-demo',
      status: 'invalid',
      invalidReason: 'token_expired',
      updatedAt: now,
    },
    [SEED_IDS.connectionBenTiktok]: {
      id: SEED_IDS.connectionBenTiktok,
      userId: SEED_IDS.userBen,
      platform: 'tiktok',
      handle: '@bentan',
      accountId: 'tiktok-acc-ben',
      status: 'valid',
      invalidReason: null,
      updatedAt: now,
    },
  };

  // Ben's submission in the other org's campaign: proves record isolation between
  // orgs and creators while Demo User still sees empty states.
  const benSubmission: Submission = {
    id: SEED_IDS.submissionBenFit,
    campaignId: SEED_IDS.campaignOtherFit,
    orgId: SEED_IDS.orgOther,
    creatorId: SEED_IDS.userBen,
    connectionId: SEED_IDS.connectionBenTiktok,
    platform: 'tiktok',
    postId: '7300000000000000001',
    url: 'https://www.tiktok.com/@bentan/video/7300000000000000001',
    rulesVersion: 1,
    status: 'metering',
    submittedAt: now,
    acceptedAt: now,
    baselineViews: BASELINE_VIEWS,
    meteringEndsAt,
    claimDeadlineAt,
    extensions: [],
    snapshots: [
      {
        id: 'snap-ben-fit-1',
        version: 1,
        observedAt: now,
        sourceTime: now,
        totalViews: BASELINE_VIEWS,
        qualifiedViewsInWindow: 0,
        missingReason: null,
        trusted: true,
      },
    ],
    dataOutage: false,
    outageStartedAt: null,
    contentReview: { status: 'pending', reason: null, decidedBy: null, decidedAt: null },
  };

  const notifications: Record<string, Notification> = {
    // The same seeded publish reaches Demo User twice, because rows are unique per
    // (eventId, recipientUserId, recipientRole): once as a creator who can join a
    // public campaign, once as the Kopi Kita merchant whose campaign went live.
    // Ticket #2 needs readable preset notifications on first entry, and the first
    // landing after the simulated sign-in is the creator workspace.
    'nt-seed-3': {
      id: 'nt-seed-3',
      eventId: 'ev:seed:campaign.published:cmp-kopi-raya',
      recipientUserId: SEED_IDS.userDemo,
      recipientRole: 'creator',
      kind: 'campaign.published',
      params: { campaignId: SEED_IDS.campaignKopiRaya, campaignTitle: 'Kopi Raya 2026' },
      href: `/campaigns/${SEED_IDS.campaignKopiRaya}`,
      createdAt: now,
      readAt: null,
      // Important kind, so the "simulated email preview" is demonstrable at baseline.
      email: { to: users[SEED_IDS.userDemo].email },
    },
    'nt-seed-1': {
      id: 'nt-seed-1',
      eventId: 'ev:seed:campaign.published:cmp-kopi-raya',
      recipientUserId: SEED_IDS.userDemo,
      recipientRole: 'merchant',
      kind: 'campaign.published',
      params: { campaignId: SEED_IDS.campaignKopiRaya, campaignTitle: 'Kopi Raya 2026' },
      href: `/merchant/campaigns/${SEED_IDS.campaignKopiRaya}`,
      createdAt: now,
      readAt: null,
      email: { to: users[SEED_IDS.userDemo].email },
    },
    'nt-seed-2': {
      id: 'nt-seed-2',
      eventId: 'ev:seed:campaign.readiness_blocked:cmp-kopi-draft',
      recipientUserId: SEED_IDS.userDemo,
      recipientRole: 'merchant',
      kind: 'campaign.readiness_blocked',
      params: {
        campaignId: SEED_IDS.campaignKopiDraft,
        campaignTitle: 'Kopi Kita Cold Brew (draft)',
        blocked: 'funding_evidence,data_source',
      },
      href: `/merchant/campaigns/${SEED_IDS.campaignKopiDraft}`,
      createdAt: now,
      readAt: now,
      email: null,
    },
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    clock: { nowIso: now, seq: 0 },
    session: {
      userId: null,
      workspace: 'creator',
      opsRole: null,
      locale: 'en-MY',
      localePromptDone: false,
      localeExplicit: false,
    },
    scenario: 'baseline',
    users,
    orgs,
    campaigns,
    connections,
    submissions: { [benSubmission.id]: benSubmission },
    claims: {},
    partialOffers: {},
    waitlist: {},
    appeals: {},
    obligations: {},
    payoutAttempts: {},
    ledger: [],
    notifications,
    audit: [],
    processedCommands: {},
  };
}
