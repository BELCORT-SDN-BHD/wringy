-- 0009_sign_in_allowlist: who may sign in to the internal build at all
-- (kickoff-package.md §3.2, §3.5 "Users are never fixtures"; ruling D13).
-- Serves M2-AC02/2: an address that is not listed and has no profile yet is
-- refused at first sign-in with 403 sign_in.not_allowed.
--
-- Creates app.sign_in_allowlist:
-- - email_norm text PRIMARY KEY, CHECK non-empty and already lower-cased. The
--   normal form is Unicode NFC, trimmed and lower-cased, with no dot or plus
--   rewriting; it is computed once in packages/db/src/allowlist.ts and used by
--   both the CLI and the API. NFC composes (the two spellings of one accented
--   letter are one key) and does not compatibility-fold, so a look-alike code
--   point — the fi ligature, a full-width letter — stays a different address
--   and a listed ASCII row never admits it.
--   The CHECK is a backstop for a hand-written row, and an ASCII one: lower() is
--   the cluster's LC_CTYPE, and this repository initdb's both its clusters with
--   --locale=C (packages/db/scripts/local-pg.mjs, test/cluster.ts), where lower()
--   folds ASCII only. So a row whose non-ASCII letters are upper-case passes the
--   CHECK here and would be refused on a UTF-8 cluster. That is why the ONE
--   guarantee is the JS normal form on every write path, not this constraint:
--   normalizeEmail() lower-cases the whole Unicode range, so no row the CLI or
--   the API writes can differ from what the gate compares (known-issues.md).
-- - reason and added_by, both NOT NULL: the audit lives in the row until
--   app.audit_log arrives with M2-03, so neither may be skipped.
-- - added_at timestamptz NOT NULL DEFAULT now(), on the database clock.
--
-- The list is checked ONCE, at first sign-in. An existing profile is never
-- re-checked, so removing an address signs nobody out; disabling the profile
-- (app.profiles.status, 0008) does.
--
-- Deliberately absent: no data_origin column and no fixture trigger. The rows
-- name real addresses of real testers, so there is no fixture form of them.
--
-- Privileges: the API gets SELECT only, which is all the gate needs; rows are
-- written only by the migrator through `pnpm db:allowlist add|remove|list`,
-- whose --reason and --by are required. 0001's default privileges already gave
-- the API SELECT; the grant is written out so this file states its own rights.
-- The worker has no USAGE on schema app (0001) and reaches nothing here.

-- Up Migration

CREATE TABLE app.sign_in_allowlist (
  email_norm text PRIMARY KEY
    CONSTRAINT sign_in_allowlist_email_norm_check
      CHECK (email_norm <> '' AND email_norm = lower(email_norm)),
  reason text NOT NULL,
  added_by text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON app.sign_in_allowlist TO wringy_api;

-- Down Migration

DROP TABLE app.sign_in_allowlist;
