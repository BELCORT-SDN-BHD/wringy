/**
 * The reviewed grant manifest (kickoff-package.md §4.11, §8.5; ruling D33 (ii)).
 *
 * Everything each runtime group may do in the database. The test "M2-AC01/2
 * runtime role privileges match reviewed grant manifest" (grants.int.test.ts)
 * computes the effective privileges of each runtime LOGIN (wringy_api_login,
 * wringy_worker_login) on every schema, table, column, sequence and function in
 * every non-system schema (all but `pg_*` and `information_schema`, so a new
 * schema is covered without an edit here) with has_*_privilege, and requires
 * them to equal this file exactly: a privilege listed here and missing fails,
 * and a privilege present and not listed fails. Column privileges are those a
 * login holds on a column without holding them on the whole table (a column
 * GRANT), so `columns` lists only column-level grants.
 *
 * Changing a grant therefore means changing a migration and this file in the
 * same review. `pgboss.*` stands for every object pg-boss installs, so a
 * pg-boss upgrade that adds a table needs no edit here unless the rights differ.
 * The migrator owns every object and is not listed.
 */
import { SESSION_IS_LIVE_SIGNATURE } from '../src/platform';
import { AUTH_SCHEMA, PLATFORM_SCHEMA, ROLES } from '../src/roles';

/** Schemas the scan skips: PostgreSQL's own catalogs (every `pg_*` schema, matched in SQL) and this one. */
export const SYSTEM_SCHEMAS = ['information_schema'] as const;

/**
 * Schemas the **platform bootstrap** owns, not the migrator: the hosted identity
 * store's `auth` (a three-column stub locally and in CI) and `platform`, whose
 * owner is `wringy_platform_admin` (M2-02 R3). Every runtime privilege in them is
 * still covered by the manifest below; what is excluded is only the "every ACL
 * names the migrator or a runtime group" assertion, because these objects have
 * another owner on purpose. grants.int.test.ts asserts their owners and grantees
 * in their own right.
 */
export const PLATFORM_BOOTSTRAP_SCHEMAS = [AUTH_SCHEMA, PLATFORM_SCHEMA] as const;

export const SCHEMA_PRIVILEGES = ['USAGE', 'CREATE'] as const;
export const TABLE_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] as const;
export const COLUMN_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] as const;
export const SEQUENCE_PRIVILEGES = ['USAGE', 'SELECT', 'UPDATE'] as const;

export type SchemaPrivilege = (typeof SCHEMA_PRIVILEGES)[number];
export type TablePrivilege = (typeof TABLE_PRIVILEGES)[number];
export type ColumnPrivilege = (typeof COLUMN_PRIVILEGES)[number];
export type SequencePrivilege = (typeof SEQUENCE_PRIVILEGES)[number];

export interface RoleGrants {
  /** The login that carries the group's rights at runtime. */
  login: string;
  /** Schema name to privileges. A schema not listed must grant the login nothing. */
  schemas: Readonly<Record<string, readonly SchemaPrivilege[]>>;
  /** `schema.table`, or `schema.*` for every table, partitioned table or view in the schema. An exact name wins. */
  tables: Readonly<Record<string, readonly TablePrivilege[]>>;
  /** `schema.table.column`: privileges granted on that column only, not on its table. */
  columns: Readonly<Record<string, readonly ColumnPrivilege[]>>;
  /** `schema.sequence` or `schema.*`. */
  sequences: Readonly<Record<string, readonly SequencePrivilege[]>>;
  /**
   * Functions the role may EXECUTE: `schema.name`, `schema.*`, or the full
   * `regprocedure` text (`schema.name(argtypes)`) when overloads matter.
   */
  functions: readonly string[];
}

export const GRANT_MANIFEST: Readonly<Record<'wringy_api' | 'wringy_worker', RoleGrants>> = {
  // Fastify: reads business rows and the operations records GET /health and
  // /internal/* need. No DDL and nothing in pgboss (kickoff-package.md §4.11,
  // §8.5): it reads the pg-boss schema version through the migrator-owned view
  // ops.pgboss_schema_version (0006). Its writes are column grants only (below):
  // the sign-in's profile columns (0010) and, since M2-03, the org, membership,
  // invitation and audit columns its commands write (0011–0016).
  wringy_api: {
    login: ROLES.apiLogin,
    // public: PostgreSQL's own default (PUBLIC keeps USAGE on it); nothing is
    // created there (migrations.int.test.ts, grants.int.test.ts).
    // platform: USAGE only, so the one EXECUTE below can be used. Nothing in
    // `auth`: the API reaches the identity store's sessions solely through that
    // SECURITY DEFINER function (M2-02 R3).
    schemas: { app: ['USAGE'], ops: ['USAGE'], platform: ['USAGE'], public: ['USAGE'] },
    tables: {
      // INSERT (name, created_by) and UPDATE (name) are column grants since 0011:
      // the API cannot choose an org's id, write its data_origin or change its
      // creator, and UPDATE (name) is what lets a command lock the org row.
      'app.orgs': ['SELECT'],
      'app.campaigns': ['SELECT'],
      // Memberships and invitations: read on the table, written per column
      // (0012, 0013), never deleted.
      'app.org_members': ['SELECT'],
      'app.org_invitations': ['SELECT'],
      // Capability grants: read only; `pnpm db:grant` writes them as the migrator
      // (0014, 0015; ruling D4).
      'app.admin_scopes': ['SELECT'],
      'app.platform_grants': ['SELECT'],
      // app.audit_log is deliberately absent: 0016 revokes the SELECT 0001's
      // default gave, so the table itself grants the API nothing and its INSERT
      // is per column below (no UPDATE, no DELETE, no sequence privilege).
      // The API upserts the profile at each sign-in and never deletes one (0008).
      // INSERT and UPDATE are column grants since 0010, so the table itself
      // carries SELECT only and the writable columns are listed below.
      'app.profiles': ['SELECT'],
      // The first-sign-in gate reads the list; only the migrator writes it (0009).
      'app.sign_in_allowlist': ['SELECT'],
      'ops.environment': ['SELECT'],
      'ops.worker_heartbeat': ['SELECT'],
      'ops.pgmigrations': ['SELECT'],
      'ops.pgboss_schema_version': ['SELECT'],
    },
    // Profiles: what a sign-in writes, and nothing else (0010; ruling D12, D7).
    // `status` is absent on purpose: only an operator disables an account, so the
    // runtime role must not be able to write it. `locale_pref` and
    // `locale_pref_set_at` are absent because M2-04 owns the feature that writes
    // them. Then the M2-03 columns (0011–0016; kickoff code review R1, R3).
    columns: {
      'app.profiles.id': ['INSERT'],
      'app.profiles.contact_email': ['INSERT', 'UPDATE'],
      'app.profiles.display_name': ['INSERT', 'UPDATE'],
      'app.profiles.last_sign_in_at': ['INSERT', 'UPDATE'],
      // 0011: create writes the name and the creator; rename writes the name.
      'app.orgs.name': ['INSERT', 'UPDATE'],
      'app.orgs.created_by': ['INSERT'],
      // 0012: create and accept insert; accept's re-activation upsert, role
      // change, remove and leave update. Never DELETE.
      'app.org_members.org_id': ['INSERT'],
      'app.org_members.user_id': ['INSERT'],
      'app.org_members.role': ['INSERT', 'UPDATE'],
      'app.org_members.status': ['UPDATE'],
      'app.org_members.grant_basis': ['INSERT', 'UPDATE'],
      'app.org_members.invitation_id': ['INSERT', 'UPDATE'],
      'app.org_members.granted_by': ['INSERT', 'UPDATE'],
      'app.org_members.granted_at': ['UPDATE'],
      'app.org_members.removed_by': ['UPDATE'],
      'app.org_members.removed_at': ['UPDATE'],
      'app.org_members.removal_basis': ['UPDATE'],
      // 0013: never UPDATE of role, expires_at or token_hash, so a bug cannot
      // escalate, extend or re-key a pending invitation.
      'app.org_invitations.org_id': ['INSERT'],
      'app.org_invitations.invited_by': ['INSERT'],
      'app.org_invitations.invitee_email_norm': ['INSERT'],
      'app.org_invitations.role': ['INSERT'],
      'app.org_invitations.token_hash': ['INSERT'],
      'app.org_invitations.expires_at': ['INSERT'],
      'app.org_invitations.status': ['UPDATE'],
      'app.org_invitations.accepted_by': ['UPDATE'],
      'app.org_invitations.accepted_at': ['UPDATE'],
      'app.org_invitations.revoked_by': ['UPDATE'],
      'app.org_invitations.revoked_at': ['UPDATE'],
      // 0016: append-only. Every column but id (identity), occurred_at (the
      // database clock) and recorded_by (the writing login, current_user).
      'app.audit_log.actor_kind': ['INSERT'],
      'app.audit_log.actor_user_id': ['INSERT'],
      'app.audit_log.actor_label': ['INSERT'],
      'app.audit_log.context_org_id': ['INSERT'],
      'app.audit_log.action': ['INSERT'],
      'app.audit_log.target_type': ['INSERT'],
      'app.audit_log.target_id': ['INSERT'],
      'app.audit_log.outcome': ['INSERT'],
      'app.audit_log.denial_code': ['INSERT'],
      'app.audit_log.reason': ['INSERT'],
      'app.audit_log.summary': ['INSERT'],
      'app.audit_log.request_id': ['INSERT'],
      'app.audit_log.session_ref': ['INSERT'],
    },
    sequences: {},
    functions: [SESSION_IS_LIVE_SIGNATURE],
  },
  // The pg-boss worker: its own heartbeat row, the environment marker, and job
  // DML in pgboss. Nothing in app, no DDL, no DELETE or TRUNCATE outside pgboss.
  // pgboss.version is read-only at table level (0006): the migrator's pg-boss
  // CLI decides what to rerun from it, so the worker may not change `version`.
  wringy_worker: {
    login: ROLES.workerLogin,
    schemas: { ops: ['USAGE'], pgboss: ['USAGE'], public: ['USAGE'] },
    tables: {
      'ops.environment': ['SELECT'],
      'ops.worker_heartbeat': ['SELECT', 'INSERT', 'UPDATE'],
      'pgboss.version': ['SELECT'],
      'pgboss.*': ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    },
    // The timestamps pg-boss stamps at run time (dist/plans.js trySetTimestamp, setMonitorBackoff).
    columns: {
      'pgboss.version.cron_on': ['UPDATE'],
      'pgboss.version.bam_on': ['UPDATE'],
      'pgboss.version.flow_on': ['UPDATE'],
      'pgboss.version.reindex_on': ['UPDATE'],
      'pgboss.version.monitor_backoff_on': ['UPDATE'],
    },
    sequences: { 'pgboss.*': ['USAGE', 'SELECT', 'UPDATE'] },
    functions: ['pgboss.*'],
  },
};
