/**
 * The reviewed grant manifest (kickoff-package.md §4.11, §8.5; ruling D33 (ii)).
 *
 * Everything each runtime group may do in schemas app, ops and pgboss. The test
 * "M2-AC01/2 runtime role privileges match reviewed grant manifest"
 * (grants.int.test.ts) computes the effective privileges of each runtime LOGIN
 * (wringy_api_login, wringy_worker_login) on every schema, table, sequence and
 * function there with has_*_privilege and requires them to equal this file
 * exactly: a privilege listed here and missing fails, and a privilege present
 * and not listed fails.
 *
 * Changing a grant therefore means changing a migration and this file in the
 * same review. `pgboss.*` stands for every object pg-boss installs, so a
 * pg-boss upgrade that adds a table needs no edit here unless the rights differ.
 * The migrator owns every object and is not listed.
 */
import { ROLES } from '../src/roles';

export const MANIFEST_SCHEMAS = ['app', 'ops', 'pgboss'] as const;
export type ManifestSchema = (typeof MANIFEST_SCHEMAS)[number];

export const SCHEMA_PRIVILEGES = ['USAGE', 'CREATE'] as const;
export const TABLE_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] as const;
export const SEQUENCE_PRIVILEGES = ['USAGE', 'SELECT', 'UPDATE'] as const;

export type SchemaPrivilege = (typeof SCHEMA_PRIVILEGES)[number];
export type TablePrivilege = (typeof TABLE_PRIVILEGES)[number];
export type SequencePrivilege = (typeof SEQUENCE_PRIVILEGES)[number];

export interface RoleGrants {
  /** The login that carries the group's rights at runtime. */
  login: string;
  schemas: Partial<Record<ManifestSchema, readonly SchemaPrivilege[]>>;
  /** `schema.table`, or `schema.*` for every table, partitioned table or view in the schema. An exact name wins. */
  tables: Readonly<Record<string, readonly TablePrivilege[]>>;
  /** `schema.sequence` or `schema.*`. */
  sequences: Readonly<Record<string, readonly SequencePrivilege[]>>;
  /** Functions the role may EXECUTE: `schema.name` or `schema.*`. */
  functions: readonly string[];
}

export const GRANT_MANIFEST: Readonly<Record<'wringy_api' | 'wringy_worker', RoleGrants>> = {
  // Fastify: reads business rows and the operations records GET /health and
  // /internal/* need. No writes in M2-01, no DDL, and nothing in pgboss
  // (kickoff-package.md §4.11, §8.5): it reads the pg-boss schema version
  // through the migrator-owned view ops.pgboss_schema_version (0006).
  wringy_api: {
    login: ROLES.apiLogin,
    schemas: { app: ['USAGE'], ops: ['USAGE'] },
    tables: {
      'app.orgs': ['SELECT'],
      'app.campaigns': ['SELECT'],
      'ops.environment': ['SELECT'],
      'ops.worker_heartbeat': ['SELECT'],
      'ops.pgmigrations': ['SELECT'],
      'ops.pgboss_schema_version': ['SELECT'],
    },
    sequences: {},
    functions: [],
  },
  // The pg-boss worker: its own heartbeat row, the environment marker, and job
  // DML in pgboss. Nothing in app, no DDL, no DELETE or TRUNCATE outside pgboss.
  // pgboss.version is read-only at table level (0006): the migrator's pg-boss
  // CLI decides what to rerun from it, so the worker may not change `version`.
  wringy_worker: {
    login: ROLES.workerLogin,
    schemas: { ops: ['USAGE'], pgboss: ['USAGE'] },
    tables: {
      'ops.environment': ['SELECT'],
      'ops.worker_heartbeat': ['SELECT', 'INSERT', 'UPDATE'],
      'pgboss.version': ['SELECT'],
      'pgboss.*': ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    },
    sequences: { 'pgboss.*': ['USAGE', 'SELECT', 'UPDATE'] },
    functions: ['pgboss.*'],
  },
};
