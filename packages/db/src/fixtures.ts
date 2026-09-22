/**
 * The internal-build fixture seed (kickoff-package.md §8.5): fixtures/internal-campaigns.sql,
 * applied as the migrator only where the environment marker allows fixtures.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type pg from 'pg';

import type { WringyEnv } from '@wringy/config';

import { readEnvironment } from './environment';

/** Two fixture orgs and three fixture campaigns, titles and statuses only. */
export const FIXTURES_FILE = fileURLToPath(new URL('../fixtures/internal-campaigns.sql', import.meta.url));

type Queryable = Pick<pg.ClientBase, 'query'>;

/** The seed was refused before anything was written. */
export class FixturesRefusedError extends Error {
  override readonly name = 'FixturesRefusedError';
}

export interface SeedFixturesOptions {
  /** WRINGY_ENV of the caller; the seed refuses a database marked as another environment. */
  expectedEnv?: WringyEnv;
}

export interface SeedFixturesResult {
  environment: WringyEnv;
  /** Rows this run inserted or changed; 0 on a rerun. */
  written: number;
  /** Fixture rows present afterwards. */
  orgs: number;
  campaigns: number;
}

/**
 * Checks the marker (present, same environment as `expectedEnv`, fixtures
 * allowed), then applies the seed file. The file's statements run as one
 * implicit transaction, or inside the caller's transaction when there is one.
 * Throws FixturesRefusedError, having written nothing, when the marker forbids it.
 */
export async function seedFixtures(
  client: Queryable,
  { expectedEnv }: SeedFixturesOptions = {},
): Promise<SeedFixturesResult> {
  const marker = await readEnvironment(client);
  if (marker === null) {
    throw new FixturesRefusedError('This database has no ops.environment marker; run pnpm db:env first.');
  }
  if (expectedEnv !== undefined && marker.name !== expectedEnv) {
    throw new FixturesRefusedError(
      `WRINGY_ENV is "${expectedEnv}" but this database is marked "${marker.name}"; nothing was written.`,
    );
  }
  if (!marker.fixturesAllowed) {
    throw new FixturesRefusedError(
      `Environment "${marker.name}" does not allow fixtures (ops.environment.fixtures_allowed is false); nothing was written.`,
    );
  }

  const result = (await client.query(readFileSync(FIXTURES_FILE, 'utf8'))) as pg.QueryResult | pg.QueryResult[];
  const written = (Array.isArray(result) ? result : [result])
    .filter((statement) => statement.command === 'INSERT')
    .reduce((sum, statement) => sum + (statement.rowCount ?? 0), 0);

  const { rows } = await client.query<{ orgs: number; campaigns: number }>(
    `SELECT (SELECT count(*) FROM app.orgs WHERE data_origin = 'fixture')::int AS orgs,
            (SELECT count(*) FROM app.campaigns WHERE data_origin = 'fixture')::int AS campaigns`,
  );
  return { environment: marker.name, written, orgs: rows[0]?.orgs ?? 0, campaigns: rows[0]?.campaigns ?? 0 };
}
