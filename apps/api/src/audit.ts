/**
 * The API's one audit writer, `app.audit_log` (migration 0016; kickoff-package.md
 * §3.2, ruling D9; M2-03 code review R3, R4, R11). Serves M2-AC03/3: every
 * allowed organisation command and every refusal of the authorisation logic
 * leaves one row, and no row carries a secret.
 *
 * Two entry points, one statement:
 *
 * - `writeAudit(client, entry)` runs on the **command's own transaction client**,
 *   so an allowed change and its audit row commit or roll back together. A
 *   failed audit insert fails the command: nothing is written without its row.
 * - `auditDenial(pool, entry, log)` is for a refusal. It runs **after** the
 *   refused transaction has rolled back (or the read has released its client),
 *   on a fresh pool client in its own short transaction (IT4), so the denial row
 *   survives the rollback of the work it refused. It never throws: a failure is
 *   logged at `warn` as a reason word and the refusal is still answered, so the
 *   audit can neither fail open nor turn a 403 into a 500.
 *
 * What a row holds, and only that: the actor (`user` with the verified subject,
 * or `system`; `bootstrap` rows are written by `packages/db` alone, and the type
 * below cannot name one), the org of the path, a stable `noun.verb` action, the
 * target (a uuid), the outcome, the error code of a denial, a fixed reason word,
 * a typed before/after summary (role, status, capability, org name — checked at
 * run time by `assertSummaryShape`), the request id (R11: a UUID per request, the
 * `reqId` of every log line) and `session_ref`, the sha256 of the session id. The
 * token, the cookie, the session id itself and any address never reach it.
 *
 * The runtime role has INSERT on the columns written here and no SELECT on the
 * table (0016), so the insert has no `RETURNING`: reading the row back would
 * need SELECT, and PostgreSQL refuses it with 42501.
 */
import { createHash } from 'node:crypto';

import type { FastifyBaseLogger, FastifyRequest } from 'fastify';

import type { Pool } from '@wringy/db';

import { actorOf } from './authenticate';
import { sqlStateOf, withTransaction } from './database';
import type { ErrorCode } from './errors';

type Queryable = { query(sql: string, values: unknown[]): Promise<unknown> };

/**
 * Every action the audit log knows, `noun.verb` (R4). Stable: a row written today
 * is read by the same name later. `allowlist.*` and `capability.grant|revoke` as
 * allowed changes are written by the operator scripts in `packages/db` (R6); the
 * API writes `capability.grant` only as the refusal of R18. `capability.use` is
 * the refusal of the capability guards (`requireOrgCapability`,
 * `requirePlatformGrant`), which are not an org read.
 */
export const AUDIT_ACTIONS = [
  'org.create',
  'org.rename',
  'org.read',
  'invitation.create',
  'invitation.revoke',
  'invitation.accept',
  'invitation.preview',
  'member.role_change',
  'member.remove',
  'member.leave',
  'capability.grant',
  'capability.revoke',
  'capability.use',
  'allowlist.add',
  'allowlist.remove',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** What a row's `target_id` names. Always a uuid when the API writes it. */
export type AuditTargetType = 'org' | 'org_member' | 'org_invitation' | 'admin_scope' | 'platform_grant';

/** The four fields a summary may carry, on either side (R4). Nothing else: never an address. */
export const AUDIT_SUMMARY_FIELDS = ['role', 'status', 'capability', 'name'] as const;
export type AuditSummaryField = (typeof AUDIT_SUMMARY_FIELDS)[number];

/** One side of a change. */
export type AuditSummarySide = { readonly [K in AuditSummaryField]?: string };

/** The typed before/after shape of an audit row's `summary`. */
export interface AuditSummary {
  readonly before?: AuditSummarySide;
  readonly after?: AuditSummarySide;
}

/**
 * One audit row as the API writes it. A closed type: `actorKind` cannot be
 * `bootstrap` (only the operator scripts write that, and `recorded_by` would
 * tell them apart anyway), `action` is one of AUDIT_ACTIONS, and `denialCode`
 * is an API error code.
 */
export interface AuditEntry {
  actorKind: 'user' | 'system';
  /** The verified token subject for `user`; null for `system` (audit_log_actor_user_check). */
  actorUserId: string | null;
  /** The org of the path (or the invitation's org); no foreign key, so an unknown org id is kept as asked. */
  contextOrgId?: string;
  action: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  outcome: 'allowed' | 'denied';
  /** Exactly when `outcome` is `denied` (audit_log_denial_code_check). */
  denialCode?: ErrorCode;
  /** A fixed reason word (`not_a_member`, `not_in_org`, …); never user input. */
  reason?: string;
  summary?: AuditSummary;
  /** The request's id (R11), the `reqId` of its log lines. */
  requestId: string;
  /** sha256 hex of the session id; null only for `system`. */
  sessionRef: string | null;
}

/** A summary that is not the typed before/after shape. Thrown before anything is written. */
export class AuditShapeError extends Error {
  override readonly name = 'AuditShapeError';
}

/**
 * Throws unless `summary` is `{ before?, after? }` with each side holding only
 * `role`, `status`, `capability` or `name` as strings. Run-time, because a value
 * typed `any` or spread from a row could carry a key the type never allowed (an
 * `email`, a `token`), and the audit log is where such a key must never land.
 */
export function assertSummaryShape(summary: unknown): asserts summary is AuditSummary | undefined {
  if (summary === undefined) return;
  if (summary === null || typeof summary !== 'object' || Array.isArray(summary)) {
    throw new AuditShapeError('An audit summary must be an object.');
  }
  for (const [side, fields] of Object.entries(summary)) {
    if (side !== 'before' && side !== 'after') throw new AuditShapeError(`An audit summary may not carry "${side}".`);
    if (fields === undefined) continue;
    if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new AuditShapeError(`The audit summary's "${side}" must be an object.`);
    }
    for (const [key, value] of Object.entries(fields)) {
      if (!(AUDIT_SUMMARY_FIELDS as readonly string[]).includes(key)) {
        throw new AuditShapeError(`An audit summary may not carry "${side}.${key}".`);
      }
      if (value !== undefined && typeof value !== 'string') {
        throw new AuditShapeError(`The audit summary's "${side}.${key}" must be a string.`);
      }
    }
  }
}

/**
 * The audit log's reference to a session: sha256 of the session id, lower-case
 * hex (64 characters, audit_log_session_ref_check). An operator holding the
 * session id can find its rows; the row tells nobody the id.
 */
export function sessionRefOf(sessionId: string): string {
  return createHash('sha256').update(sessionId, 'utf8').digest('hex');
}

/** The actor half of a row for a request that came through the authentication hook. */
export function userAuditActor(
  request: FastifyRequest,
): Pick<AuditEntry, 'actorKind' | 'actorUserId' | 'requestId' | 'sessionRef'> {
  const actor = actorOf(request);
  return {
    actorKind: 'user',
    actorUserId: actor.userId,
    requestId: String(request.id),
    sessionRef: sessionRefOf(actor.sessionId),
  };
}

/**
 * Writes one row on `client`, inside whatever transaction the caller holds.
 * Every column but `id`, `occurred_at` and `recorded_by` is named (the database
 * fills those three; the API may not write them). Each value has its own
 * placeholder: one placeholder feeding a uuid column and a text column makes
 * PostgreSQL refuse the statement ("inconsistent types deduced").
 */
export async function writeAudit(client: Queryable, entry: AuditEntry): Promise<void> {
  assertSummaryShape(entry.summary);
  await client.query(
    `INSERT INTO app.audit_log
            (actor_kind, actor_user_id, actor_label, context_org_id, action, target_type, target_id,
             outcome, denial_code, reason, summary, request_id, session_ref)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)`,
    [
      entry.actorKind,
      entry.actorUserId,
      entry.contextOrgId ?? null,
      entry.action,
      entry.targetType ?? null,
      entry.targetId ?? null,
      entry.outcome,
      entry.denialCode ?? null,
      entry.reason ?? null,
      entry.summary === undefined ? null : JSON.stringify(entry.summary),
      entry.requestId,
      entry.sessionRef,
    ],
  );
}

/**
 * Writes a denial row in its own short transaction on a fresh pool client, and
 * never throws. Call it only after the refused work's transaction has rolled back
 * and its client is released: the row must not share the fate of the work it
 * refused. On failure the refusal is still answered; the log gets a reason word
 * and the SQLSTATE, nothing else.
 */
export async function auditDenial(pool: Pool, entry: AuditEntry, log: Pick<FastifyBaseLogger, 'warn'>): Promise<void> {
  try {
    await withTransaction(pool, (client) => writeAudit(client, entry));
  } catch (error) {
    log.warn({ reason: 'audit_write_failed', code: sqlStateOf(error) ?? 'none' }, 'denial audit row not written');
  }
}
