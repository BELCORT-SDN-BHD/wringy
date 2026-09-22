/**
 * `pnpm db:migrate` (`pnpm --filter @wringy/db migrate [up|down] [count]`).
 *
 * Reads DATABASE_URL_MIGRATOR and WRINGY_ENV through @wringy/config (a local
 * run also reads the repository-root `.env` when it exists).
 *
 * `up` (the default) first brings schema pgboss to EXPECTED_PGBOSS_VERSION with
 * the pg-boss CLI, then applies the pending SQL migrations (kickoff-package.md
 * §8.4). Without a count it also checks that the database ends at
 * EXPECTED_MIGRATION_HEAD. Rerunning it changes nothing and says so.
 *
 * `down` reverts node-pg-migrate migrations only (pgboss stays), and runs only
 * when WRINGY_ENV is local or ci: a staging or production rollback redeploys
 * the previous image instead (kickoff-package.md §4.10, §8.9).
 */
import { EnvError } from '@wringy/config';
import { loadMigrateEnv } from '@wringy/config/migrate';

import { EXPECTED_PGBOSS_VERSION } from '../expected-head';
import { migrateDatabase, runMigrations } from '../migrate';
import { installPgBossSchema, type PgBossInstallResult } from '../pgboss';

function describePgBoss({ schema, from, to, outcome }: PgBossInstallResult): string {
  if (outcome === 'installed') return `pg-boss schema ${schema}: installed at version ${to}.`;
  if (outcome === 'upgraded') return `pg-boss schema ${schema}: upgraded from version ${from} to ${to}.`;
  return `pg-boss schema ${schema}: already at version ${to}; nothing changed.`;
}

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

  const databaseUrl = env.DATABASE_URL_MIGRATOR;
  const log = (line: string) => console.log(line);

  if (directionArg === 'up' && count === undefined) {
    const result = await migrateDatabase({ databaseUrl, log });
    console.log(describePgBoss(result.pgboss));
    console.log(
      result.migrations.length === 0
        ? `SQL migrations: already at ${result.head}; nothing changed.`
        : `SQL migrations: ran ${result.migrations.length} up (${result.migrations.join(', ')}); head is ${result.head}.`,
    );
    return;
  }

  if (directionArg === 'up') {
    console.log(describePgBoss(await installPgBossSchema({ databaseUrl, expectedVersion: EXPECTED_PGBOSS_VERSION, log })));
  }
  const ran = await runMigrations({ databaseUrl, direction: directionArg, count, log });
  console.log(
    ran.length === 0
      ? `SQL migrations: nothing to run ${directionArg}.`
      : `SQL migrations: ran ${ran.length} ${directionArg} (${ran.join(', ')}).`,
  );
}

main().catch((error: unknown) => {
  // EnvError names variables only; other messages come from pg or the runner and
  // never include the connection string.
  const message = error instanceof Error ? error.message : String(error);
  console.error(error instanceof EnvError ? message : `Migration failed: ${message}`);
  process.exitCode = 1;
});
