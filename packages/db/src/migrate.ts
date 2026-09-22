import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runner } from 'node-pg-migrate';
import pg from 'pg';

import { EXPECTED_MIGRATION_HEAD, EXPECTED_PGBOSS_VERSION } from './expected-head';
import { installPgBossSchema, type PgBossInstallResult } from './pgboss';

/** The versioned SQL migrations, applied in file-name order. */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/**
 * Where node-pg-migrate records what ran: `ops.pgmigrations` (the tool's default
 * table name, in the `ops` schema the migrator owns). The runner creates `ops`
 * and this table before the first migration, so the table predates the default
 * privileges 0001 sets and no runtime role can read or change it until a later
 * migration grants that explicitly.
 */
export const MIGRATIONS_SCHEMA = 'ops';
export const MIGRATIONS_TABLE = 'pgmigrations';

/** Migration ids (file names without `.sql`), oldest first. */
export function listMigrations(dir: string = MIGRATIONS_DIR): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => file.slice(0, -'.sql'.length))
    .sort();
}

export interface RunMigrationsOptions {
  /** The migration owner's connection string (`DATABASE_URL_MIGRATOR`). */
  databaseUrl: string;
  direction?: 'up' | 'down';
  /** How many to run. Defaults to all pending for `up` and one for `down`. */
  count?: number;
  /** Receives progress lines; never the connection string. */
  log?: (line: string) => void;
}

/**
 * Applies the SQL migrations as the migration owner: one transaction for the
 * whole batch, under node-pg-migrate's session advisory lock (a second concurrent
 * run fails instead of interleaving), with the order of already-applied files
 * checked. `search_path` is `app`, so an unqualified object can never land in
 * `public`. Migrations never run at app boot (kickoff-package.md §4.10).
 */
export async function runMigrations({
  databaseUrl,
  direction = 'up',
  count,
  log = () => {},
}: RunMigrationsOptions): Promise<string[]> {
  const ran = await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction,
    count: count ?? (direction === 'up' ? Number.POSITIVE_INFINITY : 1),
    schema: 'app',
    createSchema: false,
    migrationsSchema: MIGRATIONS_SCHEMA,
    createMigrationsSchema: true,
    migrationsTable: MIGRATIONS_TABLE,
    singleTransaction: true,
    checkOrder: true,
    advisoryLockMode: 'fail',
    verbose: false,
    logger: { debug: () => {}, info: log, warn: log, error: log },
  });
  return ran.map((migration) => migration.name);
}

export interface MigrateDatabaseOptions {
  /** The migration owner's connection string (`DATABASE_URL_MIGRATOR`). */
  databaseUrl: string;
  /** Receives progress lines; never the connection string. */
  log?: (line: string) => void;
}

export interface MigrateDatabaseResult {
  pgboss: PgBossInstallResult;
  /** Migration ids applied by this run, oldest first; empty when already current. */
  migrations: string[];
  /** The newest applied migration afterwards (EXPECTED_MIGRATION_HEAD). */
  head: string;
}

/**
 * `pnpm db:migrate` up, in the order kickoff-package.md §8.4 fixes, both as the
 * migration owner:
 *
 * 1. the pg-boss CLI brings schema `pgboss` to EXPECTED_PGBOSS_VERSION;
 * 2. node-pg-migrate applies the pending SQL migrations (0005 grants rights on
 *    pgboss, so it needs step 1).
 *
 * Idempotent: a second run changes nothing. Fails unless the database ends at
 * EXPECTED_MIGRATION_HEAD and EXPECTED_PGBOSS_VERSION. The test harness migrates
 * its template through this same function.
 */
export async function migrateDatabase({
  databaseUrl,
  log = () => {},
}: MigrateDatabaseOptions): Promise<MigrateDatabaseResult> {
  const pgboss = await installPgBossSchema({ databaseUrl, expectedVersion: EXPECTED_PGBOSS_VERSION, log });
  const migrations = await runMigrations({ databaseUrl, log });

  const client = new pg.Client({ connectionString: databaseUrl, application_name: 'wringy-migrate' });
  await client.connect();
  let head: string | undefined;
  try {
    const { rows } = await client.query<{ name: string }>(
      `SELECT name FROM ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} ORDER BY id DESC LIMIT 1`,
    );
    head = rows[0]?.name;
  } finally {
    await client.end();
  }
  if (head !== EXPECTED_MIGRATION_HEAD) {
    throw new Error(`The newest applied migration is ${head ?? 'none'}, but this build expects ${EXPECTED_MIGRATION_HEAD}`);
  }
  return { pgboss, migrations, head };
}
