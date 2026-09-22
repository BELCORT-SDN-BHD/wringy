/**
 * Screenshot capture for the M1 acceptance record.
 *
 * Output goes to `tests/e2e/__screenshots__/` (git-ignored). The key frames are
 * copied into `docs/m1-prototype/screenshots/` by hand, so the tracked evidence
 * stays a deliberate, small set rather than everything this run produces.
 *
 * These are not visual-regression comparisons; nothing here asserts pixels.
 */

import { test } from '@playwright/test';

import {
  closeDemoTools,
  loadScenario,
  loadScenarioAsGuest,
  openDemoTools,
  signInAs,
  waitForHydration,
} from './helpers';

test.describe('screenshots', () => {
  test('public pages', async ({ page }, testInfo) => {
    const suffix = testInfo.project.name;

    await page.goto('/');
    await waitForHydration(page);
    // Captured before answering, because the first-visit prompt is part of the flow.
    await page.screenshot({ path: `tests/e2e/__screenshots__/01-landing-prompt-${suffix}.png` });

    await loadScenarioAsGuest(page, 'main_flow_ready', '/');
    await page.screenshot({ path: `tests/e2e/__screenshots__/02-landing-${suffix}.png` });

    await page.goto('/campaigns');
    await waitForHydration(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/03-catalogue-${suffix}.png`,
      fullPage: true,
    });

    await page.getByRole('listitem').first().getByRole('link').click();
    await waitForHydration(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/04-campaign-detail-${suffix}.png`,
      fullPage: true,
    });

    await page.goto('/sign-in');
    await waitForHydration(page);
    await page.screenshot({ path: `tests/e2e/__screenshots__/05-sign-in-${suffix}.png` });
  });

  test('workspaces, notifications, settings and demo tools', async ({ page }, testInfo) => {
    const suffix = testInfo.project.name;

    await loadScenario(page, 'main_flow_ready');
    await signInAs(page, 'creator');

    await page.goto('/creator');
    await waitForHydration(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/06-creator-overview-${suffix}.png`,
      fullPage: true,
    });

    await page.goto('/notifications');
    await waitForHydration(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/07-notifications-${suffix}.png`,
      fullPage: true,
    });

    await page.getByTestId('email-preview-open').first().click();
    await page.screenshot({ path: `tests/e2e/__screenshots__/08-email-preview-${suffix}.png` });
    await page.keyboard.press('Escape');

    await page.goto('/settings');
    await waitForHydration(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/09-settings-${suffix}.png`,
      fullPage: true,
    });

    await openDemoTools(page);
    await page.screenshot({ path: `tests/e2e/__screenshots__/10-demo-tools-${suffix}.png` });
    await closeDemoTools(page);

    await signInAs(page, 'merchant');
    await page.goto('/merchant');
    await waitForHydration(page);
    await page.screenshot({
      path: `tests/e2e/__screenshots__/11-merchant-overview-${suffix}.png`,
      fullPage: true,
    });

    // The refusal frame needs an identity that really cannot hold the role: a
    // creator/merchant route now selects the workspace this identity owns, so the
    // operations identity (a separate simulated user) is the honest case.
    await signInAs(page, 'ops_reviewer');
    await page.goto('/merchant');
    await waitForHydration(page);
    await page.screenshot({ path: `tests/e2e/__screenshots__/12-forbidden-${suffix}.png` });
  });
});
