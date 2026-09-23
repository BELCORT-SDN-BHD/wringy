/**
 * The environment marker, ops.environment (migration 0002; kickoff-package.md
 * §8.5, Implementation Decision 5). One row names the environment a database
 * belongs to and whether fixture rows may be written there. The api and worker
 * refuse to start when WRINGY_ENV differs from the marker's name;
 * `pnpm db:seed:fixtures` and the trigger ops.assert_fixture_allowed() refuse
 * fixture rows unless fixtures_allowed is true.
 *
 * The row is written by `pnpm db:env` as the migrator after `pnpm db:migrate`,
 * never by a migration, because the same migrations run in every environment.
 */
import type pg from 'pg';

import type { WringyEnv } from '@wringy/config';

type Queryable = Pick<pg.ClientBase, 'query'>;

/** One connection, not a pool: setEnvironment runs several statements in one transaction. */
type Connection = Pick<pg.ClientBase, 'query' | 'getTransactionStatus'>;

/** Fixtures are allowed in local, ci and staging, never in production (0002 also enforces the latter). */
export function fixturesAllowedFor(env: WringyEnv): boolean {
  return env !== 'production';
}

export interface EnvironmentMarker {
  name: WringyEnv;
  fixturesAllowed: boolean;
  updatedAt: Date;
}

/** Raised when ops.environment does not exist yet, i.e. migrations have not run. */
export class EnvironmentTableMissingError extends Error {
  override readonly name = 'EnvironmentTableMissingError';
  constructor() {
    super('ops.environment does not exist in this database; run pnpm db:migrate first.');
  }
}

/** Fixture rows per business table (`app.<table>`), only tables that hold any. */
export type FixtureRowCounts = Readonly<Record<string, number>>;

/**
 * Raised when a database would be marked as an environment that forbids
 * fixtures (production) while business tables still hold fixture rows: the
 * marker would say "no fixtures" and the API would serve them. Delete the
 * fixture rows as the migrator first; DELETE is not blocked by the fixture
 * trigger.
 */
export class FixturesPresentError extends Error {
  override readonly name = 'FixturesPresentError';
  constructor(
    readonly requested: WringyEnv,
    readonly counts: FixtureRowCounts,
  ) {
    const listed = Object.entries(counts)
      .map(([table, count]) => `${table} ${count}`)
      .join(', ');
    super(
      `Refusing to mark this database as environment "${requested}", which does not allow fixtures, while it holds ` +
        `fixture rows (${listed}). Delete them as the migrator (DELETE FROM <table> WHERE data_origin = 'fixture', ` +
        'campaigns before orgs), then run pnpm db:env again.',
    );
  }
}

/** Raised when the database is already marked as another environment and no relabel was asked for. */
export class EnvironmentMismatchError extends Error {
  override readonly name = 'EnvironmentMismatchError';
  constructor(
    readonly marked: WringyEnv,
    readonly requested: WringyEnv,
  ) {
    super(
      `This database is marked as environment "${marked}", not "${requested}". Check that WRINGY_ENV and ` +
        'DATABASE_URL_MIGRATOR point at the same environment; to re-mark the database deliberately, run pnpm db:env --relabel.',
    );
  }
}

interface MarkerRow {
  name: WringyEnv;
  fixtures_allowed: boolean;
  updated_at: Date;
}

const toMarker = (row: MarkerRow): EnvironmentMarker => ({
  name: row.name,
  fixturesAllowed: row.fixtures_allowed,
  updatedAt: row.updated_at,
});

const UNDEFINED_TABLE = '42P01';

/** Double-quotes a catalog name for SQL (PostgreSQL's identifier quoting). */
const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Every table of schema `app` that has a data_origin column, found in the
 * catalog so tables later tickets add are covered, in creation order
 * (pg_class.oid). Creation order puts a referenced table before the tables
 * that reference it (app.orgs before app.campaigns), the order writers such
 * as the fixture seed write them in; see lockDataOriginTables.
 */
async function dataOriginTables(client: Queryable): Promise<string[]> {
  const { rows } = await client.query<{ relname: string }>(
    `SELECT c.relname
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attname = 'data_origin' AND NOT a.attisdropped
      WHERE n.nspname = 'app' AND c.relkind IN ('r', 'p') AND NOT c.relispartition
      ORDER BY c.oid`,
  );
  return rows.map((row) => row.relname);
}

/**
 * Fixture rows in every table of schema `app` that has a data_origin column,
 * keyed `app.<table>` in name order. Tables without fixture rows are left out.
 */
export async function countFixtureRows(client: Queryable): Promise<FixtureRowCounts> {
  const tables = (await dataOriginTables(client)).sort();
  const counts: Record<string, number> = {};
  for (const relname of tables) {
    const { rows } = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM app.${quoteIdent(relname)} WHERE data_origin = 'fixture'`,
    );
    const count = rows[0]?.count ?? 0;
    if (count > 0) counts[`app.${relname}`] = count;
  }
  return counts;
}

/**
 * Takes SHARE locks on every data_origin table, held until the transaction
 * ends, so that no row can be written there meanwhile. SHARE conflicts with
 * the ROW EXCLUSIVE lock every INSERT, UPDATE and DELETE takes, and not with
 * the ACCESS SHARE of a SELECT, so the API keeps reading. A write already in
 * flight is waited for, and its rows are then visible to the next statement
 * (READ COMMITTED takes a snapshot per statement); a write that starts later
 * waits for this transaction to end. Must run inside a transaction block.
 *
 * Locking in creation order means a writer that is between app.orgs and
 * app.campaigns (the fixture seed) is waited for rather than deadlocked with.
 * A writer in another order can still meet a deadlock; PostgreSQL then aborts
 * one of the two (SQLSTATE 40P01), which never lets fixture rows through.
 */
async function lockDataOriginTables(client: Queryable): Promise<void> {
  const tables = await dataOriginTables(client);
  if (tables.length === 0) return;
  await client.query(`LOCK TABLE ${tables.map((table) => `app.${quoteIdent(table)}`).join(', ')} IN SHARE MODE`);
}

async function assertNoFixtureRows(client: Queryable, name: WringyEnv): Promise<void> {
  const counts = await countFixtureRows(client);
  if (Object.keys(counts).length > 0) throw new FixturesPresentError(name, counts);
}

/** The marker, or null when the table exists but holds no row. */
export async function readEnvironment(client: Queryable): Promise<EnvironmentMarker | null> {
  try {
    const { rows } = await client.query<MarkerRow>('SELECT name, fixtures_allowed, updated_at FROM ops.environment');
    return rows[0] === undefined ? null : toMarker(rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === UNDEFINED_TABLE) throw new EnvironmentTableMissingError();
    throw error;
  }
}

export type SetEnvironmentOutcome = 'inserted' | 'unchanged' | 'updated' | 'relabelled';

export interface SetEnvironmentOptions {
  /** Allow changing the name of an existing marker. Without it a different name is refused. */
  relabel?: boolean;
}

export interface SetEnvironmentResult {
  outcome: SetEnvironmentOutcome;
  marker: EnvironmentMarker;
}

/**
 * Idempotent upsert of the single marker row for `name`, with fixtures_allowed
 * derived from it, in one transaction: its own (READ COMMITTED), or the
 * caller's when `client` is already inside one (the test harness), in which
 * case the locks below are held until the caller's transaction ends.
 *
 * Marking a database as an environment that forbids fixtures (production),
 * whether a first mark or a relabel, is refused with FixturesPresentError
 * while any business table holds fixture rows. The check and the marker
 * update are serialised with fixture writes in PostgreSQL itself: the
 * data_origin tables are locked in SHARE mode first (lockDataOriginTables),
 * then the fixture rows are counted, then the marker is written, and the locks
 * are released only at commit. So a fixture insert that was in flight is
 * committed and counted, and one that starts later waits for the commit and
 * is then refused by ops.assert_fixture_allowed(), which reads the marker
 * afresh for every row (0002: a VOLATILE PL/pgSQL function, so each of its
 * statements takes a new snapshot under READ COMMITTED).
 */
export async function setEnvironment(
  client: Connection,
  name: WringyEnv,
  { relabel = false }: SetEnvironmentOptions = {},
): Promise<SetEnvironmentResult> {
  const status = client.getTransactionStatus();
  if (status === 'T' || status === 'E') return markEnvironment(client, name, relabel);

  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try {
    const result = await markEnvironment(client, name, relabel);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

/** setEnvironment's steps, inside a transaction. */
async function markEnvironment(client: Queryable, name: WringyEnv, relabel: boolean): Promise<SetEnvironmentResult> {
  const fixturesAllowed = fixturesAllowedFor(name);
  // Each pass reads the marker afresh; a pass whose write lost a race with another run goes round again.
  for (;;) {
    const current = await readEnvironment(client);
    if (current !== null && current.name === name && current.fixturesAllowed === fixturesAllowed) {
      return { outcome: 'unchanged', marker: current };
    }
    if (current !== null && current.name !== name && !relabel) throw new EnvironmentMismatchError(current.name, name);
    if (!fixturesAllowed) {
      // Lock before counting: the count must see every fixture write that could still commit.
      await lockDataOriginTables(client);
      await assertNoFixtureRows(client, name);
    }

    if (current === null) {
      const inserted = await client.query<MarkerRow>(
        `INSERT INTO ops.environment (name, fixtures_allowed) VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING name, fixtures_allowed, updated_at`,
        [name, fixturesAllowed],
      );
      if (inserted.rows[0] !== undefined) return { outcome: 'inserted', marker: toMarker(inserted.rows[0]) };
      // Another run inserted the row first: go round again and update that row.
      continue;
    }

    const updated = await client.query<MarkerRow>(
      `UPDATE ops.environment SET name = $1, fixtures_allowed = $2
        WHERE name = $3
        RETURNING name, fixtures_allowed, updated_at`,
      [name, fixturesAllowed, current.name],
    );
    if (updated.rows[0] !== undefined) {
      return { outcome: current.name === name ? 'updated' : 'relabelled', marker: toMarker(updated.rows[0]) };
    }
    // No row: the marker changed between the read and the update; go round again.
  }
}
