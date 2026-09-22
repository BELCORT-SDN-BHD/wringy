/**
 * `pnpm db:migrate` (`pnpm --filter @wringy/db migrate [up|down] [count]`).
 *
 * Reads DATABASE_URL_MIGRATOR and WRINGY_ENV through @wringy/config (a local
 * run also reads the repository-root `.env` when it exists). `down` runs only
 * when WRINGY_ENV is local or ci: a staging or production rollback redeploys
 * the previous image instead (kickoff-package.md §4.10, §8.9).
 */
import { EnvError } from '@wringy/config';
import { loadMigrateEnv } from '@wringy/config/migrate';

import { runMigrations } from '../migrate';

async function main(): Promise<void> {
  const [directionArg = 'up', countArg] = process.argv.slice(2);
  if (directionArg !== 'up' && directionArg !== 'down') {
    throw new Error(`Unknown direction "${directionArg}"; use up or down.`);
  }
  const count = countArg === undefined ? undefined : Number(countArg);
  if (count !== undefined && (!Number.isInteger(count) || count < 1)) {
    throw new Error('The count must be a positive integer.');
  }

  const env = loadMigrateEnv();
  if (directionArg === 'down' && env.WRINGY_ENV !== 'local' && env.WRINGY_ENV !== 'ci') {
    throw new Error(`Down migrations run only locally or in CI, not in ${env.WRINGY_ENV}.`);
  }

  const ran = await runMigrations({
    databaseUrl: env.DATABASE_URL_MIGRATOR,
    direction: directionArg,
    count,
    log: (line) => console.log(line),
  });
  console.log(
    ran.length === 0
      ? 'Database is already at the newest migration.'
      : `Ran ${ran.length} migration(s) ${directionArg}: ${ran.join(', ')}`,
  );
}

main().catch((error: unknown) => {
  // EnvError names variables only; other messages come from pg or the runner and
  // never include the connection string.
  const message = error instanceof Error ? error.message : String(error);
  console.error(error instanceof EnvError ? message : `Migration failed: ${message}`);
  process.exitCode = 1;
});
