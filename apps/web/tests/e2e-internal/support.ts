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

import { expect, type Page } from '@playwright/test';

import { loginUrlsAt, withClientAt, type LoginUrls } from '@wringy/db/testing/connect';

import { M2_INTERNAL_EVIDENCE_DIR, evidenceShot } from '../e2e/evidence';
import { LOCALE_COOKIE } from '../../src/i18n/config';

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
  const messages: unknown = JSON.parse(readFileSync(`src/messages/${locale}/internal.json`, 'utf8'));
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) break;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string' || node.trim() === '') {
    throw new Error(`src/messages/${locale}/internal.json has no non-empty string at "${key}"`);
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

/** Sets the language cookie the internal layout reads, before the first navigation. */
export async function setLocaleCookie(page: Page, locale: Locale, baseURL: string | undefined): Promise<void> {
  if (!baseURL) throw new Error('the project has no baseURL');
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: locale, url: baseURL }]);
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
