/**
 * Capability grants, written only by `pnpm db:grant` as the migrator
 * (`app.admin_scopes` 0014, `app.platform_grants` 0015; kickoff-package.md §3.2,
 * ruling D4 "grants are written by an operator script, never in the app"; M2-03
 * code review R6). Serves M2-AC03/1 (no self-service escalation: the runtime role
 * has SELECT only on both tables) and M2-AC03/3 (every grant and revocation is
 * audited, with no secret in the row).
 *
 * Each change and its audit row are **one statement**: a data-modifying CTE
 * (`WITH changed AS (INSERT|DELETE … RETURNING …) INSERT INTO app.audit_log …
 * SELECT … FROM changed`), so they commit or fail together whatever the
 * caller's transaction state — a failure of the audit insert leaves no grant
 * written. The audit row is `actor_kind = 'bootstrap'`, `actor_label = --by`,
 * `action = capability.grant | capability.revoke`, `target_type = admin_scope |
 * platform_grant`, `target_id = <user id>`, `context_org_id` for an org scope,
 * `reason = --reason` and `summary = { after: { capability } }` (grant) or
 * `{ before: { capability } }` (revoke); `recorded_by` is the writing login,
 * which the database fills in. A grant that already exists and a revocation of
 * nothing change nothing and write no audit row.
 *
 * Revocation deletes the grant row (the migrator owns the tables); the audit
 * row keeps the history. The person must already have a profile (the foreign
 * key): a subject that has never signed in is refused with a message that says
 * so.
 *
 * This module imports only `pg`'s types and never `import.meta`, so the
 * Playwright internal suite (CommonJS) can load it, as it loads allowlist.ts
 * (test/connect.ts).
 */
import type pg from 'pg';

type Queryable = Pick<pg.ClientBase, 'query'>;

/** Org-scoped capabilities: the CHECK of `app.admin_scopes.capability` (0014). */
export const ORG_GRANT_CAPABILITIES = ['review', 'finance'] as const;
export type OrgGrantCapability = (typeof ORG_GRANT_CAPABILITIES)[number];

/** Platform capabilities: the CHECK of `app.platform_grants.capability` (0015). */
export const PLATFORM_GRANT_CAPABILITIES = ['ops_runtime'] as const;
export type PlatformGrantCapability = (typeof PLATFORM_GRANT_CAPABILITIES)[number];

/** A grant or revocation this module refuses before or instead of writing it. */
export class GrantRefusedError extends Error {
  override readonly name = 'GrantRefusedError';
}

/** Who decided, and why: both required, both stored on the grant and in the audit row. */
export interface GrantAuthor {
  reason: string;
  by: string;
}

export interface OrgCapabilityGrant {
  userId: string;
  orgId: string;
  capability: OrgGrantCapability;
  grantedByOperator: string;
  reason: string;
  grantedAt: Date;
}

export interface PlatformCapabilityGrant {
  userId: string;
  capability: PlatformGrantCapability;
  grantedByOperator: string;
  reason: string;
  grantedAt: Date;
}

export type GrantOutcome = 'granted' | 'already_granted';
export type RevokeOutcome = 'revoked' | 'absent';

export interface GrantResult<T> {
  outcome: GrantOutcome;
  /** The grant as it stands afterwards (the existing one when it was already held). */
  grant: T;
}

export interface RevokeResult<T> {
  outcome: RevokeOutcome;
  /** The grant as it was, when there was one. */
  grant?: T;
}

export interface OrgGrantOptions extends GrantAuthor {
  userId: string;
  orgId: string;
  capability: OrgGrantCapability;
}

export interface PlatformGrantOptions extends GrantAuthor {
  userId: string;
  capability: PlatformGrantCapability;
}

interface OrgRow {
  user_id: string;
  org_id: string;
  capability: OrgGrantCapability;
  granted_by_operator: string;
  reason: string;
  granted_at: Date;
}

interface PlatformRow {
  user_id: string;
  capability: PlatformGrantCapability;
  granted_by_operator: string;
  reason: string;
  granted_at: Date;
}

const toOrgGrant = (row: OrgRow): OrgCapabilityGrant => ({
  userId: row.user_id,
  orgId: row.org_id,
  capability: row.capability,
  grantedByOperator: row.granted_by_operator,
  reason: row.reason,
  grantedAt: row.granted_at,
});

const toPlatformGrant = (row: PlatformRow): PlatformCapabilityGrant => ({
  userId: row.user_id,
  capability: row.capability,
  grantedByOperator: row.granted_by_operator,
  reason: row.reason,
  grantedAt: row.granted_at,
});

/**
 * `--reason` and `--by` are stored in the audit log, which never holds an
 * address (R3): a value with `@` is refused, as is a blank one.
 */
function operatorText(label: '--reason' | '--by', value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new GrantRefusedError(`${label} is required and may not be blank.`);
  if (trimmed.includes('@')) {
    throw new GrantRefusedError(`${label} may not contain "@": the audit log never stores an address.`);
  }
  return trimmed;
}

function assertOneOf<T extends string>(value: string, allowed: readonly T[], what: string): asserts value is T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new GrantRefusedError(`Unknown ${what} "${value}"; expected one of ${allowed.join(', ')}.`);
  }
}

/**
 * Maps the foreign-key refusals of a grant to what the operator can act on. The
 * statement names the subject and the org by id only, so the message carries no
 * value that is not already on the operator's own command line.
 */
function refusalOf(error: unknown): never {
  const { code, constraint } = error as { code?: string; constraint?: string };
  if (code === '23503' && (constraint === 'admin_scopes_user_id_fkey' || constraint === 'platform_grants_user_id_fkey')) {
    throw new GrantRefusedError(
      'No profile for this user id: this subject has never signed in. A grant needs a person who has signed in once.',
    );
  }
  if (code === '23503' && constraint === 'admin_scopes_org_id_fkey') {
    throw new GrantRefusedError('No organisation has this org id.');
  }
  if (code === '22P02') throw new GrantRefusedError('A user id or org id is not a UUID.');
  throw error;
}

const ORG_COLUMNS = 'user_id, org_id, capability, granted_by_operator, reason, granted_at';
const PLATFORM_COLUMNS = 'user_id, capability, granted_by_operator, reason, granted_at';

/** Grants `capability` on `orgId` to `userId`, and audits it in the same statement. */
export async function grantOrgCapability(
  client: Queryable,
  options: OrgGrantOptions,
): Promise<GrantResult<OrgCapabilityGrant>> {
  assertOneOf(options.capability, ORG_GRANT_CAPABILITIES, 'org capability');
  const reason = operatorText('--reason', options.reason);
  const by = operatorText('--by', options.by);
  const params = [options.userId, options.orgId, options.capability, by, reason];
  let inserted: OrgRow | undefined;
  try {
    const { rows } = await client.query<OrgRow>(
      `WITH changed AS (
         INSERT INTO app.admin_scopes (user_id, org_id, capability, granted_by_operator, reason)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, org_id, capability) DO NOTHING
         RETURNING ${ORG_COLUMNS}
       ), audited AS (
         INSERT INTO app.audit_log
                (actor_kind, actor_label, context_org_id, action, target_type, target_id, outcome, reason, summary)
         SELECT 'bootstrap', $4, org_id, 'capability.grant', 'admin_scope', user_id::text, 'allowed', $5,
                jsonb_build_object('after', jsonb_build_object('capability', capability))
           FROM changed
       )
       SELECT ${ORG_COLUMNS} FROM changed`,
      params,
    );
    inserted = rows[0];
  } catch (error) {
    refusalOf(error);
  }
  if (inserted !== undefined) return { outcome: 'granted', grant: toOrgGrant(inserted) };
  const { rows } = await client.query<OrgRow>(
    `SELECT ${ORG_COLUMNS} FROM app.admin_scopes WHERE user_id = $1 AND org_id = $2 AND capability = $3`,
    params.slice(0, 3),
  );
  const existing = rows[0];
  if (existing === undefined) throw new Error('The grant was neither written nor found.');
  return { outcome: 'already_granted', grant: toOrgGrant(existing) };
}

/** Revokes `capability` on `orgId` from `userId`, and audits it in the same statement. */
export async function revokeOrgCapability(
  client: Queryable,
  options: OrgGrantOptions,
): Promise<RevokeResult<OrgCapabilityGrant>> {
  assertOneOf(options.capability, ORG_GRANT_CAPABILITIES, 'org capability');
  const reason = operatorText('--reason', options.reason);
  const by = operatorText('--by', options.by);
  let deleted: OrgRow | undefined;
  try {
    const { rows } = await client.query<OrgRow>(
      `WITH changed AS (
         DELETE FROM app.admin_scopes WHERE user_id = $1 AND org_id = $2 AND capability = $3
         RETURNING ${ORG_COLUMNS}
       ), audited AS (
         INSERT INTO app.audit_log
                (actor_kind, actor_label, context_org_id, action, target_type, target_id, outcome, reason, summary)
         SELECT 'bootstrap', $4, org_id, 'capability.revoke', 'admin_scope', user_id::text, 'allowed', $5,
                jsonb_build_object('before', jsonb_build_object('capability', capability))
           FROM changed
       )
       SELECT ${ORG_COLUMNS} FROM changed`,
      [options.userId, options.orgId, options.capability, by, reason],
    );
    deleted = rows[0];
  } catch (error) {
    refusalOf(error);
  }
  return deleted === undefined ? { outcome: 'absent' } : { outcome: 'revoked', grant: toOrgGrant(deleted) };
}

/** Grants the platform `capability` to `userId`, and audits it in the same statement. */
export async function grantPlatformCapability(
  client: Queryable,
  options: PlatformGrantOptions,
): Promise<GrantResult<PlatformCapabilityGrant>> {
  assertOneOf(options.capability, PLATFORM_GRANT_CAPABILITIES, 'platform capability');
  const reason = operatorText('--reason', options.reason);
  const by = operatorText('--by', options.by);
  const params = [options.userId, options.capability, by, reason];
  let inserted: PlatformRow | undefined;
  try {
    const { rows } = await client.query<PlatformRow>(
      `WITH changed AS (
         INSERT INTO app.platform_grants (user_id, capability, granted_by_operator, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, capability) DO NOTHING
         RETURNING ${PLATFORM_COLUMNS}
       ), audited AS (
         INSERT INTO app.audit_log (actor_kind, actor_label, action, target_type, target_id, outcome, reason, summary)
         SELECT 'bootstrap', $3, 'capability.grant', 'platform_grant', user_id::text, 'allowed', $4,
                jsonb_build_object('after', jsonb_build_object('capability', capability))
           FROM changed
       )
       SELECT ${PLATFORM_COLUMNS} FROM changed`,
      params,
    );
    inserted = rows[0];
  } catch (error) {
    refusalOf(error);
  }
  if (inserted !== undefined) return { outcome: 'granted', grant: toPlatformGrant(inserted) };
  const { rows } = await client.query<PlatformRow>(
    `SELECT ${PLATFORM_COLUMNS} FROM app.platform_grants WHERE user_id = $1 AND capability = $2`,
    params.slice(0, 2),
  );
  const existing = rows[0];
  if (existing === undefined) throw new Error('The grant was neither written nor found.');
  return { outcome: 'already_granted', grant: toPlatformGrant(existing) };
}

/** Revokes the platform `capability` from `userId`, and audits it in the same statement. */
export async function revokePlatformCapability(
  client: Queryable,
  options: PlatformGrantOptions,
): Promise<RevokeResult<PlatformCapabilityGrant>> {
  assertOneOf(options.capability, PLATFORM_GRANT_CAPABILITIES, 'platform capability');
  const reason = operatorText('--reason', options.reason);
  const by = operatorText('--by', options.by);
  let deleted: PlatformRow | undefined;
  try {
    const { rows } = await client.query<PlatformRow>(
      `WITH changed AS (
         DELETE FROM app.platform_grants WHERE user_id = $1 AND capability = $2
         RETURNING ${PLATFORM_COLUMNS}
       ), audited AS (
         INSERT INTO app.audit_log (actor_kind, actor_label, action, target_type, target_id, outcome, reason, summary)
         SELECT 'bootstrap', $3, 'capability.revoke', 'platform_grant', user_id::text, 'allowed', $4,
                jsonb_build_object('before', jsonb_build_object('capability', capability))
           FROM changed
       )
       SELECT ${PLATFORM_COLUMNS} FROM changed`,
      [options.userId, options.capability, by, reason],
    );
    deleted = rows[0];
  } catch (error) {
    refusalOf(error);
  }
  return deleted === undefined ? { outcome: 'absent' } : { outcome: 'revoked', grant: toPlatformGrant(deleted) };
}

export interface GrantListing {
  org: OrgCapabilityGrant[];
  platform: PlatformCapabilityGrant[];
}

/** Every grant, or every grant of `userId`, ordered by person, org and capability. Reads only. */
export async function listGrants(client: Queryable, userId?: string): Promise<GrantListing> {
  const subject = userId ?? null;
  try {
    const org = await client.query<OrgRow>(
      `SELECT ${ORG_COLUMNS} FROM app.admin_scopes
        WHERE $1::uuid IS NULL OR user_id = $1::uuid
        ORDER BY user_id, org_id, capability`,
      [subject],
    );
    const platform = await client.query<PlatformRow>(
      `SELECT ${PLATFORM_COLUMNS} FROM app.platform_grants
        WHERE $1::uuid IS NULL OR user_id = $1::uuid
        ORDER BY user_id, capability`,
      [subject],
    );
    return { org: org.rows.map(toOrgGrant), platform: platform.rows.map(toPlatformGrant) };
  } catch (error) {
    refusalOf(error);
  }
}
