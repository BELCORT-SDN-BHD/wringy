/**
 * The **platform bootstrap**: session liveness, installed from an admin
 * connection and never by an app migration (kickoff-package.md §4.6 "Mechanism
 * A", §4.11; M2-02 R3).
 *
 * `platform.session_is_live(session_id, user_id)` answers whether the hosted
 * identity store still has that session. It is `SECURITY DEFINER` with
 * `search_path = ''`, so the API role can ask the question without being given
 * any reach into the `auth` schema: only EXECUTE on this one function.
 *
 * The SQL lives here, in one place, because three callers must not drift: the
 * CLI `pnpm db:platform-bootstrap`, `pnpm db:bootstrap` for the embedded local
 * cluster, and the integration-test harness's template
 * (`packages/db/test/cluster.ts`).
 *
 * **Who owns it.** On the hosted project the connection role (`postgres`) is not
 * a superuser and already has SELECT on `auth.sessions`, so it owns the function
 * itself. Locally and in CI the admin *is* a superuser, which would make the
 * SECURITY DEFINER function all-powerful and hide a privilege mistake until
 * staging. So the install creates a non-superuser role,
 * `wringy_platform_admin`, gives it exactly SELECT on the sessions table and
 * CREATE on the database, and builds the schema and the function as that role.
 *
 * Every builder below is idempotent and safe to run twice.
 */
import type pg from 'pg';

import { AUTH_SCHEMA, PLATFORM_SCHEMA, ROLES } from './roles';

/** An admin connection to the application database that may create schemas and (locally) roles. */
export type PlatformAdminClient = Pick<pg.ClientBase, 'query'>;

/** The function's signature, as `regprocedure` prints it (what the grant manifest lists). */
export const SESSION_IS_LIVE_SIGNATURE = `${PLATFORM_SCHEMA}.session_is_live(uuid,uuid)`;

/**
 * A double-quoted identifier. Written here rather than taken from `pg.Client`
 * so the SQL builders stay pure functions a unit test can read.
 */
function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * The stub of the hosted identity store's session table, for a local or CI
 * cluster that has no such store. Three columns, which is all
 * `session_is_live` reads. Owned by whoever runs it (the cluster admin) and
 * granted to nobody, exactly as the real table is reachable by nobody but the
 * platform admin.
 *
 * Never run against a real hosted project: `installPlatform` refuses it there,
 * and the CLI refuses it outside `local` and `ci`.
 */
export function authStubSql(): string {
  return `CREATE SCHEMA IF NOT EXISTS ${AUTH_SCHEMA};
CREATE TABLE IF NOT EXISTS ${AUTH_SCHEMA}.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  not_after timestamptz
);`;
}

/**
 * The non-superuser owner of the platform objects, and the only two rights it
 * gets: read the sessions table, and create the one schema it owns in
 * `databaseName`. USAGE on the `auth` schema comes with the SELECT, because a
 * SECURITY DEFINER function is checked against its owner and a table it cannot
 * reach through its schema is a table it cannot read.
 */
export function platformAdminRoleSql(databaseName: string): string {
  const role = ROLES.platformAdmin;
  return `DO $wringy_platform_admin$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB;
  END IF;
END
$wringy_platform_admin$;
GRANT USAGE ON SCHEMA ${AUTH_SCHEMA} TO ${role};
GRANT SELECT ON ${AUTH_SCHEMA}.sessions TO ${role};
GRANT CREATE ON DATABASE ${quoteIdentifier(databaseName)} TO ${role};`;
}

/**
 * Schema `platform` and `platform.session_is_live`, run as the role that is to
 * own them. `STABLE` so a planner may cache it within a statement but never
 * across one; `SET search_path = ''` so every name in the body is what it says;
 * `pg_catalog.now()` for the same reason. EXECUTE is revoked from PUBLIC (a
 * function created by a role without the repository's database-wide default
 * would otherwise be callable by everyone) and granted to the API group only.
 */
export function platformObjectsSql(): string {
  return `CREATE SCHEMA IF NOT EXISTS ${PLATFORM_SCHEMA};
REVOKE ALL ON SCHEMA ${PLATFORM_SCHEMA} FROM PUBLIC;
CREATE OR REPLACE FUNCTION ${PLATFORM_SCHEMA}.session_is_live(p_session_id uuid, p_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $wringy_session_is_live$
  SELECT EXISTS (
    SELECT 1
      FROM ${AUTH_SCHEMA}.sessions AS s
     WHERE s.id = p_session_id
       AND s.user_id = p_user_id
       AND (s.not_after IS NULL OR s.not_after > pg_catalog.now())
  )
$wringy_session_is_live$;
REVOKE ALL ON FUNCTION ${SESSION_IS_LIVE_SIGNATURE} FROM PUBLIC;
GRANT USAGE ON SCHEMA ${PLATFORM_SCHEMA} TO ${ROLES.apiGroup};
GRANT EXECUTE ON FUNCTION ${SESSION_IS_LIVE_SIGNATURE} TO ${ROLES.apiGroup};`;
}

export interface InstallPlatformOptions {
  /** The application database this connection is open on; the CREATE grant names it. */
  databaseName: string;
  /**
   * Create the stub `auth.sessions` first. Only for a cluster with no hosted
   * identity store: refused when the admin is not a superuser, because that is a
   * hosted project whose real table must not be shadowed.
   */
  stubAuth: boolean;
}

export interface InstallPlatformResult {
  /** The role that owns schema `platform` and the function afterwards. */
  owner: string;
  /** True when the admin connection is a superuser (a local or CI cluster). */
  adminIsSuperuser: boolean;
  /** True when this run created or confirmed the stub sessions table. */
  stubbedAuth: boolean;
}

/**
 * `adminUrl` pointed at `database` instead of the admin's own database. The
 * platform objects are installed *in* the application database, while the
 * bootstrap admin URL names the cluster's own (`postgres`).
 */
export function adminUrlForDatabase(adminUrl: string, database: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${encodeURIComponent(database)}`;
  return url.toString();
}

/** A platform bootstrap that must not go on, with a message that never names a connection. */
export class PlatformBootstrapRefusedError extends Error {
  override readonly name = 'PlatformBootstrapRefusedError';
}

async function isSuperuser(admin: PlatformAdminClient): Promise<boolean> {
  const { rows } = await admin.query<{ superuser: boolean }>(
    `SELECT coalesce(rolsuper, false) AS superuser FROM pg_catalog.pg_roles WHERE rolname = CURRENT_USER`,
  );
  return rows[0]?.superuser === true;
}

async function relationExists(admin: PlatformAdminClient, qualified: string): Promise<boolean> {
  const { rows } = await admin.query<{ present: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS present`, [qualified]);
  return rows[0]?.present === true;
}

async function roleExists(admin: PlatformAdminClient, name: string): Promise<boolean> {
  const { rows } = await admin.query(`SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1`, [name]);
  return rows.length === 1;
}

/**
 * Installs session liveness on the database `adminClient` is open on.
 * Idempotent: running it again changes nothing.
 *
 * - A **superuser** admin (the embedded local cluster, CI's service) creates the
 *   stub sessions table when `stubAuth`, then `wringy_platform_admin`, then
 *   builds the platform objects `SET ROLE`-ed to that role, so they are owned by
 *   a non-superuser and the SECURITY DEFINER shape matches the hosted project.
 * - A **non-superuser** admin is a hosted project's connection role. `stubAuth`
 *   is refused there, and the platform objects are built as the admin itself,
 *   which already has SELECT on the real sessions table.
 */
export async function installPlatform(
  adminClient: PlatformAdminClient,
  { databaseName, stubAuth }: InstallPlatformOptions,
): Promise<InstallPlatformResult> {
  const adminIsSuperuser = await isSuperuser(adminClient);

  if (stubAuth && !adminIsSuperuser) {
    throw new PlatformBootstrapRefusedError(
      'Refusing --stub-auth: this connection is not a superuser, which means a hosted project whose real ' +
        `${AUTH_SCHEMA}.sessions must not be shadowed by a stub. Run it only against a local or CI cluster.`,
    );
  }
  if (!(await roleExists(adminClient, ROLES.apiGroup))) {
    throw new PlatformBootstrapRefusedError(
      `Role ${ROLES.apiGroup} does not exist, so the function's EXECUTE grant has no grantee; run pnpm db:bootstrap first.`,
    );
  }

  if (stubAuth) await adminClient.query(authStubSql());

  if (!(await relationExists(adminClient, `${AUTH_SCHEMA}.sessions`))) {
    throw new PlatformBootstrapRefusedError(
      `${AUTH_SCHEMA}.sessions does not exist in this database, so platform.session_is_live cannot be created. ` +
        'On a hosted project the identity store provides it; locally and in CI pass --stub-auth.',
    );
  }

  if (!adminIsSuperuser) {
    await adminClient.query(platformObjectsSql());
    const { rows } = await adminClient.query<{ owner: string }>(`SELECT CURRENT_USER AS owner`);
    return { owner: rows[0]?.owner ?? 'unknown', adminIsSuperuser, stubbedAuth: stubAuth };
  }

  await adminClient.query(platformAdminRoleSql(databaseName));
  // The objects are created by the non-superuser role, so it owns them.
  await adminClient.query(`SET ROLE ${ROLES.platformAdmin}`);
  try {
    await adminClient.query(platformObjectsSql());
  } finally {
    await adminClient.query('RESET ROLE');
  }
  return { owner: ROLES.platformAdmin, adminIsSuperuser, stubbedAuth: stubAuth };
}
