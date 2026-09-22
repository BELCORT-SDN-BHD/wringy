-- 0001_schemas_roles: the schema and privilege skeleton (kickoff-package.md §4.11, §8.4).
--
-- Runs as the migration owner (wringy_migrator; on Supabase possibly postgres).
-- - Group roles wringy_api and wringy_worker are NOLOGIN. Roles are cluster-wide,
--   so they are created only when absent: `pnpm db:bootstrap` creates them before
--   the first migration in every environment, together with the login roles and
--   their passwords, which never appear in a migration.
-- - Schemas app (business) and ops (environment marker, heartbeats, and the
--   migrations table the runner creates before this file) belong to the migrator.
-- - Nothing goes in public, and nothing is granted to anon, authenticated or
--   service_role (Supabase's API roles; they do not exist locally).
-- - Default privileges are the floor for tables later migrations create; each
--   later migration tightens or widens per table with explicit GRANT/REVOKE.

-- Up Migration

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'wringy_api') THEN
    CREATE ROLE wringy_api NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'wringy_worker') THEN
    CREATE ROLE wringy_worker NOLOGIN;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'group roles wringy_api/wringy_worker are missing and % may not create roles; run pnpm db:bootstrap first', current_user;
END
$$;

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION CURRENT_USER;
CREATE SCHEMA IF NOT EXISTS ops AUTHORIZATION CURRENT_USER;
ALTER SCHEMA app OWNER TO CURRENT_USER;
ALTER SCHEMA ops OWNER TO CURRENT_USER;

REVOKE ALL ON SCHEMA app, ops FROM PUBLIC;

-- The API reads business and operations data; it never creates objects.
GRANT USAGE ON SCHEMA app TO wringy_api;
GRANT USAGE ON SCHEMA ops TO wringy_api;
-- The worker writes heartbeats in ops and has nothing in app by default.
GRANT USAGE ON SCHEMA ops TO wringy_worker;

ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO wringy_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT SELECT ON TABLES TO wringy_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT SELECT, INSERT, UPDATE ON TABLES TO wringy_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT USAGE, SELECT ON SEQUENCES TO wringy_worker;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC. A per-schema default
-- cannot revoke a built-in default, so this is the migrator's database-wide
-- default: functions it creates are callable only where a migration grants it.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Down Migration

ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA ops REVOKE USAGE, SELECT ON SEQUENCES FROM wringy_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops REVOKE SELECT, INSERT, UPDATE ON TABLES FROM wringy_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops REVOKE SELECT ON TABLES FROM wringy_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE SELECT ON TABLES FROM wringy_api;

REVOKE USAGE ON SCHEMA ops FROM wringy_worker;
REVOKE USAGE ON SCHEMA ops FROM wringy_api;
REVOKE USAGE ON SCHEMA app FROM wringy_api;

-- RESTRICT (the default): fails while a later migration's objects remain.
DROP SCHEMA app;
-- ops stays: it holds ops.pgmigrations, which the runner created before this
-- migration and still writes to while reverting it. The group roles stay too:
-- they are cluster-wide, other databases in the cluster may use them, and
-- `pnpm db:bootstrap` owns their lifecycle.
