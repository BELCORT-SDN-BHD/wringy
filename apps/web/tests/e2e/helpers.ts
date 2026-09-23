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
import { EVIDENCE_SHOT_MAX_BYTES, M1_EVIDENCE_DIR, evidenceShot } from './evidence';
import { LOCALE_COOKIE } from '../../src/i18n/config';
import { DEMO_STORAGE_KEY, persistedEnvelope } from '../../src/store/persistence';
import type { Command, DemoState, Locale, ScenarioId } from '../../src/domain/types';

/** The dev server Playwright talks to; the cookie needs an origin, not a path. */
const BASE_ORIGIN = `http://127.0.0.1:${process.env.WEB_PORT ?? 3100}`;

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

/**
 * A scenario state with the session already set to a role and, optionally, a
 * locale — built by replaying real commands, not by editing the state.
 *
 * The role switch through the demo tools panel (`signInAs`) opens and closes a
 * Sheet twice per switch. That is the right path for a test that is checking the
 * panel, and the wrong one for a test that needs to visit thirty pages as four
 * different roles: the panel interaction then dominates the runtime and the
 * failure modes. This builds the same session the panel would produce.
 */
export function stateAs(
  scenarioId: ScenarioId,
  role: DemoRole | 'guest',
  locale?: Locale,
): DemoState {
  let state = buildScenarioState(scenarioId);
  let step = 0;
  const apply = (command: Parameters<typeof applyCommand>[1]) => {
    const result = applyCommand(state, command, { commandId: `e2e-as-${(step += 1)}` });
    if (!result.ok) {
      throw new Error(`stateAs(${scenarioId}, ${role}): ${command.type} refused (${result.code})`);
    }
    state = result.state;
  };

  if (role === 'guest') {
    apply({ type: 'session.signOut' });
  } else if (role === 'ops_reviewer' || role === 'ops_finance') {
    const opsUser = Object.values(state.users).find((user) => user.opsCapability === role);
    if (!opsUser) throw new Error(`no seeded user has the ${role} capability`);
    apply({ type: 'session.signIn', userId: opsUser.id });
    apply({ type: 'session.setOpsRole', role });
  } else {
    apply({ type: 'session.signIn', userId: DEMO_USER_ID });
    apply({ type: 'session.setOpsRole', role: null });
    apply({ type: 'session.switchWorkspace', workspace: role });
  }

  // Answering the first-visit prompt here is what stops it covering the page the
  // caller navigated to; `explicit` is what a real chosen language records.
  if (locale) apply({ type: 'session.setLocale', locale, explicit: true });
  else apply({ type: 'session.dismissLocalePrompt' });

  return state;
}

/** The simulated Google identity that owns both workspaces. */
export const DEMO_USER_ID = 'user-demo';

/**
 * Injects a state and sets the locale cookie to match.
 *
 * The persisted session drives the client catalogue, but `<html lang>` and the
 * page metadata are server-rendered from the cookie. Writing only one of the two
 * leaves a page whose text is translated and whose `lang` is not, which is
 * exactly the bug an `html lang` assertion is meant to catch — so a helper that
 * sets one must set both.
 */
export async function injectStateWithLocale(
  page: Page,
  state: DemoState,
  locale: Locale,
  path = '/',
): Promise<void> {
  await page.context().addCookies([
    { name: LOCALE_COOKIE, value: locale, url: BASE_ORIGIN },
  ]);
  await injectState(page, state, path);
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

/**
 * A primary action is reachable: on screen, not covered, and clickable.
 *
 * `expectNoHorizontalOverflow` catches a page that is too wide, and misses the
 * failure the 320px spot check is actually for — a control that is in the layout
 * but underneath something fixed, or below the fold of a container that cannot
 * scroll. That is what broke the partial-offer consent at 320x568 and what the
 * floating demo badge did to the sidebar footer.
 *
 * Three separate checks, because each catches a different failure:
 *   - the bounding box lies inside the viewport, so nothing is clipped off-screen;
 *   - `elementFromPoint` at the centre resolves to the control or a descendant of
 *     it, so nothing fixed is sitting on top;
 *   - a trial click runs Playwright's full actionability set (visible, stable,
 *     enabled, receives pointer events) without firing the action.
 */
export async function expectPrimaryActionUsable(
  page: Page,
  action: Locator,
  what: string,
): Promise<void> {
  await expect(action, `${what}: not visible`).toBeVisible();
  await expect(action, `${what}: disabled`).toBeEnabled();
  await action.scrollIntoViewIfNeeded();

  const box = await action.boundingBox();
  expect(box, `${what}: has no box`).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport, 'the project has no viewport size').not.toBeNull();
  if (box && viewport) {
    expect(box.x, `${what}: starts left of the viewport at ${viewport.width}px`).toBeGreaterThanOrEqual(-1);
    expect(
      box.x + box.width,
      `${what}: runs past the right edge at ${viewport.width}px`,
    ).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y, `${what}: sits above the viewport`).toBeGreaterThanOrEqual(-1);
    expect(
      box.y + box.height,
      `${what}: sits below the viewport at ${viewport.height}px tall`,
    ).toBeLessThanOrEqual(viewport.height + 1);
  }

  const covered = await action.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    if (hit === null) return 'nothing is at its centre';
    if (element.contains(hit) || hit.contains(element)) return null;
    const tag = hit.tagName.toLowerCase();
    const id = hit.getAttribute('data-testid') ?? hit.className;
    return `covered by <${tag}> ${String(id).slice(0, 80)}`;
  });
  expect(covered, `${what}: ${covered}`).toBeNull();

  // Everything Playwright checks before a real click, without the click.
  await action.click({ trial: true });
}

/** Screenshots live outside git; the tracked copies are committed by hand. */
export const SCREENSHOT_DIR = 'tests/e2e/__screenshots__';

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: false });
}

/**
 * Where the acceptance record's evidence goes.
 *
 * Unlike `SCREENSHOT_DIR` this is tracked: `docs/m1-prototype/acceptance-record.md`
 * cites these paths, so a row's evidence has to exist in the repository for the
 * record to mean anything. It is written only when WRINGY_EVIDENCE_SHOTS=1
 * (`evidence.ts`); otherwise the frame goes to the gitignored
 * `tests/e2e/__screenshots__/evidence/`, so an ordinary run leaves the tree clean.
 */
export const ACCEPTANCE_SHOT_DIR = M1_EVIDENCE_DIR;

/** 300 KB per file, so the tracked evidence stays reviewable in a diff. */
export const ACCEPTANCE_SHOT_MAX_BYTES = EVIDENCE_SHOT_MAX_BYTES;

/**
 * Writes one acceptance frame and holds it to the size budget.
 *
 * Viewport-clipped, never `fullPage`: neither `sharp` nor `pngquant` resolves in
 * this workspace, so clipping is the only downscaling available, and a clipped
 * frame is also the honest evidence for "the primary action is on screen at this
 * width". The size assertion is here rather than in a review checklist because a
 * budget nothing enforces is a budget that drifts.
 */
export async function acceptanceShot(
  page: Page,
  name: string,
  viewport: string,
): Promise<string> {
  return evidenceShot(page, ACCEPTANCE_SHOT_DIR, `${name}-${viewport}.png`);
}

/**
 * The four buckets in integer sen, read off the widget the page renders.
 *
 * `data-money` is the engine's own integer, so the check is exact and survives a
 * language switch; the formatted string would not.
 */
export async function expectBuckets(
  page: Page,
  [available, reserved, confirmedUnpaid, paid]: [number, number, number, number],
): Promise<void> {
  const widget = page.locator('[data-app-widget="budget-buckets"]').first();
  await expect(widget).toBeVisible();
  const pairs: Array<[string, number]> = [
    ['available', available],
    ['reserved', reserved],
    ['confirmed_unpaid', confirmedUnpaid],
    ['paid', paid],
  ];
  for (const [bucket, sen] of pairs) {
    await expect(
      widget.locator(`[data-bucket="${bucket}"] [data-money]`),
      `the ${bucket} bucket`,
    ).toHaveAttribute('data-money', String(sen));
  }
}

/** Confirms through a `ConfirmDialog`, typing a reason when one is required. */
export async function confirmWith(page: Page, reason?: string): Promise<void> {
  const dialog = page.locator('[role="alertdialog"]');
  await expect(dialog).toBeVisible();
  if (reason !== undefined) await dialog.locator('textarea').fill(reason);
  await page.getByTestId('confirm-accept').click();
  await expect(dialog).toHaveCount(0);
}

/**
 * Waits for every toast to leave.
 *
 * The Toaster is `position="bottom-center"`, so a toast overlaps the bottom of
 * the page for as long as it is up. A layout or coverage assertion taken while
 * one is on screen measures the toast, not the page.
 */
export async function settleToasts(page: Page): Promise<void> {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 20_000 });
}

/** Answers for a payout attempt as the simulated provider would. */
export async function setProviderOutcome(
  page: Page,
  providerRef: string,
  label: 'Funds available' | 'Failed' | 'Unknown',
): Promise<void> {
  const panel = await openDemoTools(page);
  await panel
    .locator('li', { hasText: providerRef })
    .getByRole('button', { name: label, exact: true })
    .click();
  await closeDemoTools(page);
}

/** Opens a workspace page after a state is already loaded and signed in. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForHydration(page);
  await dismissLocalePrompt(page);
}

/**
 * Applies engine commands to build a state no single role could reach alone.
 *
 * Every step must succeed: a precondition that needs a rule bent is not a demo
 * state, so the builder throws instead of asserting against it.
 */
export function replay(state: DemoState, commands: Command[], tag: string): DemoState {
  return commands.reduce((current, command, index) => {
    const result = applyCommand(current, command, { commandId: `e2e:${tag}:${index}` });
    if (!result.ok) {
      throw new Error(
        `${tag} step ${index} (${command.type}): ${result.code}${
          result.detail ? ` (${result.detail})` : ''
        }`,
      );
    }
    return result.state;
  }, state);
}

