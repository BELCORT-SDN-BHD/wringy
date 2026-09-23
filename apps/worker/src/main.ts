/**
 * The worker process (kickoff-package.md §8.3, §8.5, §8.8, §8.9).
 *
 *   pnpm --filter worker dev     node --watch --import tsx, reads apps/worker/.env when present
 *   pnpm --filter worker start   node dist/main.js (after `build`)
 *
 * Exit codes: 0 after a graceful stop; 1 when the environment is invalid, the
 * database refuses the worker (wrong environment marker, pgboss schema missing
 * or behind), the database stays unreachable, or a stop fails. Every line on
 * stdout is JSON from pino; no line carries a connection string or password.
 */
import { EnvError } from '@wringy/config';
import { loadWorkerEnv } from '@wringy/config/worker';

import { createBoss, createWorkerPool } from './connections';
import { createLogger } from './logger';
import { installShutdown } from './shutdown';
import { waitForDatabase } from './wait-for-database';
import { DRAIN_TIMEOUT_MS, createWorker } from './worker';

/** Headroom above the drain timeout for the final stopped_at write and closing the pools. */
const SHUTDOWN_GRACE_MS = 10_000;

async function main(): Promise<void> {
  let env;
  try {
    env = loadWorkerEnv();
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    // EnvError names variables only (packages/config); nothing else from the environment is logged.
    createLogger({ level: 'info' }).fatal({ problems: error.problems }, error.message);
    process.exit(1);
  }

  const logger = createLogger({
    level: env.LOG_LEVEL,
    base: { workerId: env.WORKER_ID, imageRef: env.IMAGE_REF, wringyEnv: env.WRINGY_ENV },
  });

  const pool = createWorkerPool(env.DATABASE_URL, (error) =>
    logger.warn({ err: error }, 'idle database client error'),
  );
  const boss = createBoss(env.DATABASE_URL);
  const worker = createWorker({
    boss,
    pool,
    workerId: env.WORKER_ID,
    imageRef: env.IMAGE_REF,
    wringyEnv: env.WRINGY_ENV,
    logger,
  });

  installShutdown(
    process,
    async () => {
      try {
        await worker.stop();
      } finally {
        await pool.end();
      }
    },
    { logger, exit: (code) => process.exit(code), forceExitAfterMs: DRAIN_TIMEOUT_MS + SHUTDOWN_GRACE_MS },
  );

  try {
    await waitForDatabase(pool, { logger });
    await worker.start();
  } catch (error) {
    logger.fatal({ err: error }, 'worker refused to start');
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  createLogger({ level: 'info' }).fatal({ err: error }, 'worker crashed');
  process.exit(1);
});
