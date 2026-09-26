-- 0011_orgs_ownership: a person can create an organisation, and the database
-- records who did (kickoff-package.md §3.2 "orgs"; ruling D1 "any signed-in
-- person can create an org and becomes its first admin"; M2-03 code review R1,
-- R2). Serves M2-AC03/1: the creator's admin membership (0012) can exist only for
-- the org's own creator, and that link needs this column and this key.
--
-- Expand only (§4.13): nothing here changes a row that exists. The fixture orgs
-- of the seed, and every live org the M2-01 tests insert, keep a NULL creator:
-- there is deliberately no "a live org needs a creator" CHECK, because the
-- creator is recorded on the `org_created` membership row and in the audit log.
--
-- Changes app.orgs:
-- - created_by uuid, nullable, REFERENCES app.profiles (id): the person who
--   created the org through the API. No index: nothing queries it in M2.
-- - updated_at timestamptz NOT NULL DEFAULT now(), stamped by the shared
--   ops.touch_updated_at() trigger (0002) on every UPDATE (a rename).
-- - id takes DEFAULT gen_random_uuid() (core since PostgreSQL 13, no pgcrypto)
--   and data_origin DEFAULT 'live': the API never chooses either, so every org it
--   creates is a live row with a database-chosen id (R2).
-- - orgs_id_created_by_key UNIQUE (id, created_by): the target of
--   org_members_creator_fkey (0012), which ties an `org_created` membership to
--   the org's own creator.
--
-- Privileges: the API keeps SELECT (0003) and gains two column grants,
-- INSERT (name, created_by) and UPDATE (name). It cannot choose an id, cannot
-- write data_origin (0007 also makes it immutable) and cannot change the creator,
-- and it has no DELETE. UPDATE (name) is also what lets a command take the org
-- row lock (`SELECT … FOR NO KEY UPDATE`), which needs UPDATE on some column
-- (R5). This amends M2-AC01/2's "the API gets SELECT only" of 0003: the
-- runtime-role test that refuses an INSERT naming `id` still passes, for this
-- reason. The worker has no USAGE on schema app (0001) and reaches nothing here.
--
-- Down reverses the Up in the opposite order: the column grants are revoked
-- first, then the trigger, the key, the two defaults and the two columns.

-- Up Migration

ALTER TABLE app.orgs
  ADD COLUMN created_by uuid REFERENCES app.profiles (id),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE app.orgs
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN data_origin SET DEFAULT 'live';

ALTER TABLE app.orgs
  ADD CONSTRAINT orgs_id_created_by_key UNIQUE (id, created_by);

CREATE TRIGGER orgs_touch_updated_at
  BEFORE UPDATE ON app.orgs
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

GRANT INSERT (name, created_by) ON app.orgs TO wringy_api;
GRANT UPDATE (name) ON app.orgs TO wringy_api;

-- Down Migration

REVOKE INSERT (name, created_by) ON app.orgs FROM wringy_api;
REVOKE UPDATE (name) ON app.orgs FROM wringy_api;

DROP TRIGGER orgs_touch_updated_at ON app.orgs;

ALTER TABLE app.orgs DROP CONSTRAINT orgs_id_created_by_key;

ALTER TABLE app.orgs ALTER COLUMN data_origin DROP DEFAULT;
ALTER TABLE app.orgs ALTER COLUMN id DROP DEFAULT;

ALTER TABLE app.orgs DROP COLUMN updated_at;
ALTER TABLE app.orgs DROP COLUMN created_by;
