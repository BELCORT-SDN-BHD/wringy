/**
 * `pnpm db:grant grant|revoke|list`: the only way a review, finance or
 * ops_runtime capability is granted or revoked (ruling D4; M2-03 code review
 * R6). There is no in-app grant surface.
 *
 *   pnpm db:grant grant org <userId> <orgId> review|finance --reason "<text>" --by "<name>"
 *   pnpm db:grant grant platform <userId> ops_runtime --reason "<text>" --by "<name>"
 *   pnpm db:grant revoke org <userId> <orgId> review|finance --reason "<text>" --by "<name>"
 *   pnpm db:grant revoke platform <userId> ops_runtime --reason "<text>" --by "<name>"
 *   pnpm db:grant list [<userId>]
 *
 * Each change and its `app.audit_log` row are written in one statement
 * (`src/grants.ts`); each prints one line. `--reason` and `--by` are required and
 * may not contain `@` (the audit log never stores an address). The person must
 * have signed in once: a grant for a user id with no profile is refused with
 * "this subject has never signed in".
 *
 * Runs as the migrator (the API has SELECT only on both grant tables). Reads
 * WRINGY_ENV and DATABASE_URL_MIGRATOR through @wringy/config, like
 * `pnpm db:allowlist`; no new environment variable. No output ever contains the
 * connection string.
 *
 * The argument rule lives in `src/grants-args.ts`, because this module runs
 * `main()` at import.
 */
import pg from 'pg';

import { EnvError } from '@wringy/config';
import { loadMigrateEnv } from '@wringy/config/migrate';

import {
  GrantRefusedError,
  grantOrgCapability,
  grantPlatformCapability,
  listGrants,
  revokeOrgCapability,
  revokePlatformCapability,
} from '../grants';
import { parseGrantArgs } from '../grants-args';

async function main(): Promise<void> {
  const parsed = parseGrantArgs(process.argv.slice(2));
  const env = loadMigrateEnv();
  const client = new pg.Client({
    connectionString: env.DATABASE_URL_MIGRATOR,
    application_name: 'wringy-grant',
  });
  await client.connect();
  try {
    if (parsed.command === 'list') {
      const { org, platform } = await listGrants(client, parsed.userId);
      console.log(`Capability grants: ${org.length} org, ${platform.length} platform.`);
      for (const grant of org) {
        console.log(
          `  ${grant.userId}  ${grant.capability} on org ${grant.orgId}  granted ${grant.grantedAt.toISOString()} by ${grant.grantedByOperator}: ${grant.reason}`,
        );
      }
      for (const grant of platform) {
        console.log(
          `  ${grant.userId}  ${grant.capability} (platform)  granted ${grant.grantedAt.toISOString()} by ${grant.grantedByOperator}: ${grant.reason}`,
        );
      }
      return;
    }

    const author = { reason: parsed.reason, by: parsed.by };
    if (parsed.scope === 'org') {
      const target = `${parsed.capability} on org ${parsed.orgId} for ${parsed.userId}`;
      const options = { userId: parsed.userId, orgId: parsed.orgId, capability: parsed.capability, ...author };
      if (parsed.command === 'grant') {
        const { outcome } = await grantOrgCapability(client, options);
        console.log(
          outcome === 'granted'
            ? `Granted ${target} (by ${author.by}: ${author.reason}); audited.`
            : `${target} was already granted; nothing changed.`,
        );
      } else {
        const { outcome } = await revokeOrgCapability(client, options);
        console.log(
          outcome === 'revoked'
            ? `Revoked ${target} (by ${author.by}: ${author.reason}); audited.`
            : `${target} was not granted; nothing changed.`,
        );
      }
      return;
    }

    const target = `${parsed.capability} (platform) for ${parsed.userId}`;
    const options = { userId: parsed.userId, capability: parsed.capability, ...author };
    if (parsed.command === 'grant') {
      const { outcome } = await grantPlatformCapability(client, options);
      console.log(
        outcome === 'granted'
          ? `Granted ${target} (by ${author.by}: ${author.reason}); audited.`
          : `${target} was already granted; nothing changed.`,
      );
    } else {
      const { outcome } = await revokePlatformCapability(client, options);
      console.log(
        outcome === 'revoked'
          ? `Revoked ${target} (by ${author.by}: ${author.reason}); audited.`
          : `${target} was not granted; nothing changed.`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // EnvError names variables only; the other messages come from this package or
  // pg and never include the connection string.
  const message = error instanceof Error ? error.message : String(error);
  const known = error instanceof EnvError || error instanceof GrantRefusedError;
  console.error(known ? message : `db:grant failed: ${message}`);
  process.exitCode = 1;
});
