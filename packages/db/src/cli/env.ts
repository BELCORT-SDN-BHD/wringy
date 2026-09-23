/**
 * `pnpm db:env [--relabel]`: writes the environment marker (ops.environment)
 * for WRINGY_ENV, as the migrator, after `pnpm db:migrate`. fixtures_allowed is
 * true for local, ci and staging and false for production. Idempotent; a
 * database already marked as another environment is refused unless --relabel,
 * and marking a database production is refused while it holds fixture rows.
 *
 * Reads WRINGY_ENV and DATABASE_URL_MIGRATOR through @wringy/config (a local run
 * also reads the repository-root `.env` when it exists).
 */
import pg from 'pg';

import { EnvError } from '@wringy/config';
import { loadMigrateEnv } from '@wringy/config/migrate';

import {
  EnvironmentMismatchError,
  EnvironmentTableMissingError,
  FixturesPresentError,
  setEnvironment,
} from '../environment';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const unknown = args.find((arg) => arg !== '--relabel');
  if (unknown !== undefined) throw new Error(`Unknown argument "${unknown}"; the only option is --relabel.`);

  const env = loadMigrateEnv();
  const client = new pg.Client({ connectionString: env.DATABASE_URL_MIGRATOR, application_name: 'wringy-db-env' });
  await client.connect();
  try {
    const { outcome, marker } = await setEnvironment(client, env.WRINGY_ENV, { relabel: args.includes('--relabel') });
    const described = `ops.environment: ${marker.name}, fixtures_allowed=${marker.fixturesAllowed}`;
    console.log(
      {
        inserted: `Marked this database. ${described}.`,
        unchanged: `Already marked; nothing changed. ${described}.`,
        updated: `Updated the marker. ${described}.`,
        relabelled: `Re-marked this database (--relabel). ${described}.`,
      }[outcome],
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // EnvError names variables only; the other messages come from this package or pg
  // and never include the connection string.
  const message = error instanceof Error ? error.message : String(error);
  const known =
    error instanceof EnvError ||
    error instanceof EnvironmentMismatchError ||
    error instanceof EnvironmentTableMissingError ||
    error instanceof FixturesPresentError;
  console.error(known ? message : `db:env failed: ${message}`);
  process.exitCode = 1;
});
