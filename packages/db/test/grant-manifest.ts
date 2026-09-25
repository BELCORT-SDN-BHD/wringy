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
  // /internal/* need. No writes in M2-01, no DDL, and nothing in pgboss
  // (kickoff-package.md §4.11, §8.5): it reads the pg-boss schema version
  // through the migrator-owned view ops.pgboss_schema_version (0006).
  wringy_api: {
    login: ROLES.apiLogin,
    // public: PostgreSQL's own default (PUBLIC keeps USAGE on it); nothing is
    // created there (migrations.int.test.ts, grants.int.test.ts).
    // platform: USAGE only, so the one EXECUTE below can be used. Nothing in
    // `auth`: the API reaches the identity store's sessions solely through that
    // SECURITY DEFINER function (M2-02 R3).
    schemas: { app: ['USAGE'], ops: ['USAGE'], platform: ['USAGE'], public: ['USAGE'] },
    tables: {
      'app.orgs': ['SELECT'],
      'app.campaigns': ['SELECT'],
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
    // What a sign-in writes, and nothing else (0010; ruling D12, D7). `status` is
    // absent on purpose: only an operator disables an account, so the runtime role
    // must not be able to write it. `locale_pref` and `locale_pref_set_at` are
    // absent because M2-04 owns the feature that writes them.
    columns: {
      'app.profiles.id': ['INSERT'],
      'app.profiles.contact_email': ['INSERT', 'UPDATE'],
      'app.profiles.display_name': ['INSERT', 'UPDATE'],
      'app.profiles.last_sign_in_at': ['INSERT', 'UPDATE'],
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
