/**
 * Shared set-up for the worker integration tests: a clone of the migrated
 * template (through the @wringy/db harness), the worker built exactly as
 * main.ts builds it (createBoss, createPool with the worker login), and a
 * migrator pool for arranging and inspecting state. Nothing is mocked: the
 * worker talks to a real PostgreSQL 17 as wringy_worker_login.
 */
import type { PgBoss } from 'pg-boss';

import type { WringyEnv } from '@wringy/config';
import { createPool, type Pool } from '@wringy/db';

import { TEST_WRINGY_ENV, createTestDatabase, type TestDatabase } from '../../../packages/db/test/harness';
import { createBoss, createWorkerPool } from '../src/connections';
import { createLogger, type Logger } from '../src/logger';
import { createWorker, type CreateWorkerOptions, type Worker } from '../src/worker';

export { TEST_WRINGY_ENV, createTestDatabase, type TestDatabase };

export interface LogCapture {
  logger: Logger;
  lines: string[];
  text(): string;
}

export function captureLogs(): LogCapture {
  const lines: string[] = [];
  const logger = createLogger({
    level: 'debug',
    base: { test: 'true' },
    destination: { write: (line: string) => void lines.push(line) },
  });
  return { logger, lines, text: () => lines.join('') };
}

export interface TestWorker {
  worker: Worker;
  /** The worker's pg-boss instance (createBoss, as main.ts builds it). */
  boss: PgBoss;
  /** The worker login's own pool, as main.ts builds it. */
  pool: Pool;
  logs: LogCapture;
  /** Stops the worker (if it still runs) and ends its pool. */
  dispose(): Promise<void>;
}

export function buildWorker(
  db: TestDatabase,
  overrides: Partial<Omit<CreateWorkerOptions, 'boss' | 'pool' | 'logger'>> & { workerId: string; wringyEnv?: WringyEnv },
): TestWorker {
  const logs = captureLogs();
  const pool = createWorkerPool(db.urls.worker);
  const boss = createBoss(db.urls.worker);
  const worker = createWorker({
    boss,
    pool,
    imageRef: 'ghcr.io/belcort-sdn-bhd/wringy-worker:test',
    wringyEnv: TEST_WRINGY_ENV,
    logger: logs.logger,
    ...overrides,
  });
  return {
    worker,
    boss,
    pool,
    logs,
    async dispose() {
      if (worker.status !== 'stopped') await worker.stop().catch(() => {});
      await pool.end();
    },
  };
}

/** A migrator pool on the clone, for arranging and reading state the worker may not touch. */
export function migratorPool(db: TestDatabase): Pool {
  return createPool({ connectionString: db.urls.migrator, applicationName: 'wringy-test-migrator', max: 3 });
}

export interface HeartbeatRow {
  worker_id: string;
  started_at: Date;
  last_beat_at: Date;
  last_queue_round_trip_at: Date | null;
  image_ref: string;
  stopped_at: Date | null;
}

export async function heartbeatRow(pool: Pool, workerId: string): Promise<HeartbeatRow | undefined> {
  const { rows } = await pool.query<HeartbeatRow>(
    `SELECT worker_id, started_at, last_beat_at, last_queue_round_trip_at, image_ref, stopped_at
       FROM ops.worker_heartbeat WHERE worker_id = $1`,
    [workerId],
  );
  return rows[0];
}

/** The database clock right now (clock_timestamp(), not the transaction start). */
export async function dbNow(pool: Pool): Promise<Date> {
  const { rows } = await pool.query<{ now: Date }>('SELECT clock_timestamp() AS now');
  return rows[0]!.now;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls `read` until `done` holds or `timeoutMs` passes; returns the last value read. */
export async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > deadline) return value;
    await sleep(100);
  }
}
