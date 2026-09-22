/**
 * The worker's two ways into PostgreSQL, both as the worker runtime login
 * (`wringy_worker_login`; kickoff-package.md §4.11, §4.12, §8.5):
 *
 * - its own `pg` pool (application_name `wringy-worker`) for the environment
 *   check and the heartbeat writes;
 * - pg-boss 12.33.5's pool (application_name `wringy-worker-pgboss`) for the
 *   queue. Ruling D33 (ii): the migrator owns schema `pgboss`; the worker gets
 *   DML only (migration 0005).
 *
 * pg-boss option names are its own, from docs/api/constructor.md
 * (https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/constructor.md)
 * and the installed dist/types.d.ts:
 * - `connectionString`, `schema`, `application_name`, `max`: connection options.
 * - `migrate: false`: "this instance will skip attempts to run schema migrations
 *   during start()". start() then only checks the schema (dist/contractor.js
 *   `check()`): it throws "pg-boss is not installed" when pgboss.version is
 *   absent and "pg-boss database requires migrations" when the version differs
 *   from the one this pg-boss build expects, in either direction. The worker
 *   therefore never needs DDL; `pnpm db:migrate` installs the schema.
 * - `createSchema: false`: never issue CREATE SCHEMA.
 * - `reindex: false`: the runtime role owns no pg-boss index, so it could not
 *   rebuild one (REINDEX needs ownership). Bloat detection and the
 *   `index_bloat` warning still run (types.d.ts, `reindex`); a rebuild is a
 *   migrator task.
 * `supervise` and `schedule` keep their defaults (true): maintenance and the
 * cron monitor are DML under the 0005 grants, and the cron monitor is what
 * turns the `system.heartbeat` schedule into jobs.
 */
import { PgBoss } from 'pg-boss';

import { PGBOSS_SCHEMA, createPool, type Pool } from '@wringy/db';

/** pg_stat_activity.application_name of the worker's own pool. */
export const WORKER_APPLICATION_NAME = 'wringy-worker';

/** pg_stat_activity.application_name of pg-boss's pool. */
export const PGBOSS_APPLICATION_NAME = 'wringy-worker-pgboss';

/** Pool sizes, small on purpose: one beat and one round trip at a time. M2-09 sizes the connection budget. */
export const WORKER_POOL_MAX = 2;
export const PGBOSS_POOL_MAX = 4;

export function createWorkerPool(connectionString: string, onError?: (error: Error) => void): Pool {
  return createPool(
    { connectionString, applicationName: WORKER_APPLICATION_NAME, max: WORKER_POOL_MAX },
    onError,
  );
}

export function createBoss(connectionString: string): PgBoss {
  return new PgBoss({
    connectionString,
    schema: PGBOSS_SCHEMA,
    application_name: PGBOSS_APPLICATION_NAME,
    max: PGBOSS_POOL_MAX,
    migrate: false,
    createSchema: false,
    reindex: false,
  });
}

/** The two errors pg-boss's start() raises for a schema it will not run on with `migrate: false`. */
export function isPgBossSchemaRefusal(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return message === 'pg-boss is not installed' || message === 'pg-boss database requires migrations';
}
