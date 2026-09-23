-- 0003_orgs_campaigns: the minimal business tables the M2-01 narrow loop reads
-- (kickoff-package.md §8.3, §8.4; ruling D32 "a minimal orgs table in M2-01").
-- Serves M2-AC01/2 (the page reads campaigns through Fastify from PostgreSQL
-- after a fresh migration; fixture and live rows cannot mix).
--
-- Creates:
-- - app.orgs(id, name, data_origin, created_at), UNIQUE (id, data_origin) so a
--   campaign can reference an org together with its data origin.
-- - app.campaigns(id, org_id, title, status draft|published, data_origin,
--   created_at, updated_at), UNIQUE (org_id, id) for later org-scoped foreign
--   keys, UNIQUE (id, data_origin), and FOREIGN KEY (org_id, data_origin) →
--   app.orgs(id, data_origin): a fixture campaign can only belong to a fixture
--   org, and a live campaign only to a live org. The UNIQUE (org_id, id) index
--   leads with org_id, so it also serves the foreign key's lookups.
-- - Triggers: ops.assert_fixture_allowed() on both tables (fixture rows only
--   where ops.environment allows them); ops.touch_updated_at() on campaigns.
--
-- Privileges: the API gets SELECT only (M2-01 has no business writes). The
-- worker has no USAGE on schema app (0001), so it can read nothing here.

-- Up Migration

CREATE TABLE app.orgs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  data_origin text NOT NULL
    CONSTRAINT orgs_data_origin_check CHECK (data_origin IN ('fixture', 'live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orgs_id_data_origin_key UNIQUE (id, data_origin)
);

CREATE TABLE app.campaigns (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL
    CONSTRAINT campaigns_status_check CHECK (status IN ('draft', 'published')),
  data_origin text NOT NULL
    CONSTRAINT campaigns_data_origin_check CHECK (data_origin IN ('fixture', 'live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_org_id_id_key UNIQUE (org_id, id),
  CONSTRAINT campaigns_id_data_origin_key UNIQUE (id, data_origin),
  CONSTRAINT campaigns_org_data_origin_fkey FOREIGN KEY (org_id, data_origin)
    REFERENCES app.orgs (id, data_origin)
);

CREATE TRIGGER orgs_assert_fixture_allowed
  BEFORE INSERT OR UPDATE ON app.orgs
  FOR EACH ROW EXECUTE FUNCTION ops.assert_fixture_allowed();

CREATE TRIGGER campaigns_assert_fixture_allowed
  BEFORE INSERT OR UPDATE ON app.campaigns
  FOR EACH ROW EXECUTE FUNCTION ops.assert_fixture_allowed();

CREATE TRIGGER campaigns_touch_updated_at
  BEFORE UPDATE ON app.campaigns
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

GRANT SELECT ON app.orgs, app.campaigns TO wringy_api;

-- Down Migration

DROP TABLE app.campaigns;
DROP TABLE app.orgs;
