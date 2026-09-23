-- 0006_pgboss_runtime_bounds: keeps worker-writable pg-boss data out of the
-- migrator's DDL path, and gives the API the pg-boss schema version without any
-- access to schema pgboss (kickoff-package.md §4.11 "No `pgboss` access" and
-- §8.5 "no `pgboss`" for the API login; §8.3 GET /health compares the pg-boss
-- schema version as the runtime role). Serves M2-AC01/2 (migration and runtime
-- accounts are separated).
--
-- Why: `pnpm db:migrate` runs the pg-boss CLI as the migrator before
-- node-pg-migrate. The CLI (pg-boss 12.33.5, dist/cli.js cmdMigrate) reruns
-- every pg-boss migration newer than pgboss.version, and pastes
-- pgboss.queue.table_name, for rows with partition = true, unquoted into index
-- DDL (dist/migrationStore.js formatJobTable). 0005 gave the worker DML on every
-- pgboss table, so a worker session could rewind the version and plant a queue
-- row whose table_name carries DDL of its choosing, which the next migrate ran
-- as the schema owner. This migration closes both inputs at the database:
--
-- Worker (wringy_worker):
-- - pgboss.version: SELECT, and UPDATE only on the timestamps pg-boss stamps at
--   run time (cron_on, bam_on, flow_on, reindex_on, monitor_backoff_on:
--   dist/plans.js trySetTimestamp and setMonitorBackoff). No INSERT, no DELETE
--   and no UPDATE of `version`. A pg-boss upgrade that adds a column the
--   runtime stamps needs a migration granting it (the worker integration
--   tests fail first).
-- - pgboss.queue: a CHECK that every queue is unpartitioned and uses the
--   shared job table ('job_common', what create_queue() writes for
--   partition: false; dist/plans.js createQueueFunction). The product only
--   creates partition: false queues. With it, the CLI's partition fan-out is
--   always empty. installPgBossSchema() (src/pgboss.ts) also refuses to run the
--   CLI while such a row exists, for a database migrated before this file.
--
-- API (wringy_api): ops.pgboss_schema_version, a view owned by the migrator
-- that reads pgboss.version with the owner's rights, and an aggregate, so it is
-- not automatically updatable. The API gets SELECT on it; its USAGE on schema
-- pgboss and its SELECT on pgboss.version (0005) are revoked. The worker gets
-- nothing on the view: 0001's default privileges for new ops relations are
-- revoked from it here.

-- Up Migration

REVOKE INSERT, UPDATE, DELETE ON pgboss.version FROM wringy_worker;
GRANT UPDATE (cron_on, bam_on, flow_on, reindex_on, monitor_backoff_on) ON pgboss.version TO wringy_worker;

ALTER TABLE pgboss.queue
  ADD CONSTRAINT wringy_queue_shared_table_only CHECK (NOT partition AND table_name = 'job_common');

CREATE VIEW ops.pgboss_schema_version AS
  SELECT max(v.version) AS version FROM pgboss.version AS v;

REVOKE ALL ON ops.pgboss_schema_version FROM wringy_worker;
GRANT SELECT ON ops.pgboss_schema_version TO wringy_api;

REVOKE SELECT ON pgboss.version FROM wringy_api;
REVOKE USAGE ON SCHEMA pgboss FROM wringy_api;

-- Down Migration

GRANT USAGE ON SCHEMA pgboss TO wringy_api;
GRANT SELECT ON pgboss.version TO wringy_api;

DROP VIEW ops.pgboss_schema_version;

ALTER TABLE pgboss.queue DROP CONSTRAINT wringy_queue_shared_table_only;

REVOKE UPDATE (cron_on, bam_on, flow_on, reindex_on, monitor_backoff_on) ON pgboss.version FROM wringy_worker;
GRANT INSERT, UPDATE, DELETE ON pgboss.version TO wringy_worker;
