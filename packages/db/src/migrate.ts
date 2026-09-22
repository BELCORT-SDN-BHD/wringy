import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runner } from 'node-pg-migrate';

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
