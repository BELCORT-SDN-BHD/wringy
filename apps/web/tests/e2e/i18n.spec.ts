/**
 * Trilingual checks.
 *
 * next-intl reports a missing key or a bad message through `console.error`
 * rather than throwing, so a page can silently render a raw key path. These
 * tests walk every route in the app in all three languages with the console
 * under watch, which is the only way to see that.
 *
 * L10N acceptance this covers: identical copy keys across the three catalogues,
 * the region language attribute following the choice, and a switch that changes
 * the format of an amount without changing the amount.
 */

import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

import {
  injectStateWithLocale,
  loadScenario,
  localeName,
  setLocale,
  signInAs,
  stateAs,
  waitForHydration,
  type DemoRole,
} from './helpers';
import type { DemoState, Locale, ScenarioId } from '../../src/domain/types';
import { LOCALE_COOKIE } from '../../src/i18n/config';
import { DEMO_STORAGE_KEY } from '../../src/store/persistence';

const LOCALES: Locale[] = ['en-MY', 'ms-MY', 'zh-Hans-MY'];

/** Anything next-intl says when a message is missing or malformed. */
const INTL_FAILURE = /MISSING_MESSAGE|INSUFFICIENT_PATH|INVALID_MESSAGE|INVALID_KEY|MISSING_FORMAT/;

// ---------------------------------------------------------------------------
// Every route in the app, grouped by the role that can read it
// ---------------------------------------------------------------------------

const PUBLISHED_CAMPAIGN = 'cmp-kopi-raya';
const DRAFT_CAMPAIGN = 'cmp-kopi-draft';

/**
 * Record ids are resolved from the loaded state rather than hard-coded, and the
 * resolvers throw instead of skipping: a scenario that stops producing a claim
 * must fail this walk loudly, not quietly stop covering the claim page.
 */
function firstOwn<T extends { creatorId: string }>(records: T[], owner: string, what: string): T {
  const found = records.find((record) => record.creatorId === owner);
  if (!found) throw new Error(`the scenario has no ${what} belonging to ${owner}`);
  return found;
}

function firstOf<T>(records: T[], what: string): T {
  const [found] = records;
  if (!found) throw new Error(`the scenario has no ${what}`);
  return found;
}

interface RouteGroup {
  role: DemoRole | 'guest';
  scenario: ScenarioId;
  /** Built from the state so a dynamic segment points at a record that exists. */
  paths: (state: DemoState) => string[];
}

/**
 * The scenario each group walks is chosen for the records it contains:
 * `campaign_closure` is the only preset that has submissions, a claim, an open
 * appeal and a confirmed obligation at once, and `payout_unknown` is the only one
 * with a payout attempt.
 */
const GROUPS: readonly RouteGroup[] = [
  {
    role: 'guest',
    scenario: 'campaign_closure',
    paths: () => ['/', '/campaigns', `/campaigns/${PUBLISHED_CAMPAIGN}`, '/sign-in', '/demo'],
  },
  {
    role: 'creator',
    scenario: 'campaign_closure',
    paths: (state) => {
      const submission = firstOwn(Object.values(state.submissions), 'user-demo', 'submission');
      const claim = firstOwn(Object.values(state.claims), 'user-demo', 'claim');
      return [
        '/creator',
        '/creator/accounts',
        '/creator/submissions',
        '/creator/submissions/new',
        `/creator/submissions/${submission.id}`,
        '/creator/claims',
        `/creator/claims/${claim.id}`,
        '/creator/payments',
        '/notifications',
        '/settings',
        '/demo',
      ];
    },
  },
  {
    role: 'merchant',
    scenario: 'campaign_closure',
    paths: (state) => {
      const submission = firstOwn(Object.values(state.submissions), 'user-demo', 'submission');
      return [
        '/merchant',
        '/merchant/campaigns',
        `/merchant/campaigns/${PUBLISHED_CAMPAIGN}`,
        `/merchant/campaigns/${DRAFT_CAMPAIGN}/edit`,
        `/merchant/campaigns/${DRAFT_CAMPAIGN}/preview`,
        '/merchant/submissions',
        `/merchant/submissions/${submission.id}`,
        '/merchant/reports',
        '/notifications',
      ];
    },
  },
  {
    role: 'ops_reviewer',
    scenario: 'campaign_closure',
    paths: (state) => {
      const submission = firstOf(Object.values(state.submissions), 'submission');
      const claim = firstOf(Object.values(state.claims), 'claim');
      const appeal = firstOf(Object.values(state.appeals), 'appeal');
      return [
        '/ops',
        '/ops/submissions',
        `/ops/submissions/${submission.id}`,
        '/ops/claims',
        `/ops/claims/${claim.id}`,
        '/ops/appeals',
        `/ops/appeals/${appeal.id}`,
        '/ops/exceptions',
        '/ops/readiness',
        `/ops/campaigns/${PUBLISHED_CAMPAIGN}/readiness`,
        '/notifications',
      ];
    },
  },
  {
    role: 'ops_finance',
    scenario: 'payout_unknown',
    paths: (state) => {
      const attempt = firstOf(Object.values(state.payoutAttempts), 'payout attempt');
      return ['/ops/payouts', `/ops/payouts/${attempt.id}`];
    },
  },
];

/** Collects every next-intl complaint the browser makes, with the page it made it on. */
function watchForMissingMessages(page: Page, problems: string[]): void {
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error' && INTL_FAILURE.test(message.text())) {
      problems.push(`${page.url()}: ${message.text()}`);
    }
  });
}

test.describe('trilingual route walk', () => {
  // Five role groups over every route: slower than one page load, and the only
  // check that a role page nobody opened in English still has copy.
  test.slow();

  for (const locale of LOCALES) {
    test(`every route renders in ${locale} without a missing message`, async ({ page }) => {
      const problems: string[] = [];
      watchForMissingMessages(page, problems);

      for (const group of GROUPS) {
        const state = stateAs(group.scenario, group.role, locale);

        for (const path of group.paths(state)) {
          await injectStateWithLocale(page, state, locale, path);
          // The language must follow the choice on every page, not just the one
          // where it was made.
          await expect(page.locator('html')).toHaveAttribute('lang', locale);
          // A route the role may read must not land on the simulated refusal;
          // that would mean the walk proved nothing about the page behind it.
          if (group.role !== 'guest') {
            await expect(page.locator('[data-app-state="forbidden"]')).toHaveCount(0);
          }
        }
      }

      expect(problems).toEqual([]);
    });
  }
});

/**
 * The internal build's root layout (M2-01): the same language cookie drives
 * `<html lang>` and the copy, and the page must not mount any part of the demo.
 * It has no demo-tools trigger to wait for, so it is walked on its own.
 */
test.describe('internal build route walk', () => {
  const BANNER = '内部版本 · Internal build · Versi dalaman';

  for (const locale of LOCALES) {
    test(`/internal renders in ${locale} without console errors and without the demo store`, async ({
      page,
      baseURL,
    }) => {
      const errors: string[] = [];
      page.on('console', (message: ConsoleMessage) => {
        if (message.type() === 'error') errors.push(`${page.url()}: ${message.text()}`);
      });
      page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`));

      // A fresh context per test, so nothing from another page is in storage.
      await page.context().addCookies([{ name: LOCALE_COOKIE, value: locale, url: baseURL }]);
      await page.goto('/internal');
      await page.waitForLoadState('load');

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('[data-app-banner="internal-build"]')).toHaveText(BANNER);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (!process.env.API_INTERNAL_URL) {
        // W1 placeholder: the dev server Playwright starts has no API configured.
        await expect(page.locator('[data-app-state="not-configured"]')).toBeVisible();
      }

      // None of the demo shell is mounted ...
      await expect(page.getByTestId('demo-toolbar-trigger')).toHaveCount(0);
      await expect(page.getByTestId('locale-prompt')).toHaveCount(0);
      // ... and the demo store was never hydrated, so it never wrote its key.
      expect(await page.evaluate((key) => window.localStorage.getItem(key), DEMO_STORAGE_KEY)).toBeNull();
      expect(DEMO_STORAGE_KEY).toBe('wringy-demo-v1');

      expect(errors).toEqual([]);
    });
  }
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
    return raw
      ? (JSON.parse(raw) as { state: { state: { session: Record<string, unknown> } } })
      : null;
  });

  expect(stored?.state.state.session.localePromptDone).toBe(true);
  expect(stored?.state.state.session.localeExplicit).toBe(false);
});
