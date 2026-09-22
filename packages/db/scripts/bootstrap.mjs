/**
 * `pnpm db:bootstrap`: once per environment, before the first `pnpm db:migrate`.
 *
 * Creates (or re-syncs) the NOLOGIN groups wringy_api and wringy_worker, the
 * logins wringy_migrator, wringy_api_login IN ROLE wringy_api and
 * wringy_worker_login IN ROLE wringy_worker, and the application database owned
 * by the migrator, then removes CONNECT/TEMPORARY from PUBLIC on it. Idempotent.
 *
 * Inputs (names in the root .env.example): WRINGY_ENV, PG_BOOTSTRAP_ADMIN_URL,
 * PG_BOOTSTRAP_DATABASE, PG_BOOTSTRAP_{MIGRATOR,API,WORKER}_PASSWORD. Only when
 * WRINGY_ENV=local may the admin URL and passwords be left unset: the embedded
 * cluster's superuser and fixed development passwords are used then. Any other
 * environment without them is refused by @wringy/config.
 *
 * Run through tsx (it imports TypeScript from ../src and @wringy/config).
 */
import pg from 'pg';

import { EnvError } from '@wringy/config';
import { loadBootstrapEnv } from '@wringy/config/bootstrap';

import { ensureDatabase, ensureRoles } from '../src/bootstrap.ts';
import { LOCAL_PASSWORDS, localUrls } from '../src/local-dev.ts';
import { ROLES } from '../src/roles.ts';

async function main() {
  const env = loadBootstrapEnv();
  const local = env.WRINGY_ENV === 'local';

  // loadBootstrapEnv already refused a non-local run with any of these unset.
  const adminUrl = env.PG_BOOTSTRAP_ADMIN_URL ?? localUrls().superuser;
  const passwords = {
    migrator: env.PG_BOOTSTRAP_MIGRATOR_PASSWORD ?? LOCAL_PASSWORDS.migrator,
    api: env.PG_BOOTSTRAP_API_PASSWORD ?? LOCAL_PASSWORDS.api,
    worker: env.PG_BOOTSTRAP_WORKER_PASSWORD ?? LOCAL_PASSWORDS.worker,
  };
  const database = env.PG_BOOTSTRAP_DATABASE;

  const admin = new pg.Client({ connectionString: adminUrl, application_name: 'wringy-bootstrap' });
  await admin.connect();
  try {
    await ensureRoles(admin, passwords);
    const outcome = await ensureDatabase(admin, database);
    console.log(
      [
        `Bootstrap complete for WRINGY_ENV=${env.WRINGY_ENV}${local ? ' (development passwords)' : ''}.`,
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
  // EnvError names variables only; pg errors never carry the connection string.
  const message = error instanceof Error ? error.message : String(error);
  console.error(error instanceof EnvError ? message : `Bootstrap failed: ${message}`);
  process.exitCode = 1;
});
