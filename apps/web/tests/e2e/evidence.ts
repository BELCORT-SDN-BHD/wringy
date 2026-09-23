/**
 * Evidence screenshots for the acceptance records, opt-in.
 *
 * The acceptance records cite tracked PNGs (docs/m1-prototype/screenshots for
 * M1, docs/m2-internal/screenshots for the M2 internal suite). Writing them on
 * every run would dirty the working tree after an ordinary test run, so a run
 * writes the tracked copies only when WRINGY_EVIDENCE_SHOTS=1:
 *
 *   WRINGY_EVIDENCE_SHOTS=1 pnpm e2e            # refresh docs/m1-prototype/screenshots
 *   WRINGY_EVIDENCE_SHOTS=1 pnpm e2e:internal   # refresh docs/m2-internal/screenshots
 *
 * Otherwise the same frames go to the gitignored tests/e2e/__screenshots__/evidence/,
 * so the capture code still runs (and the size budget is still enforced) on
 * every run. Paths are relative to apps/web, the directory Playwright runs in.
 *
 * This module imports nothing from the demo, so the internal suite can use it.
 */
import { expect, type Page, type PageScreenshotOptions } from '@playwright/test';

import { retryTransientCapture } from './capture-retry';

/** Tracked evidence of the M1 prototype (docs/m1-prototype/acceptance-record.md). */
export const M1_EVIDENCE_DIR = '../../docs/m1-prototype/screenshots';

/** Tracked evidence of the M2 internal build (kickoff-package.md §6.4). */
export const M2_INTERNAL_EVIDENCE_DIR = '../../docs/m2-internal/screenshots';

/** Where frames go when the evidence flag is off (gitignored). */
export const UNTRACKED_EVIDENCE_DIR = 'tests/e2e/__screenshots__/evidence';

/** 300 KB per file, so the tracked evidence stays reviewable in a diff. */
export const EVIDENCE_SHOT_MAX_BYTES = 300 * 1024;

export function evidenceShotsEnabled(): boolean {
  return process.env.WRINGY_EVIDENCE_SHOTS === '1';
}

/** The path a frame named `file` is written to under `trackedDir`, honouring the flag. */
export function evidencePath(trackedDir: string, file: string): string {
  return `${evidenceShotsEnabled() ? trackedDir : UNTRACKED_EVIDENCE_DIR}/${file}`;
}

/** Two animation frames: long enough for the page to present a new frame. */
async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

/**
 * `page.screenshot`, retried only on Chromium's transient empty-surface failure
 * (capture-retry.ts). Every evidence frame of both suites is taken through it.
 */
export function captureFrame(page: Page, options: PageScreenshotOptions): Promise<Buffer> {
  return retryTransientCapture(
    () => page.screenshot(options),
    () => nextFrame(page),
  );
}

export interface EvidenceShotOptions {
  /** Finish CSS animations first (Playwright's `animations: 'disabled'`). */
  animations?: 'disabled' | 'allow';
}

/**
 * Writes one viewport-clipped frame, never `fullPage`, and holds it to the
 * size budget. Returns the path written.
 */
export async function evidenceShot(
  page: Page,
  trackedDir: string,
  file: string,
  { animations = 'allow' }: EvidenceShotOptions = {},
): Promise<string> {
  const path = evidencePath(trackedDir, file);
  const buffer = await captureFrame(page, { path, fullPage: false, animations });
  expect(
    buffer.byteLength,
    `${file} is ${Math.round(buffer.byteLength / 1024)} KB, over the ${EVIDENCE_SHOT_MAX_BYTES / 1024} KB budget`,
  ).toBeLessThanOrEqual(EVIDENCE_SHOT_MAX_BYTES);
  return path;
}
