/**
 * The worker heartbeat protocol's OPERATIONAL constants (kickoff-package.md
 * §8.3 "Worker"), in the one package both apps/worker and apps/api may import
 * under the dependency rules (.dependency-cruiser.cjs): the worker writes on
 * this cadence and the API judges staleness with these thresholds, so the two
 * can never drift apart.
 *
 * They describe how the system watches its own processes. They are not
 * business rules: rates, thresholds, durations and rounding for campaigns live
 * only in phase-0/foundation/campaign-defaults-v1.md and never in code.
 */

/** How often the worker's process beat (Beat A) writes last_beat_at. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * A worker whose last process beat is older than this on the DATABASE clock is
 * `stale`: three beats in a row are missing.
 */
export const STALE_AFTER_MS = 45_000;

/**
 * The queue round trip (Beat B, a pg-boss job scheduled every minute) is
 * `overdue` once the last one is older than this on the database clock: three
 * one-minute schedules in a row produced no round trip.
 */
export const QUEUE_OVERDUE_AFTER_MS = 180_000;
