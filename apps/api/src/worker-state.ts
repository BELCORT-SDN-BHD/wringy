/**
 * Worker liveness as the internal health card shows it (kickoff-package.md §8.3).
 *
 * Two independent judgements per ops.worker_heartbeat row, both on the DATABASE
 * clock read in the same statement (never the API host's clock):
 *
 * - `state`, process liveness, from last_beat_at and stopped_at (Beat A);
 * - `queueState`, queue-path liveness, from last_queue_round_trip_at (Beat B).
 *
 * The thresholds are the heartbeat protocol's OPERATIONAL constants from
 * @wringy/db (packages/db/src/heartbeat.ts), the same ones the worker beats by.
 * Business defaults (rates, thresholds, durations) live only in
 * phase-0/foundation/campaign-defaults-v1.md and never in code.
 */
import type { QueueState, WorkerState } from '@wringy/contracts';
import { QUEUE_OVERDUE_AFTER_MS, STALE_AFTER_MS } from '@wringy/db';

export interface HeartbeatTimes {
  /** ops.worker_heartbeat.last_beat_at; null only for a worker registered without a beat. */
  lastBeatAt: Date | null;
  /** ops.worker_heartbeat.stopped_at; set by a graceful stop, cleared by the next start. */
  stoppedAt: Date | null;
}

/**
 * Process liveness of one worker row, judged against `dbNow`:
 *
 * - `never_seen`: no beat recorded yet;
 * - `stopped`: a graceful stop was recorded at or after the last beat;
 * - `stale`: the last beat is more than STALE_AFTER_MS old;
 * - `healthy`: otherwise.
 *
 * A worker with no row at all is not judged here: the response then has
 * `workers: []` and the page shows the state as unknown.
 */
export function computeWorkerState({ lastBeatAt, stoppedAt }: HeartbeatTimes, dbNow: Date): WorkerState {
  if (lastBeatAt === null) return 'never_seen';
  if (stoppedAt !== null && stoppedAt.getTime() >= lastBeatAt.getTime()) return 'stopped';
  if (dbNow.getTime() - lastBeatAt.getTime() > STALE_AFTER_MS) return 'stale';
  return 'healthy';
}

/**
 * Queue-path liveness of one worker row, judged against `dbNow`:
 *
 * - `never`: no pg-boss round trip has completed yet;
 * - `overdue`: the last round trip is more than QUEUE_OVERDUE_AFTER_MS old;
 * - `ok`: otherwise.
 *
 * Independent of `state`: a stopped worker's queue path is judged the same way.
 */
export function computeQueueState(lastQueueRoundTripAt: Date | null, dbNow: Date): QueueState {
  if (lastQueueRoundTripAt === null) return 'never';
  if (dbNow.getTime() - lastQueueRoundTripAt.getTime() > QUEUE_OVERDUE_AFTER_MS) return 'overdue';
  return 'ok';
}
