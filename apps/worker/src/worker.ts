/**
 * The worker's lifecycle (kickoff-package.md §8.3 "Worker", §8.5; M2-01).
 *
 * `createWorker()` takes an already-built pg-boss instance and pool, so the
 * integration tests drive the real thing against a cloned database without
 * waiting a minute for cron: `beatOnce()` runs one process beat and
 * `triggerRoundTrip()` sends one `system.heartbeat` job and resolves when this
 * worker's handler has stamped it.
 *
 * start():
 * 1. Refuses unless ops.environment names WRINGY_ENV (Implementation Decision 5).
 * 2. Starts pg-boss with `migrate: false`, which refuses a missing or
 *    out-of-date pgboss schema (see boss.ts).
 * 3. Creates the `system.heartbeat` queue with `partition: false` if absent
 *    (pg-boss's create_queue() is an INSERT … ON CONFLICT DO NOTHING, so this is
 *    DML under the 0005 grants), runs the first process beat, registers the
 *    round-trip handler, schedules the job every minute, and starts the beat
 *    interval.
 *
 * stop() (SIGTERM / SIGINT in main.ts): stops the beat interval, then at once
 * stops pg-boss gracefully (running jobs may finish within the drain timeout;
 * pg-boss fails whatever is still active after it) while a beat in flight
 * settles, so a beat held up by the database never delays the drain; the beat
 * is bounded by the worker pool's statement and query timeouts
 * (connections.ts). Once both are done it sets stopped_at, so a late beat
 * cannot clear it. The caller ends the pool.
 */
import type { PgBoss, Job } from 'pg-boss';

import type { WringyEnv } from '@wringy/config';
import { EnvironmentTableMissingError, HEARTBEAT_INTERVAL_MS, readEnvironment, type Pool } from '@wringy/db';

import { isPgBossSchemaRefusal } from './connections';
import { INITIAL_BEAT_STATE, nextBeatState, type BeatState } from './jobs/beat-state';
import {
  HEARTBEAT_CRON,
  HEARTBEAT_QUEUE,
  beatStatement,
  roundTripStatement,
  stoppedStatement,
} from './jobs/heartbeat';
import type { Logger } from './logger';

/** How long a graceful stop lets a running job finish before pg-boss fails it. */
export const DRAIN_TIMEOUT_MS = 20_000;

/** pg-boss's own default for work() (workers.md: "1 job every 2 seconds"). */
export const POLLING_INTERVAL_SECONDS = 2;

export type StartupRefusal = 'environment_unmarked' | 'environment_mismatch' | 'pgboss_schema';

/** A refusal to start that names what is wrong and never a secret. */
export class WorkerStartupError extends Error {
  override readonly name = 'WorkerStartupError';
  constructor(
    readonly reason: StartupRefusal,
    message: string,
  ) {
    super(message);
  }
}

export type WorkerStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';

export interface CreateWorkerOptions {
  boss: PgBoss;
  /** The worker login's pool (application_name wringy-worker). The caller owns and ends it. */
  pool: Pool;
  workerId: string;
  imageRef: string;
  wringyEnv: WringyEnv;
  logger: Logger;
  beatIntervalMs?: number;
  drainTimeoutMs?: number;
  pollingIntervalSeconds?: number;
  /** How long triggerRoundTrip() waits for the handler. */
  roundTripTimeoutMs?: number;
}

export interface Worker {
  start(): Promise<void>;
  /** Idempotent: a second call returns the first call's promise. */
  stop(): Promise<void>;
  /** One process beat now; resolves with last_beat_at as the database wrote it. */
  beatOnce(): Promise<Date>;
  /** Sends one system.heartbeat job; resolves with last_queue_round_trip_at once this worker handled it. */
  triggerRoundTrip(): Promise<Date>;
  readonly status: WorkerStatus;
  readonly beatState: BeatState;
}

/** The payload of a system.heartbeat job. Scheduled jobs carry none; a probe carries its token. */
interface HeartbeatJobData {
  probe?: string;
}

interface Waiter {
  resolve(at: Date): void;
  reject(error: Error): void;
}

export function createWorker(options: CreateWorkerOptions): Worker {
  const {
    boss,
    pool,
    workerId,
    imageRef,
    wringyEnv,
    beatIntervalMs = HEARTBEAT_INTERVAL_MS,
    drainTimeoutMs = DRAIN_TIMEOUT_MS,
    pollingIntervalSeconds = POLLING_INTERVAL_SECONDS,
    roundTripTimeoutMs = 30_000,
  } = options;
  const log = options.logger;
  const identity = { workerId, imageRef };

  let status: WorkerStatus = 'idle';
  let beatState: BeatState = INITIAL_BEAT_STATE;
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlightBeat: Promise<unknown> | undefined;
  let startPromise: Promise<void> | undefined;
  let stopPromise: Promise<void> | undefined;
  let bossStartAttempted = false;
  const waiters = new Map<string, Waiter>();
  let probeCounter = 0;

  boss.on('error', (error) => log.error({ err: error }, 'pg-boss error'));
  boss.on('warning', (warning) => log.warn({ warning }, 'pg-boss warning'));

  async function assertEnvironment(): Promise<void> {
    let marker;
    try {
      marker = await readEnvironment(pool);
    } catch (error) {
      if (error instanceof EnvironmentTableMissingError) {
        throw new WorkerStartupError(
          'environment_unmarked',
          'ops.environment does not exist in this database; run pnpm db:migrate and pnpm db:env first. Refusing to start.',
        );
      }
      throw error;
    }
    if (marker === null) {
      throw new WorkerStartupError(
        'environment_unmarked',
        'ops.environment holds no row; run pnpm db:env for this environment. Refusing to start.',
      );
    }
    if (marker.name !== wringyEnv) {
      throw new WorkerStartupError(
        'environment_mismatch',
        `This database is marked as environment "${marker.name}", but WRINGY_ENV is "${wringyEnv}". Refusing to start.`,
      );
    }
  }

  async function beatOnce(): Promise<Date> {
    const statement = beatStatement(identity, { first: beatState.beats === 0 });
    const run = pool.query<{ last_beat_at: Date }>(statement.text, statement.values);
    inFlightBeat = run;
    try {
      const { rows } = await run;
      const lastBeatAt = rows[0]!.last_beat_at;
      const next = nextBeatState(beatState, { ok: true, lastBeatAt });
      beatState = next.state;
      if (next.event === 'first') log.info({ lastBeatAt }, 'process beat: first beat written');
      else if (next.event === 'recovered') log.info({ lastBeatAt }, 'process beat: recovered');
      else log.debug({ lastBeatAt }, 'process beat');
      return lastBeatAt;
    } catch (error) {
      const next = nextBeatState(beatState, { ok: false });
      beatState = next.state;
      log.warn({ err: error, consecutiveFailures: beatState.consecutiveFailures }, 'process beat failed');
      throw error;
    } finally {
      if (inFlightBeat === run) inFlightBeat = undefined;
    }
  }

  function tick(): void {
    // A beat still waiting on the database is not doubled up; the next tick retries.
    if (inFlightBeat !== undefined || status !== 'running') return;
    beatOnce().catch(() => {
      // Logged in beatOnce; the interval keeps going.
    });
  }

  async function stampRoundTrip(): Promise<Date> {
    const statement = roundTripStatement(workerId);
    let result = await pool.query<{ last_queue_round_trip_at: Date }>(statement.text, statement.values);
    if (result.rows[0] === undefined) {
      // Our row is gone (only the migrator can delete it): write a beat, then stamp again.
      await beatOnce();
      result = await pool.query<{ last_queue_round_trip_at: Date }>(statement.text, statement.values);
    }
    return result.rows[0]!.last_queue_round_trip_at;
  }

  async function handleRoundTrip(jobs: Job<HeartbeatJobData | null>[]): Promise<void> {
    for (const job of jobs) {
      const at = await stampRoundTrip();
      log.debug({ jobId: job.id, lastQueueRoundTripAt: at }, 'queue round trip');
      const probe = job.data?.probe;
      if (probe !== undefined) {
        waiters.get(probe)?.resolve(at);
        waiters.delete(probe);
      }
    }
  }

  async function doStart(): Promise<void> {
    status = 'starting';
    await assertEnvironment();

    // Set before start(): a start() that refuses the schema has already opened pg-boss's pool.
    bossStartAttempted = true;
    try {
      await boss.start();
    } catch (error) {
      if (isPgBossSchemaRefusal(error)) {
        throw new WorkerStartupError(
          'pgboss_schema',
          `pg-boss refused schema pgboss: ${(error as Error).message}. The worker never migrates it (migrate: false); run pnpm db:migrate. Refusing to start.`,
        );
      }
      throw error;
    }

    await boss.createQueue(HEARTBEAT_QUEUE, { partition: false });
    await beatOnce();
    await boss.work<HeartbeatJobData | null>(
      HEARTBEAT_QUEUE,
      { pollingIntervalSeconds, batchSize: 1 },
      handleRoundTrip,
    );
    await boss.schedule(HEARTBEAT_QUEUE, HEARTBEAT_CRON);

    timer = setInterval(tick, beatIntervalMs);
    status = 'running';
    log.info(
      { queue: HEARTBEAT_QUEUE, cron: HEARTBEAT_CRON, beatIntervalMs, drainTimeoutMs },
      'worker started',
    );
  }

  function start(): Promise<void> {
    if (startPromise !== undefined) return startPromise;
    startPromise = doStart().catch(async (error: unknown) => {
      status = 'failed';
      if (bossStartAttempted) {
        await boss.stop({ graceful: false }).catch((stopError: unknown) => {
          log.warn({ err: stopError }, 'pg-boss stop after a failed start also failed');
        });
      }
      throw error;
    });
    return startPromise;
  }

  async function doStop(): Promise<void> {
    if (startPromise !== undefined) await startPromise.catch(() => {});
    status = 'stopping';
    log.info({ drainTimeoutMs }, 'worker stopping: draining');

    if (timer !== undefined) clearInterval(timer);
    timer = undefined;

    let drainError: unknown;
    // The drain starts now, alongside a beat still in flight, not after it: the beat is
    // bounded by the pool's timeouts, the drain by drainTimeoutMs, and neither waits on the other.
    const beatSettled = inFlightBeat === undefined ? Promise.resolve() : inFlightBeat.then(() => {}, () => {});
    const drained = boss
      // graceful: wait for running handlers up to `timeout` ms; close: end pg-boss's own pool (ops.md).
      .stop({ graceful: true, timeout: drainTimeoutMs, close: true })
      .catch((error: unknown) => {
        drainError = error;
        log.error({ err: error }, 'pg-boss did not stop cleanly');
      });
    await Promise.all([beatSettled, drained]);

    for (const [probe, waiter] of waiters) {
      waiter.reject(new Error('worker stopped before the round trip completed'));
      waiters.delete(probe);
    }

    // Only a process that wrote a beat marks the row: an earlier process's row is not ours to stop.
    if (beatState.beats > 0) {
      const statement = stoppedStatement(workerId);
      const { rows } = await pool.query<{ stopped_at: Date }>(statement.text, statement.values);
      log.info({ stoppedAt: rows[0]?.stopped_at ?? null }, 'worker stopped');
    } else {
      log.info('worker stopped before its first beat');
    }
    status = 'stopped';
    if (drainError !== undefined) throw drainError;
  }

  function stop(): Promise<void> {
    stopPromise ??= doStop();
    return stopPromise;
  }

  async function triggerRoundTrip(): Promise<Date> {
    if (status !== 'running') throw new Error(`worker is ${status}, not running`);
    probeCounter += 1;
    const probe = `${workerId}:${process.pid}:${probeCounter}`;
    const handled = new Promise<Date>((resolve, reject) => {
      waiters.set(probe, { resolve, reject });
    });
    // stop() may reject the waiter while send() is still in flight; the race below still sees it.
    handled.catch(() => {});
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        waiters.delete(probe);
        reject(new Error(`no round trip within ${roundTripTimeoutMs} ms`));
      }, roundTripTimeoutMs);
    });
    try {
      const jobId = await boss.send(HEARTBEAT_QUEUE, { probe } satisfies HeartbeatJobData);
      log.debug({ jobId }, 'round-trip probe sent');
      return await Promise.race([handled, timedOut]);
    } finally {
      clearTimeout(timeout);
      waiters.delete(probe);
    }
  }

  return {
    start,
    stop,
    beatOnce,
    triggerRoundTrip,
    get status() {
      return status;
    },
    get beatState() {
      return beatState;
    },
  };
}
