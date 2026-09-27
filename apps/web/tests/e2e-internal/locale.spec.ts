/**
 * M2-AC04: the language preference of the internal build, end to end
 * (docs/m2-internal/m2-04-code-review.md R13 rev 2, R3–R8, R10; localization-v1;
 * project `locale`).
 *
 * ── WHY EVERY TITLE HERE SAYS "simulated" ──────────────────────────────────
 * Fiona, Gopal, Dave and Mallory sign in through the simulated provider
 * (tests/e2e-internal/fake-auth/), for the reasons auth.spec.ts gives. The
 * identity half of every row is therefore labelled `simulated`. Everything else
 * is real: the two `next start` instances, the `POST /internal/locale` Route
 * Handler, the Fastify API's `POST /me/locale` as `wringy_api_login`, and the
 * `app.profiles` row in PostgreSQL 17 migrated from zero. The one mocked answer
 * in this file is the refused-storage row's, and its title says so.
 *
 * ── HOW IT RUNS ────────────────────────────────────────────────────────────
 * The `locale` project runs this file in order in one worker, beside `auth` and
 * `orgs`. Fiona's and Gopal's account language is shared by construction (one
 * fixed uuid each), so every row first ARRANGES the preference it starts from,
 * as the migrator (`setAccountPreference`), and never relies on the row before
 * it. Rows that make organisations name them after the test's tag, take every
 * id from a URL and read audit rows by `context_org_id`.
 *
 * It is the one project whose contexts meet the language prompt unanswered
 * (fixtures.ts `answerLocalePrompt`); a person who is not the row's subject (Dave,
 * who only invites) gets the prompt answered here, as the fixtures would.
 *
 * What the rows are, in R13's order:
 * - M2-AC04/1: the browser's suggestion and the prompt (preview, Skip); a saved
 *   preference asked about never again; a shared device; a leftover choice never
 *   carried; a choice on a page that renders signed out, over the session cookie
 *   somebody else left behind (live, revoked, and on the not-found page);
 * - M2-AC04/2: the six-run walk (choose → save → new device → failure → retry),
 *   a transport failure, refused storage, a sign-in's choice over the account
 *   value with Undo, the same choice kept through a cancelled sign-in, the
 *   invitee, the idle tab, guest persistence, two quick choices;
 * - M2-AC04/3: the three languages at 1440 and 390 (the evidence frames; the
 *   card in place and without JavaScript; a language outcome consumed by the
 *   next switch), the keyboard on the header switcher, the typed input and the
 *   request key surviving a switch from the header and from the card, the
 *   instants;
 * - then the sign-in page's caching (M2-AC04/1) and the cross-user cache (/2).
 *
 * Every header switch picks a language and presses Apply: choosing alone
 * switches nothing (a11y-i18n-1). Every control whose success removes it (the
 * prompt's Continue and Skip, Retry, Undo) leaves focus on the header switcher.
 *
 * R13's "/1 API stalled" row is NOT here, by the record's own words: the
 * simulated server cannot stall, and the outage instance's closed port answers
 * at once, so the 1.5 s bound is proven by the unit test of the reader and the
 * `read.ts` integration row the web lane owns.
 */
import { request as apiRequest, type BrowserContext, type Locator, type Page } from '@playwright/test';

import {
  FAKE_USERS,
  HEALTHY_WEB_ORIGIN,
  LOCALE_COOKIES,
  OUTAGE_WEB_ORIGIN,
  SESSION_COOKIE_PREFIX,
  SIGN_IN_ROOT,
  TESTIDS,
  WEB_ROUTES,
  cancelSignIn,
  expect,
  onlySessionOf,
  sessionCookieNames,
  signInAs,
  startCachingProxy,
  storableInSharedCache,
  test,
  type Device,
  type FakeUserName,
} from './fixtures';
import {
  COPY,
  LOCALES,
  commonCopy,
  expectBodyLocale,
  expectNoHorizontalScroll,
  internalCopy,
  internalShot,
  laterThan,
  localeCookies,
  localeName,
  readAccountPreference,
  setAccountPreference,
  setLocaleCookie,
  sql,
  watchConsole,
  type Locale,
  type LocaleSource,
} from './support';

const FIONA = FAKE_USERS.fiona;
const GOPAL = FAKE_USERS.gopal;

/** The language Route Handler every control posts to (R4). */
const LOCALE_PATH = '/internal/locale';
/** The Workspaces section's create form (src/app/(internal)/internal/org-paths.ts). */
const CREATE_ORG_PATH = '/internal/orgs/create';
/** The accept page an invitation link opens. */
const ACCEPT_PATH = '/internal/invitations/accept';

const orgPagePath = (orgId: string): string => `/internal/orgs/${orgId}`;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** What `newRequestKey()` mints, on either of its branches (R8). */
const REQUEST_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * A real browser language tag that suggests each locale (R3 step 4), as a
 * context's `locale` option sends it: `en*` → en-MY, `ms*` → ms-MY, `zh-CN` →
 * zh-Hans-MY. Real tags rather than the product's own codes, because Chromium
 * takes the option as an ICU locale too.
 */
const BROWSER_TAG: Record<Locale, string> = { 'en-MY': 'en-MY', 'ms-MY': 'ms-MY', 'zh-Hans-MY': 'zh-CN' };

/** The two locales that are not `locale`, in LOCALES order. */
const othersOf = (locale: Locale): [Locale, Locale] => {
  const [first, second] = LOCALES.filter((candidate) => candidate !== locale);
  if (first === undefined || second === undefined) throw new Error(`LOCALES must hold three codes besides ${locale}`);
  return [first, second];
};

/** The two viewports R13 re-runs its walk and its three-language rows at. */
const viewportOf = (width: 1440 | 390): { width: number; height: number } =>
  width === 1440 ? { width: 1440, height: 900 } : { width: 390, height: 844 };

/** A suffix unique to this test and attempt: the tail of the fixture's tag, which ends in a uuid. */
const uniqueSuffix = (tag: string): string => tag.slice(-12);

// --- the surface under test (docs: common test-id table; R5, R10) -------------

/** The header switcher's select. */
const switcher = (page: Page): Locator => page.getByTestId('locale-switcher');
/** The polite live region beside the header control, with `data-result`. */
const live = (page: Page): Locator => page.locator('[data-testid="locale-live"][role="status"][aria-live="polite"]');
/** The first-visit prompt, inline above the page content. */
const prompt = (page: Page): Locator => page.locator('[data-testid="internal-locale-prompt"][role="region"]');
const promptSelect = (page: Page): Locator => page.getByTestId('internal-locale-prompt-select');
/** The layout-level notice of a choice the account does not hold yet. */
const unsavedNotice = (page: Page): Locator => page.getByTestId('locale-status-unsaved');
/** The layout-level notice after a sign-in carried a choice into the account. */
const syncedNotice = (page: Page): Locator => page.getByTestId('locale-status-synced');
/** The Language card on `/internal`. */
const card = (page: Page): Locator => page.locator('section[data-internal-section="locale"]');

/** The header switcher's Apply button, visible with JavaScript too. */
const apply = (page: Page): Locator => page.getByTestId('locale-switcher-apply');

/** Picks `locale` in the header switcher and presses Apply: picking alone switches nothing (a11y-i18n-1). */
async function switchInHeader(page: Page, locale: Locale): Promise<void> {
  await switcher(page).selectOption(locale);
  await apply(page).click();
}

/**
 * Saves the Language card the way a browser without JavaScript does:
 * `form.submit()` fires no submit event, so no script sees it and the browser
 * posts the plain form and follows the handler's 303, as it does before hydration.
 */
async function submitCardWithoutScript(page: Page): Promise<void> {
  await page.getByTestId('locale-card-form').evaluate((form) => (form as HTMLFormElement).submit());
}

/** A notice sits in its own landmark: a region named `internal.locale.status.regionLabel` (a11y-i18n-9). */
async function expectInNamedRegion(notice: Locator, locale: Locale): Promise<void> {
  const region = notice.locator('xpath=ancestor::section[1]');
  await expect(region).toHaveRole('region');
  await expect(region).toHaveAccessibleName(internalCopy(locale, 'locale.status.regionLabel'));
}

/** No organisation or language outcome alert is shown, and the URL carries none of the language's. */
async function expectNoLocaleOutcome(page: Page, why: string): Promise<void> {
  await expect(page.getByTestId('org-outcome'), why).toHaveCount(0);
  const url = new URL(page.url());
  expect(url.searchParams.get('outcome'), why).toBeNull();
  expect(url.searchParams.get('from'), why).toBeNull();
}

/** The live region's answer, by `data-result` and by its sentence in the language the page ended in. */
async function expectLive(page: Page, result: string, sentence: string): Promise<void> {
  await expect(live(page)).toHaveAttribute('data-result', result);
  await expect(live(page)).toContainText(sentence);
}

/** Chooses `locale` in the prompt and presses Continue: an explicit choice, then the page in it. */
async function chooseInPrompt(page: Page, locale: Locale, source: LocaleSource): Promise<void> {
  await promptSelect(page).selectOption(locale);
  await page.getByTestId('internal-locale-prompt-continue').click();
  await expect(prompt(page)).toHaveCount(0);
  await expectBodyLocale(page, locale, source);
}

/** Each of the three options is the language's own name, marked with its own `lang` (R5: no flags, never "Indonesian"). */
async function expectLanguageOptions(select: Locator): Promise<void> {
  await expect(select.locator('option')).toHaveCount(LOCALES.length);
  for (const code of LOCALES) {
    const option = select.locator(`option[value="${code}"]`);
    await expect(option).toHaveText(localeName(code));
    await expect(option).toHaveAttribute('lang', code);
  }
}

/** Every POST `page` sends from now on, by pathname. */
function watchPosts(page: Page): string[] {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(new URL(request.url()).pathname);
  });
  return posts;
}

/**
 * Marks the prompt answered for a context whose person is not the row's subject,
 * exactly as the fixtures do for every other project (httpOnly, SameSite=Lax, the
 * healthy origin): Dave only invites, and the prompt is not what his half proves.
 */
async function promptAlreadyAnswered(context: BrowserContext): Promise<void> {
  await context.addCookies([{ name: LOCALE_COOKIES.prompt, value: '1', url: HEALTHY_WEB_ORIGIN, httpOnly: true, sameSite: 'Lax' }]);
}

/** Signs `name` in from `start` and returns the URL landed on, which may carry `outcome` and `from`. */
async function signInFrom(page: Page, name: FakeUserName, start = `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}`): Promise<URL> {
  return new URL(await signInAs(page, name, { start }));
}

/** The org outcome alert (`OutcomeAlert`) says `outcome`, in `locale` (R12). */
async function expectOrgOutcome(page: Page, outcome: string, locale: Locale): Promise<void> {
  const alert = page.getByTestId('org-outcome');
  await expect(alert).toHaveAttribute('data-outcome', outcome);
  await expect(alert).toContainText(internalCopy(locale, `outcomes.${outcome}`));
}

/** Waits for `/internal?outcome=<outcome>`, which a form post to the language handler answers (R4). */
async function landOnInternalWith(page: Page, outcome: string): Promise<void> {
  await page.waitForURL((url) => url.pathname === WEB_ROUTES.internal && url.searchParams.get('outcome') === outcome);
}

/** The database's own clock, so an audit filter never depends on the test machine's. */
async function databaseNow(): Promise<Date> {
  const rows = await sql<{ now: Date }>('migrator', 'SELECT now() AS now');
  const now = rows[0]?.now;
  if (now === undefined) throw new Error('the database did not answer SELECT now()');
  return now;
}

/** The org page a create landed on; its id comes from the URL. */
async function landOnCreatedOrg(page: Page, name: string, locale: Locale): Promise<string> {
  const pattern = new RegExp(`^/internal/orgs/(${UUID})$`);
  await page.waitForURL((url) => pattern.test(url.pathname) && url.searchParams.get('outcome') === 'created');
  const orgId = pattern.exec(new URL(page.url()).pathname)?.[1] ?? '';
  await expectOrgOutcome(page, 'created', locale);
  await expect(page.getByTestId('org-name')).toHaveText(name);
  return orgId;
}

/** Creates an org from the Workspaces section on `/internal`. */
async function createOrg(page: Page, name: string, locale: Locale): Promise<string> {
  await page.goto(WEB_ROUTES.internal);
  await page.getByTestId('create-org-name').fill(name);
  await page.getByTestId('create-org-submit').click();
  return landOnCreatedOrg(page, name, locale);
}

interface Invitation {
  /** The link the admin hands over. It carries the token: compared, never printed. */
  acceptUrl: string;
  token: string;
}

/** Invites `email` as a member through the org page's form and reads the link the invitation page shows. */
async function invite(page: Page, orgId: string, email: string): Promise<Invitation> {
  await page.goto(orgPagePath(orgId));
  // The invite form carries a request key minted after mount (R8).
  await expect(page.locator('form[data-testid="invite-form"] input[type="hidden"][name="requestKey"][data-testid="request-key"]')).toHaveValue(
    REQUEST_KEY,
  );
  await page.getByTestId('invite-email').fill(email);
  await page.getByTestId('invite-role').selectOption('member');
  await page.getByTestId('invite-submit').click();
  const pattern = new RegExp(`^/internal/orgs/${orgId}/invitations/(${UUID})$`);
  await page.waitForURL((url) => pattern.test(url.pathname) && url.searchParams.get('outcome') === 'invited');
  const acceptUrl = await page.getByTestId('invitation-accept-link').inputValue();
  const token = new URL(acceptUrl).searchParams.get('token') ?? '';
  expect(/^[A-Za-z0-9_-]{43}$/.test(token), 'the link carries a 43-character token').toBe(true);
  return { acceptUrl, token };
}

/** The member row of `userId` on an org page. */
const memberRow = (page: Page, userId: string): Locator =>
  page.getByTestId('org-members-table').locator(`[data-member-id="${userId}"]`);

/** The seeded campaigns' status badges on `/internal`: code, tone and words. */
async function campaignBadges(page: Page): Promise<{ id: string; code: string; tone: string; label: string }[]> {
  return page.locator('[data-internal-section="campaigns"] tr[data-campaign-id]').evaluateAll((rows) =>
    rows.map((row) => {
      const badge = row.querySelector('[data-state-kind="campaign-status"]');
      return {
        id: row.getAttribute('data-campaign-id') ?? '',
        code: badge?.getAttribute('data-state-code') ?? '',
        tone: badge?.getAttribute('data-state-tone') ?? '',
        label: (badge?.textContent ?? '').trim(),
      };
    }),
  );
}

/** The badge words the page must use for a campaign status in `locale` (support.ts `COPY`). */
const statusLabel = (locale: Locale, code: string): string => {
  if (code !== 'published' && code !== 'draft') throw new Error(`no seeded campaign has status "${code}"`);
  return COPY[locale][code];
};

/** The document never scrolls sideways at 320 px; the viewport is restored afterwards. */
async function expectNoHorizontalScrollAt320(page: Page): Promise<void> {
  const size = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 568 });
  try {
    await expectNoHorizontalScroll(page);
  } finally {
    if (size !== null) await page.setViewportSize(size);
  }
}

/** The header row and its switcher, named and filled in `locale` (R5, R10). */
async function expectHeader(page: Page, locale: Locale): Promise<void> {
  await expect(page.getByTestId('internal-header')).toBeVisible();
  // The banner stays the text-only note it was.
  await expect(page.locator('[role="note"][data-app-banner="internal-build"]')).toBeVisible();
  await expect(page.locator('form[data-testid="locale-switcher-form"]')).toHaveCount(1);
  await expect(switcher(page)).toHaveAccessibleName(commonCopy(locale, 'shell.languageLabel'));
  await expect(switcher(page)).toHaveValue(locale);
  await expectLanguageOptions(switcher(page));
  // Apply stays once hydrated: it, not a change of the select, is the switch (a11y-i18n-1).
  await expect(apply(page)).toBeVisible();
  await expect(apply(page)).toHaveText(internalCopy(locale, 'locale.apply'));
}

/** The prompt, in `locale`: its region named by its title, its select by its label (R5, R10). */
async function expectPrompt(page: Page, locale: Locale): Promise<void> {
  const region = prompt(page);
  await expect(region).toBeVisible();
  await expect(region).toHaveAttribute('lang', locale);
  await expect(region).toHaveAccessibleName(commonCopy(locale, 'localePrompt.title'));
  // The internal build's own description: it points at the header's Language menu, not a Settings page (a11y-i18n-8).
  await expect(region).toContainText(internalCopy(locale, 'locale.prompt.description'));
  await expect(region).not.toContainText(commonCopy(locale, 'localePrompt.description'));
  // True of this build: the Malay and Chinese copy is an unreviewed draft.
  await expect(region).toContainText(commonCopy(locale, 'localePrompt.draftNote'));
  await expect(promptSelect(page)).toHaveAccessibleName(internalCopy(locale, 'locale.prompt.selectLabel'));
  await expect(promptSelect(page)).toHaveValue(locale);
  await expectLanguageOptions(promptSelect(page));
  await expect(page.getByTestId('internal-locale-prompt-continue')).toHaveText(commonCopy(locale, 'localePrompt.continue'));
  await expect(page.getByTestId('internal-locale-prompt-skip')).toHaveText(commonCopy(locale, 'localePrompt.skip'));
}

/** The Language card on `/internal`, in `locale`, for an account whose preference is `locale` (R5, R7). */
async function expectCard(page: Page, locale: Locale, userId: string): Promise<void> {
  const section = card(page);
  await expect(section).toBeVisible();
  await expect(section).toContainText(internalCopy(locale, 'locale.card.title'));
  await expect(section).toContainText(internalCopy(locale, 'locale.card.description'));
  const state = page.getByTestId('locale-card-state');
  await expect(state).toHaveAttribute('data-account-preference', locale);
  await expect(state).toContainText(internalCopy(locale, 'locale.card.savedAs').replace('{name}', localeName(locale)));
  // The saved instant is the API's own, in Malaysia time with the offset written out.
  const saved = await readAccountPreference(userId);
  const time = page.getByTestId('locale-card-set-at').locator('time');
  await expect(time).toHaveAttribute('datetime', saved?.setAtIso ?? 'the preference has no instant');
  await expect(time).toContainText('(UTC+08:00)');
  const select = page.getByTestId('locale-card-select');
  await expect(select).toHaveAccessibleName(internalCopy(locale, 'locale.card.fieldLabel'));
  await expect(select).toHaveValue(locale);
  await expectLanguageOptions(select);
  await expect(page.getByTestId('locale-card-save')).toHaveText(internalCopy(locale, 'locale.card.save'));
}

// --- M2-AC04/1: the suggestion, the prompt, a saved preference, a shared device --

test.describe('M2-AC04 the language preference: suggestion, prompt and the shared device', () => {
  test('M2-AC04/1 simulated suggestion, prompt, preview, skip: a Malay browser is offered Malay, a preview posts nothing, and Skip saves no preference, signed out or in', async ({
    openDevice,
  }) => {
    test.setTimeout(120_000);
    const problems: string[][] = [];

    // A Malay browser, signed out: the page is Malay by suggestion and the prompt asks in Malay.
    const malay = await openDevice('malay', { locale: 'ms-MY' });
    problems.push(watchConsole(malay.page));
    const posts = watchPosts(malay.page);
    await malay.page.goto(WEB_ROUTES.signInPage);
    await expectBodyLocale(malay.page, 'ms-MY', 'browser');
    // No token, so nothing is known about an account (R3).
    await expect(malay.page.locator('body')).toHaveAttribute('data-account-preference', 'unknown');
    await expectPrompt(malay.page, 'ms-MY');

    // A preview: the prompt speaks Chinese; nothing is posted, nothing is stored, the page stays Malay.
    await promptSelect(malay.page).selectOption('zh-Hans-MY');
    await expect(prompt(malay.page)).toHaveAttribute('lang', 'zh-Hans-MY');
    await expect(prompt(malay.page)).toContainText(commonCopy('zh-Hans-MY', 'localePrompt.title'));
    await expect(malay.page.getByTestId('internal-locale-prompt-continue')).toHaveText(commonCopy('zh-Hans-MY', 'localePrompt.continue'));
    await expectBodyLocale(malay.page, 'ms-MY', 'browser');
    await expect(malay.page.locator(SIGN_IN_ROOT)).toContainText(internalCopy('ms-MY', 'signIn.title'));
    expect(posts, 'a preview sends nothing').toEqual([]);
    expect(await localeCookies(malay.context), 'a preview stores nothing').toEqual({});

    // Skip: the prompt goes, and no preference is recorded in any scope.
    await malay.page.getByTestId('internal-locale-prompt-skip').click();
    await expect(prompt(malay.page)).toHaveCount(0);
    await expectBodyLocale(malay.page, 'ms-MY', 'browser');
    await expect(switcher(malay.page), 'focus left the prompt for the header before the prompt went').toBeFocused();
    expect(posts, 'Skip is one request to the language handler').toEqual([LOCALE_PATH]);
    const skipped = await localeCookies(malay.context);
    expect(skipped[LOCALE_COOKIES.guest], 'Skip saves no guest preference').toBeUndefined();
    expect(skipped[LOCALE_COOKIES.session], 'Skip saves no session choice').toBeUndefined();
    expect(skipped[LOCALE_COOKIES.carry], 'Skip carries nothing into a sign-in').toBeUndefined();
    expect(skipped[LOCALE_COOKIES.prompt], 'Skip answers the prompt for this browsing session').toBe('1');

    await malay.page.reload();
    await expectBodyLocale(malay.page, 'ms-MY', 'browser');
    await expect(prompt(malay.page)).toHaveCount(0);

    // A fresh browser has answered nothing, so it is asked again.
    const fresh = await openDevice('fresh', { locale: 'ms-MY' });
    problems.push(watchConsole(fresh.page));
    await fresh.page.goto(WEB_ROUTES.signInPage);
    await expectPrompt(fresh.page, 'ms-MY');

    // A Traditional-Chinese browser matches nothing: English, and the prompt offers 简体中文 by its own name.
    const taiwan = await openDevice('taiwan', { locale: 'zh-TW' });
    problems.push(watchConsole(taiwan.page));
    await taiwan.page.goto(WEB_ROUTES.signInPage);
    await expectBodyLocale(taiwan.page, 'en-MY', 'default');
    await expectPrompt(taiwan.page, 'en-MY');
    await expect(promptSelect(taiwan.page).locator('option[value="zh-Hans-MY"]')).toHaveText(localeName('zh-Hans-MY'));

    // Signed in with no account preference: asked, and a Skip leaves the account without one.
    await setAccountPreference(FIONA, null);
    const signedIn = await openDevice('signed-in', { locale: 'ms-MY' });
    problems.push(watchConsole(signedIn.page));
    const landed = await signInFrom(signedIn.page, 'fiona');
    expect(landed.pathname).toBe(WEB_ROUTES.internal);
    await expectBodyLocale(signedIn.page, 'ms-MY', 'browser');
    await expect(signedIn.page.locator('body')).toHaveAttribute('data-account-preference', 'none');
    await expectPrompt(signedIn.page, 'ms-MY');
    await signedIn.page.getByTestId('internal-locale-prompt-skip').click();
    await expect(prompt(signedIn.page)).toHaveCount(0);
    await expectBodyLocale(signedIn.page, 'ms-MY', 'browser');
    expect(await readAccountPreference(FIONA.id), 'a signed-in Skip leaves locale_pref NULL').toEqual({
      localePref: null,
      setAtMicros: null,
      setAtIso: null,
    });
    const afterSignedInSkip = await localeCookies(signedIn.context);
    expect(afterSignedInSkip[LOCALE_COOKIES.guest]).toBeUndefined();
    expect(afterSignedInSkip[LOCALE_COOKIES.session]).toBeUndefined();

    expect(problems.flat()).toEqual([]);
  });

  test('M2-AC04/1 simulated saved preference, no prompt: Fiona, whose account holds Malay, signs in on a browser with no language cookie and is shown Malay without being asked', async ({
    tagged,
  }) => {
    await setAccountPreference(FIONA, 'ms-MY');
    const before = await readAccountPreference(FIONA.id);
    const { page, context } = tagged;
    const problems = watchConsole(page);
    expect(await localeCookies(context), 'the browser holds no language of its own').toEqual({});

    const landed = await signInFrom(page, 'fiona');
    expect(landed.pathname).toBe(WEB_ROUTES.internal);
    await expectBodyLocale(page, 'ms-MY', 'account');
    await expect(page.locator('body')).toHaveAttribute('data-account-preference', 'ms-MY');
    await expect(prompt(page), 'a person with a saved preference is not asked again').toHaveCount(0);
    await expect(syncedNotice(page)).toHaveCount(0);
    expect(await localeCookies(context), 'the language came from the account alone').toEqual({});
    expect(await readAccountPreference(FIONA.id), 'signing in rewrote nothing').toEqual(before);

    expect(problems).toEqual([]);
  });

  test("M2-AC04/1 simulated shared device: a Chinese guest cookie left on the device changes neither Fiona's page nor her saved Malay, and the guest gets Chinese back after she signs out", async ({
    tagged,
  }) => {
    await setAccountPreference(FIONA, 'ms-MY');
    const before = await readAccountPreference(FIONA.id);
    const { page, context } = tagged;
    const problems = watchConsole(page);
    await setLocaleCookie(page, 'zh-Hans-MY', HEALTHY_WEB_ORIGIN);

    await page.goto(WEB_ROUTES.signInPage);
    await expectBodyLocale(page, 'zh-Hans-MY', 'guest');
    await expect(prompt(page), 'a saved guest preference is not asked about').toHaveCount(0);

    await signInFrom(page, 'fiona');
    await expectBodyLocale(page, 'ms-MY', 'account');
    await expect(syncedNotice(page)).toHaveCount(0);
    expect(await readAccountPreference(FIONA.id), "the guest's choice was not written to her account").toEqual(before);
    expect((await localeCookies(context))[LOCALE_COOKIES.guest], "the guest's choice is still the guest's").toBe('zh-Hans-MY');

    await page.getByTestId(TESTIDS.signOut).click();
    await page.waitForURL((url) => url.pathname === WEB_ROUTES.signInPage);
    await expectBodyLocale(page, 'zh-Hans-MY', 'guest');
    expect(await readAccountPreference(FIONA.id)).toEqual(before);

    expect(problems).toEqual([]);
  });

  test('M2-AC04/1 simulated leftover choice: a choice made on the sign-in page reaches no account once its ten minutes are over, nor through a sign-in that was refused', async ({
    openDevice,
  }) => {
    test.setTimeout(120_000);
    await setAccountPreference(GOPAL, 'ms-MY');
    const before = await readAccountPreference(GOPAL.id);

    // Somebody chose Chinese on the sign-in page and walked away; the ten minutes run out.
    const lapsed = await openDevice('lapsed');
    const lapsedProblems = watchConsole(lapsed.page);
    await lapsed.page.goto(WEB_ROUTES.signInPage);
    await switchInHeader(lapsed.page, 'zh-Hans-MY');
    await expectBodyLocale(lapsed.page, 'zh-Hans-MY', 'guest');
    await expectLive(lapsed.page, 'saved-guest', internalCopy('zh-Hans-MY', 'locale.live.savedGuest'));
    expect((await localeCookies(lapsed.context))[LOCALE_COOKIES.carry]).toBe('zh-Hans-MY');
    // Stands in for the ten-minute lifetime of the carry cookie (R4, R6).
    await lapsed.context.clearCookies({ name: LOCALE_COOKIES.carry });

    const lapsedLanding = await signInFrom(lapsed.page, 'gopal');
    expect(lapsedLanding.pathname).toBe(WEB_ROUTES.internal);
    expect(lapsedLanding.searchParams.get('outcome'), 'nothing was carried, so nothing is announced').toBeNull();
    await expectBodyLocale(lapsed.page, 'ms-MY', 'account');
    await expect(syncedNotice(lapsed.page)).toHaveCount(0);
    expect(await readAccountPreference(GOPAL.id), 'a stale choice never reaches the account').toEqual(before);

    // Somebody chose Chinese and the sign-in that followed was refused; then Gopal signs in.
    const refused = await openDevice('refused');
    const refusedProblems = watchConsole(refused.page);
    await refused.page.goto(WEB_ROUTES.signInPage);
    await switchInHeader(refused.page, 'zh-Hans-MY');
    await expectBodyLocale(refused.page, 'zh-Hans-MY', 'guest');
    expect((await localeCookies(refused.context))[LOCALE_COOKIES.carry]).toBe('zh-Hans-MY');

    const refusal = await signInFrom(refused.page, 'mallory');
    expect(refusal.pathname).toBe(WEB_ROUTES.signInPage);
    expect(refusal.searchParams.get('outcome')).toBe('not_allowed');
    expect((await localeCookies(refused.context))[LOCALE_COOKIES.carry], 'a refusal that names the person spends the carry').toBeUndefined();

    await signInFrom(refused.page, 'gopal');
    await expectBodyLocale(refused.page, 'ms-MY', 'account');
    await expect(syncedNotice(refused.page)).toHaveCount(0);
    expect(await readAccountPreference(GOPAL.id), 'nothing was written').toEqual(before);

    expect([...lapsedProblems, ...refusedProblems]).toEqual([]);
  });

  /**
   * security-privacy-1: the sign-in page and the not-found page render signed out
   * whatever cookies the browser holds, so a choice made on them is the guest's
   * (the handler's "the page that posted decides"), even over a session cookie
   * somebody else left behind. Gopal signs in and walks away; Fiona, at the same
   * browser, chooses on the sign-in page and then signs in herself.
   *
   * "No `POST /me/locale` reached the API with Gopal's session" is observed at the
   * simulated auth server: every command the API runs asks it about the caller's
   * session (`GET /auth/v1/user`, `SESSION_LIVENESS=auth_server`), and it counts
   * that call against the tag of the context that created the session, revoked or
   * not, while `GET /me` and the page reads never ask. So the tag's `user` count
   * holding still is the API's own evidence that no command ran with his token.
   * The row alone could not say it for the revoked run: the API refuses a revoked
   * session and writes nothing either way.
   */
  for (const leftover of ['live', 'revoked'] as const) {
    test(`M2-AC04/1 simulated shared device, a ${leftover} session left behind: Fiona chooses Chinese on the sign-in page over Gopal's session cookie; nothing reaches his account, the choice is the guest's, and her own sign-in carries it into her account alone`, async ({
      tagged,
    }) => {
      test.setTimeout(90_000);
      await setAccountPreference(GOPAL, 'ms-MY');
      await setAccountPreference(FIONA, 'en-MY');
      const { page, context, tag, control } = tagged;
      const problems = watchConsole(page);

      // Gopal signs in on this browser and walks away; his session cookie stays in the jar.
      await signInFrom(page, 'gopal');
      await expectBodyLocale(page, 'ms-MY', 'account');
      const gopalSession = await onlySessionOf(tag);
      if (leftover === 'revoked') await control.revokeSession(gopalSession);
      expect((await control.liveSessions()).includes(gopalSession), `Gopal's session is ${leftover}`).toBe(leftover === 'live');
      const gopalBefore = await readAccountPreference(GOPAL.id);
      const commandsBefore = (await control.calls(tag)).calls.user;

      // The sign-in page renders signed out: the browser's language, no account known.
      await page.goto(WEB_ROUTES.signInPage);
      expect(await sessionCookieNames(context), "Gopal's session cookie is still in the jar").not.toEqual([]);
      await expectBodyLocale(page, 'en-MY', 'browser');
      await expect(page.locator('body')).toHaveAttribute('data-account-preference', 'unknown');
      // Nobody answered the prompt in this browser, yet it does not ask: whoever holds the session may have
      // a saved preference the page could not read (spec-7). The header still switches, below.
      expect((await localeCookies(context))[LOCALE_COOKIES.prompt], 'the prompt was never answered here').toBeUndefined();
      await expect(prompt(page), 'a session nobody verified is an account nobody read: not asked').toHaveCount(0);

      // Fiona chooses Chinese: the guest's choice, carried for the sign-in that starts now.
      await switchInHeader(page, 'zh-Hans-MY');
      await expectBodyLocale(page, 'zh-Hans-MY', 'guest');
      await expectLive(page, 'saved-guest', internalCopy('zh-Hans-MY', 'locale.live.savedGuest'));
      const chosen = await localeCookies(context);
      expect(chosen[LOCALE_COOKIES.guest], 'the choice is the guest cookie').toBe('zh-Hans-MY');
      expect(chosen[LOCALE_COOKIES.carry], 'the choice is carried into the sign-in that follows').toBe('zh-Hans-MY');
      expect(chosen[LOCALE_COOKIES.session], "nothing is kept as an unsaved choice of Gopal's account").toBeUndefined();
      expect((await control.calls(tag)).calls.user, "no command reached the API with Gopal's session").toBe(commandsBefore);
      expect(await readAccountPreference(GOPAL.id), "Gopal's row is unchanged").toEqual(gopalBefore);

      // Fiona signs in from this page: her sign-in carries the choice into her account, and only hers.
      const landed = await signInFrom(page, 'fiona', `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.signInPage}`);
      expect(landed.pathname).toBe(WEB_ROUTES.internal);
      expect(landed.searchParams.get('outcome')).toBe('locale_synced');
      expect(landed.searchParams.get('from')).toBe('en-MY');
      await expect(page.getByTestId(TESTIDS.signedInAs)).toContainText(FIONA.email);
      await expectBodyLocale(page, 'zh-Hans-MY', 'account');
      await expect(syncedNotice(page)).toHaveAttribute('data-from', 'en-MY');
      await expect.poll(async () => (await readAccountPreference(FIONA.id))?.localePref).toBe('zh-Hans-MY');
      expect(await readAccountPreference(GOPAL.id), "Gopal's row is still unchanged").toEqual(gopalBefore);
      expect((await localeCookies(context))[LOCALE_COOKIES.carry], 'the carry is spent').toBeUndefined();

      expect(problems).toEqual([]);
    });
  }

  test("M2-AC04/1 simulated shared device on the not-found page: a choice on a path the proxy rewrites to not-found, over Gopal's live session cookie, is the guest's and reaches no account", async ({
    tagged,
  }) => {
    await setAccountPreference(GOPAL, 'ms-MY');
    const { page, context, tag, control } = tagged;
    const problems = watchConsole(page);

    await signInFrom(page, 'gopal');
    await expectBodyLocale(page, 'ms-MY', 'account');
    const gopalBefore = await readAccountPreference(GOPAL.id);
    const commandsBefore = (await control.calls(tag)).calls.user;

    // A path outside /internal: the proxy rewrites it to the not-found page, which renders signed out.
    const response = await page.goto('/campaigns');
    expect(response?.status()).toBe(404);
    await expect(page.locator('[data-app-state="not-found"]')).toBeVisible();
    expect(await sessionCookieNames(context), "Gopal's session cookie is still in the jar").not.toEqual([]);
    await expectBodyLocale(page, 'en-MY', 'browser');
    await expect(page.locator('body')).toHaveAttribute('data-account-preference', 'unknown');
    // Gopal's Malay is saved, and the page cannot read it: he is not asked again (spec-7).
    expect((await localeCookies(context))[LOCALE_COOKIES.prompt], 'the prompt was never answered here').toBeUndefined();
    await expect(prompt(page), 'a session nobody verified is an account nobody read: not asked').toHaveCount(0);

    await switchInHeader(page, 'zh-Hans-MY');
    await expectBodyLocale(page, 'zh-Hans-MY', 'guest');
    await expectLive(page, 'saved-guest', internalCopy('zh-Hans-MY', 'locale.live.savedGuest'));
    expect(new URL(page.url()).pathname, 'the switch stays on the page it was made on').toBe('/campaigns');
    const chosen = await localeCookies(context);
    expect(chosen[LOCALE_COOKIES.guest]).toBe('zh-Hans-MY');
    expect(chosen[LOCALE_COOKIES.carry]).toBe('zh-Hans-MY');
    expect(chosen[LOCALE_COOKIES.session]).toBeUndefined();
    expect((await control.calls(tag)).calls.user, "no command reached the API with Gopal's session").toBe(commandsBefore);
    expect(await readAccountPreference(GOPAL.id), "Gopal's row is unchanged").toEqual(gopalBefore);

    // The not-found page answers 404 by design (M2-02 R12), and Chromium logs any 4xx document as a console error.
    const ownStatus = `${HEALTHY_WEB_ORIGIN}/campaigns: Failed to load resource: the server responded with a status of 404 (Not Found)`;
    expect(problems.filter((problem) => problem !== ownStatus)).toEqual([]);
  });
});

// --- M2-AC04/2: the walk, six times ------------------------------------------------

/**
 * The walk of R13 in each language at 1440 and 390. Fiona's account first holds
 * another language, so the header switch on device 1 is a real change and the
 * account visibly outranks that browser's own suggestion; device 2 is a new
 * browser with no cookies and no language of its own. `openDevice` takes the
 * describe's viewport, so both devices are the same size.
 */
for (const locale of LOCALES) {
  for (const width of [1440, 390] as const) {
    test.describe(`M2-AC04 the walk in ${locale} at ${width}px`, () => {
      test.use({ viewport: viewportOf(width) });

      test(`M2-AC04/2 simulated choose→save→new device→failure→retry (${locale}, ${width})`, async ({ openDevice }) => {
        test.setTimeout(150_000);
        const [held, next] = othersOf(locale);
        await setAccountPreference(FIONA, held);

        // Device 1: a browser whose own language is the target; the account's language still wins.
        const laptop = await openDevice('laptop', { locale: BROWSER_TAG[locale] });
        const laptopProblems = watchConsole(laptop.page);
        await signInFrom(laptop.page, 'fiona');
        await expectBodyLocale(laptop.page, held, 'account');
        await expect(prompt(laptop.page)).toHaveCount(0);

        // Choose → save: switched in place, announced as saved, and on the row with its instant.
        await switchInHeader(laptop.page, locale);
        await expectBodyLocale(laptop.page, locale, 'account');
        await expectLive(laptop.page, 'saved-account', internalCopy(locale, 'locale.live.savedAccount'));
        await expect.poll(async () => (await readAccountPreference(FIONA.id))?.localePref).toBe(locale);
        const saved = await readAccountPreference(FIONA.id);
        expect(saved?.setAtMicros, 'the preference is saved with its instant').not.toBeNull();
        const laptopCookies = await localeCookies(laptop.context);
        expect(laptopCookies[LOCALE_COOKIES.session], 'the account holds it, so no session choice is left').toBeUndefined();
        expect(laptopCookies[LOCALE_COOKIES.guest], 'a signed-in choice never writes the guest cookie').toBeUndefined();

        // Device 2: nothing of its own; signing Fiona in shows her saved language.
        const phone = await openDevice('phone');
        const phoneProblems = watchConsole(phone.page);
        await signInFrom(phone.page, 'fiona');
        await expectBodyLocale(phone.page, locale, 'account');
        expect(await localeCookies(phone.context), 'the new device holds no language cookie of its own').toEqual({});

        // Failure: the API's liveness check answers 503 for the next command only, then a switch.
        await phone.control.failNext(phone.tag, 'user', 500, 'unexpected_failure');
        await switchInHeader(phone.page, next);
        await expectBodyLocale(phone.page, next, 'session');
        await expectLive(phone.page, 'not-saved', internalCopy(next, 'locale.live.notSaved'));
        await expect(unsavedNotice(phone.page)).toHaveAttribute('data-locale', next);
        await expect(unsavedNotice(phone.page)).toContainText(internalCopy(next, 'locale.status.unsaved').replace('{name}', localeName(next)));
        await expectInNamedRegion(unsavedNotice(phone.page), next);
        await expect(phone.page.getByTestId('locale-status-retry')).toBeVisible();
        expect(await readAccountPreference(FIONA.id), 'the row is unchanged').toEqual(saved);
        expect((await localeCookies(phone.context))[LOCALE_COOKIES.session]).toBe(next);

        // Reload: the language and the notice come from the cookie, not from client state.
        await phone.page.reload();
        await expectBodyLocale(phone.page, next, 'session');
        await expect(unsavedNotice(phone.page)).toHaveAttribute('data-locale', next);
        expect(await readAccountPreference(FIONA.id)).toEqual(saved);

        // Retry: saved, the notice gone, the row changed and later than before.
        await phone.page.getByTestId('locale-status-retry').click();
        await expect(unsavedNotice(phone.page)).toHaveCount(0);
        await expectBodyLocale(phone.page, next, 'account');
        await expect(switcher(phone.page), 'focus left the notice for the header before the notice went').toBeFocused();
        await expect.poll(async () => (await readAccountPreference(FIONA.id))?.localePref).toBe(next);
        const retried = await readAccountPreference(FIONA.id);
        expect(laterThan(retried?.setAtMicros ?? null, saved?.setAtMicros ?? null), 'the retry wrote a new instant').toBe(true);
        expect((await localeCookies(phone.context))[LOCALE_COOKIES.session], 'a successful retry expires the session choice').toBeUndefined();

        // Device 1 holds no session choice, so its next render follows the account.
        await laptop.page.reload();
        await expectBodyLocale(laptop.page, next, 'account');

        expect([...laptopProblems, ...phoneProblems]).toEqual([]);
      });
    });
  }
}

// --- M2-AC04/2: failures, carries, persistence -------------------------------------

test.describe('M2-AC04 the language preference: what is saved, where, and what happens when it cannot be', () => {
  test('M2-AC04/2 simulated transport failure: a switch on the instance whose API is unreachable switches the page, saves nothing, and offers Retry at layout level on either instance', async ({
    tagged,
  }) => {
    test.setTimeout(120_000);
    await setAccountPreference(FIONA, 'en-MY');
    const { page } = tagged;
    const problems = watchConsole(page);
    await signInFrom(page, 'fiona');
    await expectBodyLocale(page, 'en-MY', 'account');
    const before = await readAccountPreference(FIONA.id);

    // The same cookies, on the instance whose API address is closed: no section renders, the header does.
    await page.goto(`${OUTAGE_WEB_ORIGIN}${WEB_ROUTES.internal}`);
    await expect(page.locator('[data-app-state="api-unreachable"]')).toHaveCount(1);
    await expect(page.locator('body'), 'the account could not be read, which is not "no preference"').toHaveAttribute(
      'data-account-preference',
      'unknown',
    );
    await expect(prompt(page), 'nobody is asked because the API blinked').toHaveCount(0);
    await expect(page.getByTestId('internal-header')).toBeVisible();

    await switchInHeader(page, 'zh-Hans-MY');
    await expectBodyLocale(page, 'zh-Hans-MY', 'session');
    await expectLive(page, 'not-saved', internalCopy('zh-Hans-MY', 'locale.live.notSaved'));
    await expect(unsavedNotice(page)).toHaveAttribute('data-locale', 'zh-Hans-MY');
    await expect(page.getByTestId('locale-status-retry')).toBeVisible();
    expect(await readAccountPreference(FIONA.id), 'the row is unchanged').toEqual(before);

    // Back on the healthy instance: a new document, and the notice is still there, from the cookie.
    await page.goto(`${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}`);
    await expectBodyLocale(page, 'zh-Hans-MY', 'session');
    await expect(unsavedNotice(page)).toHaveAttribute('data-locale', 'zh-Hans-MY');
    await page.getByTestId('locale-status-retry').click();
    await expect(unsavedNotice(page)).toHaveCount(0);
    await expectBodyLocale(page, 'zh-Hans-MY', 'account');
    await expect.poll(async () => (await readAccountPreference(FIONA.id))?.localePref).toBe('zh-Hans-MY');

    expect(problems).toEqual([]);
  });

  test('M2-AC04/2 simulated refused storage (mocked handler answer): when the browser keeps no cookie from a guest choice, the page says so and stays in one language', async ({
    tagged,
  }) => {
    const { page, context } = tagged;
    const problems = watchConsole(page);
    await page.goto(WEB_ROUTES.signInPage);
    await expectBodyLocale(page, 'en-MY');

    // MOCKED: the handler's real JSON shape for a guest choice (R4), with no Set-Cookie —
    // what a browser that refuses to store cookies is left with after the real answer.
    let answered = 0;
    await page.route(`**${LOCALE_PATH}`, async (route) => {
      answered += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ switched: true, locale: 'ms-MY', scope: 'guest', saved: true }),
      });
    });

    await switchInHeader(page, 'ms-MY');
    await expectLive(page, 'refused', internalCopy('en-MY', 'locale.live.refused'));
    expect(answered, 'the switch asked once').toBe(1);
    // One language everywhere: the server could not render Malay without the cookie, so nothing was refreshed.
    await expectBodyLocale(page, 'en-MY');
    await expect(page.locator(SIGN_IN_ROOT)).toContainText(internalCopy('en-MY', 'signIn.title'));
    await expect(prompt(page)).toContainText(commonCopy('en-MY', 'localePrompt.title'));
    expect(await localeCookies(context), 'no language cookie exists').toEqual({});

    expect(problems).toEqual([]);
  });

  test('M2-AC04/2 simulated session choice over the account value: Gopal chooses Chinese on the sign-in page, signs in, is told it replaced Bahasa Melayu, and Undo puts Bahasa Melayu back', async ({
    tagged,
  }) => {
    test.setTimeout(90_000);
    await setAccountPreference(GOPAL, 'ms-MY');
    const { page, context } = tagged;
    const problems = watchConsole(page);

    await page.goto(WEB_ROUTES.signInPage);
    await chooseInPrompt(page, 'zh-Hans-MY', 'guest');
    expect(await localeCookies(context)).toMatchObject({
      [LOCALE_COOKIES.guest]: 'zh-Hans-MY',
      [LOCALE_COOKIES.carry]: 'zh-Hans-MY',
      [LOCALE_COOKIES.prompt]: '1',
    });

    const landed = await signInFrom(page, 'gopal');
    expect(landed.pathname).toBe(WEB_ROUTES.internal);
    expect(landed.searchParams.get('outcome')).toBe('locale_synced');
    expect(landed.searchParams.get('from')).toBe('ms-MY');
    await expectBodyLocale(page, 'zh-Hans-MY', 'account');
    const synced = syncedNotice(page);
    await expect(synced).toHaveAttribute('data-from', 'ms-MY');
    await expect(synced).toContainText(internalCopy('zh-Hans-MY', 'locale.status.syncedFrom').replace('{name}', localeName('ms-MY')));
    await expectInNamedRegion(synced, 'zh-Hans-MY');
    // The embedded language name carries its own language (R10).
    await expect(synced.locator('[lang="ms-MY"]')).toHaveText(localeName('ms-MY'));
    await expect(page.getByTestId('locale-status-undo')).toHaveAccessibleName(internalCopy('zh-Hans-MY', 'locale.status.undo'));
    await expect.poll(async () => (await readAccountPreference(GOPAL.id))?.localePref).toBe('zh-Hans-MY');
    const cookies = await localeCookies(context);
    expect(cookies[LOCALE_COOKIES.carry], 'the carry is spent').toBeUndefined();
    expect(cookies[LOCALE_COOKIES.session], 'the account holds the choice').toBeUndefined();

    await page.getByTestId('locale-status-undo').click();
    await expectBodyLocale(page, 'ms-MY', 'account');
    await expect.poll(async () => (await readAccountPreference(GOPAL.id))?.localePref).toBe('ms-MY');
    await expect(syncedNotice(page)).toHaveCount(0);
    await expect(switcher(page), 'focus left the notice for the header before the notice went').toBeFocused();
    await expectNoLocaleOutcome(page, 'the synced landing was consumed by the Undo');

    expect(problems).toEqual([]);
  });

  /**
   * critic-4: an attempt that ends before the API knows who was signing in (here a
   * cancel at the provider, `error=access_denied`) keeps the carry, so the retry
   * within its ten minutes lands in the language just chosen rather than silently
   * in the account's older one (R6 rev 3).
   */
  test('M2-AC04/2 simulated cancelled sign-in keeps the choice: Gopal chooses Chinese on the sign-in page, cancels at the provider, signs in again and lands in Chinese, told it replaced Bahasa Melayu', async ({
    tagged,
  }) => {
    test.setTimeout(90_000);
    await setAccountPreference(GOPAL, 'ms-MY');
    const before = await readAccountPreference(GOPAL.id);
    const { page, context } = tagged;
    const problems = watchConsole(page);

    await page.goto(WEB_ROUTES.signInPage);
    await chooseInPrompt(page, 'zh-Hans-MY', 'guest');
    expect((await localeCookies(context))[LOCALE_COOKIES.carry]).toBe('zh-Hans-MY');

    // He starts signing in and cancels at the simulated consent screen.
    const cancelled = new URL(await cancelSignIn(page));
    expect(cancelled.pathname).toBe(WEB_ROUTES.signInPage);
    expect(cancelled.searchParams.get('outcome')).toBe('cancelled');
    await expect(page.locator(SIGN_IN_ROOT)).toHaveAttribute('data-outcome', 'cancelled');
    await expect(page.getByTestId(TESTIDS.signInOutcome)).toContainText(internalCopy('zh-Hans-MY', 'signIn.outcomes.cancelled.title'));
    await expectBodyLocale(page, 'zh-Hans-MY', 'guest');
    expect((await localeCookies(context))[LOCALE_COOKIES.carry], 'a cancel names nobody, so the carry is kept for the retry').toBe(
      'zh-Hans-MY',
    );
    expect(await readAccountPreference(GOPAL.id), 'nothing was written by the cancelled attempt').toEqual(before);

    // The retry, well within the carry's ten minutes.
    const landed = await signInFrom(page, 'gopal');
    expect(landed.pathname).toBe(WEB_ROUTES.internal);
    expect(landed.searchParams.get('outcome')).toBe('locale_synced');
    expect(landed.searchParams.get('from')).toBe('ms-MY');
    await expectBodyLocale(page, 'zh-Hans-MY', 'account');
    const synced = syncedNotice(page);
    await expect(synced).toHaveAttribute('data-from', 'ms-MY');
    await expect(synced).toContainText(internalCopy('zh-Hans-MY', 'locale.status.syncedFrom').replace('{name}', localeName('ms-MY')));
    await expect.poll(async () => (await readAccountPreference(GOPAL.id))?.localePref).toBe('zh-Hans-MY');
    expect((await localeCookies(context))[LOCALE_COOKIES.carry], 'the sign-in the API let in spent the carry').toBeUndefined();

    expect(problems).toEqual([]);
  });

  test("M2-AC04/2 simulated invitee: Fiona opens Dave's invitation in a fresh browser, chooses Chinese in the prompt and signs in, and lands on the invitation with its token intact and the synced notice", async ({
    tagged,
    tag,
    openDevice,
  }) => {
    test.setTimeout(120_000);
    await setAccountPreference(FIONA, null);

    // Dave invites Fiona into an org of this row's own. The prompt is not his to answer.
    const dave = tagged.page;
    await promptAlreadyAnswered(tagged.context);
    const daveProblems = watchConsole(dave);
    await signInFrom(dave, 'dave');
    const orgName = `Bahasa Invite ${uniqueSuffix(tag)}`;
    const orgId = await createOrg(dave, orgName, 'en-MY');
    const invitation = await invite(dave, orgId, FIONA.email);

    // Fiona, in a fresh browser, is sent to sign in and meets the prompt there.
    const fiona = await openDevice('fiona');
    const fionaProblems = watchConsole(fiona.page);
    await fiona.page.goto(invitation.acceptUrl);
    await fiona.page.waitForURL((url) => url.pathname === WEB_ROUTES.signInPage);
    await chooseInPrompt(fiona.page, 'zh-Hans-MY', 'guest');

    const landed = await signInFrom(fiona.page, 'fiona', invitation.acceptUrl);
    expect(landed.pathname).toBe(ACCEPT_PATH);
    expect(landed.searchParams.get('token') === invitation.token, 'the invitation token is intact').toBe(true);
    expect(landed.searchParams.get('outcome')).toBe('locale_synced');
    expect(landed.searchParams.get('from')).toBe('none');
    await expect(fiona.page.locator('[data-app-state="invitation-pending"]')).toBeVisible();
    await expect(fiona.page.getByTestId('invitation-org')).toHaveText(orgName);
    await expectBodyLocale(fiona.page, 'zh-Hans-MY', 'account');
    await expect(syncedNotice(fiona.page)).toHaveAttribute('data-from', 'none');
    await expect(syncedNotice(fiona.page)).toContainText(internalCopy('zh-Hans-MY', 'locale.status.synced'));
    await expect.poll(async () => (await readAccountPreference(FIONA.id))?.localePref).toBe('zh-Hans-MY');

    expect([...daveProblems, ...fionaProblems]).toEqual([]);
  });

  test('M2-AC04/2 simulated idle tab: a switch from a tab whose access token has expired switches, says it is not saved, and Retry saves, without the sign-in page ever showing', async ({
    tagged,
  }) => {
    test.setTimeout(90_000);
    await setAccountPreference(FIONA, 'en-MY');
    const { page, tag, control } = tagged;
    const problems = watchConsole(page);
    await control.tokenLifetime(tag, 2);
    await signInFrom(page, 'fiona');
    await expectBodyLocale(page, 'en-MY', 'account');
    const before = await readAccountPreference(FIONA.id);
    const documents: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) documents.push(new URL(frame.url()).pathname);
    });

    // Past the two-second lifetime AND the API's five seconds of clock tolerance
    // on `exp` (apps/api/src/authenticate.ts CLOCK_TOLERANCE_SECONDS), so the API
    // itself refuses the tab's stored access token. Three seconds, as the M2-02
    // rows wait, is enough for the web's own refresh but not for the API, which
    // then accepts the token and saves (the first integration run found this).
    await page.waitForTimeout(8_000);
    // Tokens minted from here on live an hour, so the session the refresh renews stays usable for Retry.
    await control.tokenLifetime(tag, 3600);

    await switchInHeader(page, 'ms-MY');
    await expectBodyLocale(page, 'ms-MY', 'session');
    await expectLive(page, 'not-saved', internalCopy('ms-MY', 'locale.live.notSaved'));
    await expect(unsavedNotice(page)).toHaveAttribute('data-locale', 'ms-MY');
    expect(await readAccountPreference(FIONA.id), 'the expired token saved nothing').toEqual(before);

    await page.getByTestId('locale-status-retry').click();
    await expect(unsavedNotice(page)).toHaveCount(0);
    await expectBodyLocale(page, 'ms-MY', 'account');
    await expect.poll(async () => (await readAccountPreference(FIONA.id))?.localePref).toBe('ms-MY');
    expect(new URL(page.url()).pathname).toBe(WEB_ROUTES.internal);
    expect(documents.filter((path) => path === WEB_ROUTES.signInPage), 'the sign-in page is never seen').toEqual([]);

    expect(problems).toEqual([]);
  });

  test('M2-AC04/2 simulated guest persistence: a signed-out choice outlives the browser session, and a restarted browser opens in it without being asked', async ({
    tagged,
    browser,
    viewport,
  }) => {
    const { page, context } = tagged;
    const problems = watchConsole(page);
    await page.goto(WEB_ROUTES.signInPage);
    await switchInHeader(page, 'ms-MY');
    await expectBodyLocale(page, 'ms-MY', 'guest');
    await expectLive(page, 'saved-guest', internalCopy('ms-MY', 'locale.live.savedGuest'));

    const guest = (await context.cookies()).find((cookie) => cookie.name === LOCALE_COOKIES.guest);
    expect(guest?.value).toBe('ms-MY');
    // One year (R4), so it outlives the browser session; script-readable, so refused storage can be detected.
    expect((guest?.expires ?? 0) * 1000).toBeGreaterThan(Date.now() + 300 * 24 * 60 * 60 * 1000);
    expect(guest?.httpOnly).toBe(false);

    // A restarted browser keeps what storageState keeps, less every cookie that ends with the browser
    // session and every sb-* cookie.
    const state = await context.storageState();
    const kept = state.cookies.filter((cookie) => cookie.expires !== -1 && !cookie.name.startsWith(SESSION_COOKIE_PREFIX));
    expect(kept.map((cookie) => cookie.name)).toContain(LOCALE_COOKIES.guest);
    const restarted = await browser.newContext({ baseURL: HEALTHY_WEB_ORIGIN, viewport, storageState: { cookies: kept, origins: [] } });
    try {
      const again = await restarted.newPage();
      const againProblems = watchConsole(again);
      await again.goto(WEB_ROUTES.signInPage);
      await expectBodyLocale(again, 'ms-MY', 'guest');
      await expect(prompt(again), 'a saved guest preference is not asked about').toHaveCount(0);
      const cookies = await localeCookies(restarted);
      expect(cookies[LOCALE_COOKIES.guest]).toBe('ms-MY');
      expect(cookies[LOCALE_COOKIES.prompt], 'the prompt flag ended with the browser session').toBeUndefined();
      expect(cookies[LOCALE_COOKIES.session]).toBeUndefined();
      expect([...problems, ...againProblems]).toEqual([]);
    } finally {
      await restarted.close();
    }
  });

  test('M2-AC04/2 simulated two quick choices: two header submissions in the same tick end with the last one in the page, on the row and in the live region', async ({
    tagged,
  }) => {
    await setAccountPreference(FIONA, 'en-MY');
    const { page } = tagged;
    const problems = watchConsole(page);
    await signInFrom(page, 'fiona');
    await expectBodyLocale(page, 'en-MY', 'account');
    const posts = watchPosts(page);

    // Two Applies in one tick: the second is chosen while the first is in flight.
    await page.getByTestId('locale-switcher-form').evaluate((element) => {
      const form = element as HTMLFormElement;
      const select = form.querySelector('select');
      if (select === null) throw new Error('the header switcher has no select');
      for (const value of ['ms-MY', 'zh-Hans-MY']) {
        select.value = value;
        form.requestSubmit();
      }
    });

    await expectBodyLocale(page, 'zh-Hans-MY', 'account');
    await expectLive(page, 'saved-account', internalCopy('zh-Hans-MY', 'locale.live.savedAccount'));
    await expect.poll(async () => (await readAccountPreference(FIONA.id))?.localePref).toBe('zh-Hans-MY');
    // Nothing still in flight turns it back.
    await page.waitForLoadState('networkidle');
    await expectBodyLocale(page, 'zh-Hans-MY', 'account');
    await expect(switcher(page)).toHaveValue('zh-Hans-MY');
    await expect(unsavedNotice(page)).toHaveCount(0);
    expect((await readAccountPreference(FIONA.id))?.localePref).toBe('zh-Hans-MY');
    expect(posts.length, 'one request in flight, and the newer choice replaced the pending one').toBeLessThanOrEqual(2);
    expect(posts.every((path) => path === LOCALE_PATH)).toBe(true);

    expect(problems).toEqual([]);
  });
});

// --- M2-AC04/3: three languages, six times --------------------------------------

/**
 * Every piece of the language surface in each language at 1440 and 390, with the
 * evidence frames (the sign-in page with the prompt, the synced notice, `/internal`
 * with the card, the unsaved notice) and the 320 px check of the sign-in page,
 * `/internal` and the org page. Gopal's account first holds another language, so
 * the sign-in carries the row's language over it and the synced notice names it.
 *
 * On the way it proves what the W5 fixes changed: the card's select follows a
 * header switch (spec-4); the card's Save switches in place with JavaScript and
 * lands with an outcome without it (critic-3); and a language outcome in the URL
 * is consumed by the next in-place switch — the synced notice by a header switch,
 * a "saved" landing by a failing header switch, a "not saved" landing by Retry
 * (spec-1).
 */
for (const locale of LOCALES) {
  for (const width of [1440, 390] as const) {
    test.describe(`M2-AC04 the language surface in ${locale} at ${width}px`, () => {
      test.use({ viewport: viewportOf(width) });

      test(`M2-AC04/3 simulated three languages: the header, the prompt, the card, both notices and the outcomes speak ${locale} at ${width}px`, async ({
        openDevice,
        tag,
      }) => {
        test.setTimeout(240_000);
        const [other, third] = othersOf(locale);
        await setAccountPreference(GOPAL, other);
        const device: Device = await openDevice('guest', { locale: BROWSER_TAG[locale] });
        const { page } = device;
        const problems = watchConsole(page);

        // The sign-in page: the header and the prompt, suggested by the browser.
        await page.goto(WEB_ROUTES.signInPage);
        await expectBodyLocale(page, locale, 'browser');
        await expectHeader(page, locale);
        await expectPrompt(page, locale);
        await internalShot(page, `locale-prompt-${locale}`);
        await expectNoHorizontalScrollAt320(page);

        // Continue: the suggestion becomes this browser's explicit choice.
        await page.getByTestId('internal-locale-prompt-continue').click();
        await expect(prompt(page)).toHaveCount(0);
        await expectBodyLocale(page, locale, 'guest');
        await expectLive(page, 'saved-guest', internalCopy(locale, 'locale.live.savedGuest'));
        await expect(switcher(page), 'focus left the prompt for the header before the prompt went').toBeFocused();

        // The sign-in carries it over the account's other language, and says so.
        const landed = await signInFrom(page, 'gopal');
        expect(landed.searchParams.get('outcome')).toBe('locale_synced');
        expect(landed.searchParams.get('from')).toBe(other);
        await expectBodyLocale(page, locale, 'account');
        const synced = syncedNotice(page);
        await expect(synced).toHaveAttribute('data-from', other);
        await expect(synced).toContainText(internalCopy(locale, 'locale.status.syncedFrom').replace('{name}', localeName(other)));
        await expect(synced.locator(`[lang="${other}"]`)).toHaveText(localeName(other));
        await expectInNamedRegion(synced, locale);
        await expect(page.getByTestId('locale-status-undo')).toHaveAccessibleName(internalCopy(locale, 'locale.status.undo'));
        await expect(page.getByTestId('locale-status-change')).toHaveText(internalCopy(locale, 'locale.status.change'));
        await internalShot(page, `locale-synced-${locale}`);

        // Another switch consumes the landing: the account now holds the third language, and the
        // notice must not come back saying it replaced the other one, with an Undo to it (spec-1).
        await switchInHeader(page, third);
        await expectBodyLocale(page, third, 'account');
        await expectLive(page, 'saved-account', internalCopy(third, 'locale.live.savedAccount'));
        await expect(syncedNotice(page), 'no stale "was <other>" beside a language it never replaced').toHaveCount(0);
        await expectNoLocaleOutcome(page, 'the synced landing was consumed by the switch');
        await switchInHeader(page, locale);
        await expectBodyLocale(page, locale, 'account');
        await expect(syncedNotice(page)).toHaveCount(0);
        await expect.poll(async () => (await readAccountPreference(GOPAL.id))?.localePref).toBe(locale);

        // /internal: the header and the card.
        await page.goto(WEB_ROUTES.internal);
        await expectHeader(page, locale);
        await expectCard(page, locale, GOPAL.id);
        await card(page).scrollIntoViewIfNeeded();
        await internalShot(page, `locale-card-${locale}`);
        await expectNoHorizontalScrollAt320(page);

        // A switch changes the status badges' words, never their codes, tones or icons.
        const badgesBefore = await campaignBadges(page);
        expect(badgesBefore.length, 'the seeded campaigns are listed').toBeGreaterThan(0);
        for (const badge of badgesBefore) expect(badge.label, badge.id).toBe(statusLabel(locale, badge.code));
        await switchInHeader(page, other);
        await expectBodyLocale(page, other, 'account');
        await expectLive(page, 'saved-account', internalCopy(other, 'locale.live.savedAccount'));
        await expect
          .poll(() => campaignBadges(page))
          .toEqual(badgesBefore.map((badge) => ({ ...badge, label: statusLabel(other, badge.code) })));
        // The card's select follows a switch made elsewhere, so its Save cannot post the old value back (spec-4).
        await expect(page.getByTestId('locale-card-state')).toHaveAttribute('data-account-preference', other);
        await expect(page.getByTestId('locale-card-select')).toHaveValue(other);

        // The card's Save, with JavaScript: in place, back to the row's language, no outcome, same URL (critic-3).
        const internalUrl = page.url();
        await page.getByTestId('locale-card-select').selectOption(locale);
        await page.getByTestId('locale-card-save').click();
        await expectBodyLocale(page, locale, 'account');
        await expectLive(page, 'saved-account', internalCopy(locale, 'locale.live.savedAccount'));
        expect(page.url(), 'the card switched in place').toBe(internalUrl);
        await expectNoLocaleOutcome(page, 'an in-place save lands with no outcome');
        await expect(page.getByTestId('locale-card-select')).toHaveValue(locale);
        await expect.poll(async () => (await readAccountPreference(GOPAL.id))?.localePref).toBe(locale);

        // The card without JavaScript, back to the row's language: the saved outcome.
        await switchInHeader(page, other);
        await expectBodyLocale(page, other, 'account');
        await expect.poll(async () => (await readAccountPreference(GOPAL.id))?.localePref).toBe(other);
        await page.getByTestId('locale-card-select').selectOption(locale);
        await submitCardWithoutScript(page);
        await landOnInternalWith(page, 'locale_saved');
        await expectBodyLocale(page, locale, 'account');
        await expectOrgOutcome(page, 'locale_saved', locale);

        // A header switch that then fails: the unsaved notice, and no "saved" left beside it (spec-1).
        await expect.poll(async () => (await readAccountPreference(GOPAL.id))?.localePref).toBe(locale);
        await device.control.failNext(device.tag, 'user', 500, 'unexpected_failure');
        await switchInHeader(page, other);
        await expectBodyLocale(page, other, 'session');
        await expectLive(page, 'not-saved', internalCopy(other, 'locale.live.notSaved'));
        await expect(unsavedNotice(page)).toHaveAttribute('data-locale', other);
        await expectNoLocaleOutcome(page, 'the "saved" landing was consumed by the failing switch');
        await page.getByTestId('locale-status-retry').click();
        await expect(unsavedNotice(page)).toHaveCount(0);
        await expectBodyLocale(page, other, 'account');
        await expect(switcher(page), 'focus left the notice for the header before the notice went').toBeFocused();
        await expect.poll(async () => (await readAccountPreference(GOPAL.id))?.localePref).toBe(other);

        // A save that fails without JavaScript: the not-saved outcome and the unsaved notice, in the row's language.
        await device.control.failNext(device.tag, 'user', 500, 'unexpected_failure');
        await page.getByTestId('locale-card-select').selectOption(locale);
        await submitCardWithoutScript(page);
        await landOnInternalWith(page, 'locale_not_saved');
        await expectBodyLocale(page, locale, 'session');
        await expectOrgOutcome(page, 'locale_not_saved', locale);
        await expect(unsavedNotice(page)).toHaveAttribute('data-locale', locale);
        await expect(unsavedNotice(page)).toContainText(internalCopy(locale, 'locale.status.unsaved').replace('{name}', localeName(locale)));
        await expectInNamedRegion(unsavedNotice(page), locale);
        await expect(page.getByTestId('locale-status-retry')).toHaveAccessibleName(internalCopy(locale, 'locale.status.retry'));
        await internalShot(page, `locale-unsaved-${locale}`);
        // Retry consumes the landing: no "could not be saved" survives the save that just happened (spec-1).
        await page.getByTestId('locale-status-retry').click();
        await expect(unsavedNotice(page)).toHaveCount(0);
        await expectBodyLocale(page, locale, 'account');
        await expectLive(page, 'saved-account', internalCopy(locale, 'locale.live.savedAccount'));
        await expectNoLocaleOutcome(page, 'the "not saved" landing was consumed by Retry');
        await expect(switcher(page), 'focus left the notice for the header before the notice went').toBeFocused();
        await expect.poll(async () => (await readAccountPreference(GOPAL.id))?.localePref).toBe(locale);

        // A guest's plain form post is answered `locale_switched`. The sign-in page shows no org
        // outcome, so the answer is read off the handler's redirect.
        const guest = await apiRequest.newContext();
        try {
          const answer = await guest.post(`${HEALTHY_WEB_ORIGIN}${LOCALE_PATH}`, {
            headers: { origin: HEALTHY_WEB_ORIGIN },
            form: { locale, intent: 'choose', next: WEB_ROUTES.signInPage },
            maxRedirects: 0,
            failOnStatusCode: false,
          });
          expect(answer.status()).toBe(303);
          const location = new URL(answer.headers()['location'] ?? '', HEALTHY_WEB_ORIGIN);
          expect(location.pathname).toBe(WEB_ROUTES.signInPage);
          expect(location.searchParams.get('outcome')).toBe('locale_switched');
          expect(internalCopy(locale, 'outcomes.locale_switched')).not.toBe('');
        } finally {
          await guest.dispose();
        }

        // The org page fits 320 in this language too.
        await createOrg(page, `Bahasa ${locale} ${uniqueSuffix(tag)}`, locale);
        await expectHeader(page, locale);
        await expectNoHorizontalScrollAt320(page);

        expect(problems).toEqual([]);
      });
    });
  }
}

// --- M2-AC04/3: what a switch keeps ------------------------------------------------

test.describe('M2-AC04 the language preference: what a switch may not change', () => {
  test('M2-AC04/3 simulated input survives: a switch keeps the typed org name, the request key and the URL, posts only itself, and the create that follows carries the same key once', async ({
    tagged,
    tag,
  }) => {
    test.setTimeout(90_000);
    await setAccountPreference(FIONA, 'en-MY');
    const { page } = tagged;
    const problems = watchConsole(page);
    await signInFrom(page, 'fiona');
    await expectBodyLocale(page, 'en-MY', 'account');

    const name = `咖啡 Kita Fiona ${uniqueSuffix(tag)}`;
    await page.getByTestId('create-org-name').fill(name);
    const keyField = page.locator('form[data-testid="create-org-form"] input[type="hidden"][name="requestKey"][data-testid="request-key"]');
    await expect(keyField, 'the key is minted after mount').toHaveValue(REQUEST_KEY);
    const key = await keyField.inputValue();
    const url = page.url();
    const posts = watchPosts(page);

    await switchInHeader(page, 'ms-MY');
    await expectBodyLocale(page, 'ms-MY', 'account');
    await expectLive(page, 'saved-account', internalCopy('ms-MY', 'locale.live.savedAccount'));
    await expect(page.getByTestId('create-org-name'), 'the typed name survives').toHaveValue(name);
    await expect(keyField, 'the request key survives').toHaveValue(key);
    expect(page.url(), 'the URL is unchanged').toBe(url);
    expect(posts, 'the switch posted to the language handler once, and to no command handler').toEqual([LOCALE_PATH]);

    const since = await databaseNow();
    const createPost = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === CREATE_ORG_PATH);
    await page.getByTestId('create-org-submit').click();
    const sent = new URLSearchParams((await createPost).postData() ?? '');
    expect(sent.get('requestKey'), 'the create carried the key minted before the switch').toBe(key);
    expect(sent.get('name')).toBe(name);
    const orgId = await landOnCreatedOrg(page, name, 'ms-MY');

    expect(await sql<{ id: string }>('migrator', 'SELECT id FROM app.orgs WHERE name = $1', [name]), 'exactly one org').toEqual([{ id: orgId }]);
    const audit = await sql<{ action: string; actor_user_id: string }>(
      'migrator',
      `SELECT action, actor_user_id FROM app.audit_log
        WHERE context_org_id = $1 AND occurred_at >= $2 AND outcome = 'allowed'
        ORDER BY id`,
      [orgId, since],
    );
    expect(audit, 'exactly one org.create row').toEqual([{ action: 'org.create', actor_user_id: FIONA.id }]);
    expect(posts.filter((path) => path === CREATE_ORG_PATH), 'the create was posted once').toHaveLength(1);

    expect(problems).toEqual([]);
  });

  test('M2-AC04/3 simulated input survives the card: saving on the Language card switches in place, keeps the typed org name, the request key and the URL, and posts only itself', async ({
    tagged,
    tag,
  }) => {
    test.setTimeout(90_000);
    await setAccountPreference(FIONA, 'en-MY');
    const { page } = tagged;
    const problems = watchConsole(page);
    await signInFrom(page, 'fiona');
    await expectBodyLocale(page, 'en-MY', 'account');

    const name = `Kad 咖啡 Fiona ${uniqueSuffix(tag)}`;
    await page.getByTestId('create-org-name').fill(name);
    const keyField = page.locator('form[data-testid="create-org-form"] input[type="hidden"][name="requestKey"][data-testid="request-key"]');
    await expect(keyField, 'the key is minted after mount').toHaveValue(REQUEST_KEY);
    const key = await keyField.inputValue();
    const url = page.url();
    const posts = watchPosts(page);

    await page.getByTestId('locale-card-select').selectOption('zh-Hans-MY');
    await page.getByTestId('locale-card-save').click();
    await expectBodyLocale(page, 'zh-Hans-MY', 'account');
    await expectLive(page, 'saved-account', internalCopy('zh-Hans-MY', 'locale.live.savedAccount'));
    expect(page.url(), 'the URL is unchanged: the card did not leave the page').toBe(url);
    await expect(page.getByTestId('create-org-name'), 'the typed name survives').toHaveValue(name);
    await expect(keyField, 'the request key survives').toHaveValue(key);
    await expect(page.getByTestId('org-outcome'), 'an in-place save lands with no outcome').toHaveCount(0);
    expect(posts, 'the save posted to the language handler once, and to no command handler').toEqual([LOCALE_PATH]);
    await expect.poll(async () => (await readAccountPreference(FIONA.id))?.localePref).toBe('zh-Hans-MY');
    await expect(page.getByTestId('locale-card-state')).toHaveAttribute('data-account-preference', 'zh-Hans-MY');
    await expect(page.getByTestId('locale-card-select')).toHaveValue('zh-Hans-MY');

    expect(problems).toEqual([]);
  });

  test('M2-AC04/3 simulated keyboard: moving through the header switcher with the arrow keys switches and saves nothing; Apply switches once, to the language chosen', async ({
    tagged,
  }) => {
    await setAccountPreference(FIONA, 'en-MY');
    const { page } = tagged;
    const problems = watchConsole(page);
    await signInFrom(page, 'fiona');
    await expectBodyLocale(page, 'en-MY', 'account');
    const before = await readAccountPreference(FIONA.id);
    const posts = watchPosts(page);

    // A closed native select changes its value on every arrow key (Chromium on Windows and Linux).
    await switcher(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(switcher(page), 'the keyboard moved through Bahasa Melayu to 简体中文').toHaveValue('zh-Hans-MY');
    // An absence is only seen by waiting: a switch on change would have posted within this second.
    await page.waitForTimeout(1_000);
    expect(posts, 'moving through the options posts nothing').toEqual([]);
    await expectBodyLocale(page, 'en-MY', 'account');
    await expect(live(page)).toHaveAttribute('data-result', '');
    expect(await readAccountPreference(FIONA.id), 'nothing passed on the way was saved').toEqual(before);

    await apply(page).click();
    await expectBodyLocale(page, 'zh-Hans-MY', 'account');
    await expectLive(page, 'saved-account', internalCopy('zh-Hans-MY', 'locale.live.savedAccount'));
    expect(posts, 'Apply posted once').toEqual([LOCALE_PATH]);
    await expect.poll(async () => (await readAccountPreference(FIONA.id))?.localePref).toBe('zh-Hans-MY');

    expect(problems).toEqual([]);
  });

  test('M2-AC04/3 simulated instants: switching from English to Chinese changes the words of the membership instant, never its instant or its offset, and never the typed org name', async ({
    tagged,
    tag,
  }) => {
    test.setTimeout(90_000);
    await setAccountPreference(FIONA, 'en-MY');
    const { page } = tagged;
    const problems = watchConsole(page);
    await signInFrom(page, 'fiona');

    const name = `Kopi 咖啡 Ōmar ${uniqueSuffix(tag)}`;
    const orgId = await createOrg(page, name, 'en-MY');
    await page.goto(orgPagePath(orgId));
    await expectBodyLocale(page, 'en-MY', 'account');

    const self = memberRow(page, FIONA.id);
    const since = self.locator('time');
    const granted = await sql<{ granted_at: Date }>(
      'migrator',
      'SELECT granted_at FROM app.org_members WHERE org_id = $1 AND user_id = $2',
      [orgId, FIONA.id],
    );
    const iso = granted[0]?.granted_at.toISOString();
    expect(iso, 'the membership row exists').toBeDefined();
    await expect(since).toHaveAttribute('datetime', iso!);
    await expect(since).toContainText('(UTC+08:00)');
    const english = (await since.innerText()).trim();
    const role = self.locator('[data-state-kind="role"]');
    await expect(role).toHaveAttribute('data-state-code', 'admin');
    await expect(role).toHaveText(internalCopy('en-MY', 'role.admin'));
    await expect(page.getByTestId('org-name')).toHaveText(name);

    await switchInHeader(page, 'zh-Hans-MY');
    await expectBodyLocale(page, 'zh-Hans-MY', 'account');
    await expect(since, 'the same instant').toHaveAttribute('datetime', iso!);
    await expect(since, 'in other words').not.toHaveText(english);
    await expect(since, 'still in Malaysia time').toContainText('(UTC+08:00)');
    await expect(role, 'the same code').toHaveAttribute('data-state-code', 'admin');
    await expect(role).toHaveText(internalCopy('zh-Hans-MY', 'role.admin'));
    await expect(page.getByTestId('org-name'), 'the typed name is shown as typed').toHaveText(name);

    expect(problems).toEqual([]);
  });
});

// --- caching ---------------------------------------------------------------------

test.describe('M2-AC04 the language preference and shared caches', () => {
  test('M2-AC04/1 simulated sign-in page caching: the sign-in page, which varies with Accept-Language, is no-store and a shared cache stores none of it', async () => {
    const proxy = await startCachingProxy(HEALTHY_WEB_ORIGIN);
    const anonymous = await apiRequest.newContext();
    try {
      const url = `${proxy.origin}${WEB_ROUTES.signInPage}`;
      const malay = await anonymous.get(url, { headers: { 'accept-language': 'ms-MY' } });
      expect(malay.status()).toBe(200);
      const headers = malay.headers();
      expect(headers['cache-control'], 'the sign-in page is no-store').toContain('no-store');
      expect(
        storableInSharedCache({ method: 'GET', url, headers: { 'accept-language': 'ms-MY' } }, { status: malay.status(), headers }),
        'a shared cache may not store it',
      ).toBe(false);
      expect(headers['x-wringy-proxy']).toBe('pass');
      expect(await malay.text()).toMatch(/<html[^>]*\slang="ms-MY"/);

      // An English browser asking for the same URL next gets its own page, not the stored Malay one.
      const english = await anonymous.get(url, { headers: { 'accept-language': 'en-GB' } });
      expect(english.status()).toBe(200);
      expect(english.headers()['x-wringy-proxy']).toBe('pass');
      expect(await english.text()).toMatch(/<html[^>]*\slang="en-MY"/);
      expect(proxy.storedKeys(), 'nothing of the sign-in page was stored').not.toContain(`GET ${WEB_ROUTES.signInPage}`);
      expect(proxy.hits(), 'nothing was served out of the shared cache').toBe(0);
    } finally {
      await anonymous.dispose();
      await proxy.stop();
    }
  });

  test('M2-AC04/2 simulated cross-user cache: Fiona and Gopal, whose accounts hold different languages, render alternately and each always sees their own', async ({
    tagged,
    openDevice,
  }) => {
    test.setTimeout(120_000);
    await setAccountPreference(FIONA, 'ms-MY');
    await setAccountPreference(GOPAL, 'zh-Hans-MY');
    const proxy = await startCachingProxy(HEALTHY_WEB_ORIGIN);
    try {
      const gopalDevice = await openDevice('gopal');
      const people = [
        { device: tagged, locale: 'ms-MY' as Locale, email: FIONA.email, stranger: GOPAL.email },
        { device: gopalDevice, locale: 'zh-Hans-MY' as Locale, email: GOPAL.email, stranger: FIONA.email },
      ];
      const problems = people.map(({ device }) => watchConsole(device.page));
      await signInFrom(tagged.page, 'fiona');
      await signInFrom(gopalDevice.page, 'gopal');

      // One URL for both, so a shared cache that stored either page would hand it to the other.
      const path = `${WEB_ROUTES.internal}?visitor=${Date.now()}`;
      for (let round = 1; round <= 5; round += 1) {
        for (const { device, locale, email, stranger } of people) {
          const response = await device.context.request.get(`${proxy.origin}${path}`);
          expect(response.status(), `round ${round}`).toBe(200);
          const html = await response.text();
          expect(html, `round ${round}: ${email} sees their own language`).toMatch(new RegExp(`<html[^>]*\\slang="${locale}"`));
          expect(html, `round ${round}`).toContain(email);
          expect(html, `round ${round}: nothing of the other person`).not.toContain(stranger);
          expect(response.headers()['x-wringy-proxy'], `round ${round}`).toBe('pass');

          await device.page.reload();
          await expectBodyLocale(device.page, locale, 'account');
        }
      }
      expect(proxy.storedKeys(), 'a private page is not storable in a shared cache').not.toContain(`GET ${path}`);
      expect(proxy.hits(), 'nothing was served out of the shared cache').toBe(0);
      expect(problems.flat()).toEqual([]);
    } finally {
      await proxy.stop();
    }
  });
});

// --- the invariant the earlier suites rely on ---------------------------------------

test.describe('M2-AC04 the language preference leaves the M2-01–03 testers as they were', () => {
  test('M2-AC04/1 simulated invariant: no row of this file gave Alice, Bob, Carol, Dave or Erin an account preference', async () => {
    // Every M2-01–03 row that sets `wringy-locale` relies on the guest cookie deciding its
    // language, which holds only while the person's account has no preference (R3, R13).
    const ids = (['alice', 'bob', 'carol', 'dave', 'erin'] as const).map((name) => FAKE_USERS[name].id);
    const withPreference = await sql<{ id: string }>(
      'migrator',
      'SELECT id FROM app.profiles WHERE id = ANY($1::uuid[]) AND (locale_pref IS NOT NULL OR locale_pref_set_at IS NOT NULL)',
      [ids],
    );
    expect(withPreference).toEqual([]);
  });
});
