/**
 * `pnpm db:allowlist add|remove|list`: the audited way to change who may sign in
 * to the internal build (ruling D13; M2-02 R5).
 *
 *   pnpm db:allowlist add <email> --reason "<text>" --by "<name>"
 *   pnpm db:allowlist remove <email> --reason "<text>" --by "<name>"
 *   pnpm db:allowlist list
 *
 * `--reason` and `--by` are required for both changes: the row is the audit
 * record until app.audit_log arrives with M2-03, and a removal is recorded in
 * this command's output. Each change prints one line. Removing an address signs
 * nobody out; disable the profile for that.
 *
 * Runs as the migrator (the API has SELECT only). Reads WRINGY_ENV and
 * DATABASE_URL_MIGRATOR through @wringy/config (a local run also reads the
 * repository-root `.env` when it exists). No output ever contains the connection
 * string.
 *
 * The argument rule itself lives in `src/allowlist-args.ts`, because this module
 * runs `main()` at import: importing it to test the parser would run the CLI. See
 * `src/allowlist-args.test.ts` for the cases (a missing `--reason`, an address
 * that begins with `--`, an unknown option, `list` with arguments).
 */
import pg from 'pg';

import { EnvError } from '@wringy/config';
import { loadMigrateEnv } from '@wringy/config/migrate';

import { InvalidEmailError, addAllowlistEntry, listAllowlist, removeAllowlistEntry } from '../allowlist';
import { parseAllowlistArgs } from '../allowlist-args';

async function main(): Promise<void> {
  const parsed = parseAllowlistArgs(process.argv.slice(2));
  const env = loadMigrateEnv();
  const client = new pg.Client({
    connectionString: env.DATABASE_URL_MIGRATOR,
    application_name: 'wringy-allowlist',
  });
  await client.connect();
  try {
    if (parsed.command === 'list') {
      const entries = await listAllowlist(client);
      console.log(`app.sign_in_allowlist: ${entries.length} address(es) may sign in for the first time.`);
      for (const entry of entries) {
        console.log(
          `  ${entry.emailNorm}  added ${entry.addedAt.toISOString()} by ${entry.addedBy}: ${entry.reason}`,
        );
      }
      return;
    }

    if (parsed.command === 'add') {
      const { entry, outcome } = await addAllowlistEntry(client, {
        email: parsed.email!,
        reason: parsed.reason!,
        addedBy: parsed.by!,
      });
      console.log(
        outcome === 'added'
          ? `Allow-listed ${entry.emailNorm} (by ${entry.addedBy}: ${entry.reason}).`
          : `${entry.emailNorm} was already allow-listed; replaced its reason and author (by ${entry.addedBy}: ${entry.reason}).`,
      );
      return;
    }

    const removed = await removeAllowlistEntry(client, { email: parsed.email! });
    console.log(
      removed.outcome === 'removed'
        ? `Removed ${removed.emailNorm} from the allow-list (by ${parsed.by!}: ${parsed.reason!}). ` +
            'Nobody is signed out by this: disable the profile to end access.'
        : `${removed.emailNorm} was not on the allow-list; nothing changed.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // EnvError names variables only; the other messages come from this package or
  // pg and never include the connection string.
  const message = error instanceof Error ? error.message : String(error);
  const known = error instanceof EnvError || error instanceof InvalidEmailError;
  console.error(known ? message : `db:allowlist failed: ${message}`);
  process.exitCode = 1;
});
