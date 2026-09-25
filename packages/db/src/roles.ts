/**
 * The database roles (kickoff-package.md §4.11, §8.5; names fixed at the M2-01
 * code review). Group roles carry privileges and never log in; each login role
 * belongs to exactly one group. The migrator owns the schemas and runs all DDL.
 */
export const ROLES = {
  /** Login. Owns `app`, `ops` and `pgboss`. On Supabase possibly `postgres`. */
  migrator: 'wringy_migrator',
  /** NOLOGIN group for the Fastify API. */
  apiGroup: 'wringy_api',
  /** NOLOGIN group for the pg-boss worker. */
  workerGroup: 'wringy_worker',
  /** Login used by the API process; member of `wringy_api` only. */
  apiLogin: 'wringy_api_login',
  /** Login used by the worker process; member of `wringy_worker` only. */
  workerLogin: 'wringy_worker_login',
  /**
   * NOLOGIN owner of the `platform` schema and `platform.session_is_live`
   * locally and in CI (M2-02 R3). It is deliberately NOT a superuser and holds
   * only SELECT on the identity store's `sessions` table plus CREATE on the
   * database, so the SECURITY DEFINER privilege shape matches the hosted
   * project, where the connection role `postgres` is not a superuser either: a
   * mistake that would need superuser reach fails in CI, not on staging. It is
   * created by `pnpm db:platform-bootstrap`, never by an app migration.
   */
  platformAdmin: 'wringy_platform_admin',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Business tables. */
export const APP_SCHEMA = 'app';
/** Environment marker, heartbeats and the migrations table. */
export const OPS_SCHEMA = 'ops';
/** pg-boss's tables and functions, installed by the pg-boss CLI as the migrator (ruling D33). */
export const PGBOSS_SCHEMA = 'pgboss';
/**
 * Session liveness (`platform.session_is_live`), created by the platform
 * bootstrap and owned by `platformAdmin` locally and in CI. Never touched by a
 * migration: the migrator has no business in the identity store.
 */
export const PLATFORM_SCHEMA = 'platform';
/**
 * The hosted identity store's schema. The migrator never writes here; locally
 * and in CI the platform bootstrap installs a stub `auth.sessions(id, user_id,
 * not_after)` so the same function and the same grants can be tested.
 */
export const AUTH_SCHEMA = 'auth';
