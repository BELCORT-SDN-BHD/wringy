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
 * Fixture rows in every table of schema `app` that has a data_origin column
 * (found in the catalog, so tables later tickets add are covered), keyed
 * `app.<table>`. Tables without fixture rows are left out.
 */
export async function countFixtureRows(client: Queryable): Promise<FixtureRowCounts> {
  const { rows: tables } = await client.query<{ relname: string }>(
    `SELECT c.relname
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attname = 'data_origin' AND NOT a.attisdropped
      WHERE n.nspname = 'app' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname`,
  );
  const counts: Record<string, number> = {};
  for (const { relname } of tables) {
    const { rows } = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM app.${quoteIdent(relname)} WHERE data_origin = 'fixture'`,
    );
    const count = rows[0]?.count ?? 0;
    if (count > 0) counts[`app.${relname}`] = count;
  }
  return counts;
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

/**
 * Idempotent upsert of the single marker row for `name`, with fixtures_allowed
 * derived from it. Each step is one statement, so it is safe on a client that is
 * already inside a transaction (the test harness) and needs no explicit one:
 * the unique index on a constant settles a race between two first inserts.
 *
 * Marking a database as an environment that forbids fixtures (production),
 * whether a first mark or a relabel, is refused with FixturesPresentError
 * while any business table holds fixture rows.
 */
export async function setEnvironment(
  client: Queryable,
  name: WringyEnv,
  { relabel = false }: SetEnvironmentOptions = {},
): Promise<{ outcome: SetEnvironmentOutcome; marker: EnvironmentMarker }> {
  const fixturesAllowed = fixturesAllowedFor(name);
  const current = await readEnvironment(client);
  const changesMarker = current === null || current.name !== name || current.fixturesAllowed !== fixturesAllowed;
  if (changesMarker && !fixturesAllowed) {
    if (current !== null && current.name !== name && !relabel) throw new EnvironmentMismatchError(current.name, name);
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
    // Another run inserted the row first: continue as an update of that row.
    return setEnvironment(client, name, { relabel });
  }

  if (current.name !== name && !relabel) throw new EnvironmentMismatchError(current.name, name);
  if (current.name === name && current.fixturesAllowed === fixturesAllowed) {
    return { outcome: 'unchanged', marker: current };
  }

  const updated = await client.query<MarkerRow>(
    `UPDATE ops.environment SET name = $1, fixtures_allowed = $2
      WHERE name = $3
      RETURNING name, fixtures_allowed, updated_at`,
    [name, fixturesAllowed, current.name],
  );
  if (updated.rows[0] === undefined) {
    // The row changed between the read and the update; read it again.
    return setEnvironment(client, name, { relabel });
  }
  return { outcome: current.name === name ? 'updated' : 'relabelled', marker: toMarker(updated.rows[0]) };
}
