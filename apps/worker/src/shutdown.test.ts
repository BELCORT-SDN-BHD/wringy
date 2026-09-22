import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { createLogger } from './logger';
import { installShutdown, isShutdownMessage } from './shutdown';

const silent = createLogger({ level: 'silent', destination: { write: () => {} } });

function setup(stop: () => Promise<void>, forceExitAfterMs = 60_000) {
  const proc = new EventEmitter();
  const exit = vi.fn<(code: number) => void>();
  const handle = installShutdown(proc, stop, { logger: silent, exit, forceExitAfterMs });
  return { proc, exit, handle };
}

describe('M2-AC01 graceful shutdown wiring', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)('%s runs stop once and exits 0', async (signal) => {
    const stop = vi.fn(async () => {});
    const { proc, exit, handle } = setup(stop);
    proc.emit(signal);
    proc.emit(signal);
    await handle.request(signal);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('accepts the IPC shutdown message (the Windows path) and ignores other messages', async () => {
    const stop = vi.fn(async () => {});
    const { proc, exit, handle } = setup(stop);
    proc.emit('message', { cmd: 'other' });
    expect(stop).not.toHaveBeenCalled();
    proc.emit('message', 'shutdown');
    await handle.request('ipc');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(isShutdownMessage({ cmd: 'shutdown' })).toBe(true);
    expect(isShutdownMessage(null)).toBe(false);
  });

  it('exits 1 when the stop fails', async () => {
    const { proc, exit, handle } = setup(async () => {
      throw new Error('drain failed');
    });
    proc.emit('SIGTERM');
    await handle.request('SIGTERM');
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('exits 1 when the stop outlives its deadline', async () => {
    vi.useFakeTimers();
    try {
      const { proc, exit } = setup(() => new Promise<void>(() => {}), 5_000);
      proc.emit('SIGTERM');
      await vi.advanceTimersByTimeAsync(4_999);
      expect(exit).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
