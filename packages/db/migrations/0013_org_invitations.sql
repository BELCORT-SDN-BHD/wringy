-- 0013_org_invitations: single-use invitation links into an organisation
-- (kickoff-package.md §3.2 "org_invitations", §3.3; ruling D2 "single-use link;
-- expiry 7 days"; M2-03 code review R1, R7). Serves M2-AC03/1 (joining an
-- existing org needs a grant record: an accepted invitation, pointed to by the
-- membership row) and M2-AC03/2 (the composite keys refuse cross-org
-- combinations).
--
-- Creates app.org_invitations:
-- - id uuid PRIMARY KEY DEFAULT gen_random_uuid(); org_id → app.orgs.
-- - invited_by: the inviting admin. org_invitations_inviter_fkey (org_id,
--   invited_by) → app.org_members (org_id, user_id), so only somebody who has a
--   membership row in that same org can be the inviter.
-- - invitee_email_norm: the address in the allow-list's normal form
--   (packages/db/src/allowlist.ts normalizeEmail), non-empty and already
--   lower-cased (an ASCII backstop; 0009 explains why lower() under --locale=C is
--   not the guarantee). Acceptance compares it with the verified token's address.
-- - role admin|member: what accepting grants. Fixed at creation.
-- - token_hash: the sha256 of the link's token, 64 lower-case hex characters,
--   UNIQUE. The token itself is never stored (R7).
-- - status pending|accepted|revoked, default pending; expires_at NOT NULL (the
--   API binds now() + make_interval(days => INVITATION_LIFETIME_DAYS)). An
--   expired invitation is a pending row past expires_at: expiry is not stored.
-- - accepted_by/accepted_at set exactly when accepted, revoked_by/revoked_at
--   exactly when revoked (org_invitations_accepted_check, _revoked_check).
-- - org_invitations_org_id_id_key UNIQUE (org_id, id): the target of
--   org_members_invitation_fkey below.
-- - org_invitations_pending_address_key: at most one pending invitation per
--   (org, address), a partial unique index. The API maps its 23505 to 409
--   invitation.pending.
--
-- And, on app.org_members (0012), org_members_invitation_fkey (org_id,
-- invitation_id) → app.org_invitations (org_id, id): an invitation of one org can
-- never back a membership of another. The two tables reference each other, so
-- this link can exist only once both do; it is the one exception to "one object
-- per migration", and the Down drops it before the table.
--
-- Deliberately absent: no data_origin column and no fixture trigger. An
-- invitation names a real address (§3.5), so it is never a fixture row.
--
-- Privileges: the API gets SELECT (0001's default, written out here),
-- INSERT (org_id, invited_by, invitee_email_norm, role, token_hash, expires_at)
-- and UPDATE (status, accepted_by, accepted_at, revoked_by, revoked_at). Never
-- UPDATE of role, expires_at or token_hash: a bug cannot escalate, extend or
-- re-key a pending invitation. No DELETE: a revoked or used invitation stays as
-- history. UPDATE on some column is also what lets accept lock the row
-- (`SELECT … FOR UPDATE`, R5). The worker has no USAGE on schema app (0001).

-- Up Migration

CREATE TABLE app.org_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES app.orgs (id),
  invited_by uuid NOT NULL,
  invitee_email_norm text NOT NULL
    CONSTRAINT org_invitations_email_norm_check
      CHECK (invitee_email_norm <> '' AND invitee_email_norm = lower(invitee_email_norm)),
  role text NOT NULL
    CONSTRAINT org_invitations_role_check CHECK (role IN ('admin', 'member')),
  token_hash text NOT NULL
    CONSTRAINT org_invitations_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT org_invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid REFERENCES app.profiles (id),
  accepted_at timestamptz,
  revoked_by uuid REFERENCES app.profiles (id),
  revoked_at timestamptz,
  CONSTRAINT org_invitations_token_hash_key UNIQUE (token_hash),
  CONSTRAINT org_invitations_org_id_id_key UNIQUE (org_id, id),
  CONSTRAINT org_invitations_inviter_fkey FOREIGN KEY (org_id, invited_by)
    REFERENCES app.org_members (org_id, user_id),
  CONSTRAINT org_invitations_accepted_check CHECK (
    CASE status
      WHEN 'accepted' THEN num_nonnulls(accepted_at, accepted_by) = 2
      ELSE num_nonnulls(accepted_at, accepted_by) = 0
    END
  ),
  CONSTRAINT org_invitations_revoked_check CHECK (
    CASE status
      WHEN 'revoked' THEN num_nonnulls(revoked_at, revoked_by) = 2
      ELSE num_nonnulls(revoked_at, revoked_by) = 0
    END
  )
);

CREATE UNIQUE INDEX org_invitations_pending_address_key
  ON app.org_invitations (org_id, invitee_email_norm) WHERE status = 'pending';

ALTER TABLE app.org_members
  ADD CONSTRAINT org_members_invitation_fkey FOREIGN KEY (org_id, invitation_id)
    REFERENCES app.org_invitations (org_id, id);

GRANT SELECT ON app.org_invitations TO wringy_api;
GRANT INSERT (org_id, invited_by, invitee_email_norm, role, token_hash, expires_at)
  ON app.org_invitations TO wringy_api;
GRANT UPDATE (status, accepted_by, accepted_at, revoked_by, revoked_at) ON app.org_invitations TO wringy_api;

-- Down Migration

ALTER TABLE app.org_members DROP CONSTRAINT org_members_invitation_fkey;
DROP TABLE app.org_invitations;
