-- 0015_platform_grants: platform capabilities that belong to no organisation
-- (kickoff-package.md §3.2 "platform_grants", §3.3; ruling D4; M2-03 code review
-- R1, R5, R6). Serves M2-AC03/1 (no self-service escalation to operations) and
-- M2-AC03/3 (a platform grant is not a membership, and a membership is not a
-- platform grant). M2-08 puts the first action behind `ops_runtime` (the failure
-- view and its retry); until then the grant is readable and gates nothing.
--
-- Creates app.platform_grants, one row per (person, capability):
-- - user_id → app.profiles; PRIMARY KEY (user_id, capability).
-- - capability ops_runtime.
-- - granted_by_operator and reason, both NOT NULL: the `--by` and `--reason` of
--   `pnpm db:grant`; granted_at on the database clock.
--
-- Revoking deletes the row; the audit row written in the same statement (0016,
-- packages/db/src/grants.ts) keeps the history.
--
-- Deliberately absent: no data_origin column and no fixture trigger (§3.5).
--
-- Privileges: the API gets SELECT only (0001's default, written out here); rows
-- are written only by the migrator through `pnpm db:grant`. The worker has no
-- USAGE on schema app (0001).

-- Up Migration

CREATE TABLE app.platform_grants (
  user_id uuid NOT NULL REFERENCES app.profiles (id),
  capability text NOT NULL
    CONSTRAINT platform_grants_capability_check CHECK (capability IN ('ops_runtime')),
  granted_by_operator text NOT NULL,
  reason text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_grants_pkey PRIMARY KEY (user_id, capability)
);

GRANT SELECT ON app.platform_grants TO wringy_api;

-- Down Migration

DROP TABLE app.platform_grants;
