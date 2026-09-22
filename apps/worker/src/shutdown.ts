/**
 * Turns SIGTERM / SIGINT into one graceful stop, then exits (kickoff-package.md
 * §8.3, §8.9 "drains on SIGTERM"; M2-AC09/3 rehearses it).
 *
 * - The first request runs `stop` once; its outcome sets the exit code (0 when
 *   the worker drained and marked itself stopped, 1 otherwise).
 * - A later request while stopping is logged and ignored; `forceExitAfterMs`
 *   bounds the whole stop, so a hung drain still ends the process (exit 1).
 * - A parent process may also send the IPC message `shutdown`. Windows has no
 *   POSIX signals (Node's `subprocess.kill()` there always terminates
 *   abruptly), so this is how a local test or script on Windows reaches the
 *   same graceful path that SIGTERM takes on Linux.
 */
import type { Logger } from './logger';

export type ShutdownSignal = 'SIGTERM' | 'SIGINT';
export type ShutdownReason = ShutdownSignal | 'ipc';

/** The slice of `process` this needs, so tests can pass an EventEmitter. */
export interface ShutdownProcess {
  on(event: ShutdownSignal, listener: () => void): unknown;
  on(event: 'message', listener: (message: unknown) => void): unknown;
}

export interface InstallShutdownOptions {
  logger: Logger;
  /** Ends the process; `process.exit` in main.ts. */
  exit: (code: number) => void;
  /** Hard deadline for `stop`, after which the process exits 1 regardless. */
  forceExitAfterMs: number;
}

export function isShutdownMessage(message: unknown): boolean {
  return (
    message === 'shutdown' ||
    (typeof message === 'object' && message !== null && (message as { cmd?: unknown }).cmd === 'shutdown')
  );
}

export function installShutdown(
  proc: ShutdownProcess,
  stop: () => Promise<void>,
  { logger, exit, forceExitAfterMs }: InstallShutdownOptions,
): { request(reason: ShutdownReason): Promise<void> } {
  let running: Promise<void> | undefined;

  function request(reason: ShutdownReason): Promise<void> {
    if (running !== undefined) {
      logger.warn({ reason }, 'shutdown already in progress; ignoring');
      return running;
    }
    logger.info({ reason }, 'shutdown requested');
    const deadline = setTimeout(() => {
      logger.error({ forceExitAfterMs }, 'shutdown did not finish in time; exiting');
      exit(1);
    }, forceExitAfterMs);
    deadline.unref?.();

    running = stop().then(
      () => {
        clearTimeout(deadline);
        logger.info('shutdown complete');
        exit(0);
      },
      (error: unknown) => {
        clearTimeout(deadline);
        logger.error({ err: error }, 'shutdown failed');
        exit(1);
      },
    );
    return running;
  }

  proc.on('SIGTERM', () => void request('SIGTERM'));
  proc.on('SIGINT', () => void request('SIGINT'));
  proc.on('message', (message) => {
    if (isShutdownMessage(message)) void request('ipc');
  });

  return { request };
}
