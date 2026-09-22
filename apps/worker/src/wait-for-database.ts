/**
 * Retries the first database connection with backoff (kickoff-package.md §8.8:
 * under `pnpm dev` the api and worker start alongside the database and retry
 * with backoff). Only a connection-level failure is retried; a refused login,
 * a missing database or any SQL error fails at once, because waiting cannot
 * fix it.
 */
import type { Pool } from '@wringy/db';

import type { Logger } from './logger';

const TRANSIENT_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  // PostgreSQL: cannot_connect_now (starting up or shutting down), admin_shutdown, crash_shutdown.
  '57P03',
  '57P01',
  '57P02',
]);

/** True for an error that a later attempt might not hit: the server is not reachable (yet). */
export function isTransientConnectionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true;
  // pg's pool when connectionTimeoutMillis elapses, and a socket closed mid-handshake.
  return (
    typeof message === 'string' &&
    (message.includes('timeout exceeded when trying to connect') ||
      message.includes('Connection terminated unexpectedly'))
  );
}

/** Delay before retry `attempt` (1-based): 0.5 s doubling, capped at 8 s. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(500 * 2 ** (attempt - 1), 8_000);
}

export interface WaitForDatabaseOptions {
  logger: Logger;
  /** Attempts in total, including the first (default 8: about 30 s of waiting). */
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitForDatabase(
  pool: Pool,
  { logger, attempts = 8, sleep = defaultSleep }: WaitForDatabaseOptions,
): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      if (attempt > 1) logger.info({ attempt }, 'database reachable');
      return;
    } catch (error) {
      if (!isTransientConnectionError(error) || attempt >= attempts) throw error;
      const delayMs = backoffDelayMs(attempt);
      logger.warn({ attempt, attempts, delayMs, code: (error as { code?: string }).code }, 'database not reachable; retrying');
      await sleep(delayMs);
    }
  }
}
