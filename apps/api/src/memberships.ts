/**
 * `app.org_members` as the API reads and writes it (migration 0012;
 * kickoff-package.md §3.2, §3.3, rulings D1, D3; M2-03 code review R5, R7).
 * Serves M2-AC03/1: a membership exists only as the creator's own
 * `org_created` row or through an accepted invitation, and a removal is a status,
 * never a DELETE, so the history of who belonged survives.
 *
 * Every function here runs inside a command that already holds the org row lock
 * (authorize.ts, R5 step 4); the target member's row is locked `FOR UPDATE` by
 * `lockMember` before it changes. The member list never carries an address:
 * `contact_email` is for notifications only (M2-AC03/3).
 */
import type { Membership, MembershipGrantBasis, MembershipStatus, OrgMember, OrgRole } from '@wringy/contracts';
import type { PoolClient } from '@wringy/db';

type Queryable = Pick<PoolClient, 'query'>;

const MEMBERSHIP_COLUMNS = 'org_id, user_id, role, status, grant_basis, granted_at';

interface MembershipRow {
  org_id: string;
  user_id: string;
  role: OrgRole;
  status: MembershipStatus;
  grant_basis: MembershipGrantBasis;
  granted_at: Date;
}

function toMembership(row: MembershipRow): Membership {
  return {
    orgId: row.org_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    grantBasis: row.grant_basis,
    grantedAt: row.granted_at.toISOString(),
  };
}

function one(rows: MembershipRow[], what: string): Membership {
  if (rows[0] === undefined) throw new Error(`the ${what} returned no row`);
  return toMembership(rows[0]);
}

/**
 * The creator's admin membership (D1). `org_members_creator_fkey` makes this
 * row possible only for the org's own creator, granted by themselves.
 */
export async function insertCreatorMembership(client: Queryable, orgId: string, userId: string): Promise<Membership> {
  const { rows } = await client.query<MembershipRow>(
    `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, granted_by)
     VALUES ($1, $2, 'admin', 'org_created', $3)
     RETURNING ${MEMBERSHIP_COLUMNS}`,
    [orgId, userId, userId],
  );
  return one(rows, 'creator membership insert');
}

export interface InvitedMembership {
  orgId: string;
  userId: string;
  role: OrgRole;
  invitationId: string;
  /** The inviting admin: whoever granted the membership. */
  grantedBy: string;
}

/**
 * Accepting an invitation (R7): a new row, or a removed row made active again.
 * The `WHERE app.org_members.status = 'removed'` makes rewriting an **active**
 * row impossible: then no row comes back, and the caller answers
 * `invitation.already_member`. Null in that case.
 */
export async function upsertInvitedMembership(client: Queryable, membership: InvitedMembership): Promise<Membership | null> {
  const { rows } = await client.query<MembershipRow>(
    `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, invitation_id, granted_by)
     VALUES ($1, $2, $3, 'invitation', $4, $5)
     ON CONFLICT (org_id, user_id) DO UPDATE
       SET status = 'active', role = excluded.role, grant_basis = 'invitation',
           invitation_id = excluded.invitation_id, granted_by = excluded.granted_by,
           granted_at = now(), removed_by = NULL, removed_at = NULL, removal_basis = NULL
       WHERE app.org_members.status = 'removed'
     RETURNING ${MEMBERSHIP_COLUMNS}`,
    [membership.orgId, membership.userId, membership.role, membership.invitationId, membership.grantedBy],
  );
  return rows[0] === undefined ? null : toMembership(rows[0]);
}

/** A member's row locked `FOR UPDATE`, when it is active; null when there is none in this org. */
export async function lockMember(client: Queryable, orgId: string, userId: string): Promise<{ role: OrgRole } | null> {
  const { rows } = await client.query<{ role: OrgRole }>(
    `SELECT role FROM app.org_members WHERE org_id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE`,
    [orgId, userId],
  );
  return rows[0] ?? null;
}

/** Sets an active member's role. */
export async function changeRole(client: Queryable, orgId: string, userId: string, role: OrgRole): Promise<Membership> {
  const { rows } = await client.query<MembershipRow>(
    `UPDATE app.org_members SET role = $3
      WHERE org_id = $1 AND user_id = $2 AND status = 'active'
      RETURNING ${MEMBERSHIP_COLUMNS}`,
    [orgId, userId, role],
  );
  return one(rows, 'role change');
}

async function markRemoved(
  client: Queryable,
  orgId: string,
  userId: string,
  removedBy: string,
  basis: 'left' | 'removed_by_admin',
): Promise<Membership> {
  const { rows } = await client.query<MembershipRow>(
    `UPDATE app.org_members
        SET status = 'removed', removed_by = $3, removed_at = now(), removal_basis = $4
      WHERE org_id = $1 AND user_id = $2 AND status = 'active'
      RETURNING ${MEMBERSHIP_COLUMNS}`,
    [orgId, userId, removedBy, basis],
  );
  return one(rows, 'removal');
}

/** An admin removes another member: the row stays, `removed`, with who removed it and why. */
export function removeMember(client: Queryable, orgId: string, userId: string, removedBy: string): Promise<Membership> {
  return markRemoved(client, orgId, userId, removedBy, 'removed_by_admin');
}

/** A member leaves: the row stays, `removed` by themselves, basis `left`. */
export function leave(client: Queryable, orgId: string, userId: string): Promise<Membership> {
  return markRemoved(client, orgId, userId, userId, 'left');
}

/** The active members of an org with their display names, oldest grant first. Never an address. */
export async function readMembers(client: Queryable, orgId: string): Promise<OrgMember[]> {
  const { rows } = await client.query<{ user_id: string; display_name: string | null; role: OrgRole; granted_at: Date }>(
    `SELECT m.user_id, p.display_name, m.role, m.granted_at
       FROM app.org_members m
       JOIN app.profiles p ON p.id = m.user_id
      WHERE m.org_id = $1 AND m.status = 'active'
      ORDER BY m.granted_at, m.user_id`,
    [orgId],
  );
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    grantedAt: row.granted_at.toISOString(),
  }));
}
