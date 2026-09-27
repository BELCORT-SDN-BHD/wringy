/**
 * Shared support for the internal-build Playwright suite (M2-AC01).
 *
 * Nothing here is mocked: the pages under test are served by `next start`,
 * which calls the real Fastify API, which reads a real PostgreSQL 17 database
 * migrated from zero and seeded with the fixture campaigns; the real worker
 * beats into it. The database connection used to ARRANGE state (a stale or a
 * stopped worker row) is the harness's own (`@wringy/db/testing/connect`), as
 * the worker login or the migrator, never the API's.
 */
import { readFileSync } from 'node:fs';

import { expect, type BrowserContext, type Page } from '@playwright/test';

import { loginUrlsAt, withClientAt, type LoginUrls } from '@wringy/db/testing/connect';

import { M2_INTERNAL_EVIDENCE_DIR, evidenceShot } from '../e2e/evidence';
import { LOCALE_COOKIE } from '../../src/i18n/config';
import { readStoredAccessToken } from '../../src/lib/auth/supabase-server';

import type { FakeUser } from './fake-auth/users';
import { LOCALE_COOKIES, type LocaleCookieName } from './fixtures';

export type Locale = 'en-MY' | 'ms-MY' | 'zh-Hans-MY';
export const LOCALES: Locale[] = ['en-MY', 'ms-MY', 'zh-Hans-MY'];

/** The worker the suite's webServer entry starts (playwright.internal.config.ts). */
export const E2E_WORKER_ID = 'e2e-worker-1';
export const E2E_IMAGE_REF = 'local/e2e';

/** The seed in packages/db/fixtures/internal-campaigns.sql, as the page must show it. */
export const SEEDED_CAMPAIGNS = [
  { id: 'c0000000-0000-4000-8000-000000000001', title: 'Morning brew launch', orgName: 'Kopi Kita', status: 'published' },
  { id: 'c0000000-0000-4000-8000-000000000002', title: 'Hari Raya open house', orgName: 'Kopi Kita', status: 'draft' },
  { id: 'c0000000-0000-4000-8000-000000000003', title: 'Weekend run club', orgName: 'Nusantara Fit', status: 'published' },
] as const;

/** The localized words the page must use (src/messages/<locale>/{internal,common}.json). */
export const COPY: Record<
  Locale,
  { fixture: string; unknown: string; healthy: string; stale: string; stopped: string; queueOk: string; published: string; draft: string }
> = {
  'en-MY': {
    fixture: 'Demo data',
    unknown: 'Unknown',
    healthy: 'Healthy',
    stale: 'Stale',
    stopped: 'Stopped',
    queueOk: 'Round trip OK',
    published: 'Published',
    draft: 'Draft',
  },
  'ms-MY': {
    fixture: 'Data demo',
    unknown: 'Tidak diketahui',
    healthy: 'Sihat',
    stale: 'Lapuk',
    stopped: 'Dihentikan',
    queueOk: 'Perjalanan baris gilir OK',
    published: 'Diterbitkan',
    draft: 'Draf',
  },
  'zh-Hans-MY': {
    fixture: '演示数据',
    unknown: '未知',
    healthy: '正常',
    stale: '心跳超时',
    stopped: '已停止',
    queueOk: '队列往返正常',
    published: '已发布',
    draft: '草稿',
  },
};

/**
 * One localized string from `src/messages/<locale>/internal.json`, by dotted key
 * (`signIn.outcomes.cancelled.title`).
 *
 * It is READ at run time rather than imported, on purpose. The identity slice
 * owns that file; this suite owns only the key names of the copy contract. So a
 * row asserts the string the product actually ships in that locale, and a key
 * that is missing or empty fails naming itself instead of quietly matching an
 * empty expectation.
 *
 * Paths are relative to apps/web, the directory Playwright runs in.
 */
export function internalCopy(locale: Locale, key: string): string {
  return catalogueString('internal', locale, key);
}

/**
 * One localized string from `src/messages/<locale>/common.json`, read at run time
 * for the same reason as `internalCopy`. The M2-04 prompt reuses
 * `common.localePrompt.*` but its description (the internal build's own is
 * `internal.locale.prompt.description`), the header switcher is named by
 * `common.shell.languageLabel`, and the three language names are
 * `common.locale.<code>` (m2-04-code-review.md R5, R10).
 */
export function commonCopy(locale: Locale, key: string): string {
  return catalogueString('common', locale, key);
}

/**
 * The name the language controls show for `code`: `common.locale.<code>` read
 * from that language's OWN catalogue, because a language is always offered in
 * itself (简体中文, never "Simplified Chinese"; localization-v1).
 */
export function localeName(code: Locale): string {
  return commonCopy(code, `locale.${code}`);
}

/** A dotted key of one namespace's catalogue; a missing or empty string fails naming itself. */
function catalogueString(namespace: 'internal' | 'common', locale: Locale, key: string): string {
  const file = `src/messages/${locale}/${namespace}.json`;
  const messages: unknown = JSON.parse(readFileSync(file, 'utf8'));
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) break;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string' || node.trim() === '') {
    throw new Error(`${file} has no non-empty string at "${key}"`);
  }
  return node;
}

/** The login URLs of the suite's database, from what the database webServer entry announced. */
export function e2eDatabase(): LoginUrls {
  const host = process.env.WRINGY_E2E_PG_HOST;
  const port = Number(process.env.WRINGY_E2E_PG_PORT);
  const database = process.env.WRINGY_E2E_PG_DATABASE;
  if (!host || !Number.isInteger(port) || !database) {
    throw new Error('the internal suite database is not announced (run through playwright.internal.config.ts)');
  }
  return loginUrlsAt(host, port, database);
}

/** Runs one statement on the suite's database as `role`. */
export function sql<T>(role: keyof LoginUrls, text: string, params: unknown[] = []): Promise<T[]> {
  return withClientAt(e2eDatabase()[role], async (client) => (await client.query(text, params)).rows as T[]);
}

/**
 * Sets the language cookie the internal layout reads, before the first navigation.
 *
 * Since M2-04 this cookie is the GUEST's explicit saved preference, step 3 of the
 * resolution order (m2-04-code-review.md R3): it decides the page's language for
 * anybody signed out, and for a signed-in person whose account holds no
 * preference — which is every person the M2-01–03 rows sign in, because no M2-04
 * row gives Alice, Bob, Carol, Dave or Erin one. So those rows keep switching
 * the language with it exactly as before.
 */
export async function setLocaleCookie(page: Page, locale: Locale, baseURL: string | undefined): Promise<void> {
  if (!baseURL) throw new Error('the project has no baseURL');
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: locale, url: baseURL }]);
}

// --- M2-04: the language preference ----------------------------------------------

/** Where the resolved language came from, as `<body data-locale-source>` names it (R3). */
export type LocaleSource = 'session' | 'account' | 'guest' | 'browser' | 'default';

/**
 * The locale cookies `context` holds, by name (fixtures.ts `LOCALE_COOKIES`); a
 * cookie it does not hold is absent from the result. The values are language
 * codes and the prompt flag, never a credential, so a failing row may print them.
 */
export async function localeCookies(context: BrowserContext): Promise<Partial<Record<LocaleCookieName, string>>> {
  const names = new Set<string>(Object.values(LOCALE_COOKIES));
  const held: Partial<Record<LocaleCookieName, string>> = {};
  for (const cookie of await context.cookies()) {
    if (names.has(cookie.name)) held[cookie.name as LocaleCookieName] = cookie.value;
  }
  return held;
}

/**
 * The page is rendered in `locale` from end to end: the server-rendered
 * `<html lang>` and the resolution the layout stamps on `<body>` (`data-locale`,
 * and `data-locale-source` when `source` is given). Web-first, so it waits out a
 * `router.refresh()` that is still committing.
 */
export async function expectBodyLocale(page: Page, locale: Locale, source?: LocaleSource): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-locale', locale);
  if (source !== undefined) await expect(body).toHaveAttribute('data-locale-source', source);
}

/**
 * Arranges `user`'s account language as the migrator, the way R13 arranges it.
 *
 * A locale is written with `INSERT … ON CONFLICT DO UPDATE` on both columns, so
 * it works before the person's first sign-in as well as after: the sign-in's own
 * upsert refreshes only `contact_email`, `display_name` and `last_sign_in_at`, and
 * keeps the preference (R2, executed by the critique). `null` clears the
 * preference of a row that exists and writes nothing for a person who has never
 * signed in. The two columns always move together, as the pair CHECK
 * `profiles_locale_pref_pair_check` (0017) requires.
 */
export async function setAccountPreference(user: FakeUser, locale: Locale | null): Promise<void> {
  if (locale === null) {
    await sql('migrator', 'UPDATE app.profiles SET locale_pref = NULL, locale_pref_set_at = NULL WHERE id = $1', [user.id]);
    return;
  }
  await sql(
    'migrator',
    `INSERT INTO app.profiles (id, contact_email, display_name, last_sign_in_at, locale_pref, locale_pref_set_at)
     VALUES ($1, $2, $3, now(), $4, now())
     ON CONFLICT (id) DO UPDATE SET locale_pref = EXCLUDED.locale_pref, locale_pref_set_at = EXCLUDED.locale_pref_set_at`,
    [user.id, user.email, user.fullName, locale],
  );
}

/** One person's account language as PostgreSQL holds it. */
export interface AccountPreference {
  localePref: Locale | null;
  /**
   * `locale_pref_set_at` in microseconds since the epoch, as a decimal string: the
   * database's own precision, so "unchanged" is string equality and "later" is
   * `laterThan`. The API's instants are milliseconds and are compared with `>=`.
   */
  setAtMicros: string | null;
  /** The same instant as the API serialises it, for a `<time datetime>` comparison. */
  setAtIso: string | null;
}

/** `userId`'s account language, read as the migrator; `undefined` when the person has no profile yet. */
export async function readAccountPreference(userId: string): Promise<AccountPreference | undefined> {
  const rows = await sql<{ locale_pref: Locale | null; set_at_micros: string | null; set_at: Date | null }>(
    'migrator',
    `SELECT locale_pref,
            (extract(epoch FROM locale_pref_set_at) * 1000000)::bigint::text AS set_at_micros,
            locale_pref_set_at AS set_at
       FROM app.profiles
      WHERE id = $1`,
    [userId],
  );
  const row = rows[0];
  if (row === undefined) return undefined;
  return { localePref: row.locale_pref, setAtMicros: row.set_at_micros, setAtIso: row.set_at?.toISOString() ?? null };
}

/** Whether instant `a` (micros, as `readAccountPreference` gives it) is strictly after `b`. */
export function laterThan(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  return BigInt(a) > BigInt(b);
}

/** Console errors and uncaught page errors, collected for an `expect(...).toEqual([])` at the end. */
export function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`${page.url()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`${page.url()}: ${error.message}`));
  return problems;
}

/** The viewport name the evidence frames are filed under: 390, 1440 or 320. */
export function viewportName(page: Page): string {
  return String(page.viewportSize()?.width ?? 'unknown');
}

/** An evidence frame for the M2 record; tracked only with WRINGY_EVIDENCE_SHOTS=1. */
export function internalShot(page: Page, name: string): Promise<string> {
  return evidenceShot(page, M2_INTERNAL_EVIDENCE_DIR, `${name}-${viewportName(page)}.png`);
}

/** The document never scrolls sideways at the current viewport. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `the page scrolls sideways at ${innerWidth}px`).toBeLessThanOrEqual(innerWidth);
}

/**
 * The access token stored in this context's session cookie, read with the
 * application's own reader (`src/lib/auth/supabase-server.ts`).
 *
 * The production reader is reused rather than re-implemented so the row cannot
 * pass against a format the app does not actually write: it combines the cookie
 * chunks, undoes the `base64url` prefix and takes `access_token`, all through
 * `@supabase/ssr`'s own helpers.
 *
 * The token is returned to the caller and is never logged, asserted on, or put in
 * a failure message — a row that needs it sends it and asserts the answer.
 */
export async function storedAccessToken(context: BrowserContext, supabaseUrl: string): Promise<string> {
  const values = new Map((await context.cookies()).map((cookie) => [cookie.name, cookie.value]));
  const token = await readStoredAccessToken(supabaseUrl, (name) => values.get(name) ?? null);
  expect(token === null, 'the context should hold a session cookie carrying an access token').toBe(false);
  return token as string;
}
