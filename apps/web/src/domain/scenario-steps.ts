// Scenario definitions as command replays.
//
// A scenario is never a hand-written state blob: it is a list of commands applied
// through `applyCommand` from the seed, so "刷新保持本地数据，重置返回基准数据，主流程和
// 异常场景可再次完成" holds and every scenario is provably reachable by the same rules the
// UI uses. Each step resolves its own target ids from the state built so far, so the
// list stays readable and the replay fails loudly if a rule stops allowing a step.
//
// This module holds data and lookups only; the engine injects `applyCommand` into
// `replayScenario`, which keeps the module graph acyclic.

import type {
  AccountConnection,
  Campaign,
  Claim,
  Command,
  CommandMeta,
  CommandResult,
  DemoState,
  Platform,
  ScenarioId,
  Submission,
  Workspace,
} from './types';
import { SEED_IDS } from './seed';

export interface ScenarioStep {
  label: string;
  /** Returns the command, or null when a required record is missing. */
  build(state: DemoState): Command | null;
}

const DEMO_TIKTOK_URL = 'https://www.tiktok.com/@demouser/video/7400000000000000001';
const DEMO_YOUTUBE_URL = 'https://www.youtube.com/watch?v=demoClosure01';
const BEN_TIKTOK_URL = 'https://www.tiktok.com/@bentan/video/7400000000000000101';

const TITLE_PARTIAL = 'Kopi Kita Sampler (small pool)';
const TITLE_WAITLIST = 'Kopi Kita Tasting (tiny pool)';
const TITLE_CLOSURE = 'Kopi Kita Closure Demo';

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

function campaignByTitle(state: DemoState, title: string): Campaign | null {
  return Object.values(state.campaigns).find((campaign) => campaign.title === title) ?? null;
}

function submissionByUrl(state: DemoState, url: string): Submission | null {
  return Object.values(state.submissions).find((submission) => submission.url === url) ?? null;
}

function latestClaimFor(state: DemoState, submissionId: string): Claim | null {
  const claims = Object.values(state.claims)
    .filter((claim) => claim.submissionId === submissionId)
    .sort((a, b) => a.seq - b.seq);
  return claims[claims.length - 1] ?? null;
}

function connectionFor(
  state: DemoState,
  userId: string,
  platform: Platform,
): AccountConnection | null {
  return (
    Object.values(state.connections).find(
      (connection) => connection.userId === userId && connection.platform === platform,
    ) ?? null
  );
}

function obligationForClaim(state: DemoState, claimId: string) {
  return Object.values(state.obligations).find((obligation) => obligation.claimId === claimId) ?? null;
}

function latestAttemptForClaim(state: DemoState, claimId: string) {
  const obligation = obligationForClaim(state, claimId);
  if (!obligation) return null;
  const attempts = Object.values(state.payoutAttempts)
    .filter((attempt) => attempt.obligationId === obligation.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return attempts[attempts.length - 1] ?? null;
}

// ---------------------------------------------------------------------------
// Step builders
// ---------------------------------------------------------------------------

function signIn(userId: string): ScenarioStep {
  return { label: `session.signIn ${userId}`, build: () => ({ type: 'session.signIn', userId }) };
}

function switchWorkspace(workspace: Workspace): ScenarioStep {
  return {
    label: `session.switchWorkspace ${workspace}`,
    build: () => ({ type: 'session.switchWorkspace', workspace }),
  };
}

function createCampaign(title: string, poolSen?: number): ScenarioStep {
  return {
    label: `campaign.createDraft ${title}`,
    build: () => ({
      type: 'campaign.createDraft',
      orgId: SEED_IDS.orgKopi,
      title,
      brief: 'Demo campaign created by a scenario replay. Simulated funding only.',
      rules: poolSen === undefined ? undefined : { poolSen },
    }),
  };
}

function readyCampaign(title: string): ScenarioStep {
  return {
    label: `demo.setReadiness ${title}`,
    build: (state) => {
      const campaign = campaignByTitle(state, title);
      if (!campaign) return null;
      return {
        type: 'demo.setReadiness',
        campaignId: campaign.id,
        fundingEvidence: true,
        dataSourceReady: true,
      };
    },
  };
}

function publishCampaign(title: string): ScenarioStep {
  return {
    label: `campaign.publish ${title}`,
    build: (state) => {
      const campaign = campaignByTitle(state, title);
      if (!campaign) return null;
      return { type: 'campaign.publish', campaignId: campaign.id };
    },
  };
}

function submit(campaign: { title?: string; id?: string }, connectionId: string, url: string): ScenarioStep {
  return {
    label: `submission.create ${url}`,
    build: (state) => {
      const campaignId = campaign.id ?? campaignByTitle(state, campaign.title ?? '')?.id;
      if (!campaignId) return null;
      return { type: 'submission.create', campaignId, connectionId, url };
    },
  };
}

/** Same as `submit`, but resolves the creator's connection for that platform. */
function submitWith(
  title: string,
  userId: string,
  platform: Platform,
  url: string,
): ScenarioStep {
  return {
    label: `submission.create ${platform} ${url}`,
    build: (state) => {
      const campaign = campaignByTitle(state, title);
      const connection = connectionFor(state, userId, platform);
      if (!campaign || !connection) return null;
      return {
        type: 'submission.create',
        campaignId: campaign.id,
        connectionId: connection.id,
        url,
      };
    },
  };
}

function addViews(url: string, views: number): ScenarioStep {
  return {
    label: `demo.addQualifiedViews ${views} (${url})`,
    build: (state) => {
      const submission = submissionByUrl(state, url);
      if (!submission) return null;
      return { type: 'demo.addQualifiedViews', submissionId: submission.id, views };
    },
  };
}

function requestClaim(url: string): ScenarioStep {
  return {
    label: `claim.request (${url})`,
    build: (state) => {
      const submission = submissionByUrl(state, url);
      if (!submission) return null;
      return { type: 'claim.request', submissionId: submission.id };
    },
  };
}

function approveContent(url: string): ScenarioStep {
  return {
    label: `submission.reviewContent approve (${url})`,
    build: (state) => {
      const submission = submissionByUrl(state, url);
      if (!submission) return null;
      return {
        type: 'submission.reviewContent',
        submissionId: submission.id,
        decision: 'approve',
        reason: null,
      };
    },
  };
}

function reviewMetering(
  url: string,
  decision: 'approve' | 'hold' | 'reject',
  reason: string | null,
): ScenarioStep {
  return {
    label: `claim.reviewMetering ${decision} (${url})`,
    build: (state) => {
      const submission = submissionByUrl(state, url);
      if (!submission) return null;
      const claim = latestClaimFor(state, submission.id);
      if (!claim) return null;
      return { type: 'claim.reviewMetering', claimId: claim.id, decision, reason };
    },
  };
}

function fileAppeal(url: string, reason: string): ScenarioStep {
  return {
    label: `appeal.file (${url})`,
    build: (state) => {
      const submission = submissionByUrl(state, url);
      if (!submission) return null;
      const claim = latestClaimFor(state, submission.id);
      if (!claim) return null;
      return { type: 'appeal.file', claimId: claim.id, reason };
    },
  };
}

function startPayout(url: string): ScenarioStep {
  return {
    label: `payout.start (${url})`,
    build: (state) => {
      const submission = submissionByUrl(state, url);
      if (!submission) return null;
      const claim = latestClaimFor(state, submission.id);
      if (!claim) return null;
      const obligation = obligationForClaim(state, claim.id);
      if (!obligation) return null;
      return { type: 'payout.start', obligationId: obligation.id };
    },
  };
}

function payoutOutcome(
  url: string,
  outcome: 'succeeded' | 'failed' | 'unknown',
  reason?: string,
): ScenarioStep {
  return {
    label: `demo.setPayoutOutcome ${outcome} (${url})`,
    build: (state) => {
      const submission = submissionByUrl(state, url);
      if (!submission) return null;
      const claim = latestClaimFor(state, submission.id);
      if (!claim) return null;
      const attempt = latestAttemptForClaim(state, claim.id);
      if (!attempt) return null;
      return { type: 'demo.setPayoutOutcome', attemptId: attempt.id, outcome, reason };
    },
  };
}

function setOutage(url: string, outage: boolean): ScenarioStep {
  return {
    label: `demo.setDataOutage ${outage} (${url})`,
    build: (state) => {
      const submission = submissionByUrl(state, url);
      if (!submission) return null;
      return { type: 'demo.setDataOutage', submissionId: submission.id, outage };
    },
  };
}

function advanceDays(days: number): ScenarioStep {
  return {
    label: `demo.advanceClock ${days}d`,
    build: () => ({ type: 'demo.advanceClock', byMs: days * DAY_MS }),
  };
}

function closeCampaign(title: string): ScenarioStep {
  return {
    label: `campaign.close ${title}`,
    build: (state) => {
      const campaign = campaignByTitle(state, title);
      if (!campaign) return null;
      return {
        type: 'campaign.close',
        campaignId: campaign.id,
        reason: 'Campaign period finished; settling the remaining cases.',
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/** Campaign published, creator connected, one submission metering with 1,000 views. */
const MAIN_FLOW_READY: ScenarioStep[] = [
  signIn(SEED_IDS.userDemo),
  submit({ id: SEED_IDS.campaignKopiRaya }, SEED_IDS.connectionDemoTiktok, DEMO_TIKTOK_URL),
  addViews(DEMO_TIKTOK_URL, 1000),
];

export const SCENARIO_STEPS: Record<ScenarioId, ScenarioStep[]> = {
  // Seed records, signed in as Demo User in the creator workspace.
  baseline: [signIn(SEED_IDS.userDemo)],

  main_flow_ready: MAIN_FLOW_READY,

  // RM60 claimable against RM50 available → open partial offer, nothing reserved.
  partial_budget: [
    signIn(SEED_IDS.userDemo),
    switchWorkspace('merchant'),
    createCampaign(TITLE_PARTIAL, 5_000),
    readyCampaign(TITLE_PARTIAL),
    publishCampaign(TITLE_PARTIAL),
    switchWorkspace('creator'),
    submit({ title: TITLE_PARTIAL }, SEED_IDS.connectionDemoTiktok, DEMO_TIKTOK_URL),
    addViews(DEMO_TIKTOK_URL, 12_000), // 12,000 × RM5/1,000 = RM60, below the RM100 cap
    requestClaim(DEMO_TIKTOK_URL),
  ],

  // Ben's claim leaves RM4 available, below the RM5 minimum → Demo User is waitlisted.
  waitlist: [
    signIn(SEED_IDS.userDemo),
    switchWorkspace('merchant'),
    createCampaign(TITLE_WAITLIST, 900),
    readyCampaign(TITLE_WAITLIST),
    publishCampaign(TITLE_WAITLIST),
    signIn(SEED_IDS.userBen),
    submit({ title: TITLE_WAITLIST }, SEED_IDS.connectionBenTiktok, BEN_TIKTOK_URL),
    addViews(BEN_TIKTOK_URL, 1000),
    requestClaim(BEN_TIKTOK_URL),
    signIn(SEED_IDS.userDemo),
    submit({ title: TITLE_WAITLIST }, SEED_IDS.connectionDemoTiktok, DEMO_TIKTOK_URL),
    addViews(DEMO_TIKTOK_URL, 1000),
    requestClaim(DEMO_TIKTOK_URL),
  ],

  // Metering rejected with a reason; reservation held, appeal window open.
  rejection_appeal: [
    ...MAIN_FLOW_READY,
    requestClaim(DEMO_TIKTOK_URL),
    signIn(SEED_IDS.userOpsReviewer),
    reviewMetering(DEMO_TIKTOK_URL, 'reject', 'Qualified views could not be verified in the window.'),
    signIn(SEED_IDS.userDemo),
  ],

  // Confirmed claim whose payout attempt came back unknown: reconcile only.
  payout_unknown: [
    ...MAIN_FLOW_READY,
    requestClaim(DEMO_TIKTOK_URL),
    switchWorkspace('merchant'),
    approveContent(DEMO_TIKTOK_URL),
    signIn(SEED_IDS.userOpsReviewer),
    reviewMetering(DEMO_TIKTOK_URL, 'approve', null),
    signIn(SEED_IDS.userOpsFinance),
    startPayout(DEMO_TIKTOK_URL),
    payoutOutcome(DEMO_TIKTOK_URL, 'unknown'),
    signIn(SEED_IDS.userDemo),
  ],

  // Confirmed claim with a confirmed failed attempt: controlled retry is allowed.
  payout_failed: [
    ...MAIN_FLOW_READY,
    requestClaim(DEMO_TIKTOK_URL),
    switchWorkspace('merchant'),
    approveContent(DEMO_TIKTOK_URL),
    signIn(SEED_IDS.userOpsReviewer),
    reviewMetering(DEMO_TIKTOK_URL, 'approve', null),
    signIn(SEED_IDS.userOpsFinance),
    startPayout(DEMO_TIKTOK_URL),
    payoutOutcome(DEMO_TIKTOK_URL, 'failed', 'Simulated provider rejected the account number.'),
    signIn(SEED_IDS.userDemo),
  ],

  // Outage across the metering end → full published grace from the recovery time.
  deadline_extension: [
    ...MAIN_FLOW_READY,
    setOutage(DEMO_TIKTOK_URL, true),
    advanceDays(8),
    setOutage(DEMO_TIKTOK_URL, false),
    signIn(SEED_IDS.userDemo),
  ],

  // Closing with an open appeal, a confirmed unpaid claim and a sub-minimum tail.
  campaign_closure: [
    signIn(SEED_IDS.userDemo),
    switchWorkspace('merchant'),
    createCampaign(TITLE_CLOSURE),
    readyCampaign(TITLE_CLOSURE),
    publishCampaign(TITLE_CLOSURE),
    switchWorkspace('creator'),
    submit({ title: TITLE_CLOSURE }, SEED_IDS.connectionDemoTiktok, DEMO_TIKTOK_URL),
    addViews(DEMO_TIKTOK_URL, 1000),
    requestClaim(DEMO_TIKTOK_URL),
    switchWorkspace('merchant'),
    approveContent(DEMO_TIKTOK_URL),
    signIn(SEED_IDS.userOpsReviewer),
    reviewMetering(DEMO_TIKTOK_URL, 'approve', null),
    signIn(SEED_IDS.userBen),
    submit({ title: TITLE_CLOSURE }, SEED_IDS.connectionBenTiktok, BEN_TIKTOK_URL),
    addViews(BEN_TIKTOK_URL, 1000),
    requestClaim(BEN_TIKTOK_URL),
    signIn(SEED_IDS.userOpsReviewer),
    reviewMetering(BEN_TIKTOK_URL, 'reject', 'Metering evidence is inconsistent with the window.'),
    signIn(SEED_IDS.userBen),
    fileAppeal(BEN_TIKTOK_URL, 'The views were inside the window; please re-check the source.'),
    signIn(SEED_IDS.userDemo),
    {
      label: 'connection.connect youtube',
      build: () => ({ type: 'connection.connect', platform: 'youtube', handle: '@demouser' }),
    },
    submitWith(TITLE_CLOSURE, SEED_IDS.userDemo, 'youtube', DEMO_YOUTUBE_URL),
    addViews(DEMO_YOUTUBE_URL, 500), // RM2.50: below the RM5 minimum → unconfirmed tail
    advanceDays(8),
    switchWorkspace('merchant'),
    closeCampaign(TITLE_CLOSURE),
    signIn(SEED_IDS.userDemo),
    switchWorkspace('merchant'),
  ],

  // Source unreachable: the last trusted value and its time stay visible.
  data_outage: [
    ...MAIN_FLOW_READY,
    setOutage(DEMO_TIKTOK_URL, true),
    addViews(DEMO_TIKTOK_URL, 500), // untrusted read; qualified views stay at 1,000
    signIn(SEED_IDS.userDemo),
  ],
};

export type ApplyCommandFn = (
  state: DemoState,
  command: Command,
  meta: CommandMeta,
) => CommandResult;

/**
 * Replays a scenario from `seed`. Throws with the failing step, because a scenario
 * that cannot be reached by the engine's own rules is a defect, not a demo state.
 */
export function replayScenario(
  seed: DemoState,
  scenarioId: ScenarioId,
  apply: ApplyCommandFn,
): DemoState {
  const steps = SCENARIO_STEPS[scenarioId];
  if (!steps) throw new Error(`unknown scenario: ${scenarioId}`);
  let state: DemoState = { ...seed, scenario: scenarioId };
  steps.forEach((step, index) => {
    const command = step.build(state);
    if (command === null) {
      throw new Error(`scenario ${scenarioId} step ${index} [${step.label}]: target record missing`);
    }
    const result = apply(state, command, { commandId: `scenario:${scenarioId}:${index}` });
    if (!result.ok) {
      const detail = result.detail ? ` (${result.detail})` : '';
      throw new Error(`scenario ${scenarioId} step ${index} [${step.label}]: ${result.code}${detail}`);
    }
    state = result.state;
  });
  return state;
}
