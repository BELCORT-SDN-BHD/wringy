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
 */
import pg from 'pg';

import { EnvError } from '@wringy/config';
import { loadMigrateEnv } from '@wringy/config/migrate';

import { InvalidEmailError, addAllowlistEntry, listAllowlist, removeAllowlistEntry } from '../allowlist';

const USAGE = [
  'Usage:',
  '  pnpm db:allowlist add <email> --reason "<text>" --by "<name>"',
  '  pnpm db:allowlist remove <email> --reason "<text>" --by "<name>"',
  '  pnpm db:allowlist list',
].join('\n');

interface Parsed {
  command: 'add' | 'remove' | 'list';
  email?: string;
  reason?: string;
  by?: string;
}

/** Parses argv. `--reason`/`--by` take the next argument; anything else is refused. */
export function parseAllowlistArgs(argv: readonly string[]): Parsed {
  const [command, ...rest] = argv;
  if (command !== 'add' && command !== 'remove' && command !== 'list') {
    throw new Error(`Unknown command "${command ?? ''}".\n${USAGE}`);
  }

  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]!;
    if (argument === '--reason' || argument === '--by') {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${argument} needs a value.\n${USAGE}`);
      named[argument.slice(2)] = value;
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown option "${argument}".\n${USAGE}`);
    } else {
      positional.push(argument);
    }
  }

  if (command === 'list') {
    if (positional.length > 0 || Object.keys(named).length > 0) throw new Error(`list takes no arguments.\n${USAGE}`);
    return { command };
  }
  if (positional.length !== 1) throw new Error(`${command} takes exactly one email address.\n${USAGE}`);
  const values: Record<'reason' | 'by', string> = { reason: '', by: '' };
  for (const option of ['reason', 'by'] as const) {
    const value = named[option];
    if (value === undefined || value.trim() === '') {
      throw new Error(`${command} requires --${option} with a non-empty value.\n${USAGE}`);
    }
    values[option] = value;
  }
  return { command, email: positional[0], reason: values.reason, by: values.by };
}

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
