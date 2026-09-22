-- 0004_worker_heartbeat: the worker's liveness record (kickoff-package.md §8.3,
-- §8.4). Serves M2-AC01/2 (the internal page shows the background job health
-- read through the API) and prepares the M2-AC09/3 drain rehearsal (stopped_at).
--
-- Creates ops.worker_heartbeat, one row per worker instance:
-- - started_at / last_beat_at: written by the worker's interval beat, always
--   with the database clock (now()), never the process clock.
-- - last_queue_round_trip_at: written by the worker's pg-boss scheduled job;
--   NULL until the first round trip.
-- - image_ref: the image the worker runs (IMAGE_REF).
-- - stopped_at: set on a graceful stop; NULL while running.
-- - updated_at: stamped by ops.touch_updated_at() on every update.
-- The API derives stopped / stale / healthy / never seen from these on the
-- database clock; this table stores no state column.
--
-- Privileges: the worker may SELECT, INSERT and UPDATE (an upsert of its own
-- row), never DELETE or TRUNCATE; the API may SELECT only.

-- Up Migration

CREATE TABLE ops.worker_heartbeat (
  worker_id text PRIMARY KEY,
  started_at timestamptz NOT NULL,
  last_beat_at timestamptz NOT NULL,
  last_queue_round_trip_at timestamptz NULL,
  image_ref text NOT NULL,
  stopped_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER worker_heartbeat_touch_updated_at
  BEFORE UPDATE ON ops.worker_heartbeat
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON ops.worker_heartbeat TO wringy_worker;
GRANT SELECT ON ops.worker_heartbeat TO wringy_api;

-- Down Migration

DROP TABLE ops.worker_heartbeat;
