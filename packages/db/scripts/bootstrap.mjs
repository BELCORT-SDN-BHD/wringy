/**
 * `pnpm db:bootstrap`: once per environment, before the first `pnpm db:migrate`.
 *
 * Creates (or re-syncs) the NOLOGIN groups wringy_api and wringy_worker, the
 * logins wringy_migrator, wringy_api_login IN ROLE wringy_api and
 * wringy_worker_login IN ROLE wringy_worker, and the application database owned
 * by the migrator, then removes CONNECT/TEMPORARY from PUBLIC on it. Idempotent.
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
    console.log(
      [
        `Bootstrap complete for WRINGY_ENV=${env.WRINGY_ENV}${developmentPasswords ? ' (development passwords, embedded local cluster)' : ''}.`,
        `  groups: ${ROLES.apiGroup}, ${ROLES.workerGroup} (NOLOGIN)`,
        `  logins: ${ROLES.migrator}, ${ROLES.apiLogin} in ${ROLES.apiGroup}, ${ROLES.workerLogin} in ${ROLES.workerGroup}`,
        `  database: ${database} (${outcome}), owner ${ROLES.migrator}, CONNECT for the runtime groups only`,
        'Next: pnpm db:migrate, then pnpm db:env (and pnpm db:seed:fixtures where fixtures are allowed)',
      ].join('\n'),
    );
  } finally {
    await admin.end();
  }
}

main().catch((error) => {
  // EnvError and DevelopmentPasswordRefusedError name variables only; pg errors never carry the connection string.
  const message = error instanceof Error ? error.message : String(error);
  const known = error instanceof EnvError || error instanceof DevelopmentPasswordRefusedError;
  console.error(known ? message : `Bootstrap failed: ${message}`);
  process.exitCode = 1;
});
