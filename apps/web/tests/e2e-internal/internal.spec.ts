/**
 * M2-AC01: the internal build's narrow loop, end to end, on real servers
 * (playwright.internal.config.ts): the browser loads /internal from `next
 * start`, whose Server Component calls the real Fastify API, which reads the
 * real PostgreSQL 17 database migrated from zero and seeded with the fixture
 * campaigns; the real worker beats into it. Nothing is mocked.
 *
 * Runs in the `mobile` (390), `desktop` (1440) and `small` (320) projects.
 * Titles carry `M2-AC01/2` where they prove that sub-item: the
 * page → Fastify → PostgreSQL read.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  COPY,
  E2E_IMAGE_REF,
  E2E_WORKER_ID,
  LOCALES,
  SEEDED_CAMPAIGNS,
  expectNoHorizontalScroll,
  internalShot,
  sql,
  setLocaleCookie,
  watchConsole,
} from './support';

const BANNER = '内部版本 · Internal build · Versi dalaman';
/** The demo store's localStorage key (src/store/persistence.ts); the internal build must never write it. */
const DEMO_STORAGE_KEY = 'wringy-demo-v1';
/** Every explicit failure state the page can show. */
const FAILURE_STATES = '[data-app-state="api-unreachable"], [data-app-state="api-unavailable"], [data-app-state="unexpected"], [data-app-state="not-configured"]';

async function openInternal(page: Page): Promise<void> {
  const response = await page.goto('/internal');
  expect(response?.status(), '/internal answers 200').toBe(200);
}

/** Upserts one heartbeat row as the worker login, with instants relative to the database clock. */
async function arrangeWorker(
  workerId: string,
  { lastBeatAgo, stoppedAgo = null, roundTripAgo = null }: { lastBeatAgo: string; stoppedAgo?: string | null; roundTripAgo?: string | null },
): Promise<void> {
  await sql(
    'worker',
    `INSERT INTO ops.worker_heartbeat (worker_id, started_at, last_beat_at, last_queue_round_trip_at, image_ref, stopped_at)
     VALUES ($1, now() - interval '10 minutes', now() - $2::interval, now() - $3::interval, $4, now() - $5::interval)
     ON CONFLICT (worker_id) DO UPDATE
       SET last_beat_at = EXCLUDED.last_beat_at,
           last_queue_round_trip_at = EXCLUDED.last_queue_round_trip_at,
           stopped_at = EXCLUDED.stopped_at`,
    [workerId, lastBeatAgo, roundTripAgo, 'local/e2e-arranged', stoppedAgo],
  );
}

test.describe('M2-AC01 internal build: /internal on the real API, worker and database', () => {
  for (const locale of LOCALES) {
    test(`M2-AC01/2 cold start: /internal lists the three seeded fixture campaigns read through Fastify from PostgreSQL (${locale})`, async ({
      page,
      baseURL,
    }) => {
      const problems = watchConsole(page);
      await setLocaleCookie(page, locale, baseURL);
      await openInternal(page);

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('[data-app-banner="internal-build"]')).toHaveText(BANNER);
      await expect(page.locator(FAILURE_STATES)).toHaveCount(0);

      const section = page.locator('[data-internal-section="campaigns"]');
      await expect(section.locator('tr[data-campaign-id]')).toHaveCount(SEEDED_CAMPAIGNS.length);

      // The instants on the page are the database's own: each row's updated_at, read as the migrator.
      const updated = await sql<{ id: string; updated_at: Date }>(
        'migrator',
        "SELECT id, updated_at FROM app.campaigns WHERE data_origin = 'fixture'",
      );
      for (const campaign of SEEDED_CAMPAIGNS) {
        const row = section.locator(`tr[data-campaign-id="${campaign.id}"]`);
        await expect(row.locator('[data-field="title"]')).toHaveText(campaign.title);
        await expect(row.locator('[data-field="org"]')).toHaveText(campaign.orgName);
        await expect(row.locator('[data-state-kind="campaign-status"]')).toHaveText(COPY[locale][campaign.status]);
        const origin = row.locator('[data-state-kind="data-origin"]');
        await expect(origin).toHaveAttribute('data-state-code', 'fixture');
        await expect(origin).toHaveText(COPY[locale].fixture);
        const time = row.locator('time');
        await expect(time).toContainText('(UTC+08:00)');
        const iso = updated.find((entry) => entry.id === campaign.id)?.updated_at.toISOString();
        expect(iso, `${campaign.id} is in the database`).toBeDefined();
        await expect(time).toHaveAttribute('datetime', iso!);
      }
      await expect(section.locator('[data-data-as-of="campaigns"]')).toContainText('(UTC+08:00)');

      if (locale === 'en-MY') await internalShot(page, 'cold-start');
      expect(problems).toEqual([]);
    });
  }

  test('M2-AC01/2 worker health: the running worker reports healthy within 30 s and the queue round trip becomes ok or is shown as unknown, never 0', async ({
    page,
    baseURL,
  }, testInfo) => {
    await setLocaleCookie(page, 'en-MY', baseURL);
    const card = page.locator(`[data-worker-id="${E2E_WORKER_ID}"]`);

    await expect
      .poll(
        async () => {
          await openInternal(page);
          return card.getAttribute('data-worker-state', { timeout: 2_000 }).catch(() => null);
        },
        { timeout: 30_000, intervals: [1_000, 2_000, 3_000] },
      )
      .toBe('healthy');

    await expect(card.locator('[data-state-kind="process"]')).toHaveText('Process: Healthy');
    await expect(card.locator('[data-field="image-ref"]')).toHaveText(E2E_IMAGE_REF);

    const queueState = await card.getAttribute('data-queue-state');
    expect(['ok', 'never']).toContain(queueState);
    const roundTrip = card.locator('[data-field="last-round-trip"]');
    if (queueState === 'ok') {
      await expect(card.locator('[data-state-kind="queue"]')).toHaveText('Queue: Round trip OK');
      await expect(roundTrip.locator('time')).toContainText('(UTC+08:00)');
    } else {
      // No round trip yet (the schedule fires once a minute): unknown, not zero.
      await expect(card.locator('[data-state-kind="queue"]')).toHaveText('Queue: Unknown');
      await expect(roundTrip).toHaveText('Unknown');
    }

    // No field of the card pretends to a value with a zero or a dash.
    for (const text of await card.locator('dd, [data-state-kind]').allInnerTexts()) {
      expect(text.trim()).not.toMatch(/^(0|-|—|–)$/);
      expect(text).not.toMatch(/:\s*0$/);
    }
    await expect(page.locator('[data-data-as-of="workers"]')).toContainText('(UTC+08:00)');

    if (testInfo.project.name !== 'small') {
      await card.scrollIntoViewIfNeeded();
      await internalShot(page, 'worker-health');
    }
  });

  test('M2-AC01 a worker whose beat is overdue shows stale', async ({ page, baseURL }, testInfo) => {
    const workerId = `e2e-stale-${testInfo.project.name}`;
    await arrangeWorker(workerId, { lastBeatAgo: '2 minutes', roundTripAgo: '5 minutes' });

    await setLocaleCookie(page, 'en-MY', baseURL);
    await openInternal(page);

    const card = page.locator(`[data-worker-id="${workerId}"]`);
    await expect(card).toHaveAttribute('data-worker-state', 'stale');
    await expect(card.locator('[data-state-kind="process"]')).toHaveText('Process: Stale');
    await expect(card).toHaveAttribute('data-queue-state', 'overdue');
    await expect(card.locator('[data-state-kind="queue"]')).toHaveText('Queue: Round trip overdue');
    // The real worker beside it is unaffected.
    await expect(page.locator(`[data-worker-id="${E2E_WORKER_ID}"]`)).toHaveAttribute('data-worker-state', 'healthy');

    if (testInfo.project.name === 'desktop') {
      await card.scrollIntoViewIfNeeded();
      await internalShot(page, 'worker-stale');
    }
  });

  test('M2-AC01 a worker that recorded a clean stop shows stopped', async ({ page, baseURL }, testInfo) => {
    const workerId = `e2e-stopped-${testInfo.project.name}`;
    await arrangeWorker(workerId, { lastBeatAgo: '60 seconds', stoppedAgo: '50 seconds' });

    await setLocaleCookie(page, 'zh-Hans-MY', baseURL);
    await openInternal(page);

    const card = page.locator(`[data-worker-id="${workerId}"]`);
    await expect(card).toHaveAttribute('data-worker-state', 'stopped');
    await expect(card.locator('[data-state-kind="process"]')).toHaveText(`进程：${COPY['zh-Hans-MY'].stopped}`);
    // It never completed a queue round trip: unknown, never 0.
    await expect(card).toHaveAttribute('data-queue-state', 'never');
    await expect(card.locator('[data-state-kind="queue"]')).toHaveText(`队列：${COPY['zh-Hans-MY'].unknown}`);
    await expect(card.locator('[data-field="last-round-trip"]')).toHaveText(COPY['zh-Hans-MY'].unknown);
  });

  test('M2-AC01 /internal never mounts the demo store', async ({ page, baseURL }) => {
    const problems = watchConsole(page);
    await setLocaleCookie(page, 'en-MY', baseURL);
    await openInternal(page);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('demo-toolbar-trigger')).toHaveCount(0);
    await expect(page.getByTestId('locale-prompt')).toHaveCount(0);
    await expect(page.getByTestId('demo-badge')).toHaveCount(0);
    expect(await page.evaluate((key) => window.localStorage.getItem(key), DEMO_STORAGE_KEY)).toBeNull();
    expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
    expect(problems).toEqual([]);
  });

  test('M2-AC01 /internal at 320 px has no horizontal scroll and the campaigns and worker card are reachable', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'small', 'the 320 px spot check runs in the small project');

    for (const locale of LOCALES) {
      await setLocaleCookie(page, locale, baseURL);
      await openInternal(page);
      await expectNoHorizontalScroll(page);

      const section = page.locator('[data-internal-section="campaigns"]');
      const firstTitle = section.locator('[data-field="title"]').first();
      await firstTitle.scrollIntoViewIfNeeded();
      await expect(firstTitle).toBeInViewport();

      // The table may scroll sideways inside its own container, never the page.
      const container = section.locator('[data-slot="table-container"]');
      expect(await container.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto');
      const lastCell = section.locator('tr[data-campaign-id] td').last();
      await lastCell.scrollIntoViewIfNeeded();
      await expect(lastCell).toBeInViewport();
      await expectNoHorizontalScroll(page);

      const card = page.locator(`[data-worker-id="${E2E_WORKER_ID}"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('[data-state-kind="process"]')).toBeInViewport();
      await expect(card.locator('[data-field="image-ref"]')).toBeVisible();
      await expectNoHorizontalScroll(page);

      // The cold-start test files cold-start-320.png; this one files the worker card at 320.
      if (locale === 'en-MY') await internalShot(page, 'worker-health');
    }
  });

  test('M2-AC01 an unmatched /internal path renders the internal not-found inside the internal layout', async ({
    page,
    baseURL,
  }, testInfo) => {
    const problems = watchConsole(page);
    await setLocaleCookie(page, 'ms-MY', baseURL);
    const response = await page.goto('/internal/no-such-page');
    expect(response?.status()).toBe(404);

    await expect(page.locator('html')).toHaveAttribute('lang', 'ms-MY');
    await expect(page.locator('[data-app-banner="internal-build"]')).toHaveText(BANNER);
    const notFound = page.locator('[data-app-state="not-found"]');
    await expect(notFound).toContainText('Halaman tidak ditemui');
    await expect(notFound.getByRole('link', { name: 'Kembali ke versi dalaman' })).toHaveAttribute('href', '/internal');
    await expect(page.getByTestId('demo-toolbar-trigger')).toHaveCount(0);
    expect(await page.evaluate((key) => window.localStorage.getItem(key), DEMO_STORAGE_KEY)).toBeNull();
    await expectNoHorizontalScroll(page);

    if (testInfo.project.name !== 'small') await internalShot(page, 'internal-not-found');
    // Next logs nothing for an expected not-found; anything else here is a real error.
    expect(problems.filter((problem) => !problem.includes('404'))).toEqual([]);
  });

  test('M2-AC01 an unmatched URL outside /internal renders the not-found page inside the demo root layout', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for the routing check');
    await setLocaleCookie(page, 'en-MY', baseURL);
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-MY');
    await expect(page.getByText('This page could not be found.')).toBeVisible();
    expect(await page.evaluate(() => document.styleSheets.length)).toBeGreaterThan(0);
    await expect(page.locator('[data-app-banner="internal-build"]')).toHaveCount(0);
    // The demo root layout is the one around it: its demo tools are mounted.
    await expect(page.getByTestId('demo-toolbar-trigger')).toBeVisible();
  });
});
