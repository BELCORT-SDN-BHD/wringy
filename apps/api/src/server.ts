/**
 * Process start for the API: pool, app, the environment check, listen.
 *
 * The API refuses to start unless the database's environment marker
 * (ops.environment.name) equals WRINGY_ENV (kickoff-package.md §8.5,
 * Implementation Decision 5), so a local process can never serve a staging or
 * production database by a mis-set URL. While the database is still coming up
 * (pnpm dev starts everything at once, §8.8) it retries with backoff.
 */
import type { FastifyBaseLogger } from 'fastify';

import type { ApiEnv, WringyEnv } from '@wringy/config';
import { EnvironmentTableMissingError, readEnvironment, type Pool } from '@wringy/db';

import { buildApp, type ApiApp, type BuildAppOptions } from './app';
import { createApiPool, isDatabaseUnavailable, sqlStateOf, withDatabase } from './database';

/** The API was pointed at a database that belongs to another environment, or at one with no marker. */
export class EnvironmentRefusedError extends Error {
  override readonly name = 'EnvironmentRefusedError';
}

export interface RetryPolicy {
  /** Attempts in total, the first included. */
  attempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

/** About 45 s in total before giving up: long enough for `pnpm dev` to bring the database up. */
export const STARTUP_RETRY: RetryPolicy = { attempts: 8, initialDelayMs: 500, maxDelayMs: 8_000 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads ops.environment as the runtime role and throws EnvironmentRefusedError
 * unless its single row names `expected`. Only "database unavailable" errors are
 * retried; a mismatch, a missing marker or a permission error fails at once.
 */
export async function verifyEnvironment(
  pool: Pool,
  expected: WringyEnv,
  log: FastifyBaseLogger,
  retry: RetryPolicy = STARTUP_RETRY,
): Promise<void> {
  let delay = retry.initialDelayMs;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const marker = await withDatabase(pool, (client) => readEnvironment(client));
      if (marker === null) {
        throw new EnvironmentRefusedError(
          `Refusing to start: the database has no ops.environment marker; WRINGY_ENV is "${expected}". Run pnpm db:env for this environment.`,
        );
      }
      if (marker.name !== expected) {
        throw new EnvironmentRefusedError(
          `Refusing to start: WRINGY_ENV is "${expected}" but the database is marked "${marker.name}" (ops.environment). ` +
            'Point DATABASE_URL at this environment\'s database.',
        );
      }
      log.info({ environment: marker.name, fixturesAllowed: marker.fixturesAllowed }, 'environment marker matches');
      return;
    } catch (error) {
      if (error instanceof EnvironmentTableMissingError) {
        throw new EnvironmentRefusedError(`Refusing to start: ${error.message}`);
      }
      if (!isDatabaseUnavailable(error) || attempt >= retry.attempts) throw error;
      log.warn(
        { attempt, attempts: retry.attempts, retryInMs: delay, code: sqlStateOf((error as Error).cause) ?? 'unknown' },
        'database not reachable yet; retrying',
      );
      await sleep(delay);
      delay = Math.min(delay * 2, retry.maxDelayMs);
    }
  }
}

export interface StartServerOptions extends Pick<BuildAppOptions, 'logStream' | 'expected'> {
  retry?: RetryPolicy;
}

export interface RunningServer {
  app: ApiApp;
  pool: Pool;
  /** Stops accepting requests, waits for in-flight ones, then ends the pool. */
  close(): Promise<void>;
}

/**
 * Builds the app on a pool as the runtime login, checks the environment marker,
 * and listens on HOST:PORT. On any failure it logs one fatal line (scrubbed),
 * releases everything it opened and rethrows.
 */
export async function startServer(env: ApiEnv, options: StartServerOptions = {}): Promise<RunningServer> {
  // The pool reports idle-connection errors to the app's logger, which exists once the app does.
  const logger: { current?: FastifyBaseLogger } = {};
  const pool = createApiPool(env.DATABASE_URL, (error) => {
    logger.current?.warn({ err: error }, 'idle database connection failed');
  });
  const running = buildApp({ pool, logLevel: env.LOG_LEVEL, logStream: options.logStream, expected: options.expected });
  logger.current = running.log;

  const close = async () => {
    try {
      await running.close();
    } finally {
      await pool.end();
    }
  };

  try {
    await verifyEnvironment(pool, env.WRINGY_ENV, running.log, options.retry);
    await running.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    running.log.fatal({ err: error }, error instanceof Error ? error.message : 'startup failed');
    await close();
    throw error;
  }

  return { app: running, pool, close };
}
