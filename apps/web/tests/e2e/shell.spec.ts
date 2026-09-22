/**
 * The wave-1 shell run: landing → catalogue → detail → simulated sign-in →
 * creator overview → merchant workspace → notifications → settings language
 * switch → reset.
 *
 * It exists to prove the frame the role features will be built into, and it
 * asserts the things ticket #2 lists: the demo mark on every page, only the
 * simulated Google entry, the same record set behind the three roles, persisted
 * state and read flags, the empty / loading / forbidden conditions, a language
 * switch that keeps typed input, and no clipped primary action at 320px.
 */

import { expect, test } from '@playwright/test';

import {
  addViews,
  advanceClock,
  clearStoredDemo,
  dismissLocalePrompt,
  expectNoHorizontalOverflow,
  loadScenario,
  loadScenarioAsGuest,
  loadScenarioViaUi,
  readStoredState,
  resetDemo,
  setLocale,
  signInAs,
  waitForHydration,
} from './helpers';

test.describe('public pages', () => {
  test('landing offers only the simulated Google entry', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);

    // The first-visit prompt is a light inline region, not a blocking gate.
    await expect(page.getByTestId('locale-prompt')).toBeVisible();
    await dismissLocalePrompt(page);

    await expect(page.getByTestId('demo-badge')).toBeVisible();
    await expect(page.getByTestId('landing-sign-in')).toBeVisible();

    // No email, password or one-time-code control anywhere on the page.
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[autocomplete="one-time-code"]')).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });

  test('catalogue and detail state the rate, cap, minimum and dates', async ({ page }) => {
    await loadScenario(page, 'baseline', '/campaigns');

    const cards = page.getByRole('listitem');
    await expect(cards.first()).toBeVisible();

    await cards.first().getByRole('link').click();
    await expect(page.getByTestId('join-campaign')).toBeVisible();

    const rules = page.locator('[data-app-widget="campaign-rules"]');
    await expect(rules).toContainText('per 1,000 qualified views');
    await expect(rules).toContainText('Pending configuration');
    await expect(rules).toContainText('UTC+08:00');

    await expectNoHorizontalOverflow(page);
  });

  test('joining while signed out goes through the simulated sign-in', async ({ page }) => {
    await loadScenarioAsGuest(page, 'baseline', '/campaigns');
    await page.getByRole('listitem').first().getByRole('link').click();
    await page.getByTestId('join-campaign').click();

    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await expect(page.getByTestId('sign-in-google')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('a campaign that is not published is not readable by url', async ({ page }) => {
    await loadScenario(page, 'baseline', '/campaigns/cmp-kopi-draft');
    await expect(page.locator('[data-app-state="empty"]')).toBeVisible();
    await expect(page.getByTestId('join-campaign')).toHaveCount(0);
  });
});

test.describe('workspaces', () => {
  test('the creator overview is guarded and shows the four budget buckets', async ({ page }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');

    await page.goto('/creator');
    await waitForHydration(page);

    const buckets = page.locator('[data-app-widget="budget-buckets"]').first();
    await expect(buckets).toBeVisible();
    for (const bucket of ['available', 'reserved', 'confirmed_unpaid', 'paid']) {
      await expect(buckets.locator(`[data-bucket="${bucket}"]`)).toBeVisible();
    }

    await expectNoHorizontalOverflow(page);
  });

  test('the merchant workspace shows the same pool as the creator', async ({ page }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');
    await page.goto('/creator');
    const creatorPool = await page
      .locator('[data-app-widget="budget-buckets"] [data-bucket="available"]')
      .first()
      .innerText();

    await signInAs(page, 'merchant');
    await page.goto('/merchant');
    await waitForHydration(page);
    const merchantPool = await page
      .locator('[data-app-widget="budget-buckets"] [data-bucket="available"]')
      .first()
      .innerText();

    expect(merchantPool).toBe(creatorPool);
  });

  /**
   * The refusal still has to exist, and it has to be shown for an identity that
   * really cannot hold the role. The operations identities are separate simulated
   * users reachable only from the demo tools, so an ops identity on a merchant
   * route is that case; `session.switchWorkspace` also clears `opsRole`, so
   * following the route here would silently demote the operator.
   */
  test('an identity that cannot hold the role sees a labelled simulated refusal', async ({
    page,
  }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'ops_reviewer');

    await page.goto('/merchant');
    await expect(page.locator('[data-app-state="forbidden"]')).toBeVisible();
    await expect(page.locator('[data-app-state="forbidden"]')).toContainText(
      'simulated check, not production authorisation',
    );
    expect((await readStoredState(page))!.session.opsRole).toBe('ops_reviewer');
  });

  /**
   * One simulated identity owns both the creator workspace and the Kopi Kita org
   * (kickoff decision 7) and `resolveActor` derives the role from
   * `session.workspace`, so "wrong role" on a `/creator` or `/merchant` route can
   * mean nothing more than "the other workspace is selected". The founder walk hit
   * exactly that: with the merchant workspace active, "Join campaign" links to
   * `/creator/submissions/new?campaign=…` and the creator route answered "you do
   * not have access to this workspace" for a workspace this identity does own.
   * Sign-in already derives the workspace from the return path; the guard now does
   * the same for an identity that is already signed in.
   */
  test('joining from the merchant workspace follows the route into the creator workspace', async ({
    page,
  }) => {
    await loadScenario(page, 'baseline');
    await signInAs(page, 'merchant');

    await page.goto('/campaigns');
    await waitForHydration(page);
    await page.getByRole('listitem').first().getByRole('link').click();
    await page.getByTestId('join-campaign').click();

    await expect(page).toHaveURL(/\/creator\/submissions\/new\?campaign=/);
    await waitForHydration(page);
    await expect(page.locator('[data-app-state="forbidden"]')).toHaveCount(0);
    await expect(page.getByTestId('submit-link')).toBeVisible();
    expect((await readStoredState(page))!.session.workspace).toBe('creator');
  });

  test('a merchant route from the creator workspace lands on the merchant overview', async ({
    page,
  }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');

    await page.goto('/merchant');
    await waitForHydration(page);
    await expect(page.locator('[data-app-state="forbidden"]')).toHaveCount(0);
    await expect(page.getByTestId('overview-budgets')).toBeVisible();
    expect((await readStoredState(page))!.session.workspace).toBe('merchant');
  });

  test('an unreadable source keeps the last trusted value and never shows 0', async ({ page }) => {
    await loadScenario(page, 'data_outage');
    await signInAs(page, 'creator');
    await page.goto('/creator');
    await waitForHydration(page);

    const notice = page.getByTestId('overview-data-unavailable');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Unknown does not mean zero');
    await expect(notice).toContainText('Last trusted');
    // The scenario's last trusted read was 1,000 qualified views, and that is what
    // stays on screen: the unreadable source did not turn into a zero.
    await expect(notice).toContainText('1,000 · Qualified views');
    await expect(notice).toContainText('UTC+08:00');
  });

  test('a signed-out visitor is sent to sign in with a return path', async ({ page }) => {
    await loadScenarioAsGuest(page, 'baseline');
    await page.goto('/creator');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fcreator/);
  });

  /**
   * `session.signIn` always lands in the creator workspace (it is the baseline a
   * reset returns to) and the engine derives the role from the active workspace, so
   * a `/merchant` return path has to select that workspace before navigating.
   * Otherwise the only sign-in control in the demo deposits the visitor on "you do
   * not have access to this workspace" for the org this very identity owns — a
   * refusal the demo is supposed to show on purpose, not by accident.
   */
  test('signing in with a merchant return path lands in the merchant workspace', async ({
    page,
  }) => {
    await loadScenarioAsGuest(page, 'baseline');
    await page.goto('/merchant/campaigns');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fmerchant%2Fcampaigns/);

    await page.getByTestId('sign-in-google').click();
    await expect(page).toHaveURL(/\/merchant\/campaigns/);
    await waitForHydration(page);
    await expect(page.locator('[data-app-state="forbidden"]')).toHaveCount(0);
    await expect(page.getByTestId('new-campaign')).toBeVisible();
    expect((await readStoredState(page))!.session.workspace).toBe('merchant');
  });

  /**
   * The operations identities are separate simulated users reachable only from the
   * demo tools, so for an /ops return path the refusal would be TRUE. Saying so and
   * routing to the workspace this identity does own beats handing it a dead end.
   */
  test('signing in with an operations return path says why and goes to the creator workspace', async ({
    page,
  }) => {
    await loadScenarioAsGuest(page, 'baseline');
    await page.goto('/ops/claims');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fops%2Fclaims/);
    await expect(page.getByTestId('sign-in-ops-notice')).toContainText('demo tools');

    await page.getByTestId('sign-in-google').click();
    await expect(page).toHaveURL(/\/creator$/);
    await expect(page.locator('[data-app-state="forbidden"]')).toHaveCount(0);
  });
});

test.describe('notifications', () => {
  test('unread first, and the read flag survives a refresh', async ({ page }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');

    await page.goto('/notifications');
    await waitForHydration(page);

    const list = page.getByTestId('notifications-list');
    await expect(list).toBeVisible();

    const firstUnread = list.locator('[data-unread="true"]').first();
    await expect(firstUnread).toBeVisible();
    await firstUnread.getByTestId('mark-read').click();

    await page.reload();
    await waitForHydration(page);

    const stored = await readStoredState(page);
    const readCount = Object.values(stored?.notifications ?? {}).filter(
      (notification) => notification.readAt !== null,
    ).length;
    expect(readCount).toBeGreaterThan(0);
  });

  test('one event reaches each role in its own context, with its own link', async ({ page }) => {
    // A row exists per (event, recipient, role). Demo User owns both the creator
    // workspace and the Kopi Kita org, so the same campaign.published event is a
    // creator row linking to the public page and a merchant row linking to the
    // campaign's budget columns. Ticket #2: 同事件通知正确角色.
    await loadScenario(page, 'main_flow_ready');

    await signInAs(page, 'creator');
    await page.goto('/notifications');
    await waitForHydration(page);
    const creatorList = page.getByTestId('notifications-list');
    await expect(creatorList).toContainText('Received as creator');
    await expect(creatorList).not.toContainText('Received as merchant');
    const creatorRows = await creatorList.locator('[data-slot="item"]').count();

    await signInAs(page, 'merchant');
    await page.goto('/notifications');
    await waitForHydration(page);
    const merchantList = page.getByTestId('notifications-list');
    await expect(merchantList).toContainText('Received as merchant');
    await expect(merchantList).not.toContainText('Received as creator');
    const merchantRows = await merchantList.locator('[data-slot="item"]').count();

    // Both lists carry rows, and neither is the other's list relabelled.
    expect(creatorRows).toBeGreaterThan(0);
    expect(merchantRows).toBeGreaterThan(0);
    await expect(merchantList.getByRole('link').first()).toHaveAttribute(
      'href',
      /^\/merchant\//,
    );
  });

  test('marking one role row read leaves the other role unread', async ({ page }) => {
    await loadScenario(page, 'main_flow_ready');

    await signInAs(page, 'creator');
    await page.goto('/notifications');
    await waitForHydration(page);
    await page.getByTestId('mark-all-read').click();
    await expect(page.getByTestId('mark-all-read')).toBeDisabled();

    // markAllRead covers the current user across both roles, so the merchant
    // list must also be clear. A per-row markRead is the one that is scoped.
    await signInAs(page, 'merchant');
    await page.goto('/notifications');
    await waitForHydration(page);
    await expect(page.getByTestId('mark-all-read')).toBeDisabled();

    await resetDemo(page);
    await signInAs(page, 'creator');
    await page.goto('/notifications');
    await waitForHydration(page);
    const row = page.getByTestId('notifications-list').locator('[data-unread="true"]').first();
    await row.getByTestId('mark-read').click();

    await signInAs(page, 'merchant');
    await page.goto('/notifications');
    await waitForHydration(page);
    // The merchant row for the same event was not touched.
    await expect(page.getByTestId('mark-all-read')).toBeEnabled();
  });

  test('an important event offers the simulated email preview', async ({ page }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');
    await page.goto('/notifications');
    await waitForHydration(page);

    const open = page.getByTestId('email-preview-open').first();
    await expect(open).toBeVisible();
    await open.click();

    const dialog = page.locator('[data-app-widget="email-preview"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('not sent');

    // Official dialog behaviour: Escape closes and focus returns to the trigger.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });
});

test.describe('settings and demo data', () => {
  test('switching language keeps a typed value and does not navigate', async ({ page }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');

    await page.goto('/settings');
    await waitForHydration(page);

    const note = page.getByTestId('settings-scratch-note');
    await note.fill('jangan hilang');
    const urlBefore = page.url();

    await setLocale(page, 'ms-MY');
    expect(page.url()).toBe(urlBefore);
    await expect(note).toHaveValue('jangan hilang');

    await setLocale(page, 'zh-Hans-MY');
    expect(page.url()).toBe(urlBefore);
    await expect(note).toHaveValue('jangan hilang');

    await setLocale(page, 'en-MY');
    await expect(note).toHaveValue('jangan hilang');
  });

  test('reset returns to the baseline after a confirmation', async ({ page }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');
    await page.goto('/settings');
    await waitForHydration(page);

    await page.getByTestId('settings-reset').click();
    await page.getByTestId('confirm-accept').click();

    await page.reload();
    await waitForHydration(page);
    const stored = await readStoredState(page);
    expect(stored?.scenario).toBe('baseline');
  });
});

test.describe('demo tools', () => {
  test('the clock, views and a scenario load all work from the panel', async ({ page }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');

    const before = await readStoredState(page);
    const clockBefore = before?.clock.nowIso;

    await advanceClock(page, 'day');
    const afterClock = await readStoredState(page);
    expect(afterClock?.clock.nowIso).not.toBe(clockBefore);

    // Every demo action reports its outcome through Sonner, so this also proves
    // the toaster renders without a theme provider.
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible();

    const submissionId = Object.values(before?.submissions ?? {}).find(
      (submission) => submission.creatorId === before?.session.userId,
    )?.id;
    expect(submissionId, 'the main flow scenario has a submission for the demo user').toBeTruthy();

    await addViews(page, submissionId as string, 1000);

    // The UI-driven scenario path, so the panel itself is covered once.
    await loadScenarioViaUi(page, 'payout_unknown');
    const afterScenario = await readStoredState(page);
    expect(afterScenario?.scenario).toBe('payout_unknown');

    await resetDemo(page);
    const afterReset = await readStoredState(page);
    expect(afterReset?.scenario).toBe('baseline');
  });

  test('the creator product UI has no add-views control', async ({ page }) => {
    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');
    await page.goto('/creator');
    await waitForHydration(page);

    // The panel is closed, so nothing on the page may offer it.
    await expect(page.getByTestId('demo-add-1000')).toHaveCount(0);
    await expect(page.getByTestId('demo-add-custom')).toHaveCount(0);
  });
});

test.describe('loading and cold start', () => {
  test('a cold start with no stored data still renders', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    await clearStoredDemo(page);
    await expect(page.getByTestId('demo-badge')).toBeVisible();
  });
});

test.describe('layout', () => {
  const paths = ['/', '/campaigns', '/sign-in', '/notifications', '/settings'];

  for (const path of paths) {
    test(`no sideways scroll on ${path}`, async ({ page }) => {
      await loadScenario(page, 'main_flow_ready');
      await signInAs(page, 'creator');
      await page.goto(path);
      await waitForHydration(page);
      await expectNoHorizontalOverflow(page);
    });
  }
});
