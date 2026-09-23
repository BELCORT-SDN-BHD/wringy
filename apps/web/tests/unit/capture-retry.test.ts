import { describe, expect, it } from 'vitest';

import {
  CAPTURE_ATTEMPTS,
  TRANSIENT_CAPTURE_FAILURE,
  isTransientCaptureFailure,
  retryTransientCapture,
} from '../e2e/capture-retry';

// The message Playwright surfaces for Chromium's empty surface copy (the pnpm e2e:internal failure).
const transient = () =>
  new Error(`page.screenshot: Protocol error (Page.captureScreenshot): ${TRANSIENT_CAPTURE_FAILURE}`);

/** A capture that fails with each error in turn, then returns `frame`. */
function captureFailing(errors: Error[], frame = 'frame') {
  const calls = { capture: 0, settle: 0 };
  const capture = async () => {
    calls.capture += 1;
    const error = errors[calls.capture - 1];
    if (error) throw error;
    return frame;
  };
  const settle = async () => {
    calls.settle += 1;
  };
  return { calls, capture, settle };
}

describe('M2-AC01 evidence frames survive Chromium\'s transient empty-surface failure', () => {
  it('M2-AC01 recognises only the Chromium empty-surface message', () => {
    expect(isTransientCaptureFailure(transient())).toBe(true);
    expect(isTransientCaptureFailure(new Error('page.screenshot: Target page, context or browser has been closed'))).toBe(
      false,
    );
    expect(isTransientCaptureFailure(TRANSIENT_CAPTURE_FAILURE)).toBe(false);
  });

  it('M2-AC01 retries the transient failure after letting the page present a frame, then returns the frame', async () => {
    const { calls, capture, settle } = captureFailing([transient()]);
    await expect(retryTransientCapture(capture, settle)).resolves.toBe('frame');
    expect(calls).toEqual({ capture: 2, settle: 1 });
  });

  it('M2-AC01 gives up after the bounded number of attempts and rethrows the last failure', async () => {
    const errors = Array.from({ length: CAPTURE_ATTEMPTS }, transient);
    const { calls, capture, settle } = captureFailing(errors);
    await expect(retryTransientCapture(capture, settle)).rejects.toBe(errors[CAPTURE_ATTEMPTS - 1]);
    expect(calls).toEqual({ capture: CAPTURE_ATTEMPTS, settle: CAPTURE_ATTEMPTS - 1 });
  });

  it('M2-AC01 rethrows any other capture error at once, without a retry', async () => {
    const closed = new Error('page.screenshot: Target page, context or browser has been closed');
    const { calls, capture, settle } = captureFailing([closed]);
    await expect(retryTransientCapture(capture, settle)).rejects.toBe(closed);
    expect(calls).toEqual({ capture: 1, settle: 0 });
  });
});
