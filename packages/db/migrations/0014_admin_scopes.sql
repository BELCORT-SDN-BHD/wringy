-- 0014_admin_scopes: org-scoped review and finance capabilities (kickoff-package.md
-- §3.2 "admin_scopes", §3.3; rulings D4 "grants are written by an operator
-- script, never in the app", D5; M2-03 code review R1, R5, R6). Serves M2-AC03/1
-- ("无自助运营/财务提权入口": no request can write a grant) and M2-AC03/3 (review
-- and finance are independent, and neither implies membership).
--
-- Creates app.admin_scopes, one row per (person, org, capability):
-- - user_id → app.profiles (a grant needs a person who has signed in), org_id →
--   app.orgs; PRIMARY KEY (user_id, org_id, capability).
-- - capability review|finance. Holding one gives nothing of the other, and no
--   membership: a review grant on an org is not a seat in it.
-- - granted_by_operator and reason, both NOT NULL: the `--by` and `--reason` of
--   `pnpm db:grant`; granted_at on the database clock.
--
-- Revoking deletes the row (the migrator owns the table); the audit row that
-- `pnpm db:grant` writes in the same statement (0016, packages/db/src/grants.ts)
-- keeps the history.
--
-- Deliberately absent: no data_origin column and no fixture trigger. Grants name
-- real people (§3.5).
--
-- Privileges: the API gets SELECT only (0001's default, written out here), which
-- is all a capability check needs; it can never lock a row here (no UPDATE on any
-- column), so the check is a plain read (R5). Rows are written only by the
-- migrator through `pnpm db:grant`. The worker has no USAGE on schema app (0001).

-- Up Migration

CREATE TABLE app.admin_scopes (
  user_id uuid NOT NULL REFERENCES app.profiles (id),
  org_id uuid NOT NULL REFERENCES app.orgs (id),
  capability text NOT NULL
    CONSTRAINT admin_scopes_capability_check CHECK (capability IN ('review', 'finance')),
  granted_by_operator text NOT NULL,
  reason text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_scopes_pkey PRIMARY KEY (user_id, org_id, capability)
);

GRANT SELECT ON app.admin_scopes TO wringy_api;

-- Down Migration

DROP TABLE app.admin_scopes;
