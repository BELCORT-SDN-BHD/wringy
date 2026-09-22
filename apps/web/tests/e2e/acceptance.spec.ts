/**
 * The P01–P11 acceptance run (ticket #9, spec issue #1's 原型验收表).
 *
 * One `test.describe` per acceptance row, named with its P-number, so a run's
 * output is the acceptance record: a row that fails has a named test and a
 * screenshot, and a row that passes has a named test and a screenshot. The
 * results are transcribed into `docs/m1-prototype/acceptance-record.md`.
 *
 * The role specs (`creator.spec.ts`, `merchant.spec.ts`, `ops.spec.ts`) prove the
 * rules in depth. This file is deliberately different: it proves the rows of the
 * acceptance table end to end, across roles, in the order a reviewer reads them,
 * and it writes the evidence.
 *
 * Viewports. Issue #1 sets the bar: "最低检查手机390px与电脑1440px，并抽查320px不出现
 * 关键操作被遮挡". The P-row tests therefore run at `mobile` (390) and `desktop`
 * (1440) and are skipped at `small` (320); the 320px work is the dedicated spot
 * check at the end of this file, which runs only at `small` and asserts exactly
 * what the spec asks — no sideways scroll and no primary action covered.
 */

import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { DEFAULT_RULES, loadScenario as buildScenarioState } from '../../src/domain';
import type { Claim, DemoState, Submission } from '../../src/domain/types';

import {
  acceptanceShot,
  addViews,
  advanceClock,
  clearStoredDemo,
  confirmWith,
  dismissLocalePrompt,
  expectBuckets,
  expectNoHorizontalOverflow,
  expectPrimaryActionUsable,
  injectState,
  loadScenario,
  loadScenarioAsGuest,
  open,
  readStoredState,
  replay,
  resetDemo,
  setLocale,
  setProviderOutcome,
  settleToasts,
  signInAs,
  stateAs,
  waitForHydration,
} from './helpers';

const KOPI_RAYA = 'cmp-kopi-raya';
const KOPI_DRAFT = 'cmp-kopi-draft';
const DEMO_USER = 'user-demo';
const DEMO_TIKTOK_URL = 'https://www.tiktok.com/@demouser/video/7400000000000000001';
const POOL_SEN = DEFAULT_RULES.poolSen; // 200_000
const FIVE_RINGGIT = DEFAULT_RULES.minClaimSen; // 500

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * The P-rows run at 390 and 1440; 320 is the dedicated spot check at the end.
 *
 * Declared as a call rather than a bare condition so the reason travels with the
 * skip into the report: a skipped acceptance row has to say why it was skipped.
 */
function skipAtSmall(): void {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name === 'small',
      'issue #1 asks for 390px and 1440px in full and a 320px spot check; the spot check is the last describe in this file',
    );
  });
}

/** The spot check is only meaningful at the width it is a spot check for. */
function onlyAtSmall(): void {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'small',
      'the 320px spot check runs in the `small` project only',
    );
  });
}

function ownSubmission(state: DemoState, userId = DEMO_USER): Submission {
  const found = Object.values(state.submissions).find(
    (candidate) => candidate.creatorId === userId,
  );
  if (!found) throw new Error(`no submission for ${userId} in this state`);
  return found;
}

function ownClaim(state: DemoState, userId = DEMO_USER): Claim {
  const found = Object.values(state.claims).find((candidate) => candidate.creatorId === userId);
  if (!found) throw new Error(`no claim for ${userId} in this state`);
  return found;
}

async function storedClaim(page: Page): Promise<Claim> {
  const stored = await readStoredState(page);
  if (!stored) throw new Error('nothing was persisted');
  return ownClaim(stored);
}

/** The viewport suffix the acceptance screenshots are filed under. */
function shotSuffix(testInfo: TestInfo): string {
  return testInfo.project.name === 'desktop' ? '1440' : testInfo.project.name === 'mobile' ? '390' : '320';
}

// ===========================================================================
// P01 — the three roles complete the same campaign
// ===========================================================================

test.describe('P01 all three roles complete one campaign', () => {
  skipAtSmall();
  test.slow();

  test('submit, claim, both reviews and a payout, with the four amounts agreeing everywhere', async ({
    page,
  }, testInfo) => {
    // Starts from the seed, so nothing in this run depends on a pre-built claim:
    // "按主流程无需手工改数据文件完成".
    await loadScenario(page, 'baseline');
    await signInAs(page, 'creator');

    // ---- 1. the creator submits a link ---------------------------------
    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    await page.getByTestId('submit-url').fill(DEMO_TIKTOK_URL);
    await page.getByTestId('submit-link').click();
    await page.waitForURL(/\/creator\/submissions\/sub_\d+$/);
    const submissionId = page.url().split('/').pop() as string;

    // Nothing is committed yet, so the pool is untouched in every role.
    await expectBuckets(page, [POOL_SEN, 0, 0, 0]);

    // ---- 2. the demo tools add the qualified views ----------------------
    await addViews(page, submissionId, 1000);
    await open(page, `/creator/submissions/${submissionId}`);
    await expect(page.getByTestId('reward-claimable').locator('[data-money]')).toHaveAttribute(
      'data-money',
      String(FIVE_RINGGIT),
    );

    // ---- 3. the claim reserves it --------------------------------------
    await page.getByTestId('claim-reward').click();
    await confirmWith(page);
    await expect(page.getByTestId('claim-reserved')).toBeVisible();
    await expectBuckets(page, [POOL_SEN - FIVE_RINGGIT, FIVE_RINGGIT, 0, 0]);

    const claim = await storedClaim(page);
    expect(claim.amountSen).toBe(FIVE_RINGGIT);
    expect(claim.status).toBe('pending_review');

    // ---- 4. the merchant decides the content ---------------------------
    await signInAs(page, 'merchant');
    // The four amounts live on the campaign, so that is where the merchant reads
    // the same reservation the creator just made.
    await open(page, `/merchant/campaigns/${KOPI_RAYA}`);
    await expectBuckets(page, [POOL_SEN - FIVE_RINGGIT, FIVE_RINGGIT, 0, 0]);

    await open(page, `/merchant/submissions/${submissionId}`);
    // And the submission's own panel carries the same amount, not a second one.
    await expect(page.getByTestId('reward-panel')).toContainText('5.00');
    await page.getByTestId('content-approve').click();
    await confirmWith(page);
    await expect(page.getByTestId('content-decided')).toBeVisible();

    // One approval is not a confirmation: the money has not moved.
    await open(page, `/merchant/campaigns/${KOPI_RAYA}`);
    await expectBuckets(page, [POOL_SEN - FIVE_RINGGIT, FIVE_RINGGIT, 0, 0]);

    // ---- 5. operations decides the metering ----------------------------
    await signInAs(page, 'ops_reviewer');
    await open(page, `/ops/claims/${claim.id}`);
    await page.getByTestId('ops-metering-approve').click();
    await confirmWith(page);
    await expect(page.locator('[data-status-group="claim"]').first()).toHaveAttribute(
      'data-status-code',
      'confirmed_unpaid',
    );
    await expectBuckets(page, [POOL_SEN - FIVE_RINGGIT, 0, FIVE_RINGGIT, 0]);

    // ---- 6. finance pays it --------------------------------------------
    const withObligation = await readStoredState(page);
    const obligation = Object.values(withObligation?.obligations ?? {})[0];
    expect(obligation, 'confirming a claim must create an obligation').toBeDefined();

    await signInAs(page, 'ops_finance');
    await open(page, `/ops/payouts/${obligation.id}`);
    await page.getByTestId('ops-start-open').click();
    await confirmWith(page);

    const afterStart = await readStoredState(page);
    const attempt = Object.values(afterStart?.payoutAttempts ?? {})[0];
    expect(attempt, 'starting a payout must record an attempt').toBeDefined();
    await setProviderOutcome(page, attempt.providerRef, 'Funds available');
    await expect(page.getByTestId('ops-payout-settled')).toBeVisible();

    // ---- 7. the same four amounts, read by all three roles -------------
    const paid: [number, number, number, number] = [POOL_SEN - FIVE_RINGGIT, 0, 0, FIVE_RINGGIT];

    await open(page, `/ops/claims/${claim.id}`);
    await expectBuckets(page, paid);

    await signInAs(page, 'merchant');
    await open(page, `/merchant/campaigns/${KOPI_RAYA}`);
    await expectBuckets(page, paid);

    await signInAs(page, 'creator');
    await open(page, `/creator/claims/${claim.id}`);
    await expect(page.locator('[data-status-group="claim"]').first()).toHaveAttribute(
      'data-status-code',
      'paid',
    );
    await open(page, '/creator');
    await expectBuckets(page, paid);

    await settleToasts(page);
    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p01', shotSuffix(testInfo));
  });
});

// ===========================================================================
// P02 — configuration is clear and validated
// ===========================================================================

test.describe('P02 the configuration is clear and validated', () => {
  skipAtSmall();

  test('the defaults are the approved ones, an illegal minimum is refused, and the preview agrees', async ({
    page,
  }, testInfo) => {
    await injectState(page, stateAs('baseline', 'merchant'), `/merchant/campaigns/${KOPI_DRAFT}/edit`);
    await waitForHydration(page);
    await dismissLocalePrompt(page);

    // The draft opens on the approved defaults, in the editor's own fields.
    await expect(page.getByTestId('editor-defaults')).toBeVisible();
    await expect(page.getByTestId('field-pool')).toHaveValue('2000.00');
    await expect(page.getByTestId('field-rate')).toHaveValue('5.00');
    await expect(page.getByTestId('field-min-claim')).toHaveValue('5.00');
    await expect(page.getByTestId('field-cap')).toHaveValue('100.00');
    await expect(page.getByTestId('field-metering-days')).toHaveValue('7');
    await expect(page.getByTestId('field-grace-days')).toHaveValue('7');
    // Never a number: the fee is not decided.
    await expect(page.getByTestId('field-service-fee')).toContainText(/pending/i);

    // A minimum above the cap is an illegal combination and is refused.
    await page.getByTestId('field-min-claim').fill('200');
    await page.getByTestId('editor-save').click();
    await expect(page.getByTestId('editor-error-summary')).toBeVisible();
    await acceptanceShot(page, 'p02-invalid', shotSuffix(testInfo));

    // A high view threshold with a lower cap is legal, and the cap is explained.
    await page.getByTestId('field-min-claim').fill('5');
    await page.getByTestId('field-threshold').fill('100000');
    await page.getByTestId('field-cap').fill('50');
    await expect(page.getByTestId('cap-explanation')).toBeVisible();
    await page.getByTestId('editor-save').click();
    await settleToasts(page);

    const saved = await readStoredState(page);
    expect(saved?.campaigns[KOPI_DRAFT].rules.viewThreshold).toBe(100_000);
    expect(saved?.campaigns[KOPI_DRAFT].rules.capPerSubmissionSen).toBe(5_000);

    // The preview states the same numbers the editor holds, AND the derived fact
    // the rule asks to be shown: "必须明确展示'达10万观看，奖励封顶RM100'". The rule sheet
    // here is literally the component the public campaign page renders, so a
    // creator reads the same sentence.
    await open(page, `/merchant/campaigns/${KOPI_DRAFT}/preview`);
    const preview = page.locator('body');
    await expect(preview).toContainText('100,000');
    await expect(preview).toContainText('50.00');
    await expect(page.getByTestId('campaign-cap-at-threshold')).toContainText(
      'At 100,000 qualified views the reward is capped at RM 50.00',
    );

    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p02', shotSuffix(testInfo));
  });
});

// ===========================================================================
// P03 — browse first, then join
// ===========================================================================

test.describe('P03 browse first, then join', () => {
  skipAtSmall();

  test('a signed-out visitor reads the rules and joins only through the simulated Google entry', async ({
    page,
  }, testInfo) => {
    await loadScenarioAsGuest(page, 'baseline', `/campaigns/${KOPI_RAYA}`);

    // The public detail states the rate, the cap, the minimum and the dates
    // without an identity.
    const body = page.locator('body');
    await expect(body).toContainText('5.00');
    await expect(body).toContainText('100.00');
    await expect(page.getByTestId('header-sign-in')).toBeVisible();

    await acceptanceShot(page, 'p03-public', shotSuffix(testInfo));

    await page.getByTestId('join-campaign').click();
    await page.waitForURL(/\/sign-in/);
    await waitForHydration(page);

    // One entry, and no other credential control anywhere on the page.
    await expect(page.getByTestId('sign-in-google')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[autocomplete="one-time-code"]')).toHaveCount(0);
    await acceptanceShot(page, 'p03', shotSuffix(testInfo));

    await page.getByTestId('sign-in-google').click();
    await expect(page.getByTestId('user-menu')).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });
});

// ===========================================================================
// P04 — the link and the simulated data are explicit
// ===========================================================================

test.describe('P04 the link and the simulated data are explicit', () => {
  skipAtSmall();

  test('no upload entry, a duplicate link is refused, and a missing read is never 0 views', async ({
    page,
  }, testInfo) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');

    await open(page, '/creator/accounts');
    await expect(page.getByTestId('accounts-no-upload')).toBeVisible();
    // Nothing anywhere takes a file.
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    // The same post again is refused rather than recorded twice.
    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    await page.getByTestId('submit-url').fill(DEMO_TIKTOK_URL);
    await page.getByTestId('submit-link').click();
    await expect(page.getByTestId('submit-error')).toHaveAttribute(
      'data-error-code',
      'duplicate_post',
    );
    const stored = await readStoredState(page);
    expect(
      Object.values(stored?.submissions ?? {}).filter((s) => s.creatorId === DEMO_USER),
    ).toHaveLength(1);
    await acceptanceShot(page, 'p04-duplicate', shotSuffix(testInfo));

    // An unreadable source keeps the last trusted value and says the read failed.
    const outage = await loadScenario(page, 'data_outage');
    const submission = ownSubmission(outage);
    await open(page, `/creator/submissions/${submission.id}`);
    await expect(page.getByTestId('submission-status')).toHaveAttribute(
      'data-submission-status',
      'data_unavailable',
    );
    const views = page.getByTestId('reward-qualified-views');
    await expect(views).toBeVisible();
    await expect(views).not.toContainText(/^0$/);
    await expect(page.getByTestId('reward-last-trusted')).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p04', shotSuffix(testInfo));
  });
});

// ===========================================================================
// P05 — the claim amount and the statuses agree
// ===========================================================================

test.describe('P05 the claim amount and the statuses agree', () => {
  skipAtSmall();

  test('the cap holds, one pending claim per submission, and a second press adds nothing', async ({
    page,
  }, testInfo) => {
    const ready = await loadScenario(page, 'main_flow_ready');
    const submission = ownSubmission(ready);
    await signInAs(page, 'creator');

    // 1,000 qualified views at RM5/1,000 is RM5 claimable.
    await open(page, `/creator/submissions/${submission.id}`);
    await expect(page.getByTestId('reward-claimable').locator('[data-money]')).toHaveAttribute(
      'data-money',
      String(FIVE_RINGGIT),
    );

    await page.getByTestId('claim-reward').click();
    await confirmWith(page);
    await expect(page.getByTestId('claim-reserved')).toBeVisible();

    // A second claim on the same submission is blocked while one is pending.
    await expect(page.getByTestId('reward-pending-claim')).toBeVisible();
    await expect(page.getByTestId('claim-reward')).toBeDisabled();
    const afterOne = await readStoredState(page);
    expect(Object.values(afterOne?.claims ?? {})).toHaveLength(1);
    await acceptanceShot(page, 'p05-pending', shotSuffix(testInfo));

    // The cumulative cap is RM100 per post, so 30,000 more views do not pay 150.
    await addViews(page, submission.id, 30_000);
    await open(page, `/creator/submissions/${submission.id}`);
    await expect(page.getByTestId('reward-cap-reached')).toBeVisible();
    await expect(page.getByTestId('reward-cap').locator('[data-money]').first()).toHaveAttribute(
      'data-money',
      String(DEFAULT_RULES.capPerSubmissionSen),
    );

    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p05', shotSuffix(testInfo));
  });
});

// ===========================================================================
// P06 — a partial budget and the waitlist
// ===========================================================================

test.describe('P06 a partial budget and the waitlist', () => {
  skipAtSmall();

  test('only an exact consent reserves, and a waitlisted entry holds nothing', async ({
    page,
  }, testInfo) => {
    const partial = await loadScenario(page, 'partial_budget');
    const submission = ownSubmission(partial);
    await open(page, `/creator/submissions/${submission.id}`);

    // RM60 claimable against RM50 available: an offer, and nothing reserved.
    const panel = page.getByTestId('partial-offer-panel');
    await expect(panel).toContainText('60.00');
    await expect(panel).toContainText('50.00');
    await expect(page.getByTestId('reward-reserved').locator('[data-money]')).toHaveAttribute(
      'data-money',
      '0',
    );
    await acceptanceShot(page, 'p06-offer', shotSuffix(testInfo));

    await page.getByTestId('offer-review').click();
    await page.getByTestId('offer-consent').click();
    await expect(page.getByTestId('partial-offer-dialog')).toHaveCount(0);
    await expect(page.getByTestId('reward-reserved').locator('[data-money]')).toHaveAttribute(
      'data-money',
      '5000',
    );

    const consented = await readStoredState(page);
    const claim = ownClaim(consented!);
    expect(claim.amountSen).toBe(5_000);
    expect(claim.isPartial).toBe(true);
    // The remainder is recorded as unreserved, not forfeited. RM60 claimable
    // minus the RM50 consented to is RM10, which is never paid and never lost.
    expect(claim.unreservedRemainderSen).toBe(1_000);

    // Below the minimum, the entry waits and reserves nothing.
    const waitlisted = await loadScenario(page, 'waitlist');
    await open(page, '/creator/claims');
    await expect(page.getByTestId('waitlist-list')).toContainText(
      'No reservation and no payment guarantee',
    );
    expect(
      Object.values(waitlisted.claims).filter((entry) => entry.creatorId === DEMO_USER),
    ).toHaveLength(0);

    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p06', shotSuffix(testInfo));
  });
});

// ===========================================================================
// P07 — review and appeal
// ===========================================================================

test.describe('P07 review and appeal', () => {
  skipAtSmall();

  test('a rejection keeps its reason and its reservation, and an appeal does not re-order the queue', async ({
    page,
  }, testInfo) => {
    const rejected = await loadScenario(page, 'rejection_appeal');
    const claim = ownClaim(rejected);
    await open(page, `/creator/claims/${claim.id}`);

    // The written reason is readable, and the reservation is still held.
    await expect(page.getByTestId('rejection-reason')).toBeVisible();
    await expect(page.getByTestId('reservation-held')).toBeVisible();
    await expect(page.getByTestId('appeal-deadline')).toBeVisible();
    await acceptanceShot(page, 'p07-rejected', shotSuffix(testInfo));

    // Filing an appeal keeps the reservation and the queue position.
    // The appeal is a form with a required reason, not a confirmation dialog:
    // the creator is writing evidence, not agreeing to something.
    await page.getByTestId('appeal-reason').fill('The views were inside the metering window.');
    await page.getByTestId('appeal-file').click();
    await expect(page.locator('[data-status-group="claim"]').first()).toHaveAttribute(
      'data-status-code',
      'appealing',
    );

    const appealed = await readStoredState(page);
    const held = ownClaim(appealed!);
    expect(held.seq, 'an appeal must not change the queue position').toBe(claim.seq);
    expect(held.amountSen, 'an appeal must not change the amount').toBe(claim.amountSen);

    // Operations cannot release the reservation while the appeal is open.
    await signInAs(page, 'ops_reviewer');
    await open(page, `/ops/claims/${claim.id}`);
    await expect(page.getByTestId('ops-finalize-blocked')).toBeVisible();
    await expect(page.getByTestId('ops-reservation-held')).toBeVisible();

    // Upholding it continues the check rather than closing anything. The decision
    // lives on the appeal's own page, which is where the evidence is.
    const filed = await readStoredState(page);
    const appeal = Object.values(filed?.appeals ?? {})[0];
    expect(appeal, 'filing an appeal must create an appeal record').toBeDefined();
    await open(page, `/ops/appeals/${appeal.id}`);
    await expect(page.getByTestId('ops-appeal-creator-reason')).toBeVisible();
    await page.getByTestId('ops-appeal-uphold').click();
    await confirmWith(page, 'The source was re-read; the window is correct.');

    const resolved = await readStoredState(page);
    expect(Object.values(resolved?.appeals ?? {})[0].status).toBe('upheld');
    // Neither the queue position nor the amount moved.
    expect(ownClaim(resolved!).seq).toBe(claim.seq);
    expect(ownClaim(resolved!).amountSen).toBe(claim.amountSen);

    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p07', shotSuffix(testInfo));
  });
});

// ===========================================================================
// P08 — payouts and the operations exceptions
// ===========================================================================

test.describe('P08 payouts and the operations exceptions', () => {
  skipAtSmall();

  test('an unknown result offers reconciliation only, and a retry needs a confirmed failure', async ({
    page,
  }, testInfo) => {
    const unknown = await loadScenario(page, 'payout_unknown');
    const attempt = Object.values(unknown.payoutAttempts)[0];
    const obligation = Object.values(unknown.obligations)[0];

    await signInAs(page, 'ops_finance');
    await open(page, `/ops/payouts/${obligation.id}`);

    await expect(page.locator('[data-attempt-status="unknown"]')).toBeVisible();
    // There is no "pay again", and the page says why.
    await expect(page.getByTestId('ops-no-pay-again')).toBeVisible();
    await expect(page.getByTestId('ops-start-open')).toBeDisabled();
    await expect(page.getByTestId('ops-payout-retry')).toHaveCount(0);
    // The only action is reconciling against the original attempt.
    await expect(page.getByTestId('ops-reconcile-open')).toBeEnabled();
    await acceptanceShot(page, 'p08-unknown', shotSuffix(testInfo));

    expect(attempt.status).toBe('unknown');

    // A confirmed failure is the evidence a controlled retry needs.
    const failed = await loadScenario(page, 'payout_failed');
    const failedObligation = Object.values(failed.obligations)[0];
    await signInAs(page, 'ops_finance');
    await open(page, `/ops/payouts/${failedObligation.id}`);
    await expect(page.locator('[data-attempt-status="failed"]')).toBeVisible();
    await expect(page.getByTestId('ops-start-blocked')).toHaveAttribute('data-block', 'failed');
    await expect(page.getByTestId('ops-retry-open')).toBeEnabled();

    // Paid means the provider account; bank settlement stays a separate fact.
    await expect(page.getByTestId('ops-bank-settlement')).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p08', shotSuffix(testInfo));
  });
});

// ===========================================================================
// P09 — the deadlines and the retention end are clear
// ===========================================================================

test.describe('P09 the deadlines and the retention end are clear', () => {
  skipAtSmall();
  test.slow();

  test('7 days of metering and 7 of grace, read identically by all three roles', async ({
    page,
  }, testInfo) => {
    const ready = await loadScenario(page, 'main_flow_ready');
    const submission = ownSubmission(ready);

    // The approved example: accepted 1 Sep 12:00 → metering ends 8 Sep 12:00 →
    // claim deadline 15 Sep 12:00.
    expect(submission.meteringEndsAt).toBe('2026-09-08T12:00:00+08:00');
    expect(submission.claimDeadlineAt).toBe('2026-09-15T12:00:00+08:00');

    // `DateTimeText` renders a <time datetime> with the exact instant, so the
    // three roles are compared on the instant rather than on a rendered label
    // that also carries its own row heading.
    const instantOf = (testId: string) =>
      page.getByTestId(testId).locator('time').first().getAttribute('datetime');

    await open(page, `/creator/submissions/${submission.id}`);
    const creatorMetering = await instantOf('metering-ends');
    const creatorDeadline = await instantOf('effective-claim-deadline');
    expect(creatorMetering).toBe('2026-09-08T12:00:00+08:00');
    expect(creatorDeadline).toBe('2026-09-15T12:00:00+08:00');
    await page.getByTestId('submission-window').scrollIntoViewIfNeeded();
    await acceptanceShot(page, 'p09-creator', shotSuffix(testInfo));

    await signInAs(page, 'merchant');
    await open(page, `/merchant/submissions/${submission.id}`);
    await expect(page.getByTestId('merchant-window')).toBeVisible();
    expect(await instantOf('merchant-metering-ends')).toBe(creatorMetering);
    expect(await instantOf('merchant-effective-claim-deadline')).toBe(creatorDeadline);
    await page.getByTestId('merchant-window').scrollIntoViewIfNeeded();
    await acceptanceShot(page, 'p09-merchant', shotSuffix(testInfo));

    await signInAs(page, 'ops_reviewer');
    await open(page, `/ops/submissions/${submission.id}`);
    expect(await instantOf('ops-effective-deadline')).toBe(creatorDeadline);
    await page.getByTestId('ops-extensions').scrollIntoViewIfNeeded();
    await acceptanceShot(page, 'p09', shotSuffix(testInfo));

    await expectNoHorizontalOverflow(page);
  });

  test('views after the metering end are not counted, and the demo tools say so', async ({
    page,
  }) => {
    const ready = await loadScenario(page, 'main_flow_ready');
    const submission = ownSubmission(ready);
    await signInAs(page, 'creator');

    // Past the metering end through the demo tools, the way a reviewer would.
    await advanceClock(page, 'meteringEnd');
    await advanceClock(page, 'hour');
    await open(page, `/creator/submissions/${submission.id}`);
    await expect(page.getByTestId('submission-status')).toHaveAttribute(
      'data-submission-status',
      'metering_ended',
    );
    const before = await page
      .getByTestId('reward-qualified-views')
      .locator('[data-views], span')
      .first()
      .innerText();

    await addViews(page, submission.id, 5_000);
    // The panel must not claim it added anything it did not add.
    await expect(page.locator('[data-sonner-toast]')).toContainText(
      'the metering window has closed',
    );
    await settleToasts(page);

    await open(page, `/creator/submissions/${submission.id}`);
    const after = await page
      .getByTestId('reward-qualified-views')
      .locator('[data-views], span')
      .first()
      .innerText();
    expect(after, 'a view added after the metering end must not count').toBe(before);

    const stored = await readStoredState(page);
    expect(stored?.submissions[submission.id].snapshots.at(-1)?.qualifiedViewsInWindow).toBe(1_000);
  });

  test('an outage across the metering end grants the published grace again, with a reason', async ({
    page,
  }, testInfo) => {
    const extended = await loadScenario(page, 'deadline_extension');
    const submission = ownSubmission(extended);

    // Computed, not typed: unblocked 9 Sep + 7 days of published grace.
    expect(submission.extensions).toHaveLength(1);
    expect(submission.extensions[0].reason).toBe('data_outage');
    expect(submission.extensions[0].newDeadlineAt).toBe('2026-09-16T12:00:00+08:00');
    // Metering is never re-opened.
    expect(submission.meteringEndsAt).toBe('2026-09-08T12:00:00+08:00');

    await open(page, `/creator/submissions/${submission.id}`);
    const extensions = page.getByTestId('submission-extensions');
    await expect(extensions).toBeVisible();
    await extensions.scrollIntoViewIfNeeded();
    await expect(extensions).toContainText('unreadable');
    // The retention end names the reason it is that date.
    await expect(page.getByTestId('submission-retention')).toBeVisible();

    // All three roles were told, each in its own context.
    const notices = Object.values(extended.notifications).filter(
      (entry) => entry.kind === 'deadline.claim_deadline_extended',
    );
    expect(notices.map((entry) => entry.recipientRole).sort()).toEqual([
      'creator',
      'merchant',
      'ops_reviewer',
    ]);

    await signInAs(page, 'merchant');
    await open(page, `/merchant/submissions/${submission.id}`);
    await expect(page.getByTestId('merchant-extensions')).toBeVisible();
    await page.getByTestId('merchant-extensions').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('merchant-effective-claim-deadline')).toContainText('16');

    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p09-extension', shotSuffix(testInfo));
  });

  test('a link accepted on the last submission day still gets a full metering window', async ({
    page,
  }) => {
    // The clock jump is built with the same `demo.advanceClock` command the panel
    // sends, because the panel only offers +1h/+1d/+7d and 13d 23h would be
    // thirty sheet interactions. The submission itself is made through the real
    // creator control and the window is read off the page.
    const lastDay = replay(
      buildScenarioState('baseline'),
      [{ type: 'demo.advanceClock', byMs: 13 * DAY_MS + 23 * HOUR_MS }],
      'p09-last-day',
    );
    await injectState(page, lastDay, '/');
    await dismissLocalePrompt(page);
    await signInAs(page, 'creator');

    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    await page.getByTestId('submit-url').fill(DEMO_TIKTOK_URL);
    await page.getByTestId('submit-link').click();
    await page.waitForURL(/\/creator\/submissions\/sub_\d+$/);

    const stored = await readStoredState(page);
    const submission = ownSubmission(stored!);
    // Published 1 Sep 12:00, so intake closes 15 Sep 12:00 and this link is
    // accepted with an hour to spare. The window is not truncated by that close:
    // metering still runs a full 7 days and the grace a full 7 after it.
    expect(submission.acceptedAt).toBe('2026-09-15T11:00:00+08:00');
    expect(submission.meteringEndsAt).toBe('2026-09-22T11:00:00+08:00');
    expect(submission.claimDeadlineAt).toBe('2026-09-29T11:00:00+08:00');
    expect(
      await page.getByTestId('metering-ends').locator('time').first().getAttribute('datetime'),
    ).toBe('2026-09-22T11:00:00+08:00');
  });

  test('a closing campaign never reads as fully settled while a case or money is open', async ({
    page,
  }, testInfo) => {
    const closing = await loadScenario(page, 'campaign_closure');
    // The scenario publishes its own campaign rather than reusing the seed's, so
    // the id is read from the claim that is under appeal.
    const appealing = Object.values(closing.claims).find((claim) => claim.status === 'appealing');
    if (!appealing) throw new Error('the closure scenario must carry a claim under appeal');
    const closingCampaignId = appealing.campaignId;
    expect(closing.campaigns[closingCampaignId].status).toBe('closed');

    await signInAs(page, 'merchant');
    await open(page, `/merchant/campaigns/${closingCampaignId}`);
    const closure = page.getByTestId('closure-panel');
    await expect(closure).toHaveAttribute('data-fully-settled', 'false');
    // The tail below the minimum is disclosed before closure, not after.
    await expect(page.getByTestId('closure-tail')).toBeVisible();
    // The refund of the unused pool is never automatic.
    await expect(page.getByTestId('closure-refund')).toContainText(/pending/i);
    await page.getByTestId('closure-panel').scrollIntoViewIfNeeded();
    await acceptanceShot(page, 'p09-closure-merchant', shotSuffix(testInfo));

    // Operations reads the same verdict, because operations resolves what it waits on.
    await signInAs(page, 'ops_reviewer');
    await open(page, `/ops/campaigns/${closingCampaignId}/readiness`);
    await expect(page.getByTestId('ops-closure-panel')).toHaveAttribute(
      'data-fully-settled',
      'false',
    );
    await expect(page.getByTestId('ops-closure-verdict')).toContainText(/not fully settled/i);
    await expect(page.getByTestId('ops-closure-refund')).toContainText(/pending/i);

    await expectNoHorizontalOverflow(page);
    await page.getByTestId('ops-closure-panel').scrollIntoViewIfNeeded();
    await acceptanceShot(page, 'p09-closure-ops', shotSuffix(testInfo));
  });
});

// ===========================================================================
// P10 — language, phone and notifications
// ===========================================================================

test.describe('P10 language, phone and notifications', () => {
  skipAtSmall();
  test.slow();

  test('all three languages on a form keep the typed input', async ({ page }, testInfo) => {
    await injectState(page, stateAs('baseline', 'merchant'), `/merchant/campaigns/${KOPI_DRAFT}/edit`);
    await waitForHydration(page);
    await dismissLocalePrompt(page);

    const typedTitle = 'Kopi Kita Cold Brew — 冷萃 sejuk';
    await page.getByTestId('field-title').fill(typedTitle);
    await page.getByTestId('field-pool').fill('1750.25');
    await page.getByTestId('field-threshold').fill('100000');

    for (const locale of ['ms-MY', 'zh-Hans-MY', 'en-MY'] as const) {
      await settleToasts(page);
      await setLocale(page, locale);
      // The catalogue is swapped in place, so the form is not remounted and the
      // typed values are still there — including the ones never saved.
      await expect(page.getByTestId('field-title')).toHaveValue(typedTitle);
      await expect(page.getByTestId('field-pool')).toHaveValue('1750.25');
      await expect(page.getByTestId('field-threshold')).toHaveValue('100000');
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    }

    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p10-form', shotSuffix(testInfo));
  });

  test('the right role receives each event, the read flag survives a reload, and the email is only a preview', async ({
    page,
  }, testInfo) => {
    await loadScenario(page, 'main_flow_ready');

    // One event, two rows: Demo User holds both the creator workspace and the org.
    await signInAs(page, 'creator');
    await open(page, '/notifications');
    const creatorList = page.getByTestId('notifications-list');
    await expect(creatorList).toContainText('Received as creator');
    await expect(creatorList).not.toContainText('Received as merchant');

    // The simulated email says it was not sent.
    await page.getByTestId('email-preview-open').first().click();
    const email = page.locator('[data-app-widget="email-preview"]');
    await expect(email).toBeVisible();
    await expect(email).toContainText('not sent');
    await acceptanceShot(page, 'p10-email', shotSuffix(testInfo));
    await page.keyboard.press('Escape');
    await expect(email).toHaveCount(0);

    // Marking one row read persists across a reload.
    const unread = creatorList.locator('[data-unread="true"]').first();
    await expect(unread).toBeVisible();
    await unread.getByTestId('mark-read').click();
    await settleToasts(page);
    await page.reload();
    await waitForHydration(page);

    const stored = await readStoredState(page);
    const readRows = Object.values(stored?.notifications ?? {}).filter(
      (entry) => entry.readAt !== null,
    );
    expect(readRows.length).toBeGreaterThan(0);
    // And the merchant's own row for the same event is still unread.
    await signInAs(page, 'merchant');
    await open(page, '/notifications');
    await expect(page.getByTestId('notifications-list')).toContainText('Received as merchant');

    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p10', shotSuffix(testInfo));
  });
});

// ===========================================================================
// P11 — the demo can be run again
// ===========================================================================

test.describe('P11 the demo can be run again', () => {
  skipAtSmall();
  test.slow();

  test('a reload keeps the progress, reset returns to the seed, and the main flow runs twice', async ({
    page,
  }, testInfo) => {
    const ready = await loadScenario(page, 'main_flow_ready');
    const submission = ownSubmission(ready);
    await signInAs(page, 'creator');

    // ---- run once -------------------------------------------------------
    await open(page, `/creator/submissions/${submission.id}`);
    await page.getByTestId('claim-reward').click();
    await confirmWith(page);
    await expect(page.getByTestId('claim-reserved')).toBeVisible();

    // A refresh keeps it: the demo records live in this browser.
    await page.reload();
    await waitForHydration(page);
    await expectBuckets(page, [POOL_SEN - FIVE_RINGGIT, FIVE_RINGGIT, 0, 0]);
    const afterReload = await readStoredState(page);
    expect(Object.values(afterReload?.claims ?? {})).toHaveLength(1);
    await acceptanceShot(page, 'p11-kept', shotSuffix(testInfo));

    // ---- reset ----------------------------------------------------------
    await settleToasts(page);
    await resetDemo(page);
    const afterReset = await readStoredState(page);
    expect(afterReset?.scenario).toBe('baseline');
    expect(Object.values(afterReset?.claims ?? {})).toHaveLength(0);
    // The seed's own records are back, not an empty store.
    expect(Object.keys(afterReset?.campaigns ?? {})).toContain(KOPI_RAYA);

    // ---- run the same flow a second time --------------------------------
    await signInAs(page, 'creator');
    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    await page.getByTestId('submit-url').fill(DEMO_TIKTOK_URL);
    await page.getByTestId('submit-link').click();
    await page.waitForURL(/\/creator\/submissions\/sub_\d+$/);
    const secondId = page.url().split('/').pop() as string;

    await addViews(page, secondId, 1000);
    await open(page, `/creator/submissions/${secondId}`);
    await page.getByTestId('claim-reward').click();
    await confirmWith(page);
    await expect(page.getByTestId('claim-reserved')).toBeVisible();
    await expectBuckets(page, [POOL_SEN - FIVE_RINGGIT, FIVE_RINGGIT, 0, 0]);

    await settleToasts(page);
    await expectNoHorizontalOverflow(page);
    await acceptanceShot(page, 'p11', shotSuffix(testInfo));
  });

  test('a cold start with nothing stored renders the seed rather than failing', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    await clearStoredDemo(page);
    await expect(page.getByTestId('demo-badge')).toBeVisible();
    await open(page, '/campaigns');
    await expect(page.getByRole('listitem').first()).toBeVisible();
  });

  test('the guided demo names every step and every scenario, and its Go switches role', async ({
    page,
  }, testInfo) => {
    await loadScenarioAsGuest(page, 'baseline', '/demo');

    // Seven numbered steps and one card per scenario preset.
    await expect(page.getByTestId('demo-guide-flow').locator('> li')).toHaveCount(7);
    await expect(page.getByTestId('demo-guide-scenarios').locator('> li')).toHaveCount(10);
    await expect(page.getByTestId('demo-guide-clock')).toBeVisible();
    await expect(page.getByTestId('demo-guide-buckets')).toContainText('1995');
    await acceptanceShot(page, 'p11-guide', shotSuffix(testInfo));

    // "Go" reaches the page as the role the step belongs to, from a guest.
    await page.getByTestId('demo-guide-go-step-1').click();
    await page.waitForURL(/\/merchant\/campaigns$/);
    await waitForHydration(page);
    const stored = await readStoredState(page);
    expect(stored?.session.userId).toBe(DEMO_USER);
    expect(stored?.session.workspace).toBe('merchant');
    expect(stored?.session.opsRole).toBeNull();

    // Loading a scenario from the guide lands on the page it is worth reading on.
    await open(page, '/demo');
    await page.getByTestId('demo-guide-load-payout_unknown').click();
    await confirmWith(page);
    await page.waitForURL(/\/ops\/payouts$/);
    await waitForHydration(page);
    const loaded = await readStoredState(page);
    expect(loaded?.scenario).toBe('payout_unknown');
    expect(loaded?.session.opsRole).toBe('ops_finance');
    await expect(page.getByTestId('ops-payouts-list')).toBeVisible();

    await settleToasts(page);
    await expectNoHorizontalOverflow(page);
  });
});

// ===========================================================================
// Keyboard, focus return and reduced motion (ticket #9's a11y line)
// ===========================================================================

test.describe('keyboard and reduced motion', () => {
  skipAtSmall();

  test('the claim dialog can be completed with the keyboard and returns focus to its trigger', async ({
    page,
  }) => {
    const ready = await loadScenario(page, 'main_flow_ready');
    const submission = ownSubmission(ready);
    await signInAs(page, 'creator');
    await open(page, `/creator/submissions/${submission.id}`);

    const trigger = page.getByTestId('claim-reward');
    await trigger.focus();
    await expect(trigger).toBeFocused();

    // Escape first: the dialog must give the focus back where it came from.
    await page.keyboard.press('Enter');
    await expect(page.locator('[role="alertdialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="alertdialog"]')).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // Then complete it with the keyboard only.
    await page.keyboard.press('Enter');
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible();
    const confirm = page.getByTestId('confirm-accept');
    await confirm.focus();
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('claim-reserved')).toBeVisible();
  });

  test('the reject-with-reason dialog can be completed with the keyboard', async ({ page }) => {
    const ready = await loadScenario(page, 'main_flow_ready');
    const submission = ownSubmission(ready);
    await signInAs(page, 'merchant');
    await open(page, `/merchant/submissions/${submission.id}`);

    const trigger = page.getByTestId('content-reject');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible();

    // The confirm stays disabled until a reason is typed, so the keyboard path
    // has to type one.
    await expect(page.getByTestId('confirm-accept')).toBeDisabled();
    await dialog.locator('textarea').focus();
    await page.keyboard.type('The post does not mention the campaign.');
    await expect(page.getByTestId('confirm-accept')).toBeEnabled();
    await page.getByTestId('confirm-accept').focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);

    const stored = await readStoredState(page);
    expect(stored?.submissions[submission.id].contentReview.status).toBe('rejected');
    expect(stored?.submissions[submission.id].contentReview.reason).toBe(
      'The post does not mention the campaign.',
    );
  });

  test('reduced motion renders every dialog and panel without an error', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const partial = await loadScenario(page, 'partial_budget');
    const submission = ownSubmission(partial);
    await signInAs(page, 'creator');
    await open(page, `/creator/submissions/${submission.id}`);

    // A dialog, a sheet and a confirmation: the three animated surfaces.
    await page.getByTestId('offer-review').click();
    await expect(page.getByTestId('partial-offer-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('partial-offer-dialog')).toHaveCount(0);

    await page.getByTestId('demo-toolbar-trigger').click();
    await expect(page.getByTestId('demo-toolbar')).toBeVisible();
    await page.getByTestId('demo-toolbar').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('demo-toolbar')).toHaveCount(0);

    expect(errors, 'reduced motion must not change what renders').toEqual([]);
  });
});

// ===========================================================================
// The 320px spot check (issue #1: 抽查320px不出现关键操作被遮挡)
// ===========================================================================

test.describe('320px spot check: no primary action is covered', () => {
  onlyAtSmall();

  test('the creator submission detail keeps the claim and offer actions reachable', async ({
    page,
  }, testInfo) => {
    const ready = await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');
    await open(page, `/creator/submissions/${ownSubmission(ready).id}`);
    await settleToasts(page);

    await expectNoHorizontalOverflow(page);
    await expectPrimaryActionUsable(page, page.getByTestId('claim-reward'), 'the claim button');
    await acceptanceShot(page, 'p10-320-claim', shotSuffix(testInfo));

    // The offer dialog's own footer buttons, which is where a dialog taller than
    // the viewport hides its primary action.
    const partial = await loadScenario(page, 'partial_budget');
    await open(page, `/creator/submissions/${ownSubmission(partial).id}`);
    await settleToasts(page);
    await expectPrimaryActionUsable(page, page.getByTestId('offer-review'), 'the review-offer button');

    await page.getByTestId('offer-review').click();
    await expect(page.getByTestId('partial-offer-dialog')).toBeVisible();
    await expectPrimaryActionUsable(page, page.getByTestId('offer-consent'), 'the consent button');
    await expectPrimaryActionUsable(page, page.getByTestId('offer-decline'), 'the decline button');
    await acceptanceShot(page, 'p10-320-offer', shotSuffix(testInfo));
  });

  test('the merchant editor keeps Save reachable', async ({ page }, testInfo) => {
    await injectState(page, stateAs('baseline', 'merchant'), `/merchant/campaigns/${KOPI_DRAFT}/edit`);
    await waitForHydration(page);
    await dismissLocalePrompt(page);
    await settleToasts(page);

    await expectNoHorizontalOverflow(page);
    await expectPrimaryActionUsable(page, page.getByTestId('editor-save'), 'the editor Save button');
    await acceptanceShot(page, 'p10-320-editor', shotSuffix(testInfo));
  });

  test('the operations claim page keeps the review actions reachable', async ({
    page,
  }, testInfo) => {
    const ready = await loadScenario(page, 'main_flow_ready');
    const submission = ownSubmission(ready);
    const withClaim = replay(
      ready,
      [{ type: 'claim.request', submissionId: submission.id }],
      'p10-320-ops',
    );
    const claim = ownClaim(withClaim);

    await injectState(page, withClaim, '/');
    await dismissLocalePrompt(page);
    await signInAs(page, 'ops_reviewer');
    await open(page, `/ops/claims/${claim.id}`);
    await settleToasts(page);

    await expectNoHorizontalOverflow(page);
    await expectPrimaryActionUsable(
      page,
      page.getByTestId('ops-metering-approve'),
      'the approve-metering button',
    );
    await expectPrimaryActionUsable(
      page,
      page.getByTestId('ops-metering-reject'),
      'the reject-metering button',
    );
    await acceptanceShot(page, 'p10-320-ops-claim', shotSuffix(testInfo));
  });

  test('the payout page keeps start and reconcile reachable', async ({ page }, testInfo) => {
    const confirmed = await loadScenario(page, 'payout_unknown');
    const obligation = Object.values(confirmed.obligations)[0];
    await signInAs(page, 'ops_finance');
    await open(page, `/ops/payouts/${obligation.id}`);
    await settleToasts(page);

    await expectNoHorizontalOverflow(page);
    // Start is correctly disabled here (an attempt is unresolved), so the
    // reachable primary action is the reconciliation.
    await expectPrimaryActionUsable(
      page,
      page.getByTestId('ops-reconcile-open'),
      'the reconcile button',
    );
    await acceptanceShot(page, 'p10-320-payout', shotSuffix(testInfo));

    // And on a payable obligation, Start itself.
    const payable = await loadScenario(page, 'main_flow_ready');
    const submission = ownSubmission(payable);
    const ready = replay(
      payable,
      [
        { type: 'claim.request', submissionId: submission.id },
        { type: 'session.switchWorkspace', workspace: 'merchant' },
        {
          type: 'submission.reviewContent',
          submissionId: submission.id,
          decision: 'approve',
          reason: null,
        },
        { type: 'session.signIn', userId: 'user-ops-reviewer' },
        { type: 'session.setOpsRole', role: 'ops_reviewer' },
        {
          type: 'claim.reviewMetering',
          claimId: ownClaim(replay(payable, [{ type: 'claim.request', submissionId: submission.id }], 'probe')).id,
          decision: 'approve',
          reason: null,
        },
      ],
      'p10-320-payable',
    );
    const payableObligation = Object.values(ready.obligations)[0];

    await injectState(page, ready, '/');
    await dismissLocalePrompt(page);
    await signInAs(page, 'ops_finance');
    await open(page, `/ops/payouts/${payableObligation.id}`);
    await settleToasts(page);

    await expectNoHorizontalOverflow(page);
    await expectPrimaryActionUsable(page, page.getByTestId('ops-start-open'), 'the start-payout button');
    await acceptanceShot(page, 'p10-320-payout-start', shotSuffix(testInfo));
  });
});
