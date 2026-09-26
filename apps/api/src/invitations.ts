/**
 * `app.org_invitations` as the API reads and writes it (migration 0013;
 * kickoff-package.md §3.2, §3.3, ruling D2 "single-use link; expiry 7 days";
 * M2-03 code review R7). Serves M2-AC03/1: joining an existing org needs an
 * accepted invitation, and the membership points to it.
 *
 * The secret is a 32-byte random token, sent once in the create response and
 * stored only as its sha256. It is never an API path segment (the request log
 * writes paths), never a log field and never an audit value: the token travels
 * in POST bodies only. What a leaked or mis-delivered link grants is nothing,
 * because acceptance also needs the verified address it was sent to.
 *
 * The runtime role may insert every column but the status fields and update the
 * status fields only (never `role`, `expires_at` or `token_hash`: a bug cannot
 * escalate, extend or re-key a pending invitation), and it has no DELETE. Expiry
 * is judged on the database clock.
 */
import { createHash, randomBytes } from 'node:crypto';

import { INVITATION_LIFETIME_DAYS, type InvitationStatus, type OrgRole, type PendingInvitation } from '@wringy/contracts';
import type { PoolClient } from '@wringy/db';

type Queryable = Pick<PoolClient, 'query'>;

/** A new link token: base64url of 32 random bytes, 43 characters, no padding. */
export function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the database keeps of a token: its sha256, 64 lower-case hex characters. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

const PENDING_COLUMNS = 'id, invitee_email_norm, role, expires_at, created_at';

interface PendingRow {
  id: string;
  invitee_email_norm: string;
  role: OrgRole;
  expires_at: Date;
  created_at: Date;
}

function toPendingInvitation(row: PendingRow): PendingInvitation {
  return {
    id: row.id,
    inviteeEmailNorm: row.invitee_email_norm,
    role: row.role,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * The pending invitation for `emailNorm` in `orgId`, locked `FOR UPDATE`, and
 * whether it has expired on the database clock. At most one exists
 * (`org_invitations_pending_address_key`).
 */
export async function lockPendingForAddress(
  client: Queryable,
  orgId: string,
  emailNorm: string,
): Promise<{ id: string; expired: boolean } | null> {
  const { rows } = await client.query<{ id: string; expired: boolean }>(
    `SELECT id, expires_at <= now() AS expired
       FROM app.org_invitations
      WHERE org_id = $1 AND invitee_email_norm = $2 AND status = 'pending'
      FOR UPDATE`,
    [orgId, emailNorm],
  );
  return rows[0] ?? null;
}

export interface NewInvitation {
  orgId: string;
  invitedBy: string;
  emailNorm: string;
  role: OrgRole;
  tokenHash: string;
}

/**
 * Inserts a pending invitation expiring INVITATION_LIFETIME_DAYS after the
 * database's `now()`. The number is bound, never restated: its one home is
 * `@wringy/contracts` (ruling D2).
 */
export async function createInvitation(client: Queryable, invitation: NewInvitation): Promise<PendingInvitation> {
  const { rows } = await client.query<PendingRow>(
    `INSERT INTO app.org_invitations (org_id, invited_by, invitee_email_norm, role, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6))
     RETURNING ${PENDING_COLUMNS}`,
    [
      invitation.orgId,
      invitation.invitedBy,
      invitation.emailNorm,
      invitation.role,
      invitation.tokenHash,
      INVITATION_LIFETIME_DAYS,
    ],
  );
  if (rows[0] === undefined) throw new Error('the invitation insert returned no row');
  return toPendingInvitation(rows[0]);
}

/** The invitation a token names, unlocked: accept learns the org to lock from it (R5, R7). */
export async function readByTokenHashUnlocked(
  client: Queryable,
  tokenHash: string,
): Promise<{ id: string; orgId: string } | null> {
  const { rows } = await client.query<{ id: string; org_id: string }>(
    `SELECT id, org_id FROM app.org_invitations WHERE token_hash = $1`,
    [tokenHash],
  );
  return rows[0] === undefined ? null : { id: rows[0].id, orgId: rows[0].org_id };
}

/** An invitation's state as the commands judge it, `expired` on the database clock. */
export interface InvitationState {
  id: string;
  orgId: string;
  invitedBy: string;
  inviteeEmailNorm: string;
  role: OrgRole;
  status: InvitationStatus;
  expired: boolean;
  expiresAt: Date;
}

interface StateRow {
  id: string;
  org_id: string;
  invited_by: string;
  invitee_email_norm: string;
  role: OrgRole;
  status: InvitationStatus;
  expired: boolean;
  expires_at: Date;
}

const STATE_COLUMNS = 'id, org_id, invited_by, invitee_email_norm, role, status, expires_at <= now() AS expired, expires_at';

function toState(row: StateRow): InvitationState {
  return {
    id: row.id,
    orgId: row.org_id,
    invitedBy: row.invited_by,
    inviteeEmailNorm: row.invitee_email_norm,
    role: row.role,
    status: row.status,
    expired: row.expired,
    expiresAt: row.expires_at,
  };
}

/** The invitation `invitationId` **of `orgId`**, locked `FOR UPDATE`; null when that org has no such invitation. */
export async function lockInvitationById(client: Queryable, orgId: string, invitationId: string): Promise<InvitationState | null> {
  const { rows } = await client.query<StateRow>(
    `SELECT ${STATE_COLUMNS} FROM app.org_invitations WHERE org_id = $1 AND id = $2 FOR UPDATE`,
    [orgId, invitationId],
  );
  return rows[0] === undefined ? null : toState(rows[0]);
}

/** The invitation a token names in `orgId`, locked `FOR UPDATE` once the org lock is held (accept, R7). */
export async function lockInvitationByTokenHash(
  client: Queryable,
  orgId: string,
  tokenHash: string,
): Promise<InvitationState | null> {
  const { rows } = await client.query<StateRow>(
    `SELECT ${STATE_COLUMNS} FROM app.org_invitations WHERE org_id = $1 AND token_hash = $2 FOR UPDATE`,
    [orgId, tokenHash],
  );
  return rows[0] === undefined ? null : toState(rows[0]);
}

/** What `POST /invitations/preview` reads: the state plus the org's name. Unlocked. */
export async function readForPreview(
  client: Queryable,
  tokenHash: string,
): Promise<(InvitationState & { orgName: string }) | null> {
  const { rows } = await client.query<StateRow & { org_name: string }>(
    `SELECT i.id, i.org_id, i.invited_by, i.invitee_email_norm, i.role, i.status,
            i.expires_at <= now() AS expired, i.expires_at, o.name AS org_name
       FROM app.org_invitations i
       JOIN app.orgs o ON o.id = i.org_id
      WHERE i.token_hash = $1`,
    [tokenHash],
  );
  return rows[0] === undefined ? null : { ...toState(rows[0]), orgName: rows[0].org_name };
}

/** Marks a pending invitation accepted by `userId`. */
export async function markAccepted(client: Queryable, invitationId: string, userId: string): Promise<void> {
  const { rowCount } = await client.query(
    `UPDATE app.org_invitations SET status = 'accepted', accepted_by = $2, accepted_at = now()
      WHERE id = $1 AND status = 'pending'`,
    [invitationId, userId],
  );
  if (rowCount !== 1) throw new Error('the invitation was not pending when it was accepted');
}

/** Marks a pending invitation revoked by `userId` (an admin, or the invitee closing it as an existing member). */
export async function markRevoked(client: Queryable, invitationId: string, userId: string): Promise<void> {
  const { rowCount } = await client.query(
    `UPDATE app.org_invitations SET status = 'revoked', revoked_by = $2, revoked_at = now()
      WHERE id = $1 AND status = 'pending'`,
    [invitationId, userId],
  );
  if (rowCount !== 1) throw new Error('the invitation was not pending when it was revoked');
}

/** The org's pending invitations (expired ones included, with their expiry), newest first. Never a token or its hash. */
export async function listPending(client: Queryable, orgId: string): Promise<PendingInvitation[]> {
  const { rows } = await client.query<PendingRow>(
    `SELECT ${PENDING_COLUMNS} FROM app.org_invitations
      WHERE org_id = $1 AND status = 'pending'
      ORDER BY created_at DESC, id`,
    [orgId],
  );
  return rows.map(toPendingInvitation);
}
