-- 0007_data_origin_immutable: a row's data origin is fixed at creation
-- (kickoff-package.md §8.5: "the data_origin column, the composite FK and the
-- trigger make mixing impossible"; Implementation Decision 5). Serves M2-AC01/2
-- (fixture and live data stay apart).
--
-- Why: ops.assert_fixture_allowed() (0002) looks only at NEW, so one UPDATE
-- could point a fixture campaign at a live org and relabel it live (the
-- composite FK accepts the new pair), letting a fixture identity and its
-- history pass as live data in any environment, production included; and a
-- live row could be relabelled fixture wherever fixtures are allowed.
--
-- Creates ops.assert_data_origin_unchanged(): a BEFORE UPDATE trigger function
-- that refuses any change of data_origin, SQLSTATE 23514 (check_violation),
-- constraint name data_origin_immutable. It is attached to app.orgs and
-- app.campaigns. Triggers of one event fire in name order, so on those tables
-- the fixture guard (*_assert_fixture_allowed) still answers first where it
-- applies. To move data between origins, delete the row and insert a new one.

-- Up Migration

CREATE FUNCTION ops.assert_data_origin_unchanged() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  IF NEW.data_origin IS DISTINCT FROM OLD.data_origin THEN
    RAISE EXCEPTION 'data_origin of a row in %.% cannot change (% to %)', TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.data_origin, NEW.data_origin
      USING ERRCODE = 'check_violation',
            CONSTRAINT = 'data_origin_immutable',
            SCHEMA = TG_TABLE_SCHEMA,
            TABLE = TG_TABLE_NAME,
            HINT = 'Delete the row and insert a new one with the other data origin.';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER orgs_data_origin_immutable
  BEFORE UPDATE ON app.orgs
  FOR EACH ROW EXECUTE FUNCTION ops.assert_data_origin_unchanged();

CREATE TRIGGER campaigns_data_origin_immutable
  BEFORE UPDATE ON app.campaigns
  FOR EACH ROW EXECUTE FUNCTION ops.assert_data_origin_unchanged();

-- Down Migration

DROP TRIGGER campaigns_data_origin_immutable ON app.campaigns;
DROP TRIGGER orgs_data_origin_immutable ON app.orgs;
DROP FUNCTION ops.assert_data_origin_unchanged();
