/**
 * `pnpm db:platform-bootstrap [--stub-auth]`: installs session liveness
 * (`platform.session_is_live`) from the admin connection, once per environment,
 * after `pnpm db:bootstrap` (kickoff-package.md §4.6; M2-02 R3).
 *
 * It is a separate command from `pnpm db:bootstrap` because it is a separate
 * authority: it reaches into the hosted identity store's schema, which no app
 * migration and no runtime role may touch. On a hosted project the admin is that
 * project's `postgres` role, which already has SELECT on `auth.sessions` and owns
 * the function itself. Locally and in CI the admin is a superuser, so the install
 * creates the non-superuser `wringy_platform_admin` and builds the objects as it.
 *
 * `--stub-auth` also creates the three-column stub `auth.sessions`, for a cluster
 * with no identity store. It is accepted only when WRINGY_ENV is local or ci, and
 * `installPlatform` refuses it again whenever the admin is not a superuser.
 *
 * Inputs (names in the root `.env.example`): WRINGY_ENV, PG_BOOTSTRAP_ADMIN_URL,
 * PG_BOOTSTRAP_DATABASE. As `pnpm db:bootstrap`, the admin URL may be left unset
 * only for the embedded local cluster, whose superuser is used then
 * (src/bootstrap-plan.ts). Nothing printed here contains a connection string.
 *
 * Run through tsx (it imports TypeScript from ../ and @wringy/config).
 */
import pg from 'pg';

import { EnvError } from '@wringy/config';
import { loadBootstrapEnv } from '@wringy/config/bootstrap';

import { DevelopmentPasswordRefusedError, resolveBootstrapPlan } from '../bootstrap-plan';
import {
  PlatformBootstrapRefusedError,
  SESSION_IS_LIVE_SIGNATURE,
  adminUrlForDatabase,
  installPlatform,
} from '../platform';
import { AUTH_SCHEMA } from '../roles';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const unknown = args.find((argument) => argument !== '--stub-auth');
  if (unknown !== undefined) throw new Error(`Unknown argument "${unknown}"; the only option is --stub-auth.`);
  const stubAuth = args.includes('--stub-auth');

  const env = loadBootstrapEnv();
  if (stubAuth && env.WRINGY_ENV !== 'local' && env.WRINGY_ENV !== 'ci') {
    throw new PlatformBootstrapRefusedError(
      `--stub-auth creates a fake ${AUTH_SCHEMA}.sessions and runs only when WRINGY_ENV is local or ci, not in ${env.WRINGY_ENV}.`,
    );
  }

  const { adminUrl } = resolveBootstrapPlan(env);
  const database = env.PG_BOOTSTRAP_DATABASE;
  const admin = new pg.Client({
    connectionString: adminUrlForDatabase(adminUrl, database),
    application_name: 'wringy-platform-bootstrap',
  });
  await admin.connect();
  try {
    const result = await installPlatform(admin, { databaseName: database, stubAuth });
    console.log(
      [
        `Platform bootstrap complete for WRINGY_ENV=${env.WRINGY_ENV} on database ${database}.`,
        result.stubbedAuth
          ? `  ${AUTH_SCHEMA}.sessions: stub present (id, user_id, not_after), granted to nobody`
          : `  ${AUTH_SCHEMA}.sessions: the identity store's own table, left untouched`,
        `  function: ${SESSION_IS_LIVE_SIGNATURE}, SECURITY DEFINER, owner ${result.owner}` +
          `${result.adminIsSuperuser ? ' (a non-superuser role, so the privilege shape matches a hosted project)' : ''}`,
        '  grants: USAGE on schema platform and EXECUTE on the function, to wringy_api only',
        'Next: set SESSION_LIVENESS=database for the api in this environment',
      ].join('\n'),
    );
  } finally {
    await admin.end();
  }
}

main().catch((error: unknown) => {
  // EnvError and the two refusals name variables and roles only; pg errors never
  // carry the connection string.
  const message = error instanceof Error ? error.message : String(error);
  const known =
    error instanceof EnvError ||
    error instanceof DevelopmentPasswordRefusedError ||
    error instanceof PlatformBootstrapRefusedError;
  console.error(known ? message : `Platform bootstrap failed: ${message}`);
  process.exitCode = 1;
});
