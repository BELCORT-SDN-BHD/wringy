-- Fixture data for the M2-01 internal build (kickoff-package.md §8.3, §8.5).
--
-- Two orgs and three campaigns (two published, one draft) with fixed ids, every
-- row data_origin = 'fixture'. Names, titles and statuses only: no money, no
-- rule values, no dates, and nothing taken from apps/web/src/domain/seed.ts.
--
-- Applied by `pnpm db:seed:fixtures` as the migrator, which refuses to run
-- unless ops.environment allows fixtures; the trigger ops.assert_fixture_allowed()
-- refuses the rows again inside the database. The statements run as one implicit
-- transaction. Idempotent: a rerun rewrites only a fixture row whose name, title
-- or status differs from this file, and never touches a live row.

INSERT INTO app.orgs (id, name, data_origin) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Kopi Kita', 'fixture'),
  ('a0000000-0000-4000-8000-000000000002', 'Nusantara Fit', 'fixture')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name
  WHERE app.orgs.data_origin = 'fixture'
    AND app.orgs.name IS DISTINCT FROM EXCLUDED.name;

INSERT INTO app.campaigns (id, org_id, title, status, data_origin) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Morning brew launch', 'published', 'fixture'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Hari Raya open house', 'draft', 'fixture'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'Weekend run club', 'published', 'fixture')
ON CONFLICT (id) DO UPDATE
  SET title = EXCLUDED.title, status = EXCLUDED.status
  WHERE app.campaigns.data_origin = 'fixture'
    AND (app.campaigns.title, app.campaigns.status) IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.status);
