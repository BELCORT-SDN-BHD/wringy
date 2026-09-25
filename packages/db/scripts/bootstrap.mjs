/**
 * `pnpm db:bootstrap`: once per environment, before the first `pnpm db:migrate`.
 *
 * Creates (or re-syncs) the NOLOGIN groups wringy_api and wringy_worker, the
 * logins wringy_migrator, wringy_api_login IN ROLE wringy_api and
 * wringy_worker_login IN ROLE wringy_worker, and the application database owned
 * by the migrator, then removes CONNECT/TEMPORARY from PUBLIC on it. Idempotent.
 *
 * On the embedded local cluster (the development plan: WRINGY_ENV=local with the
 * admin URL unset or at the db:start port) it also runs the platform bootstrap
 * that `pnpm db:platform-bootstrap --stub-auth` runs: the stub auth.sessions and
 * platform.session_is_live, owned by the non-superuser wringy_platform_admin
 * (M2-02 R3). So `pnpm db:start && pnpm db:bootstrap && pnpm db:migrate` yields a
 * database the api can use with SESSION_LIVENESS=database. Anywhere else the
 * platform bootstrap stays a separate, explicit command, because it reaches into
 * the hosted identity store's schema.
 *
 * Inputs (names in the root .env.example): WRINGY_ENV, PG_BOOTSTRAP_ADMIN_URL,
 * PG_BOOTSTRAP_DATABASE, PG_BOOTSTRAP_{MIGRATOR,API,WORKER}_PASSWORD. Only for
 * the embedded local cluster (WRINGY_ENV=local and the admin URL unset, or on a
 * loopback host at the db:start port) may the admin URL and passwords be left
 * unset: its superuser and the fixed development passwords are used then.
 * Anywhere else they are required, and a development password is refused
 * (src/bootstrap-plan.ts, @wringy/config).
 *
 * Run through tsx (it imports TypeScript from ../src and @wringy/config).
 */
import pg from 'pg';

import { EnvError } from '@wringy/config';
import { loadBootstrapEnv } from '@wringy/config/bootstrap';

import { ensureDatabase, ensureRoles } from '../src/bootstrap.ts';
import { DevelopmentPasswordRefusedError, resolveBootstrapPlan } from '../src/bootstrap-plan.ts';
import {
  PlatformBootstrapRefusedError,
  SESSION_IS_LIVE_SIGNATURE,
  adminUrlForDatabase,
  installPlatform,
} from '../src/platform.ts';
import { ROLES } from '../src/roles.ts';

async function main() {
  const env = loadBootstrapEnv();
  const { adminUrl, passwords, developmentPasswords } = resolveBootstrapPlan(env);
  const database = env.PG_BOOTSTRAP_DATABASE;

  const admin = new pg.Client({ connectionString: adminUrl, application_name: 'wringy-bootstrap' });
  await admin.connect();
  try {
    await ensureRoles(admin, passwords);
    const outcome = await ensureDatabase(admin, database);
    const lines = [
      `Bootstrap complete for WRINGY_ENV=${env.WRINGY_ENV}${developmentPasswords ? ' (development passwords, embedded local cluster)' : ''}.`,
      `  groups: ${ROLES.apiGroup}, ${ROLES.workerGroup} (NOLOGIN)`,
      `  logins: ${ROLES.migrator}, ${ROLES.apiLogin} in ${ROLES.apiGroup}, ${ROLES.workerLogin} in ${ROLES.workerGroup}`,
      `  database: ${database} (${outcome}), owner ${ROLES.migrator}, CONNECT for the runtime groups only`,
    ];

    if (developmentPasswords) {
      lines.push(...(await installPlatformLocally(adminUrl, database)));
    } else {
      lines.push('  platform: not installed here; run pnpm db:platform-bootstrap for this environment');
    }

    lines.push('Next: pnpm db:migrate, then pnpm db:env (and pnpm db:seed:fixtures where fixtures are allowed)');
    console.log(lines.join('\n'));
  } finally {
    await admin.end();
  }
}

/** The platform bootstrap on the embedded local cluster, with the auth stub. */
async function installPlatformLocally(adminUrl, database) {
  const client = new pg.Client({
    connectionString: adminUrlForDatabase(adminUrl, database),
    application_name: 'wringy-bootstrap-platform',
  });
  await client.connect();
  try {
    const result = await installPlatform(client, { databaseName: database, stubAuth: true });
    return [
      `  ${ROLES.platformAdmin}: owns schema platform (NOLOGIN, not a superuser)`,
      `  platform: ${SESSION_IS_LIVE_SIGNATURE} over the stub auth.sessions, EXECUTE for ${ROLES.apiGroup} only` +
        `${result.owner === ROLES.platformAdmin ? '' : ` (owner ${result.owner})`}`,
    ];
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // EnvError and DevelopmentPasswordRefusedError name variables only; pg errors never carry the connection string.
  const message = error instanceof Error ? error.message : String(error);
  const known =
    error instanceof EnvError ||
    error instanceof DevelopmentPasswordRefusedError ||
    error instanceof PlatformBootstrapRefusedError;
  console.error(known ? message : `Bootstrap failed: ${message}`);
  process.exitCode = 1;
});
