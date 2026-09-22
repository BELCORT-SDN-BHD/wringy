-- 0002_environment_marker: which environment this database belongs to, and the
-- fixture guard (kickoff-package.md §8.4, §8.5; Implementation Decision 5).
-- Serves M2-AC01/2 (fixture and live data stay apart; the api and worker compare
-- WRINGY_ENV with this marker before they start).
--
-- Creates:
-- - ops.environment: at most one row {name, fixtures_allowed, updated_at}. The
--   row itself is written by `pnpm db:env` (and by the test harness), never by a
--   migration, because the same migrations run in every environment. A
--   production marker can never allow fixtures.
-- - ops.touch_updated_at(): BEFORE UPDATE trigger function that stamps
--   updated_at with the database clock. Used here and by 0003 and 0004.
-- - ops.assert_fixture_allowed(): BEFORE INSERT OR UPDATE trigger function for
--   tables with a data_origin column. It refuses a row whose data_origin is
--   'fixture' unless ops.environment says fixtures_allowed, and refuses it when
--   the marker row is missing (fail closed). SQLSTATE 23514 (check_violation),
--   constraint name ops_environment_fixtures_allowed. SECURITY INVOKER: every
--   role that writes business rows can read the marker.
--
-- Privileges: the API and the worker may read the marker; neither may change
-- it. 0001's default privileges gave the worker INSERT and UPDATE on every new
-- ops table, so they are revoked here for this table.

-- Up Migration

CREATE TABLE ops.environment (
  name text PRIMARY KEY
    CONSTRAINT environment_name_check CHECK (name IN ('local', 'ci', 'staging', 'production')),
  fixtures_allowed boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT environment_production_refuses_fixtures CHECK (name <> 'production' OR NOT fixtures_allowed)
);

-- At most one row: a unique index on a constant expression.
CREATE UNIQUE INDEX environment_single_row ON ops.environment ((true));

CREATE FUNCTION ops.touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END
$$;

CREATE TRIGGER environment_touch_updated_at
  BEFORE UPDATE ON ops.environment
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

CREATE FUNCTION ops.assert_fixture_allowed() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  marker record;
BEGIN
  IF NEW.data_origin IS DISTINCT FROM 'fixture' THEN
    RETURN NEW;
  END IF;

  SELECT e.name, e.fixtures_allowed INTO marker FROM ops.environment AS e;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fixture row refused in %.%: this database has no ops.environment marker', TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'ops_environment_fixtures_allowed',
            SCHEMA = TG_TABLE_SCHEMA,
            TABLE = TG_TABLE_NAME,
            HINT = 'Run pnpm db:env after pnpm db:migrate.';
  END IF;

  IF NOT marker.fixtures_allowed THEN
    RAISE EXCEPTION 'fixture row refused in %.%: environment % does not allow fixtures', TG_TABLE_SCHEMA, TG_TABLE_NAME, marker.name
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'ops_environment_fixtures_allowed',
            SCHEMA = TG_TABLE_SCHEMA,
            TABLE = TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END
$$;

REVOKE INSERT, UPDATE ON ops.environment FROM wringy_worker;
GRANT SELECT ON ops.environment TO wringy_api, wringy_worker;

-- Down Migration

DROP TABLE ops.environment;
DROP FUNCTION ops.assert_fixture_allowed();
DROP FUNCTION ops.touch_updated_at();
