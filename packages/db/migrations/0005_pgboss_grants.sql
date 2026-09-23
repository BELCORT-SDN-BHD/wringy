-- 0005_pgboss_grants: runtime rights on the pg-boss schema and on the version
-- records GET /health compares (kickoff-package.md §4.11, §8.4; ruling D33 (ii):
-- the migrator owns pgboss, the worker gets DML only). Serves M2-AC01/2
-- (migration and runtime accounts are separated).
--
-- Order: `pnpm db:migrate` installs or upgrades schema pgboss with the pg-boss
-- CLI as the migrator BEFORE node-pg-migrate runs, so pgboss exists here. The
-- guard below fails the whole batch with a clear message if it does not.
--
-- Worker (wringy_worker): USAGE on pgboss; SELECT, INSERT, UPDATE, DELETE on its
-- tables; USAGE, SELECT, UPDATE on its sequences; EXECUTE on its functions. No
-- CREATE and no TRUNCATE: queues are created with partition: false, so creating
-- one inserts a row instead of a table, and the worker starts PgBoss with
-- migrate: false. Default privileges extend the same rights to objects a later
-- pg-boss upgrade creates as the migrator.
--
-- API (wringy_api): USAGE on pgboss only to read pgboss.version, plus SELECT on
-- ops.pgmigrations (node-pg-migrate's table, created before 0001 and so outside
-- its default privileges). Nothing else in pgboss.
--
-- PUBLIC: on a fresh database pg-boss is installed before 0001 sets the
-- migrator's "functions are not executable by PUBLIC" default, so its functions
-- start with PostgreSQL's built-in EXECUTE for PUBLIC. That is revoked here.

-- Up Migration

DO $$
BEGIN
  IF to_regnamespace('pgboss') IS NULL THEN
    RAISE EXCEPTION 'schema pgboss is missing: pnpm db:migrate installs it with the pg-boss CLI before node-pg-migrate runs';
  END IF;
END
$$;

REVOKE ALL ON SCHEMA pgboss FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pgboss FROM PUBLIC;

GRANT USAGE ON SCHEMA pgboss TO wringy_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO wringy_worker;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA pgboss TO wringy_worker;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgboss TO wringy_worker;

ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wringy_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO wringy_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT EXECUTE ON FUNCTIONS TO wringy_worker;

GRANT USAGE ON SCHEMA pgboss TO wringy_api;
GRANT SELECT ON pgboss.version TO wringy_api;
GRANT SELECT ON ops.pgmigrations TO wringy_api;

-- Down Migration

REVOKE SELECT ON ops.pgmigrations FROM wringy_api;
REVOKE SELECT ON pgboss.version FROM wringy_api;
REVOKE USAGE ON SCHEMA pgboss FROM wringy_api;

ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss REVOKE EXECUTE ON FUNCTIONS FROM wringy_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM wringy_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM wringy_worker;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA pgboss FROM wringy_worker;
REVOKE USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA pgboss FROM wringy_worker;
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss FROM wringy_worker;
REVOKE USAGE ON SCHEMA pgboss FROM wringy_worker;
-- PUBLIC's EXECUTE on pgboss functions is deliberately not restored. The pgboss
-- schema itself stays: pg-boss owns its lifecycle (`pg-boss rollback`), not
-- node-pg-migrate.
