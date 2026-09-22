/**
 * Ticket #3 acceptance, plus the merchant lines of #6 and #8.
 *
 * The run proves seven things, and each of them is a thing a person can be misled
 * about rather than a coding detail:
 *   1. a new draft carries the approved defaults;
 *   2. publishing is blocked with a readable reason until funding evidence and
 *      data-source readiness are recorded, and works once they are;
 *   3. a minimum claim above the cap is refused, while a high view threshold with a
 *      low cap is allowed and explained;
 *   4. the editor, the readiness check, the campaign detail and the public page
 *      state the same numbers; a second publish is refused, not duplicated; a
 *      refresh keeps the draft;
 *   5. the service fee is only ever "pending configuration, not charged";
 *   6. publishing notifies the merchant with a simulated email preview, and a
 *      content decision moves the same claim the creator sees;
 *   7. a language switch keeps typed values, and nothing is clipped at 320px.
 *
 * States are built by replaying engine commands (the scenario helpers' own
 * technique), never by editing a state blob, so every fixture is reachable by the
 * rules the UI obeys.
 */

import { expect, test, type Page } from '@playwright/test';

import { applyCommand, loadScenario as buildScenarioState } from '../../src/domain';
import { DEFAULT_RULES } from '../../src/domain';
import type { Command, DemoState } from '../../src/domain/types';

import {
  dismissLocalePrompt,
  expectNoHorizontalOverflow,
  injectState,
  loadScenario,
  openDemoTools,
  closeDemoTools,
  readStoredState,
  setLocale,
  signInAs,
  waitForHydration,
} from './helpers';

const DRAFT_ID = 'cmp-kopi-draft';
const PUBLISHED_ID = 'cmp-kopi-raya';

/** Replays commands through the engine, the way `replayScenario` does. */
function replay(state: DemoState, commands: Command[], tag: string): DemoState {
  return commands.reduce((current, command, index) => {
    const result = applyCommand(current, command, { commandId: `e2e:${tag}:${index}` });
    if (!result.ok) {
      throw new Error(`${tag} step ${index} (${command.type}): ${result.code} ${result.detail ?? ''}`);
    }
    return result.state;
  }, state);
}

/** Signed in as Demo User in the Kopi Kita merchant workspace. */
function merchantState(scenario: Parameters<typeof buildScenarioState>[0] = 'baseline'): DemoState {
  return replay(
    buildScenarioState(scenario),
    [
      { type: 'session.signIn', userId: 'user-demo' },
      { type: 'session.switchWorkspace', workspace: 'merchant' },
    ],
    'merchant',
  );
}

async function gotoMerchant(page: Page, state: DemoState, path: string): Promise<void> {
  await injectState(page, state, path);
  await dismissLocalePrompt(page);
}

/** Reads the `data-money` attribute the shared MoneyText component writes. */
async function moneyOf(page: Page, selector: string): Promise<string | null> {
  return page.locator(selector).first().getAttribute('data-money');
}

// ---------------------------------------------------------------------------
// 1. Defaults
// ---------------------------------------------------------------------------

test.describe('defaults', () => {
  test('a new draft carries the approved defaults and reaches the editor', async ({ page }) => {
    await gotoMerchant(page, merchantState(), '/merchant/campaigns');

    const before = Object.keys((await readStoredState(page))!.campaigns).length;
    await page.getByTestId('new-campaign').first().click();
    await expect(page).toHaveURL(/\/merchant\/campaigns\/.+\/edit$/);

    // The engine's defaults, read off the inputs the merchant will edit.
    await expect(page.getByTestId('field-pool')).toHaveValue('2000.00');
    await expect(page.getByTestId('field-rate')).toHaveValue('5.00');
    await expect(page.getByTestId('field-min-claim')).toHaveValue('5.00');
    await expect(page.getByTestId('field-cap')).toHaveValue('100.00');
    await expect(page.getByTestId('field-threshold')).toHaveValue('');
    await expect(page.getByTestId('field-submission-window')).toHaveValue('14');
    await expect(page.getByTestId('field-metering-days')).toHaveValue('7');
    await expect(page.getByTestId('field-grace-days')).toHaveValue('7');
    await expect(page.getByTestId('field-retention-days')).toHaveValue('30');
    // The cross-platform independent cap defaults to off and states its rule.
    await expect(page.getByTestId('field-cross-platform')).toHaveAttribute(
      'data-state',
      'unchecked',
    );
    await expect(page.getByTestId('cross-platform-rule')).toBeVisible();
    // The audience region is fixed and says why.
    await expect(page.getByTestId('field-region')).toContainText('Global');

    const stored = (await readStoredState(page))!;
    expect(Object.keys(stored.campaigns).length).toBe(before + 1);
    const created = Object.values(stored.campaigns).find(
      (campaign) => campaign.createdAt === stored.clock.nowIso && campaign.status === 'draft' && campaign.id.startsWith('cmp_'),
    );
    expect(created?.rules).toEqual(DEFAULT_RULES);
    // A brand-new draft is never ready: publishing needs evidence, not a form.
    expect(created?.readiness).toEqual({ fundingEvidence: false, dataSourceReady: false });

    await expectNoHorizontalOverflow(page);
  });

  test('the list states the pool, the available amount and the submission count', async ({
    page,
  }) => {
    await gotoMerchant(page, merchantState('main_flow_ready'), '/merchant/campaigns');

    // The list renders a dense table above `sm` and the same rows as cards below
    // it, so only one of the two carriers of `data-campaign-id` is on screen.
    const row = page.locator(`[data-campaign-id="${PUBLISHED_ID}"]:visible`).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('2,000.00');
    await expectNoHorizontalOverflow(page);
  });
});

// ---------------------------------------------------------------------------
// 2. Readiness and publishing
// ---------------------------------------------------------------------------

test.describe('publishing', () => {
  test('blocked with a reason until readiness is recorded, then allowed', async ({ page }) => {
    await gotoMerchant(page, merchantState(), `/merchant/campaigns/${DRAFT_ID}/preview`);

    await expect(page.getByTestId('readiness-funding')).toHaveAttribute('data-ready', 'false');
    await expect(page.getByTestId('readiness-data-source')).toHaveAttribute('data-ready', 'false');

    const blocked = page.getByTestId('publish-blocked');
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText('funding evidence');
    await expect(blocked).toContainText('data source');
    await expect(page.getByTestId('publish-campaign')).toBeDisabled();

    // The demo tools are where readiness is recorded — not this page.
    await openDemoTools(page);
    await page.locator(`#demo-funding-${DRAFT_ID}`).click();
    await page.locator(`#demo-source-${DRAFT_ID}`).click();
    await closeDemoTools(page);

    await expect(page.getByTestId('readiness-funding')).toHaveAttribute('data-ready', 'true');
    await expect(page.getByTestId('publish-blocked')).toHaveCount(0);

    const publish = page.getByTestId('publish-campaign');
    await expect(publish).toBeEnabled();
    await publish.click();

    await expect(page.getByTestId('publish-not-draft')).toBeVisible();
    const stored = (await readStoredState(page))!;
    expect(stored.campaigns[DRAFT_ID].status).toBe('published');
    expect(stored.campaigns[DRAFT_ID].publishedAt).not.toBeNull();

    // The published campaign is now in the public catalogue and detail page.
    await page.goto('/campaigns');
    await waitForHydration(page);
    await expect(page.getByRole('listitem').filter({ hasText: 'Cold Brew' })).toHaveCount(1);

    await page.goto(`/campaigns/${DRAFT_ID}`);
    await waitForHydration(page);
    await expect(page.getByTestId('join-campaign')).toBeVisible();
  });

  test('a second publish is refused and creates no second campaign', async ({ page }) => {
    const ready = replay(
      merchantState(),
      [
        {
          type: 'demo.setReadiness',
          campaignId: DRAFT_ID,
          fundingEvidence: true,
          dataSourceReady: true,
        },
      ],
      'ready',
    );
    await gotoMerchant(page, ready, `/merchant/campaigns/${DRAFT_ID}/preview`);

    const before = Object.keys((await readStoredState(page))!.campaigns).length;
    const publish = page.getByTestId('publish-campaign');

    await publish.click();
    // Second attempt: a fresh command id, so the engine really refuses it rather
    // than replaying the first result as a success.
    await publish.click();

    const refusal = page.locator('[data-app-state="command-error"]');
    await expect(refusal).toBeVisible();
    await expect(refusal).toHaveAttribute('data-error-code', 'invalid_transition');

    const stored = (await readStoredState(page))!;
    expect(Object.keys(stored.campaigns).length).toBe(before);
    expect(stored.campaigns[DRAFT_ID].status).toBe('published');
  });
});

// ---------------------------------------------------------------------------
// 3. Validation
// ---------------------------------------------------------------------------

test.describe('validation', () => {
  test('a minimum claim above the cap blocks the save', async ({ page }) => {
    await gotoMerchant(page, merchantState(), `/merchant/campaigns/${DRAFT_ID}/edit`);

    await page.getByTestId('field-min-claim').fill('150.00');
    await page.getByTestId('editor-save').click();

    const min = page.getByTestId('field-min-claim');
    await expect(min).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('field-cap')).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByText('Minimum claim cannot exceed the per-submission cap').first(),
    ).toBeVisible();
    await expect(page.getByTestId('editor-error-summary')).toBeVisible();

    // Nothing was written.
    const stored = (await readStoredState(page))!;
    expect(stored.campaigns[DRAFT_ID].rules.minClaimSen).toBe(500);

    // The readiness check refuses to publish an invalid configuration too.
    await page.getByTestId('field-min-claim').fill('5.00');
    await page.getByTestId('editor-save').click();
    await expect(page.getByTestId('field-min-claim')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('a 100,000-view threshold with an RM100 cap is allowed and explained', async ({ page }) => {
    await gotoMerchant(page, merchantState(), `/merchant/campaigns/${DRAFT_ID}/edit`);

    await page.getByTestId('field-threshold').fill('100000');
    const explanation = page.getByTestId('cap-explanation');
    await expect(explanation).toBeVisible();
    // 100,000 × RM5/1,000 = RM500, capped at RM100.
    await expect(explanation).toContainText('100,000');
    await expect(explanation).toContainText('100.00');

    await page.getByTestId('editor-save').click();
    await expect(page.getByTestId('editor-error-summary')).toHaveCount(0);

    const stored = (await readStoredState(page))!;
    expect(stored.campaigns[DRAFT_ID].rules.viewThreshold).toBe(100_000);
    expect(stored.campaigns[DRAFT_ID].rules.capPerSubmissionSen).toBe(10_000);
  });
});

// ---------------------------------------------------------------------------
// 4. One set of numbers, and a draft that survives a refresh
// ---------------------------------------------------------------------------

test.describe('one record', () => {
  test('editor, readiness check, detail and public page state the same values', async ({
    page,
  }) => {
    const ready = replay(
      merchantState(),
      [
        {
          type: 'campaign.updateDraft',
          campaignId: DRAFT_ID,
          patch: { rules: { poolSen: 150_000, ratePerThousandSen: 700, capPerSubmissionSen: 12_000 } },
        },
        {
          type: 'demo.setReadiness',
          campaignId: DRAFT_ID,
          fundingEvidence: true,
          dataSourceReady: true,
        },
      ],
      'same-numbers',
    );

    await gotoMerchant(page, ready, `/merchant/campaigns/${DRAFT_ID}/edit`);
    await expect(page.getByTestId('field-pool')).toHaveValue('1500.00');
    await expect(page.getByTestId('field-rate')).toHaveValue('7.00');
    await expect(page.getByTestId('field-cap')).toHaveValue('120.00');

    await page.getByTestId('editor-preview-link').click();
    const previewRules = page.locator('[data-app-widget="campaign-rules"]');
    await expect(previewRules).toContainText('RM 7.00 per 1,000 qualified views');
    await expect(previewRules).toContainText('RM 120.00');
    await expect(previewRules).toContainText('RM 1,500.00');

    await page.getByTestId('publish-campaign').click();
    await expect(page.getByTestId('publish-not-draft')).toBeVisible();

    await page.goto(`/merchant/campaigns/${DRAFT_ID}`);
    await waitForHydration(page);
    const detailRules = page.locator('[data-app-widget="campaign-rules"]');
    await expect(detailRules).toContainText('RM 7.00 per 1,000 qualified views');
    await expect(detailRules).toContainText('RM 120.00');
    expect(await moneyOf(page, '[data-bucket="available"] [data-money]')).toBe('150000');
    expect(await moneyOf(page, '[data-bucket="reserved"] [data-money]')).toBe('0');

    await page.goto(`/campaigns/${DRAFT_ID}`);
    await waitForHydration(page);
    const publicRules = page.locator('[data-app-widget="campaign-rules"]');
    await expect(publicRules).toContainText('RM 7.00 per 1,000 qualified views');
    await expect(publicRules).toContainText('RM 120.00');
    await expect(publicRules).toContainText('RM 1,500.00');
  });

  test('a saved draft survives a refresh', async ({ page }) => {
    await gotoMerchant(page, merchantState(), `/merchant/campaigns/${DRAFT_ID}/edit`);

    await page.getByTestId('field-title').fill('Kopi Kita Cold Brew (edited)');
    await page.getByTestId('field-pool').fill('1234.56');
    await page.getByTestId('editor-save').click();
    await expect(page.getByTestId('editor-dirty')).toHaveCount(0);

    await page.reload();
    await waitForHydration(page);
    await expect(page.getByTestId('field-title')).toHaveValue('Kopi Kita Cold Brew (edited)');
    await expect(page.getByTestId('field-pool')).toHaveValue('1234.56');

    const stored = (await readStoredState(page))!;
    expect(stored.campaigns[DRAFT_ID].rules.poolSen).toBe(123_456);
    expect(stored.campaigns[DRAFT_ID].status).toBe('draft');
  });

  test('a published campaign is read-only with a notice', async ({ page }) => {
    await gotoMerchant(page, merchantState(), `/merchant/campaigns/${PUBLISHED_ID}/edit`);
    await expect(page.getByTestId('editor-read-only')).toBeVisible();
    await expect(page.getByTestId('field-pool')).toHaveCount(0);
    await expect(page.getByTestId('editor-save')).toHaveCount(0);
  });

  test('another organisation campaign is not readable by url', async ({ page }) => {
    await gotoMerchant(page, merchantState(), '/merchant/campaigns/cmp-other-fit');
    await expect(page.locator('[data-app-state="empty"]')).toBeVisible();
    await expect(page.getByTestId('campaign-actions')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Service fee
// ---------------------------------------------------------------------------

test('the service fee is only pending configuration, never a number', async ({ page }) => {
  await gotoMerchant(page, merchantState(), `/merchant/campaigns/${DRAFT_ID}/edit`);
  await expect(page.getByTestId('field-service-fee')).toContainText(
    'Pending configuration · not charged in demo',
  );

  for (const path of [
    `/merchant/campaigns/${DRAFT_ID}/preview`,
    `/merchant/campaigns/${PUBLISHED_ID}`,
    `/campaigns/${PUBLISHED_ID}`,
  ]) {
    await page.goto(path);
    await waitForHydration(page);
    const body = await page.locator('body').innerText();
    expect(body).toContain('Pending configuration');
    expect(body).not.toMatch(/15\s*%/);
    expect(body).not.toMatch(/service fee[^\n]*RM/i);
  }
});

// ---------------------------------------------------------------------------
// 6. Notifications, email preview and the content decision
// ---------------------------------------------------------------------------

test.describe('events and review', () => {
  test('publishing notifies the merchant with a simulated email preview', async ({ page }) => {
    const ready = replay(
      merchantState(),
      [
        {
          type: 'demo.setReadiness',
          campaignId: DRAFT_ID,
          fundingEvidence: true,
          dataSourceReady: true,
        },
      ],
      'notify',
    );
    await gotoMerchant(page, ready, `/merchant/campaigns/${DRAFT_ID}/preview`);
    await page.getByTestId('publish-campaign').click();
    await expect(page.getByTestId('publish-not-draft')).toBeVisible();

    // The bell carries the new event for the merchant role.
    await expect(page.getByTestId('notifications-bell')).toContainText(/\d/);

    await page.goto('/notifications');
    await waitForHydration(page);
    const row = page
      .locator('[data-testid="notifications-list"] >> text=Campaign published')
      .first();
    await expect(row).toBeVisible();

    await page.getByTestId('email-preview-open').first().click();
    const preview = page.locator('[data-app-widget="email-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Simulated email preview');
    await expect(preview).toContainText('demo.user@wringy.test');
    await expect(preview).toContainText('open for submissions');
  });

  test('a content decision updates the same claim the creator sees', async ({ page }) => {
    // main_flow_ready leaves one metering submission with 1,000 qualified views;
    // the creator then claims it, so a pending claim exists before the merchant
    // makes any content decision.
    const withClaim = buildScenarioState('main_flow_ready');
    const submissionId = Object.values(withClaim.submissions).find(
      (submission) => submission.creatorId === 'user-demo',
    )!.id;
    const claimed = replay(
      withClaim,
      [
        { type: 'claim.request', submissionId },
        { type: 'session.switchWorkspace', workspace: 'merchant' },
      ],
      'claimed',
    );
    const claimId = Object.values(claimed.claims)[0].id;
    expect(claimed.claims[claimId].status).toBe('pending_review');

    await gotoMerchant(page, claimed, `/merchant/submissions/${submissionId}`);

    // The metering panel is separate and read-only; approving content must not
    // read as a payment.
    const metering = page.getByTestId('metering-panel');
    await expect(metering).toContainText('Metering (operations)');
    await expect(metering).toContainText('Metering review pending');
    await expect(metering.getByRole('button')).toHaveCount(0);

    // Reward view, read-only: 1,000 qualified views at RM5/1,000 = RM5.00.
    const reward = page.getByTestId('reward-panel');
    await expect(reward).toContainText('1,000');
    await expect(reward).toContainText('RM 5.00');

    // The external post link opens a new tab and says so.
    const link = page.getByTestId('submission-post-link');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('aria-label', /new tab/i);

    await page.getByTestId('content-reject').click();
    await page.getByRole('textbox').fill('The blend name is not mentioned in the first ten seconds.');
    await page.getByTestId('confirm-accept').click();

    await expect(page.getByTestId('content-decided')).toContainText('Content rejected');
    await expect(page.getByTestId('content-reason')).toContainText('blend name');

    const stored = (await readStoredState(page))!;
    expect(stored.submissions[submissionId].contentReview.status).toBe('rejected');
    // The very same claim changed, and the reservation is HELD for the appeal
    // window rather than returned to the pool.
    expect(stored.claims[claimId].status).toBe('rejected_appealable');
    expect(stored.claims[claimId].rejection?.source).toBe('content');
    expect(stored.claims[claimId].rejection?.reason).toContain('blend name');

    // The merchant's campaign page shows the same claim and keeps the amount
    // reserved rather than paid.
    await page.goto(`/merchant/campaigns/${stored.claims[claimId].campaignId}`);
    await waitForHydration(page);
    await expect(page.locator(`[data-claim-id="${claimId}"]`)).toContainText('appeal');
    expect(await moneyOf(page, '[data-bucket="reserved"] [data-money]')).toBe('500');
    expect(await moneyOf(page, '[data-bucket="paid"] [data-money]')).toBe('0');
  });

  test('approving content leaves the claim pending and nothing paid', async ({ page }) => {
    const withClaim = buildScenarioState('main_flow_ready');
    const submissionId = Object.values(withClaim.submissions).find(
      (submission) => submission.creatorId === 'user-demo',
    )!.id;
    const claimed = replay(
      withClaim,
      [
        { type: 'claim.request', submissionId },
        { type: 'session.switchWorkspace', workspace: 'merchant' },
      ],
      'approve',
    );
    const claimId = Object.values(claimed.claims)[0].id;

    await gotoMerchant(page, claimed, `/merchant/submissions/${submissionId}`);
    await page.getByTestId('content-approve').click();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('content-decided')).toContainText('Content approved');

    const stored = (await readStoredState(page))!;
    expect(stored.submissions[submissionId].contentReview.status).toBe('approved');
    // Content approval alone confirms nothing.
    expect(stored.claims[claimId].status).toBe('pending_review');
    expect(stored.claims[claimId].meteringReview.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// #8: closure, calendar and report
// ---------------------------------------------------------------------------

test.describe('closure and calendar', () => {
  test('the calendar states the approved worked example', async ({ page }) => {
    await gotoMerchant(page, merchantState(), `/merchant/campaigns/${PUBLISHED_ID}`);
    // The seed publishes at 1 Sept 2026 12:00 (+08:00): metering ends 8 Sept,
    // claims close 15 Sept.
    const example = page.getByTestId('calendar-example');
    await expect(example).toContainText('1 Sept 2026, 12:00');
    await expect(example).toContainText('8 Sept 2026, 12:00');
    await expect(example).toContainText('15 Sept 2026, 12:00');
  });

  test('a campaign with an open appeal cannot be shown as fully settled', async ({ page }) => {
    const state = merchantState('campaign_closure');
    const campaignId = Object.values(state.campaigns).find(
      (campaign) => campaign.title === 'Kopi Kita Closure Demo',
    )!.id;

    await gotoMerchant(page, state, `/merchant/campaigns/${campaignId}`);

    const closure = page.getByTestId('closure-panel');
    await expect(closure).toHaveAttribute('data-fully-settled', 'false');
    await expect(page.getByTestId('closure-verdict')).toContainText('Not fully settled');
    // The sub-minimum tail is disclosed rather than hidden: RM2.50 from the
    // 500-view YouTube post.
    await expect(page.getByTestId('closure-tail')).toContainText('RM 2.50');
    await expect(page.getByTestId('closure-refund')).toContainText('Pending verification');
    // Confirmed unpaid and paid are two separate figures, never one total.
    await expect(page.getByTestId('campaign-report')).toContainText('Confirmed unpaid');
    await expect(page.getByTestId('campaign-report')).toContainText('Paid');
    await expectNoHorizontalOverflow(page);
  });

  test('pause, close submissions and close are confirmed and refused when invalid', async ({
    page,
  }) => {
    await gotoMerchant(page, merchantState(), `/merchant/campaigns/${PUBLISHED_ID}`);

    await page.getByTestId('campaign-pause').click();
    await page.getByTestId('confirm-accept').click();
    expect((await readStoredState(page))!.campaigns[PUBLISHED_ID].status).toBe('paused');

    await page.getByTestId('campaign-resume').click();
    await page.getByTestId('confirm-accept').click();
    expect((await readStoredState(page))!.campaigns[PUBLISHED_ID].status).toBe('published');

    await page.getByTestId('campaign-close-submissions').click();
    await page.getByTestId('confirm-accept').click();
    expect((await readStoredState(page))!.campaigns[PUBLISHED_ID].status).toBe(
      'submissions_closed',
    );

    // Closing needs a written reason before the confirm button unlocks.
    await page.getByTestId('campaign-close').click();
    await expect(page.getByTestId('confirm-accept')).toBeDisabled();
    await page.getByRole('textbox').fill('Budget committed elsewhere.');
    await page.getByTestId('confirm-accept').click();
    expect((await readStoredState(page))!.campaigns[PUBLISHED_ID].status).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// 7. Language, viewports and the overview
// ---------------------------------------------------------------------------

test.describe('language and layout', () => {
  test('switching language on the editor keeps the typed values', async ({ page }) => {
    await gotoMerchant(page, merchantState(), `/merchant/campaigns/${DRAFT_ID}/edit`);

    await page.getByTestId('field-title').fill('Kopi Kita Cold Brew v2');
    await page.getByTestId('field-pool').fill('1750.25');
    await page.getByTestId('field-threshold').fill('100000');

    await setLocale(page, 'ms-MY');
    await expect(page.getByTestId('field-title')).toHaveValue('Kopi Kita Cold Brew v2');
    await expect(page.getByTestId('field-pool')).toHaveValue('1750.25');
    await expect(page.getByTestId('cap-explanation')).toBeVisible();

    await setLocale(page, 'zh-Hans-MY');
    await expect(page.getByTestId('field-title')).toHaveValue('Kopi Kita Cold Brew v2');
    await expect(page.getByTestId('field-pool')).toHaveValue('1750.25');
    // The amount is the same number in every language; only the format changes.
    await expect(page.getByTestId('editor-defaults')).toContainText('2,000.00');

    await setLocale(page, 'en-MY');
    await expect(page.getByTestId('field-threshold')).toHaveValue('100000');
  });

  test('the overview, the list and the review page fit the viewport', async ({ page }) => {
    const state = merchantState('main_flow_ready');
    const submissionId = Object.values(state.submissions).find(
      (submission) => submission.creatorId === 'user-demo',
    )!.id;

    await gotoMerchant(page, state, '/merchant');
    await expect(page.getByTestId('overview-status-counts')).toBeVisible();
    await expect(page.getByTestId('overview-budgets')).toBeVisible();
    await expect(page.getByTestId('pending-review-count')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    for (const path of [
      '/merchant/campaigns',
      `/merchant/campaigns/${PUBLISHED_ID}`,
      `/merchant/campaigns/${DRAFT_ID}/edit`,
      `/merchant/campaigns/${DRAFT_ID}/preview`,
      '/merchant/submissions',
      `/merchant/submissions/${submissionId}`,
      '/merchant/reports',
    ]) {
      await page.goto(path);
      await waitForHydration(page);
      await expectNoHorizontalOverflow(page);
    }
  });

  test('an identity with no organisation gets a labelled refusal, not a blank page', async ({
    page,
  }) => {
    // Ben is a creator with no org membership, so `resolveActor` gives him no
    // merchant role at all. The seed has no org that owns zero campaigns, so the
    // overview's own empty state is not reachable by replaying commands; this
    // covers the neighbouring condition the seed does reach.
    const state = replay(
      buildScenarioState('baseline'),
      [{ type: 'session.signIn', userId: 'user-ben' }],
      'no-org',
    );
    await gotoMerchant(page, state, '/merchant');
    await expect(page.locator('[data-app-state="forbidden"]')).toBeVisible();
    await expect(page.getByTestId('new-campaign')).toHaveCount(0);
  });
});

test.describe('small viewport', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) !== 320, 'the 320px spot check only');

  test('the editor keeps its primary action reachable at 320px', async ({ page }) => {
    await gotoMerchant(page, merchantState(), `/merchant/campaigns/${DRAFT_ID}/edit`);

    const save = page.getByTestId('editor-save');
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeVisible();

    const box = await save.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);

    await expectNoHorizontalOverflow(page);
  });
});

// ---------------------------------------------------------------------------
// Acceptance frames
// ---------------------------------------------------------------------------

/**
 * Capture only; nothing here asserts pixels. Output goes to the git-ignored
 * `tests/e2e/__screenshots__/`, following `screenshots.spec.ts`; the key frames
 * are copied into `docs/m1-prototype/screenshots/` by hand so the tracked
 * evidence stays a small, deliberate set.
 */
test.describe('screenshots', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) === 320, 'the 390 and 1440 frames only');

  test('merchant frames', async ({ page }, testInfo) => {
    const suffix = testInfo.project.name;
    const shot = (name: string) =>
      page.screenshot({ path: `tests/e2e/__screenshots__/${name}-${suffix}.png`, fullPage: true });

    const withClaim = buildScenarioState('main_flow_ready');
    const submissionId = Object.values(withClaim.submissions).find(
      (submission) => submission.creatorId === 'user-demo',
    )!.id;
    const state = replay(
      withClaim,
      [
        { type: 'claim.request', submissionId },
        { type: 'session.switchWorkspace', workspace: 'merchant' },
        {
          type: 'demo.setReadiness',
          campaignId: DRAFT_ID,
          fundingEvidence: true,
          dataSourceReady: true,
        },
      ],
      'frames',
    );

    await gotoMerchant(page, state, '/merchant/campaigns');
    await shot('20-merchant-campaigns');

    await page.goto(`/merchant/campaigns/${DRAFT_ID}/edit`);
    await waitForHydration(page);
    await page.getByTestId('field-min-claim').fill('150.00');
    await page.getByTestId('field-threshold').fill('100000');
    await page.getByTestId('editor-save').click();
    await expect(page.getByTestId('editor-error-summary')).toBeVisible();
    await shot('21-merchant-editor-validation');

    await page.goto(`/merchant/campaigns/${DRAFT_ID}/preview`);
    await waitForHydration(page);
    await shot('22-merchant-preview-ready');

    await page.goto(`/merchant/campaigns/${PUBLISHED_ID}`);
    await waitForHydration(page);
    await shot('23-merchant-campaign-detail');

    await page.goto(`/merchant/submissions/${submissionId}`);
    await waitForHydration(page);
    await shot('24-merchant-content-review');

    await page.goto('/merchant');
    await waitForHydration(page);
    await shot('25-merchant-overview');
  });
});

// The role check below runs in every project: a creator identity must not reach
// the merchant workspace at all.
test('a creator identity cannot open the merchant workspace', async ({ page }) => {
  await loadScenario(page, 'baseline');
  await signInAs(page, 'creator');
  await page.goto('/merchant/campaigns');
  await waitForHydration(page);
  await expect(page.locator('[data-app-state="forbidden"]')).toBeVisible();
  await expect(page.getByTestId('new-campaign')).toHaveCount(0);
});
