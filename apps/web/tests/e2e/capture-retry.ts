/**
 * Retries Chromium's transient "Unable to capture screenshot" failure.
 *
 * Chromium answers Page.captureScreenshot with that error when the copy of the
 * compositor surface comes back empty (content/browser/devtools/protocol/
 * page_handler.cc, PageHandler::ScreenshotCaptured: `if (image.IsEmpty())`).
 * The copy is requested from a surface Chromium has just asked the renderer
 * to repaint (render_widget_host_impl.cc, GetSnapshotFromBrowser). Why the copy
 * came back empty is inside Chromium and not established here (unverified).
 * It is not the page: `pnpm e2e:internal` failed once this way in outage.spec.ts
 * on a page whose every assertion had just passed, 12 browsers and 5 servers
 * sharing the machine, and the same test passed on the next runs.
 *
 * Only that exact error is retried, a bounded number of times, after the page
 * has had a chance to present a new frame; any other error, and the last
 * failure, are rethrown unchanged. No Playwright import, so the unit test
 * (tests/unit/capture-retry.test.ts) runs under Vitest.
 */

/** The message Chromium's DevTools handler sends when the surface copy is empty. */
export const TRANSIENT_CAPTURE_FAILURE = 'Unable to capture screenshot';

/** Attempts per frame, the first included. Test-harness setting, not a product rule. */
export const CAPTURE_ATTEMPTS = 3;

export function isTransientCaptureFailure(error: unknown): boolean {
  return error instanceof Error && error.message.includes(TRANSIENT_CAPTURE_FAILURE);
}

/**
 * Runs `capture`; on the transient failure, awaits `settle` (let the page
 * present a frame) and tries again, up to `attempts` times in all.
 */
export async function retryTransientCapture<T>(
  capture: () => Promise<T>,
  settle: () => Promise<void>,
  attempts: number = CAPTURE_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await capture();
    } catch (error) {
      if (attempt >= attempts || !isTransientCaptureFailure(error)) throw error;
      await settle();
    }
  }
}
