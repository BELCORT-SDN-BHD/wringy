/**
 * Worker liveness as the internal health card shows it (kickoff-package.md §8.3).
 *
 * The two numbers below are OPERATIONAL constants of the heartbeat protocol, not
 * business rules: the worker upserts ops.worker_heartbeat every 15 s, and the API
 * calls a worker stale once three beats in a row are missing. Business defaults
 * (rates, thresholds, durations) live only in
 * phase-0/foundation/campaign-defaults-v1.md and never in code.
 */
import type { WorkerState } from '@wringy/contracts';

/** How often the worker's interval beat writes last_beat_at (the worker owns the timer). */
export const WORKER_BEAT_INTERVAL_SECONDS = 15;

/** A worker whose last beat is older than this, on the database clock, is stale. */
export const WORKER_STALE_AFTER_SECONDS = 45;

export interface HeartbeatTimes {
  /** ops.worker_heartbeat.last_beat_at; null only for a worker registered without a beat. */
  lastBeatAt: Date | null;
  /** ops.worker_heartbeat.stopped_at; set by a graceful stop, cleared by the next start. */
  stoppedAt: Date | null;
}

/**
 * The state of one worker row, judged against `dbNow`, which must be the database
 * clock read in the same query (never the API host's clock):
 *
 * - `never_seen`: no beat recorded yet;
 * - `stopped`: a graceful stop was recorded at or after the last beat;
 * - `stale`: the last beat is more than WORKER_STALE_AFTER_SECONDS old;
 * - `healthy`: otherwise.
 *
 * A worker with no row at all is not judged here: the response then has
 * `workers: []` and the page shows the state as unknown.
 */
export function computeWorkerState({ lastBeatAt, stoppedAt }: HeartbeatTimes, dbNow: Date): WorkerState {
  if (lastBeatAt === null) return 'never_seen';
  if (stoppedAt !== null && stoppedAt.getTime() >= lastBeatAt.getTime()) return 'stopped';
  if (dbNow.getTime() - lastBeatAt.getTime() > WORKER_STALE_AFTER_SECONDS * 1000) return 'stale';
  return 'healthy';
}
