/**
 * The worker's two heartbeats (kickoff-package.md §8.3 "Worker").
 *
 * - Beat A, the process beat: every BEAT_INTERVAL_MS the worker upserts its own
 *   row in ops.worker_heartbeat, which shows the process is alive.
 * - Beat B, the queue round trip: pg-boss creates a `system.heartbeat` job every
 *   minute from a cron schedule, and this worker's handler stamps
 *   last_queue_round_trip_at, which shows the queue path is alive.
 *
 * Two beats catch a worker that is stuck without throwing: the process beat can
 * keep going while the queue path is dead, and the other way round.
 *
 * Every timestamp comes from the DATABASE clock (`now()`). No statement here
 * takes a time value from the process: the API derives healthy / stale / stopped
 * on the database clock as well, so the two never disagree about skew.
 */

/** The pg-boss queue that carries the round-trip job. */
export const HEARTBEAT_QUEUE = 'system.heartbeat';

/** Every minute: pg-boss evaluates cron schedules at minute precision (scheduling.md). */
export const HEARTBEAT_CRON = '* * * * *';

/**
 * Operational cadence of the process beat. The API calls a worker stale after
 * 45 s without a beat, i.e. three missed beats (M2-01 shared SQL contract).
 */
export const BEAT_INTERVAL_MS = 15_000;

/** A parameterised statement for `pg`. Values never include a timestamp. */
export interface Statement {
  text: string;
  values: string[];
}

export interface BeatIdentity {
  /** WORKER_ID: the row's primary key. */
  workerId: string;
  /** IMAGE_REF: the image this process runs. */
  imageRef: string;
}

/**
 * Beat A as one upsert. The first beat of a process (`first`) also resets
 * started_at, so a restarted worker that keeps its WORKER_ID shows when THIS
 * process started; later beats leave started_at alone. Every beat clears
 * stopped_at: a running process is not stopped.
 */
export function beatStatement({ workerId, imageRef }: BeatIdentity, { first }: { first: boolean }): Statement {
  const onConflict = first
    ? 'started_at = now(), last_beat_at = now(), image_ref = EXCLUDED.image_ref, stopped_at = NULL'
    : 'last_beat_at = now(), image_ref = EXCLUDED.image_ref, stopped_at = NULL';
  return {
    text:
      'INSERT INTO ops.worker_heartbeat (worker_id, started_at, last_beat_at, image_ref, stopped_at) ' +
      'VALUES ($1, now(), now(), $2, NULL) ' +
      `ON CONFLICT (worker_id) DO UPDATE SET ${onConflict} ` +
      'RETURNING last_beat_at',
    values: [workerId, imageRef],
  };
}

/**
 * Beat B: the round-trip handler stamps this worker's own row. The row exists
 * because start() runs the first process beat before it registers the handler.
 */
export function roundTripStatement(workerId: string): Statement {
  return {
    text:
      'UPDATE ops.worker_heartbeat SET last_queue_round_trip_at = now() ' +
      'WHERE worker_id = $1 RETURNING last_queue_round_trip_at',
    values: [workerId],
  };
}

/**
 * The last write of a graceful stop. The API reports `stopped` while
 * stopped_at >= last_beat_at, so this runs only after the process beat has
 * stopped and any beat in flight has finished.
 */
export function stoppedStatement(workerId: string): Statement {
  return {
    text: 'UPDATE ops.worker_heartbeat SET stopped_at = now() WHERE worker_id = $1 RETURNING stopped_at',
    values: [workerId],
  };
}
