-- 0012_org_members: who belongs to which organisation, in which role, and on
-- what grant (kickoff-package.md §3.2 "org_members", §3.3; rulings D1, D3; M2-03
-- code review R1, R5, R7). Serves M2-AC03/1 ("加入已有组织必须有授权授予记录": a
-- membership exists only as the creator's own row or through an accepted
-- invitation) and M2-AC03/2 (every command re-reads the caller's membership here).
--
-- Creates app.org_members, one row per (org, person), never deleted:
-- - org_id → app.orgs, user_id → app.profiles; PRIMARY KEY (org_id, user_id).
-- - role admin|member (D3: only the last active admin is protected, so the
--   creator can later be demoted and the role is not pinned by a CHECK).
-- - status active|removed, default active. A removed row stays, with who removed
--   it, when and why (removal_basis left|removed_by_admin), all three or none
--   (org_members_removal_check). Re-joining through a new invitation turns the
--   same row active again.
-- - grant_basis org_created|invitation, granted_by → app.profiles, granted_at.
--   invitation_id is set exactly when the basis is an invitation
--   (org_members_invitation_basis_check); 0013 adds the composite foreign key
--   org_members_invitation_fkey (org_id, invitation_id) → app.org_invitations
--   (org_id, id), so an invitation of one org can never back a membership of
--   another.
-- - creator_ref, a stored generated column: user_id when the basis is
--   org_created, otherwise NULL. org_members_creator_fkey (org_id, creator_ref)
--   → app.orgs (id, created_by) makes an `org_created` row possible only for the
--   org's own creator; MATCH SIMPLE skips the check on every invitation row,
--   where creator_ref is NULL. org_members_org_created_self_check adds that such a
--   row is granted by the creator to themselves.
-- - created_at, updated_at with the shared ops.touch_updated_at() trigger (0002).
-- - org_members_user_active_idx: a partial index on user_id for the active rows,
--   which is what `GET /me/workspaces` reads.
--
-- Deliberately absent: no data_origin column and no fixture trigger. A
-- membership names a real person (§3.5), so it is never a fixture row.
--
-- Privileges: the API gets SELECT (0001's default, written out here),
-- INSERT (org_id, user_id, role, grant_basis, invitation_id, granted_by) and
-- UPDATE (role, status, grant_basis, invitation_id, granted_by, granted_at,
-- removed_by, removed_at, removal_basis): what create, accept (including the
-- re-activation upsert), role change, remove and leave write, and nothing else.
-- No DELETE: a removal is a status, so the history of who belonged survives.
-- The worker has no USAGE on schema app (0001) and reaches nothing here.

-- Up Migration

CREATE TABLE app.org_members (
  org_id uuid NOT NULL REFERENCES app.orgs (id),
  user_id uuid NOT NULL REFERENCES app.profiles (id),
  role text NOT NULL
    CONSTRAINT org_members_role_check CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'active'
    CONSTRAINT org_members_status_check CHECK (status IN ('active', 'removed')),
  grant_basis text NOT NULL
    CONSTRAINT org_members_grant_basis_check CHECK (grant_basis IN ('org_created', 'invitation')),
  invitation_id uuid,
  granted_by uuid NOT NULL REFERENCES app.profiles (id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  removed_by uuid REFERENCES app.profiles (id),
  removed_at timestamptz,
  removal_basis text
    CONSTRAINT org_members_removal_basis_check CHECK (removal_basis IN ('left', 'removed_by_admin')),
  creator_ref uuid GENERATED ALWAYS AS (CASE WHEN grant_basis = 'org_created' THEN user_id END) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_members_pkey PRIMARY KEY (org_id, user_id),
  CONSTRAINT org_members_creator_fkey FOREIGN KEY (org_id, creator_ref)
    REFERENCES app.orgs (id, created_by),
  CONSTRAINT org_members_org_created_self_check CHECK (grant_basis <> 'org_created' OR granted_by = user_id),
  CONSTRAINT org_members_invitation_basis_check CHECK ((grant_basis = 'invitation') = (invitation_id IS NOT NULL)),
  CONSTRAINT org_members_removal_check CHECK (
    CASE status
      WHEN 'removed' THEN num_nonnulls(removed_at, removed_by, removal_basis) = 3
      ELSE num_nonnulls(removed_at, removed_by, removal_basis) = 0
    END
  )
);

CREATE INDEX org_members_user_active_idx ON app.org_members (user_id) WHERE status = 'active';

CREATE TRIGGER org_members_touch_updated_at
  BEFORE UPDATE ON app.org_members
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

GRANT SELECT ON app.org_members TO wringy_api;
GRANT INSERT (org_id, user_id, role, grant_basis, invitation_id, granted_by) ON app.org_members TO wringy_api;
GRANT UPDATE (role, status, grant_basis, invitation_id, granted_by, granted_at, removed_by, removed_at, removal_basis)
  ON app.org_members TO wringy_api;

-- Down Migration

DROP TABLE app.org_members;
