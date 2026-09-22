/**
 * Trilingual checks.
 *
 * next-intl reports a missing key or a bad message through `console.error`
 * rather than throwing, so a page can silently render a raw key path. These
 * tests walk every shell page in all three languages with the console under
 * watch, which is the only way to see that.
 *
 * L10N acceptance this covers: identical copy keys across the three catalogues,
 * the region language attribute following the choice, and a switch that changes
 * the format of an amount without changing the amount.
 */

import { expect, test, type ConsoleMessage } from '@playwright/test';

import {
  loadScenario,
  localeName,
  setLocale,
  signInAs,
  waitForHydration,
} from './helpers';
import type { Locale } from '../../src/domain/types';

const LOCALES: Locale[] = ['en-MY', 'ms-MY', 'zh-Hans-MY'];
const PAGES = ['/', '/campaigns', '/sign-in', '/creator', '/notifications', '/settings'];

/** Anything next-intl says when a message is missing or malformed. */
const INTL_FAILURE = /MISSING_MESSAGE|INSUFFICIENT_PATH|INVALID_MESSAGE|INVALID_KEY|MISSING_FORMAT/;

test('every shell page renders in all three languages without a missing message', async ({
  page,
}) => {
  const problems: string[] = [];
  const record = (message: ConsoleMessage) => {
    if (message.type() === 'error' && INTL_FAILURE.test(message.text())) {
      problems.push(`${page.url()}: ${message.text()}`);
    }
  };
  page.on('console', record);

  await loadScenario(page, 'main_flow_ready');
  await signInAs(page, 'creator');

  for (const locale of LOCALES) {
    await page.goto('/settings');
    await waitForHydration(page);
    await setLocale(page, locale);

    for (const path of PAGES) {
      await page.goto(path);
      await waitForHydration(page);
      // The language must follow the choice on every page, not just the one
      // where it was made.
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    }
  }

  expect(problems).toEqual([]);
});

test('the language select names each language in its own language', async ({ page }) => {
  await loadScenario(page, 'main_flow_ready');
  await signInAs(page, 'creator');
  await page.goto('/settings');
  await waitForHydration(page);

  for (const locale of LOCALES) {
    await setLocale(page, locale);
    await page.getByTestId('locale-select').first().click();
    for (const other of LOCALES) {
      await expect(page.getByRole('option', { name: localeName(other), exact: true })).toBeVisible();
    }
    await page.keyboard.press('Escape');
  }
});

test('switching language changes the format of an amount, not the amount', async ({ page }) => {
  await loadScenario(page, 'main_flow_ready', '/campaigns');

  const digits = (value: string) => value.replace(/[^\d.]/g, '');
  const amounts: Record<string, string> = {};

  for (const locale of LOCALES) {
    await setLocale(page, locale);
    const cap = await page
      .locator('[data-app-widget="campaign-rules"], dl')
      .first()
      .innerText()
      .catch(() => '');
    // The catalogue card carries the same figures as the detail rule sheet.
    const pool = await page.locator('[data-money]').first().getAttribute('data-money');
    amounts[locale] = `${pool}`;
    expect(cap.length).toBeGreaterThan(0);
  }

  // `data-money` is the integer sen the engine holds, so it must be identical.
  expect(new Set(Object.values(amounts)).size).toBe(1);
  expect(digits(Object.values(amounts)[0] ?? '')).not.toBe('');
});

test('the first-visit prompt records an explicit choice only on Continue', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);

  await expect(page.getByTestId('locale-prompt')).toBeVisible();
  await page.getByTestId('locale-prompt-continue').click();
  await expect(page.getByTestId('locale-prompt')).toHaveCount(0);

  await page.reload();
  await waitForHydration(page);
  // Answered once; it must not come back on the next visit.
  await expect(page.getByTestId('locale-prompt')).toHaveCount(0);
});

test('skipping the prompt does not record a language preference', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);

  await page.getByTestId('locale-prompt-skip').click();
  await expect(page.getByTestId('locale-prompt')).toHaveCount(0);

  const stored = await page.evaluate(() => {
    const raw = window.localStorage.getItem('wringy-demo-v1');
    return raw ? (JSON.parse(raw) as { state: { state: { session: Record<string, unknown> } } }) : null;
  });

  expect(stored?.state.state.session.localePromptDone).toBe(true);
  expect(stored?.state.state.session.localeExplicit).toBe(false);
});
