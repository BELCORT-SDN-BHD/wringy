/**
 * What a correctly migrated database looks like for this build. GET /health
 * compares the database with these (kickoff-package.md §8.3) and
 * `pnpm db:migrate` refuses to finish anywhere else.
 *
 * Both are literals on purpose, so the API image needs neither the migrations
 * directory nor pg-boss's package.json at runtime. expected-head.test.ts derives
 * each value from its source (the migrations directory; the installed pg-boss)
 * and fails on drift: adding a migration or bumping pg-boss without updating
 * this file fails `pnpm --filter @wringy/db test`.
 */

/** The newest file in packages/db/migrations, as recorded in ops.pgmigrations.name. */
export const EXPECTED_MIGRATION_HEAD = '0005_pgboss_grants';

/** The pgboss.version that pg-boss 12.33.5 installs (its package.json `pgboss.schema`). */
export const EXPECTED_PGBOSS_VERSION = 42;
