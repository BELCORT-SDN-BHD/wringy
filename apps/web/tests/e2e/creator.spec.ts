/**
 * Creator acceptance (tickets #4, #5 and the creator side of #6, #7, #8).
 *
 * Every state is reached either through the shared scenario presets or through
 * the real controls; nothing reaches into the store. The demo tools panel is the
 * only thing that moves the simulated clock or the simulated view data, which is
 * exactly what ticket #4 requires of the creator pages.
 */

import { expect, test, type Page } from '@playwright/test';

import { applyCommand, loadScenario as buildScenarioState } from '../../src/domain';
import type { Claim, Command, DemoState, Submission } from '../../src/domain/types';

import {
  addViews,
  advanceClock,
  dismissLocalePrompt,
  expectNoHorizontalOverflow,
  injectState,
  loadScenario,
  readStoredState,
  setLocale,
  waitForHydration,
} from './helpers';

const DEMO_USER = 'user-demo';
const BEN = 'user-ben';
const KOPI_RAYA = 'cmp-kopi-raya';
const OTHER_FIT = 'cmp-other-fit';
const DEMO_TIKTOK_URL = 'https://www.tiktok.com/@demouser/video/7400000000000000001';

function ownSubmission(state: DemoState, userId = DEMO_USER): Submission {
  const submission = Object.values(state.submissions).find(
    (candidate) => candidate.creatorId === userId,
  );
  if (!submission) throw new Error(`no submission for ${userId} in this scenario`);
  return submission;
}

function ownClaim(state: DemoState, userId = DEMO_USER): Claim {
  const claim = Object.values(state.claims).find((candidate) => candidate.creatorId === userId);
  if (!claim) throw new Error(`no claim for ${userId} in this scenario`);
  return claim;
}

/** Opens a workspace page after a scenario is already loaded and signed in. */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForHydration(page);
  await dismissLocalePrompt(page);
}

/**
 * Waits for the submit page to hand over to the new submission and returns its
 * id. Minted ids look like `sub_000012`, so the pattern cannot match the
 * `/creator/submissions/new` page it navigates away from.
 */
async function waitForSubmissionId(page: Page): Promise<string> {
  await page.waitForURL(/\/creator\/submissions\/sub_\d+$/);
  return page.url().split('/').pop() as string;
}

/**
 * Applies engine commands to build a state no single role could reach alone
 * (a merchant decision, then operations, then finance). Every step must succeed:
 * a scenario that needs a rule bent would not be a demo state.
 */
function runner(start: DemoState, tag: string) {
  let state = start;
  let step = 0;
  return {
    apply(command: Command): DemoState {
      const result = applyCommand(state, command, { commandId: `e2e-${tag}-${step}` });
      if (!result.ok) {
        throw new Error(`${tag} step ${step} (${command.type}) failed: ${result.code}`);
      }
      step += 1;
      state = result.state;
      return state;
    },
    get state(): DemoState {
      return state;
    },
  };
}

test.describe('creator', () => {
  test('an unusable account and a bad link give the specific reason and the next step', async ({
    page,
  }) => {
    await loadScenario(page, 'baseline');
    await open(page, '/creator/accounts');

    // The prototype has no upload entry anywhere: the creator publishes on the
    // platform and brings back the link.
    await expect(page.getByTestId('accounts-no-upload')).toBeVisible();
    expect(await page.locator('input[type=file]').count()).toBe(0);

    const invalidRow = page.getByTestId('connection-conn-demo-instagram');
    await expect(invalidRow).toHaveAttribute('data-connection-status', 'invalid');
    await expect(invalidRow.getByTestId('connection-reason')).toContainText('token expired');
    await expect(invalidRow).toContainText('Reconnect this account');
    await expect(page.getByTestId('accounts-attention')).toContainText('token expired');

    // Submit page: the unusable account is offered but cannot be chosen, with its
    // own reason and a link to the accounts page.
    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    expect(await page.locator('input[type=file]').count()).toBe(0);
    await expect(page.getByTestId('connection-option-reason')).toContainText('token expired');
    await expect(page.getByTestId('connection-option-reason')).toContainText(
      'Reconnect this account',
    );
    await expect(page.getByTestId('connection-reason-accounts')).toHaveAttribute(
      'href',
      '/creator/accounts',
    );
    await page.getByTestId('submit-connection').click();
    await expect(
      page.locator('[data-connection-id="conn-demo-instagram"][data-disabled]'),
    ).toHaveCount(1);
    await expect(page.locator('[data-connection-id="conn-demo-instagram"]')).toContainText(
      'needs reconnecting',
    );
    await page.keyboard.press('Escape');

    // A shortened share link cannot be resolved: say so and say what to paste.
    await page.getByTestId('submit-url').fill('https://vm.tiktok.com/ZMabcdefg/');
    await page.getByTestId('submit-link').click();
    await expect(page.getByTestId('submit-error')).toHaveAttribute(
      'data-error-code',
      'invalid_input',
    );
    await expect(page.getByTestId('submit-error')).toContainText('paste the full post URL');

    // A link on another platform than the chosen account.
    await page.getByTestId('submit-url').fill('https://www.instagram.com/reel/Abc123def/');
    await page.getByTestId('submit-link').click();
    await expect(page.getByTestId('submit-error')).toContainText('different platform');

    // A profile link rather than a post.
    await page.getByTestId('submit-url').fill('https://www.tiktok.com/@demouser');
    await page.getByTestId('submit-link').click();
    await expect(page.getByTestId('submit-error')).toContainText('single post');

    // Nothing was created by any refusal.
    const stored = await readStoredState(page);
    expect(
      Object.values(stored?.submissions ?? {}).filter((s) => s.creatorId === DEMO_USER),
    ).toHaveLength(0);

    // The reconnect action is simulated and makes the connection usable again.
    await open(page, '/creator/accounts');
    await page.getByTestId('reconnect-conn-demo-instagram').click();
    await expect(page.getByTestId('connection-conn-demo-instagram')).toHaveAttribute(
      'data-connection-status',
      'valid',
    );
  });

  test('the same post in another URL form adds nothing, and cross-campaign reuse is explained', async ({
    page,
  }) => {
    await loadScenario(page, 'main_flow_ready');
    await open(page, '/creator/submissions');
    await expect(page.getByTestId('submissions-list').locator('[data-submission-status]')).toHaveCount(1);

    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    await page
      .getByTestId('submit-url')
      .fill(`${DEMO_TIKTOK_URL}?is_from_webapp=1&sender_device=pc`);
    await page.getByTestId('submit-link').click();

    const error = page.getByTestId('submit-error');
    await expect(error).toHaveAttribute('data-error-code', 'duplicate_post');
    await expect(error).toContainText('already submitted to this campaign');
    await expect(error).toContainText('does not create a new entry');
    await page.getByTestId('submit-error-action').click();
    await waitForSubmissionId(page);

    let stored = await readStoredState(page);
    expect(
      Object.values(stored?.submissions ?? {}).filter((s) => s.creatorId === DEMO_USER),
    ).toHaveLength(1);

    // The same platform post cannot earn in a second campaign.
    await open(page, `/creator/submissions/new?campaign=${OTHER_FIT}`);
    await page.getByTestId('submit-url').fill(DEMO_TIKTOK_URL);
    await page.getByTestId('submit-link').click();
    await expect(page.getByTestId('submit-error')).toHaveAttribute(
      'data-error-code',
      'cross_campaign_blocked',
    );
    await expect(page.getByTestId('submit-error')).toContainText('cannot earn twice');

    stored = await readStoredState(page);
    expect(
      Object.values(stored?.submissions ?? {}).filter((s) => s.creatorId === DEMO_USER),
    ).toHaveLength(1);
  });

  test('a missing baseline is not fabricated', async ({ page }) => {
    // A published campaign whose data source stopped being ready: the link is
    // accepted for checks, but no baseline and therefore no acceptance time.
    const seed = buildScenarioState('baseline');
    const blocked = applyCommand(
      seed,
      { type: 'demo.setReadiness', campaignId: KOPI_RAYA, dataSourceReady: false },
      { commandId: 'e2e-data-source-down' },
    );
    expect(blocked.ok).toBe(true);
    await injectState(page, blocked.state);
    await dismissLocalePrompt(page);

    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    await page.getByTestId('submit-url').fill('https://www.tiktok.com/@demouser/video/7400000000000000555');
    await page.getByTestId('submit-link').click();
    await waitForSubmissionId(page);

    await expect(page.getByTestId('submission-status')).toHaveAttribute(
      'data-submission-status',
      'baseline_unavailable',
    );
    await expect(page.getByTestId('submission-status')).toContainText(
      'not fabricated an acceptance time',
    );
    await expect(page.getByTestId('submission-accepted-at')).toContainText('Not set');
    await expect(page.getByTestId('submission-accepted-at')).toContainText('does not invent one');
    // No trusted reading at all: unknown, never zero.
    await expect(page.getByTestId('reward-qualified-views').locator('[data-views]')).toHaveAttribute(
      'data-views',
      'unknown',
    );
    await expect(page.getByTestId('claim-reward')).toBeDisabled();
    await expect(page.getByTestId('claim-block-reason')).toHaveAttribute(
      'data-block-reason',
      'data_unavailable',
    );
  });

  test('views before acceptance are excluded and the baseline is shown', async ({ page }) => {
    const state = await loadScenario(page, 'main_flow_ready');
    const submission = ownSubmission(state);
    await open(page, `/creator/submissions/${submission.id}`);

    // 1,200 views existed at acceptance and never count; 1,000 qualified views
    // inside the window are worth RM5.00 at RM5 per 1,000.
    await expect(
      page.getByTestId('submission-baseline-views').locator('[data-baseline]'),
    ).toHaveAttribute('data-baseline', '1200');
    await expect(page.getByTestId('submission-baseline-views')).toContainText(
      'before acceptance never count',
    );
    await expect(page.getByTestId('reward-qualified-views').locator('[data-views]')).toHaveAttribute(
      'data-views',
      '1000',
    );
    await expect(page.getByTestId('reward-estimate').locator('[data-money]')).toHaveAttribute(
      'data-money',
      '500',
    );
    await expect(page.getByTestId('reward-panel')).toContainText('Estimated, not confirmed');
    await expect(page.getByTestId('reward-last-trusted').locator('time')).toHaveAttribute(
      'datetime',
      /2026-09-01/,
    );
    await expect(page.getByTestId('no-views-control')).toContainText('demo tools panel');

    // The one 320px spot check for this ticket.
    await page.setViewportSize({ width: 320, height: 568 });
    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId('claim-reward')).toBeVisible();
  });

  test('+1,000 views makes RM5.00 claimable, and one claim reserves it once', async ({ page }) => {
    await loadScenario(page, 'baseline');
    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    await page.getByTestId('submit-url').fill('https://www.tiktok.com/@demouser/video/7400000000000000777');
    await page.getByTestId('submit-link').click();
    const submissionId = await waitForSubmissionId(page);

    // Accepted, metering, nothing claimable yet.
    await expect(page.getByTestId('submission-status')).toHaveAttribute(
      'data-submission-status',
      'metering',
    );
    await expect(page.getByTestId('claim-reward')).toBeDisabled();
    await expect(page.getByTestId('claim-block-reason')).toHaveAttribute(
      'data-block-reason',
      'nothing_claimable',
    );

    // Only the demo tools add views.
    await addViews(page, submissionId, 1000);
    await expect(page.getByTestId('reward-claimable').locator('[data-money]')).toHaveAttribute(
      'data-money',
      '500',
    );
    await expect(page.getByTestId('claim-reward')).toBeEnabled();

    await page.getByTestId('claim-reward').click();
    await page.getByTestId('confirm-accept').click();

    const reserved = page.getByTestId('claim-reserved');
    await expect(reserved).toBeVisible();
    await expect(reserved).toContainText('5.00');

    // 1995 available / 5 reserved / 0 confirmed unpaid / 0 paid.
    const panel = page.getByTestId('reward-panel');
    for (const [bucket, value] of [
      ['available', '199500'],
      ['reserved', '500'],
      ['confirmed_unpaid', '0'],
      ['paid', '0'],
    ] as const) {
      await expect(
        panel.locator(`[data-bucket="${bucket}"] [data-money]`).first(),
      ).toHaveAttribute('data-money', value);
    }

    // A second press cannot file a second claim: the engine refuses and the page
    // says a claim is already pending.
    await expect(page.getByTestId('claim-reward')).toBeDisabled();
    await expect(page.getByTestId('claim-block-reason')).toHaveAttribute(
      'data-block-reason',
      'pending_claim_exists',
    );
    await expect(page.getByTestId('reward-pending-claim')).toContainText('One claim per post');

    // A refresh does not duplicate anything either.
    await page.reload();
    await waitForHydration(page);
    const stored = await readStoredState(page);
    const claims = Object.values(stored?.claims ?? {}).filter(
      (claim) => claim.submissionId === submissionId,
    );
    expect(claims).toHaveLength(1);
    expect(claims[0].amountSen).toBe(500);

    // The 48-hour review target escalates and never approves.
    await advanceClock(page, 'week');
    await open(page, `/creator/claims/${claims[0].id}`);
    await expect(page.getByTestId('claim-escalated')).toContainText('not auto-approved');
    await expect(
      page.getByTestId('claim-stage-list').locator('[data-stage="pending_review"]'),
    ).toHaveAttribute('data-stage-state', 'current');

    // The creator is told, with a simulated email preview.
    await open(page, '/notifications');
    await expect(page.getByTestId('notifications-list')).toContainText('Submission accepted');
    await expect(page.getByTestId('notifications-list')).toContainText('Claim reserved');
    await page.getByTestId('email-preview-open').first().click();
    await expect(page.locator('[data-app-widget="email-preview"]')).toContainText(
      'not sent',
    );
  });

  test('every money event reaches the creator with a simulated email preview', async ({
    page,
  }) => {
    // Confirmed and paid needs the merchant and both operations capabilities, so
    // the state is built through their own commands.
    const confirmed = runner(buildScenarioState('main_flow_ready'), 'confirm');
    const submission = ownSubmission(confirmed.state);
    confirmed.apply({ type: 'claim.request', submissionId: submission.id });
    const claim = ownClaim(confirmed.state);
    confirmed.apply({ type: 'session.switchWorkspace', workspace: 'merchant' });
    confirmed.apply({
      type: 'submission.reviewContent',
      submissionId: submission.id,
      decision: 'approve',
      reason: null,
    });
    confirmed.apply({ type: 'session.signIn', userId: 'user-ops-reviewer' });
    confirmed.apply({
      type: 'claim.reviewMetering',
      claimId: claim.id,
      decision: 'approve',
      reason: null,
    });
    confirmed.apply({ type: 'session.signIn', userId: 'user-ops-finance' });
    const obligation = Object.values(confirmed.state.obligations)[0];
    confirmed.apply({ type: 'payout.start', obligationId: obligation.id });
    const attempt = Object.values(confirmed.state.payoutAttempts)[0];
    confirmed.apply({
      type: 'demo.setPayoutOutcome',
      attemptId: attempt.id,
      outcome: 'succeeded',
    });
    confirmed.apply({ type: 'session.signIn', userId: DEMO_USER });

    await injectState(page, confirmed.state);
    await dismissLocalePrompt(page);
    await open(page, '/creator');
    await expect(page.getByTestId('notifications-bell')).not.toHaveAttribute('data-unread', '0');

    await open(page, '/notifications');
    const list = page.getByTestId('notifications-list');
    for (const title of [
      'Submission accepted',
      'Claim reserved',
      'Content approved',
      'Claim confirmed',
      'Payout processing',
      'Funds available',
    ]) {
      await expect(list).toContainText(title);
    }
    // The important kinds carry a preview, and nothing is ever sent.
    expect(await page.getByTestId('email-preview-open').count()).toBeGreaterThan(2);
    await page.getByTestId('email-preview-open').first().click();
    await expect(page.locator('[data-app-widget="email-preview"]')).toContainText('not sent');
    await page.keyboard.press('Escape');

    // A rejection and an appeal outcome reach the creator too.
    const appealed = runner(buildScenarioState('rejection_appeal'), 'appeal');
    const rejected = ownClaim(appealed.state);
    appealed.apply({
      type: 'appeal.file',
      claimId: rejected.id,
      reason: 'The views were inside the window.',
    });
    appealed.apply({ type: 'session.signIn', userId: 'user-ops-reviewer' });
    const appeal = Object.values(appealed.state.appeals)[0];
    appealed.apply({
      type: 'appeal.resolve',
      appealId: appeal.id,
      decision: 'uphold',
      note: 'Source re-checked; the window is correct.',
    });
    appealed.apply({ type: 'session.signIn', userId: DEMO_USER });

    await injectState(page, appealed.state);
    await dismissLocalePrompt(page);
    await open(page, '/notifications');
    await expect(page.getByTestId('notifications-list')).toContainText('Claim rejected');
    await expect(page.getByTestId('notifications-list')).toContainText('Appeal upheld');
  });

  test('a partial budget needs an explicit consent, and a changed offer needs a new one', async ({
    page,
  }) => {
    const state = await loadScenario(page, 'partial_budget');
    const submission = ownSubmission(state);
    await open(page, `/creator/submissions/${submission.id}`);

    // RM60 claimable against RM50 available: an offer, and nothing reserved.
    const offerPanel = page.getByTestId('partial-offer-panel');
    await expect(offerPanel).toContainText('60.00');
    await expect(offerPanel).toContainText('50.00');
    await expect(offerPanel).toContainText('nothing is reserved');
    await expect(page.getByTestId('reward-reserved').locator('[data-money]')).toHaveAttribute(
      'data-money',
      '0',
    );

    await page.getByTestId('offer-review').click();
    const dialog = page.getByTestId('partial-offer-dialog');
    await expect(dialog.getByTestId('partial-offer-description')).toContainText(
      'stays unreserved and is not forfeited',
    );
    await expect(dialog.getByTestId('offer-consent')).toContainText('50.00');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // The reading changes, so the offer can no longer be consented to as it is.
    await addViews(page, submission.id, 1000);
    await page.getByTestId('offer-review').click();
    await expect(page.getByTestId('offer-stale')).toBeVisible();
    await expect(page.getByTestId('offer-stale')).toContainText('made again');
    await expect(page.getByTestId('offer-consent')).toHaveCount(0);

    // A fresh offer, then the explicit consent.
    await page.getByTestId('offer-refresh').click();
    await expect(page.getByTestId('partial-offer-description')).toContainText('65.00');
    await expect(page.getByTestId('offer-consent')).toContainText('50.00');
    await page.getByTestId('offer-consent').click();
    await expect(page.getByTestId('partial-offer-dialog')).toHaveCount(0);

    await expect(page.getByTestId('reward-reserved').locator('[data-money]')).toHaveAttribute(
      'data-money',
      '5000',
    );
    const stored = await readStoredState(page);
    const claims = Object.values(stored?.claims ?? {});
    expect(claims).toHaveLength(1);
    expect(claims[0].amountSen).toBe(5000);
    expect(claims[0].isPartial).toBe(true);
    expect(claims[0].unreservedRemainderSen).toBe(1500);

    await open(page, `/creator/claims/${claims[0].id}`);
    await expect(page.getByTestId('claim-summary')).toContainText('50.00');
    await expect(page.locator('body')).toContainText('stays unreserved');
  });

  test('a waitlisted claim reserves nothing, and a resubmit takes a new queue time', async ({
    page,
  }) => {
    const waitlisted = await loadScenario(page, 'waitlist');
    await open(page, '/creator/claims');
    const list = page.getByTestId('waitlist-list');
    await expect(list).toContainText('No reservation and no payment guarantee');
    await expect(list.locator('[data-waitlist-status]').first()).toHaveAttribute(
      'data-waitlist-status',
      'waiting',
    );
    // Nothing of the creator's own is reserved while waitlisted.
    expect(
      Object.values(waitlisted.claims).filter((claim) => claim.creatorId === DEMO_USER),
    ).toHaveLength(0);

    // Budget recovers only when operations finalise the other creator's
    // rejection, which is what notifies the waitlist.
    const benClaim = ownClaim(waitlisted, BEN);
    let state = waitlisted;
    const steps = [
      { type: 'session.signIn' as const, userId: 'user-ops-reviewer' },
      {
        type: 'claim.reviewMetering' as const,
        claimId: benClaim.id,
        decision: 'reject' as const,
        reason: 'Metering evidence could not be verified for this window.',
      },
      { type: 'demo.advanceClock' as const, byMs: 8 * 24 * 60 * 60 * 1000 },
      {
        type: 'claim.finalizeRejection' as const,
        claimId: benClaim.id,
        reason: 'Appeal window closed with no appeal.',
      },
      { type: 'session.signIn' as const, userId: DEMO_USER },
    ];
    steps.forEach((command, index) => {
      const result = applyCommand(state, command, { commandId: `e2e-waitlist-${index}` });
      expect(result.ok, `${command.type} failed`).toBe(true);
      state = result.state;
    });
    const notified = Object.values(state.waitlist).find((entry) => entry.creatorId === DEMO_USER);
    expect(notified?.status).toBe('notified');

    await injectState(page, state);
    await dismissLocalePrompt(page);
    await open(page, '/creator/claims');
    const row = page.getByTestId(`waitlist-${notified?.id}`);
    await expect(row).toHaveAttribute('data-waitlist-status', 'notified');
    await expect(row).toContainText('File again to take a new queue position');

    const before = await row.getByTestId('waitlist-valid-at').locator('time').getAttribute('datetime');
    await page.getByTestId(`waitlist-resubmit-${notified?.id}`).click();

    // The resubmit produced a real claim, at the new time, not the old position.
    await expect(page.getByTestId('claims-list')).toContainText('5.00');
    const stored = await readStoredState(page);
    const own = Object.values(stored?.claims ?? {}).filter(
      (claim) => claim.creatorId === DEMO_USER,
    );
    expect(own).toHaveLength(1);
    expect(own[0].validAt).not.toBe(before);
    expect(own[0].seq).toBeGreaterThan(benClaim.seq);
  });

  test('a rejection is readable, keeps the reservation and can be appealed inside the window', async ({
    page,
  }) => {
    const state = await loadScenario(page, 'rejection_appeal');
    const claim = ownClaim(state);
    await open(page, `/creator/claims/${claim.id}`);

    await expect(page.getByTestId('rejection-reason')).toContainText(
      'Qualified views could not be verified in the window.',
    );
    await expect(page.getByTestId('reservation-held')).toContainText('stays reserved');
    await expect(page.getByTestId('appeal-deadline').locator('time')).toHaveAttribute(
      'datetime',
      /2026-09-08/,
    );
    // The metering review is shown separately from the content review.
    await expect(page.getByTestId('claim-metering-review')).toBeVisible();
    await expect(page.getByTestId('claim-content-review')).toBeVisible();

    await page.getByTestId('appeal-reason').fill('The views were inside the window; please re-check the source.');
    await page.getByTestId('appeal-file').click();
    await expect(page.getByTestId('appeal-outcome')).toHaveAttribute('data-outcome', 'open');
    await expect(page.getByTestId('reservation-held')).toBeVisible();
    await expect(page.getByTestId('appeal-file')).toHaveCount(0);

    const stored = await readStoredState(page);
    expect(Object.values(stored?.appeals ?? {})).toHaveLength(1);
    expect(stored?.claims[claim.id].status).toBe('appealing');

    // Seven calendar days later, with no appeal filed, the window is closed.
    await loadScenario(page, 'rejection_appeal');
    await advanceClock(page, 'week');
    await advanceClock(page, 'day');
    await open(page, `/creator/claims/${claim.id}`);
    await expect(page.getByTestId('appeal-window-closed')).toContainText('cannot be filed');
    await expect(page.getByTestId('appeal-file')).toHaveCount(0);
    await expect(page.getByTestId('reservation-held')).toBeVisible();
  });

  test('an unknown payout is reconciled and a failed one waits for operations', async ({ page }) => {
    await loadScenario(page, 'payout_unknown');
    await open(page, '/creator/payments');

    await expect(page.getByTestId('payments-not-wallet')).toContainText('not a wallet balance');
    const unknownAttempt = page.locator('[data-attempt-status="unknown"]');
    await expect(unknownAttempt).toHaveCount(1);
    await expect(unknownAttempt.getByTestId('attempt-note')).toContainText(
      'reconciled against the original transaction',
    );
    await expect(unknownAttempt.getByTestId('attempt-note')).toContainText(
      'No second payment will be made',
    );
    // Confirmed unpaid is not paid, and bank settlement is its own fact.
    await expect(page.locator('[data-claim-status="confirmed_unpaid"]')).toHaveCount(1);
    await expect(page.getByTestId('payment-bank-settlement')).toContainText(
      'Bank settlement unknown',
    );
    // A creator has no payout control at all.
    await expect(page.getByTestId('payments-list').getByRole('button')).toHaveCount(0);

    await loadScenario(page, 'payout_failed');
    await open(page, '/creator/payments');
    const failedAttempt = page.locator('[data-attempt-status="failed"]');
    await expect(failedAttempt).toHaveCount(1);
    await expect(failedAttempt.getByTestId('attempt-failure-reason')).toContainText(
      'Simulated provider rejected the account number.',
    );
    await expect(failedAttempt.getByTestId('attempt-note')).toContainText(
      'after confirming the failure',
    );
    await expect(page.getByTestId('payments-list').getByRole('button')).toHaveCount(0);
  });

  test('an extension names its reason and does not re-open metering', async ({ page }) => {
    const state = await loadScenario(page, 'deadline_extension');
    const submission = ownSubmission(state);
    await open(page, `/creator/submissions/${submission.id}`);

    const extensions = page.getByTestId('submission-extensions');
    await expect(extensions).toBeVisible();
    await expect(extensions.locator('[data-extension-reason="data_outage"]')).toContainText(
      'unreadable while the window and grace were running',
    );
    await expect(extensions).toContainText('16 Sept 2026');
    await expect(page.getByTestId('effective-claim-deadline').locator('time')).toHaveAttribute(
      'datetime',
      /2026-09-16/,
    );
    // The published deadline is still visible next to the one in force.
    await expect(page.getByTestId('base-claim-deadline').locator('time')).toHaveAttribute(
      'datetime',
      /2026-09-15/,
    );
    // Metering did not re-open: the window still ends where it ended.
    await expect(page.getByTestId('metering-ends').locator('time')).toHaveAttribute(
      'datetime',
      /2026-09-08/,
    );
    await expect(page.getByTestId('submission-status')).toHaveAttribute(
      'data-submission-status',
      'metering_ended',
    );
    await expect(page.getByTestId('submission-window')).toContainText('not re-opened');
  });

  test('a language change keeps typed input, and a refresh keeps the demo state', async ({
    page,
  }) => {
    const url = 'https://www.tiktok.com/@demouser/video/7400000000000000123';
    await loadScenario(page, 'baseline');
    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    await page.getByTestId('submit-url').fill(url);

    await setLocale(page, 'zh-Hans-MY');
    await expect(page.getByTestId('submit-url')).toHaveValue(url);
    await expect(page.getByTestId('submit-link')).toContainText('提交链接');

    await setLocale(page, 'ms-MY');
    await expect(page.getByTestId('submit-url')).toHaveValue(url);
    await expect(page.getByTestId('submit-link')).toContainText('Hantar pautan');

    await setLocale(page, 'en-MY');
    await page.getByTestId('submit-link').click();
    const submissionId = await waitForSubmissionId(page);

    await page.reload();
    await waitForHydration(page);
    await expect(page.getByTestId('submission-status')).toHaveAttribute(
      'data-submission-status',
      'metering',
    );
    const stored = await readStoredState(page);
    expect(stored?.submissions[submissionId]).toBeTruthy();
  });

  test('acceptance screenshots', async ({ page }) => {
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width !== 390 && width !== 1440, 'only the two acceptance viewports are captured');
    // Six scenarios and six pages in one test: more than the default budget when
    // the dev server is compiling routes for every worker at once.
    test.setTimeout(150_000);
    const dir = '../../docs/m1-prototype/screenshots';
    const shot = async (name: string) => {
      // `animations: 'disabled'` finishes the official enter transitions first, so
      // an overlay or a dialog is never captured half way through its animation.
      await page.screenshot({
        path: `${dir}/creator-${name}-${width}.png`,
        fullPage: false,
        animations: 'disabled',
      });
    };

    await loadScenario(page, 'baseline');
    await open(page, '/creator/accounts');
    await shot('accounts');

    await open(page, `/creator/submissions/new?campaign=${KOPI_RAYA}`);
    await page.getByTestId('submit-url').fill('https://vm.tiktok.com/ZMabcdefg/');
    await page.getByTestId('submit-link').click();
    await expect(page.getByTestId('submit-error')).toBeVisible();
    await shot('submit-error');

    const metering = await loadScenario(page, 'main_flow_ready');
    await open(page, `/creator/submissions/${ownSubmission(metering).id}`);
    await shot('submission-detail');

    const partial = await loadScenario(page, 'partial_budget');
    await open(page, `/creator/submissions/${ownSubmission(partial).id}`);
    await page.getByTestId('offer-review').click();
    await expect(page.getByTestId('partial-offer-dialog')).toBeVisible();
    await shot('partial-offer');

    const rejected = await loadScenario(page, 'rejection_appeal');
    await open(page, `/creator/claims/${ownClaim(rejected).id}`);
    await shot('claim-rejected');

    await loadScenario(page, 'payout_failed');
    await open(page, '/creator/payments');
    await shot('payments');
  });
});
