/**
 * The database roles (kickoff-package.md §4.11, §8.5; names fixed at the M2-01
 * code review). Group roles carry privileges and never log in; each login role
 * belongs to exactly one group. The migrator owns the schemas and runs all DDL.
 */
export const ROLES = {
  /** Login. Owns `app`, `ops` (and `pgboss` from W2). On Supabase possibly `postgres`. */
  migrator: 'wringy_migrator',
  /** NOLOGIN group for the Fastify API. */
  apiGroup: 'wringy_api',
  /** NOLOGIN group for the pg-boss worker. */
  workerGroup: 'wringy_worker',
  /** Login used by the API process; member of `wringy_api` only. */
  apiLogin: 'wringy_api_login',
  /** Login used by the worker process; member of `wringy_worker` only. */
  workerLogin: 'wringy_worker_login',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Business tables. */
export const APP_SCHEMA = 'app';
/** Environment marker, heartbeats and the migrations table. */
export const OPS_SCHEMA = 'ops';
