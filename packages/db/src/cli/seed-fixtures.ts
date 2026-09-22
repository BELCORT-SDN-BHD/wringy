/**
 * `pnpm db:seed:fixtures`: applies fixtures/internal-campaigns.sql as the
 * migrator. Refuses (exit 1, nothing written) unless ops.environment exists,
 * names the same environment as WRINGY_ENV, and allows fixtures. Idempotent.
 *
 * Reads WRINGY_ENV and DATABASE_URL_MIGRATOR through @wringy/config (a local run
 * also reads the repository-root `.env` when it exists).
 */
import pg from 'pg';

import { EnvError } from '@wringy/config';
import { loadMigrateEnv } from '@wringy/config/migrate';

import { EnvironmentTableMissingError } from '../environment';
import { FixturesRefusedError, seedFixtures } from '../fixtures';

async function main(): Promise<void> {
  const env = loadMigrateEnv();
  const client = new pg.Client({ connectionString: env.DATABASE_URL_MIGRATOR, application_name: 'wringy-db-seed' });
  await client.connect();
  try {
    const result = await seedFixtures(client, { expectedEnv: env.WRINGY_ENV });
    console.log(
      [
        `Fixture seed applied for environment ${result.environment}: ${result.written} row(s) inserted or changed.`,
        `  app.orgs: ${result.orgs} fixture row(s); app.campaigns: ${result.campaigns} fixture row(s).`,
      ].join('\n'),
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // EnvError names variables only; the other messages come from this package or pg
  // and never include the connection string.
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof FixturesRefusedError || error instanceof EnvironmentTableMissingError) {
    console.error(`Fixture seed refused: ${message}`);
  } else {
    console.error(error instanceof EnvError ? message : `Fixture seed failed: ${message}`);
  }
  process.exitCode = 1;
});
