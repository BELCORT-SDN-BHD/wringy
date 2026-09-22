/**
 * Shared Playwright helpers for every M1 acceptance run.
 *
 * Two ways to reach a demo state:
 *   - `loadScenario` writes the state the engine builds for that preset straight
 *     into localStorage and reloads. It is fast and does not depend on the demo
 *     tools rendering, so most specs should use it.
 *   - `loadScenarioViaUi` drives the demo tools panel instead, which is what
 *     proves the panel itself works. `shell.spec.ts` covers that path once.
 *
 * Everything else here drives real controls, so a spec never reaches into the
 * store directly and never asserts against a state the UI could not produce.
 */

import { expect, type Locator, type Page } from '@playwright/test';

import { applyCommand, loadScenario as buildScenarioState } from '../../src/domain';
import { DEMO_STORAGE_KEY, persistedEnvelope } from '../../src/store/persistence';
import type { DemoState, Locale, ScenarioId } from '../../src/domain/types';

export type DemoRole = 'creator' | 'merchant' | 'ops_reviewer' | 'ops_finance';
export type ClockPreset = 'hour' | 'day' | 'week' | 'meteringEnd' | 'claimDeadline';

/** Language names shown in the select; the same strings in all three locales. */
const LOCALE_NAME: Record<Locale, string> = {
  'en-MY': 'English',
  'ms-MY': 'Bahasa Melayu',
  'zh-Hans-MY': '简体中文',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * The demo tools trigger renders only after the persisted state has been read,
 * so it is the hydration signal for every other helper.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await expect(page.getByTestId('demo-toolbar-trigger')).toBeVisible();
}

/**
 * Writes a state into localStorage and reloads so the app picks it up. The
 * navigation first is what gives the page an origin to write to.
 */
export async function injectState(page: Page, state: DemoState, path = '/'): Promise<void> {
  await page.goto(path);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [DEMO_STORAGE_KEY, JSON.stringify(persistedEnvelope(state))] as const,
  );
  await page.reload();
  await waitForHydration(page);
}

/** The fast path: the engine builds the scenario, the browser just loads it. */
export async function loadScenario(
  page: Page,
  scenarioId: ScenarioId,
  path = '/',
): Promise<DemoState> {
  const state = buildScenarioState(scenarioId);
  await injectState(page, state, path);
  await dismissLocalePrompt(page);
  return state;
}

/**
 * The same preset with nobody signed in.
 *
 * Replaying a scenario leaves the demo user signed in, because the steps are the
 * real commands and submitting requires an identity. A public-page test needs a
 * guest, so this signs out through the engine rather than editing the state by
 * hand.
 */
export async function loadScenarioAsGuest(
  page: Page,
  scenarioId: ScenarioId,
  path = '/',
): Promise<DemoState> {
  const signedIn = buildScenarioState(scenarioId);
  const result = applyCommand(signedIn, { type: 'session.signOut' }, { commandId: 'e2e-sign-out' });
  await injectState(page, result.state, path);
  await dismissLocalePrompt(page);
  return result.state;
}

/** The slow path, which proves the demo tools panel itself works. */
export async function loadScenarioViaUi(page: Page, scenarioId: ScenarioId): Promise<void> {
  await openDemoTools(page);
  await page.getByTestId('demo-scenario-select').click();
  await page.getByRole('option', { name: scenarioLabel(scenarioId) }).click();
  await page.getByTestId('demo-scenario-load').click();
  await page.getByTestId('confirm-accept').click();
  await closeDemoTools(page);
}

/** English labels for the scenario options, as rendered by `demo.scenario.*`. */
function scenarioLabel(scenarioId: ScenarioId): string {
  const labels: Record<ScenarioId, string> = {
    baseline: 'Baseline',
    main_flow_ready: 'Main flow ready',
    partial_budget: 'Partial budget',
    waitlist: 'Waitlist',
    rejection_appeal: 'Rejection and appeal',
    payout_unknown: 'Payout unknown',
    payout_failed: 'Payout failed',
    deadline_extension: 'Deadline extension',
    campaign_closure: 'Campaign closure',
    data_outage: 'Data outage',
  };
  return labels[scenarioId];
}

export async function resetDemo(page: Page): Promise<void> {
  await openDemoTools(page);
  await page.getByTestId('demo-reset').click();
  await page.getByTestId('confirm-accept').click();
  await closeDemoTools(page);
}

/** Clears the stored demo data without using the UI, for a cold-start test. */
export async function clearStoredDemo(page: Page): Promise<void> {
  await page.evaluate((key) => window.localStorage.removeItem(key), DEMO_STORAGE_KEY);
  await page.reload();
  await waitForHydration(page);
}

/** Reads the persisted state back, to assert what actually survived a refresh. */
export async function readStoredState(page: Page): Promise<DemoState | null> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), DEMO_STORAGE_KEY);
  if (!raw) return null;
  return (JSON.parse(raw) as { state: { state: DemoState } }).state.state;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * Signs in through the simulated Google entry, then reaches the requested role.
 * Merchant is a workspace switch; the two operations capabilities exist only in
 * the demo tools, which is exactly where this goes to get them.
 */
export async function signInAs(page: Page, role: DemoRole): Promise<void> {
  if (!(await isSignedIn(page))) {
    await page.goto('/sign-in');
    await waitForHydration(page);
    await dismissLocalePrompt(page);
    await page.getByTestId('sign-in-google').click();
    await expect(page.getByTestId('user-menu')).toBeVisible();
    await dismissLocalePrompt(page);
  }

  const testId = {
    creator: 'demo-role-creator',
    merchant: 'demo-role-merchant',
    ops_reviewer: 'demo-role-ops-reviewer',
    ops_finance: 'demo-role-ops-finance',
  }[role];

  await openDemoTools(page);
  await page.getByTestId(testId).click();
  await closeDemoTools(page);
}

async function isSignedIn(page: Page): Promise<boolean> {
  if (page.url() === 'about:blank') return false;
  return (await page.getByTestId('user-menu').count()) > 0;
}

export async function signOut(page: Page): Promise<void> {
  await page.getByTestId('user-menu').click();
  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('header-sign-in')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

/** Answers the first-visit prompt with Skip, which records no preference. */
export async function dismissLocalePrompt(page: Page): Promise<void> {
  const skip = page.getByTestId('locale-prompt-skip');
  if (await skip.count()) await skip.click();
}

/** Switches language through the header select, the way a visitor would. */
export async function setLocale(page: Page, locale: Locale): Promise<void> {
  await page.getByTestId('locale-select').first().click();
  await page.getByRole('option', { name: LOCALE_NAME[locale], exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}

export function localeName(locale: Locale): string {
  return LOCALE_NAME[locale];
}

// ---------------------------------------------------------------------------
// Demo tools
// ---------------------------------------------------------------------------

export async function openDemoTools(page: Page): Promise<Locator> {
  const panel = page.getByTestId('demo-toolbar');

  // A panel that is still playing its exit animation is in the DOM but about to
  // detach. Waiting it out first stops a click landing on a disappearing node.
  if ((await panel.count()) && (await panel.getAttribute('data-state')) !== 'open') {
    await expect(panel).toHaveCount(0);
  }
  if (!(await panel.count())) {
    await page.getByTestId('demo-toolbar-trigger').click();
  }
  await expect(panel).toHaveAttribute('data-state', 'open');
  await expect(panel).toBeVisible();
  return panel;
}

export async function closeDemoTools(page: Page): Promise<void> {
  const panel = page.getByTestId('demo-toolbar');
  if (!(await panel.count())) return;

  // The official Sheet close button, not Escape: a key press can be swallowed
  // while a confirmation dialog above the panel is still unmounting.
  await panel.getByRole('button', { name: 'Close' }).click();
  // Detached, not merely hidden, so the next open starts from a clean state.
  await expect(panel).toHaveCount(0);
}

/** Moves the simulated clock. The relative presets are always available. */
export async function advanceClock(page: Page, preset: ClockPreset): Promise<void> {
  const testId = {
    hour: 'demo-clock-hour',
    day: 'demo-clock-day',
    week: 'demo-clock-week',
    meteringEnd: 'demo-clock-metering-end',
    claimDeadline: 'demo-clock-claim-deadline',
  }[preset];

  await openDemoTools(page);
  const button = page.getByTestId(testId);
  await expect(button).toBeEnabled();
  await button.click();
  await closeDemoTools(page);
}

/** Adds qualified views to one submission. Only the demo tools can do this. */
export async function addViews(page: Page, submissionId: string, views: number): Promise<void> {
  await openDemoTools(page);
  await page.locator('#demo-views-submission').click();
  await page.locator(`[data-submission-id="${submissionId}"]`).click();

  if (views === 1000) {
    await page.getByTestId('demo-add-1000').click();
  } else {
    const field = page.locator('#demo-views-custom');
    await field.fill(String(views));
    await page.getByTestId('demo-add-custom').click();
  }
  await closeDemoTools(page);
}

/** Turns a submission's simulated data outage on or off. */
export async function setDataOutage(
  page: Page,
  submissionId: string,
  outage: boolean,
): Promise<void> {
  await openDemoTools(page);
  const toggle = page.locator(`#demo-outage-${submissionId}`);
  const checked = (await toggle.getAttribute('data-state')) === 'checked';
  if (checked !== outage) await toggle.click();
  await closeDemoTools(page);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * No page may scroll sideways: acceptance P10 checks 390px and 1440px and spot
 * checks 320px, where a clipped primary action is the failure being looked for.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `page scrolls sideways at ${innerWidth}px`).toBeLessThanOrEqual(innerWidth);
}

/** Screenshots live outside git; the tracked copies are committed by hand. */
export const SCREENSHOT_DIR = 'tests/e2e/__screenshots__';

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: false });
}
