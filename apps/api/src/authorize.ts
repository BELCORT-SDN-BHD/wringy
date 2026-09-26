/**
 * Organisation-scoped authorisation: who may do what in which org, re-read from
 * PostgreSQL on every request, and the one lock order every org command takes
 * (kickoff-package.md §3.1, §3.3, IT2; M2-03 code review R4, R5, R12, R18).
 * Serves M2-AC03/2 ("每次读写重核实际成员、组织和能力") and M2-AC03/3 (every
 * refusal of this logic is audited, and nothing it writes carries a secret).
 *
 * **The org is the path.** Every org route is `/orgs/:orgId/…`; a body or header
 * `orgId` is never read (bodies are plain `z.object`s, which strip it). The path
 * is a claim, and the functions here re-authorise it against the caller's active
 * membership each time: a stale tab, a cached page or a replayed request cannot
 * act in an org the caller has left.
 *
 * **Reads** (`runOrgRead`) check the membership on a pooled client and release it;
 * a non-member and an unknown org get the one 403 `org.forbidden` (no existence
 * oracle) and a denial row.
 *
 * **Commands** (`runOrgCommand`) run inside one transaction, in this order, and
 * no other (revision 1's "own row, then the org" order deadlocked, `40P01`, under
 * ordinary concurrent admin actions):
 *
 * 1. session liveness on the transaction client (§4.6);
 * 2. the caller's profile `FOR SHARE` (an account disabled since the hook's read
 *    is refused before any work);
 * 3. an **unlocked** read of the caller's membership: an outsider is refused
 *    here and never takes an org lock;
 * 4. the org row `FOR NO KEY UPDATE` — the one mutex of the org. `NO KEY`, so
 *    foreign-key inserts by other transactions (which take `KEY SHARE` on the
 *    org) are not blocked, while two commands on one org serialise;
 * 5. the caller's membership and role re-read under that lock;
 * 6. then the command's own target rows (`FOR UPDATE`), the last-admin count,
 *    the write and its audit row, in the caller's `work`.
 *
 * Accepting an invitation (`routes/invitations.ts`) learns the org and the
 * address from the invitation, refuses another address before any lock (like
 * step 3, an outsider never takes an org lock), and follows the same order from
 * step 4 on; under the org lock it
 * also re-checks that the admin who sent the invitation still is one
 * (`isActiveAdmin`), because the invitation acts on that admin's authority.
 *
 * A refusal anywhere throws `Refused`; the transaction rolls back, and the catch
 * here writes the denial row with `auditDenial` (a fresh client, after the
 * rollback) and answers. Liveness and profile refusals (steps 1–2) are decided
 * before an actor is admitted to the authorisation logic and are **not** audited
 * (R4's scope): no signed-out or disabled caller can write a row. A `23505` on
 * `org_invitations_pending_address_key` is answered as 409 `invitation.pending`
 * (a backstop; the org lock already serialises two invitations of one address).
 * A deadlock, `40P01`, stays a 500: with one lock order it is a bug.
 *
 * **Capabilities** are plain reads (the runtime role holds SELECT only on
 * `admin_scopes` and `platform_grants`, so it could not lock them anyway):
 * `requireOrgCapability` and `requirePlatformGrant` are preHandlers for the
 * tickets that first put an action behind a grant. Holding a capability implies
 * no membership, and being an admin implies no capability.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  orgParamsSchema,
  type OrgCapability,
  type OrgRole,
  type PlatformCapability,
} from '@wringy/contracts';
import type { Pool, PoolClient } from '@wringy/db';

import {
  auditDenial,
  userAuditActor,
  writeAudit,
  type AuditAction,
  type AuditEntry,
  type AuditTargetType,
} from './audit';
import { actorOf, type Actor } from './authenticate';
import { sqlStateOf, withDatabase, withTransaction } from './database';
import { errorBody, type ErrorCode } from './errors';
import { lockProfileStatusForShare } from './profiles';
import { NOT_LIVE_REFUSAL, type SessionLiveness } from './session-liveness';

type Queryable = Pick<PoolClient, 'query'>;

// --- The reads -----------------------------------------------------------------

/** What the unlocked membership read found: whether the org exists, and the caller's active role in it. */
export interface OrgAccess {
  orgExists: boolean;
  /** Null when the caller has no active membership (never joined, removed, or left). */
  role: OrgRole | null;
}

/**
 * The caller's active membership in `orgId`, unlocked. One statement tells an
 * unknown org from a non-member, for the denial row's reason; the caller hears
 * the same 403 for both.
 */
export async function readActiveMembership(client: Queryable, orgId: string, userId: string): Promise<OrgAccess> {
  const { rows } = await client.query<{ role: OrgRole | null }>(
    `SELECT m.role
       FROM app.orgs o
       LEFT JOIN app.org_members m ON m.org_id = o.id AND m.user_id = $2 AND m.status = 'active'
      WHERE o.id = $1`,
    [orgId, userId],
  );
  const row = rows[0];
  return row === undefined ? { orgExists: false, role: null } : { orgExists: true, role: row.role };
}

/**
 * Step 4: the org row `FOR NO KEY UPDATE`, the mutex every command in the org
 * takes first. Possible because the runtime role holds `UPDATE (name)` on
 * `app.orgs` (0011). False when there is no such org.
 */
export async function lockOrgRow(client: Queryable, orgId: string): Promise<boolean> {
  const { rows } = await client.query(`SELECT id FROM app.orgs WHERE id = $1 FOR NO KEY UPDATE`, [orgId]);
  return rows.length === 1;
}

/**
 * Step 5: the caller's active role, re-read once the org lock is held. A plain
 * read is enough: every change to a membership of this org takes the same lock
 * first, so nothing can change it now.
 */
export async function readMembershipUnderLock(client: Queryable, orgId: string, userId: string): Promise<OrgRole | null> {
  const { rows } = await client.query<{ role: OrgRole }>(
    `SELECT role FROM app.org_members WHERE org_id = $1 AND user_id = $2 AND status = 'active'`,
    [orgId, userId],
  );
  return rows[0]?.role ?? null;
}

/**
 * Active admins of `orgId` whose **profile is active** (a disabled admin cannot
 * act, so it does not keep the org administrable; ruling D3), leaving out
 * `exceptUserId` when given — the member a command is about to demote or remove.
 * Zero means the change would leave the org without an admin.
 */
export async function countActiveAdmins(client: Queryable, orgId: string, exceptUserId?: string): Promise<number> {
  const { rows } = await client.query<{ admins: number }>(
    `SELECT count(*)::int AS admins
       FROM app.org_members m
       JOIN app.profiles p ON p.id = m.user_id AND p.status = 'active'
      WHERE m.org_id = $1 AND m.status = 'active' AND m.role = 'admin'
        AND ($2::uuid IS NULL OR m.user_id <> $2::uuid)`,
    [orgId, exceptUserId ?? null],
  );
  return rows[0]?.admins ?? 0;
}

/**
 * Whether `userId` is an active admin of `orgId` whose **profile is active** â€”
 * the same standing `countActiveAdmins` counts. An invitation is sent on its
 * inviter's authority, so accept and preview ask this of `invited_by` at the
 * moment the link is used (R7 rev 3): once the inviter is removed, has left, has
 * been demoted or has been disabled, their pending invitations admit nobody.
 * Under the org lock (accept) a plain read is enough, as for step 5.
 */
export async function isActiveAdmin(client: Queryable, orgId: string, userId: string): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1
       FROM app.org_members m
       JOIN app.profiles p ON p.id = m.user_id AND p.status = 'active'
      WHERE m.org_id = $1 AND m.user_id = $2 AND m.status = 'active' AND m.role = 'admin'`,
    [orgId, userId],
  );
  return rows.length === 1;
}

/** The org capabilities `userId` holds on `orgId` (`app.admin_scopes`, written only by `pnpm db:grant`). */
export async function readOrgCapabilities(client: Queryable, userId: string, orgId: string): Promise<OrgCapability[]> {
  const { rows } = await client.query<{ capability: OrgCapability }>(
    `SELECT capability FROM app.admin_scopes WHERE user_id = $1 AND org_id = $2 ORDER BY capability`,
    [userId, orgId],
  );
  return rows.map((row) => row.capability);
}

/** The platform capabilities `userId` holds (`app.platform_grants`, written only by `pnpm db:grant`). */
export async function readPlatformGrants(client: Queryable, userId: string): Promise<PlatformCapability[]> {
  const { rows } = await client.query<{ capability: PlatformCapability }>(
    `SELECT capability FROM app.platform_grants WHERE user_id = $1 ORDER BY capability`,
    [userId],
  );
  return rows.map((row) => row.capability);
}

// --- Refusals ------------------------------------------------------------------

/** The parts of a denial row a refusal may name; the rest comes from the request and the command. */
export type AuditDetail = Partial<Pick<AuditEntry, 'action' | 'contextOrgId' | 'targetType' | 'targetId' | 'summary'>>;

/**
 * A refusal of the authorisation logic (R12's audited codes). Throwing it rolls
 * the transaction back; the catch writes one denial row and answers
 * `status` with `code`. `reason` is a fixed word for the row and the log line,
 * never user input.
 */
export class Refused extends Error {
  override readonly name = 'Refused';
  constructor(
    readonly status: 403 | 404 | 409,
    readonly code: ErrorCode,
    readonly reason: string,
    readonly audit: AuditDetail = {},
  ) {
    super(`refused: ${reason}`);
  }
}

/**
 * A refusal decided before the authorisation logic admits the actor (a session
 * that ended, a disabled or missing profile): answered, logged as a reason word,
 * and **not** audited (R4's scope).
 */
class NotAdmitted extends Error {
  override readonly name = 'NotAdmitted';
  constructor(
    readonly status: 401 | 403 | 503,
    readonly code: ErrorCode,
    readonly reason: string,
  ) {
    super(`not admitted: ${reason}`);
  }
}

/** A refusal, or the 23505 backstop of R5 mapped to one; undefined for anything else. */
function refusalOf(error: unknown): Refused | undefined {
  if (error instanceof Refused) return error;
  const constraint = (error as { constraint?: unknown } | null)?.constraint;
  if (sqlStateOf(error) === '23505' && constraint === 'org_invitations_pending_address_key') {
    return new Refused(409, 'invitation.pending', 'pending_exists');
  }
  return undefined;
}

/** `base` with every defined value of `detail` laid over it. */
function withDetail(base: AuditDetail, detail: AuditDetail): AuditDetail {
  const merged: AuditDetail = { ...base };
  for (const [key, value] of Object.entries(detail) as Array<[keyof AuditDetail, unknown]>) {
    if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}

/** What a command or read is, for its audit rows: the action and, when known, the org and the target. */
export interface CommandFrame {
  action: AuditAction;
  contextOrgId?: string;
  targetType?: AuditTargetType;
  targetId?: string;
}

/**
 * Writes the denial row (after the refused work's transaction has ended) and
 * answers. The row write never throws (`auditDenial`), so a refusal is always
 * answered as the refusal it is.
 */
async function answerRefusal(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  frame: CommandFrame,
  refusal: Refused,
): Promise<FastifyReply> {
  const detail = withDetail(frame, refusal.audit);
  await auditDenial(
    pool,
    {
      ...userAuditActor(request),
      action: detail.action ?? frame.action,
      contextOrgId: detail.contextOrgId,
      targetType: detail.targetType,
      targetId: detail.targetId,
      summary: detail.summary,
      outcome: 'denied',
      denialCode: refusal.code,
      reason: refusal.reason,
    },
    request.log,
  );
  request.log.info({ reason: refusal.reason, code: refusal.code }, 'request refused');
  return reply.code(refusal.status).send(errorBody(refusal.code));
}

// --- Commands ------------------------------------------------------------------

/** The command's answer, or the reply already sent for its refusal. */
export type CommandOutcome<T> = { refused: FastifyReply } | { value: T };

export interface CommandDeps {
  pool: Pool;
  liveness: SessionLiveness;
}

/** What a command's work receives besides its transaction client. */
export interface CommandContext {
  actor: Actor;
  /** Writes this command's allowed row on the transaction client: it commits with the change or not at all. */
  audit(detail?: AuditDetail): Promise<void>;
  /**
   * Writes a denial row on the transaction client. Only for a refusal that
   * commits a change of its own (accepting as an existing member closes the
   * invitation): the row belongs to that transaction. Every other refusal throws
   * `Refused`.
   */
  auditDenied(code: ErrorCode, reason: string, detail?: AuditDetail): Promise<void>;
}

/** A command inside an org: the org of the path and the caller's role there, re-read under the org lock. */
export interface OrgCommandContext extends CommandContext {
  orgId: string;
  role: OrgRole;
}

/**
 * Steps 1–2 of R5 and the refusal handling, for a command that is not (yet) in
 * an org: creating one, accepting an invitation. `work` runs on the transaction
 * client after the session and the profile have been re-checked there.
 */
export async function runCommand<T>(
  { pool, liveness }: CommandDeps,
  request: FastifyRequest,
  reply: FastifyReply,
  frame: CommandFrame,
  work: (client: PoolClient, context: CommandContext) => Promise<T>,
): Promise<CommandOutcome<T>> {
  const actor = actorOf(request);
  const who = userAuditActor(request);
  const entry = (detail: AuditDetail, outcome: AuditEntry['outcome']): AuditEntry => {
    const merged = withDetail(frame, detail);
    return {
      ...who,
      action: merged.action ?? frame.action,
      contextOrgId: merged.contextOrgId,
      targetType: merged.targetType,
      targetId: merged.targetId,
      summary: merged.summary,
      outcome,
    };
  };

  try {
    const value = await withTransaction(pool, async (client) => {
      const state = await liveness.check(actor, client);
      if (state !== 'live') {
        const { status, code } = NOT_LIVE_REFUSAL[state];
        throw new NotAdmitted(status, code, `session_${state}`);
      }
      const status = await lockProfileStatusForShare(client, actor.userId);
      if (status === 'disabled') throw new NotAdmitted(403, 'account.disabled', 'account_disabled');
      if (status === null) throw new NotAdmitted(403, 'profile.missing', 'profile_missing');

      return work(client, {
        actor,
        audit: (detail = {}) => writeAudit(client, entry(detail, 'allowed')),
        auditDenied: (code, reason, detail = {}) =>
          writeAudit(client, { ...entry(detail, 'denied'), denialCode: code, reason }),
      });
    });
    return { value };
  } catch (error) {
    if (error instanceof NotAdmitted) {
      request.log.info({ reason: error.reason }, 'request refused');
      return { refused: reply.code(error.status).send(errorBody(error.code)) };
    }
    const refusal = refusalOf(error);
    if (refusal === undefined) throw error;
    return { refused: await answerRefusal(pool, request, reply, frame, refusal) };
  }
}

export interface OrgCommandOptions {
  action: AuditAction;
  /** `admin`: only an admin of the org; `member`: any active member. */
  role: OrgRole;
  /** The command's target for its audit rows; the org itself when omitted. */
  targetType?: AuditTargetType;
  targetId?: string;
}

/**
 * A command in the org of the path: R5 steps 1–5, then `work` (step 6 on) with
 * the org locked and the caller's role re-read under the lock.
 */
export async function runOrgCommand<T>(
  deps: CommandDeps,
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  options: OrgCommandOptions,
  work: (client: PoolClient, context: OrgCommandContext) => Promise<T>,
): Promise<CommandOutcome<T>> {
  const frame: CommandFrame = {
    action: options.action,
    contextOrgId: orgId,
    targetType: options.targetType ?? 'org',
    targetId: options.targetId ?? orgId,
  };
  const forbidden = (reason: 'not_a_member' | 'org_unknown') =>
    new Refused(403, 'org.forbidden', reason, { targetType: 'org', targetId: orgId });

  return runCommand(deps, request, reply, frame, async (client, context) => {
    const userId = context.actor.userId;
    // 3. Unlocked: an outsider is refused before taking any org lock.
    const access = await readActiveMembership(client, orgId, userId);
    if (access.role === null) throw forbidden(access.orgExists ? 'not_a_member' : 'org_unknown');
    // 4. The org's mutex, before any other row of the org.
    if (!(await lockOrgRow(client, orgId))) throw forbidden('org_unknown');
    // 5. The role that decides, read under the lock.
    const role = await readMembershipUnderLock(client, orgId, userId);
    if (role === null) throw forbidden('not_a_member');
    if (options.role === 'admin' && role !== 'admin') throw new Refused(403, 'org.admin_required', 'admin_required');
    return work(client, { ...context, orgId, role });
  });
}

// --- Reads ---------------------------------------------------------------------

/**
 * A read in the org of the path: the caller's active membership is checked on a
 * pooled client, then `work` reads with the same client, which is released
 * before a denial row is written. Reads rely on the token alone (§4.6): no
 * liveness check, no lock. Allowed reads are not audited (R4).
 */
export async function runOrgRead<T>(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  work: (client: PoolClient, role: OrgRole) => Promise<T>,
): Promise<CommandOutcome<T>> {
  const frame: CommandFrame = { action: 'org.read', contextOrgId: orgId, targetType: 'org', targetId: orgId };
  return runRead(pool, request, reply, frame, async (client) => {
    const access = await readActiveMembership(client, orgId, actorOf(request).userId);
    if (access.role === null) throw new Refused(403, 'org.forbidden', access.orgExists ? 'not_a_member' : 'org_unknown');
    return work(client, access.role);
  });
}

/**
 * Any read whose refusals are audited: `work` runs on a pooled client and may
 * throw `Refused`; the denial row is written after the client is released.
 */
export async function runRead<T>(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  frame: CommandFrame,
  work: (client: PoolClient) => Promise<T>,
): Promise<CommandOutcome<T>> {
  try {
    return { value: await withDatabase(pool, work) };
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    return { refused: await answerRefusal(pool, request, reply, frame, error) };
  }
}

// --- Capability guards (for the tickets that put an action behind a grant) -------

/**
 * A preHandler: returns undefined to let the route run, or the reply it sent.
 * The same shape as `LiveSessionGuard`, so a route can list both.
 */
export type CapabilityGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply | undefined>;

/**
 * Lets the route run only for a caller holding `capability` on the org of the
 * path (`:orgId`). A grant on another org gives nothing here, `review` gives
 * nothing of `finance` and the reverse, and membership (admin included) gives
 * nothing at all. A refusal is 403 `capability.required`, audited as
 * `capability.use` with the reason `capability_required`.
 */
export function requireOrgCapability(pool: Pool, capability: OrgCapability): CapabilityGuard {
  return async (request, reply) => {
    const params = orgParamsSchema.safeParse(request.params);
    if (!params.success) {
      // No org can be named from this path, so there is nothing to authorise or audit.
      request.log.info({ reason: 'org_id_not_a_uuid' }, 'request rejected');
      return reply.code(400).send(errorBody('bad_request'));
    }
    const { orgId } = params.data;
    const held = await withDatabase(pool, (client) => readOrgCapabilities(client, actorOf(request).userId, orgId));
    if (held.includes(capability)) return undefined;
    return answerRefusal(
      pool,
      request,
      reply,
      { action: 'capability.use', contextOrgId: orgId },
      new Refused(403, 'capability.required', 'capability_required'),
    );
  };
}

/**
 * Lets the route run only for a caller holding the platform `capability`. No
 * membership and no org capability stands in for it. A refusal is 403
 * `capability.required`, audited as `capability.use` with the reason
 * `platform_grant_required`.
 */
export function requirePlatformGrant(pool: Pool, capability: PlatformCapability): CapabilityGuard {
  return async (request, reply) => {
    const held = await withDatabase(pool, (client) => readPlatformGrants(client, actorOf(request).userId));
    if (held.includes(capability)) return undefined;
    return answerRefusal(
      pool,
      request,
      reply,
      { action: 'capability.use' },
      new Refused(403, 'capability.required', 'platform_grant_required'),
    );
  };
}
