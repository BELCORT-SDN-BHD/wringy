import type pg from 'pg';

import { ROLES } from './roles';
import { scramSha256Verifier } from './scram';

/** An admin connection that may create roles and databases. */
export type AdminClient = Pick<pg.Client, 'query' | 'escapeIdentifier' | 'escapeLiteral'>;

export interface LoginPasswords {
  migrator: string;
  api: string;
  worker: string;
}

async function roleExists(admin: AdminClient, name: string): Promise<boolean> {
  const result = await admin.query('SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1', [name]);
  return result.rowCount === 1;
}

/**
 * Creates the login, or resets its password when it exists, and makes it a
 * member of `groups`. Only LOGIN and PASSWORD are set, because a non-superuser
 * admin (Supabase's `postgres`) may not name attributes such as BYPASSRLS; the
 * safe defaults are then verified by `assertPlainLogin`.
 */
async function ensureLogin(
  admin: AdminClient,
  name: string,
  password: string,
  groups: readonly string[],
): Promise<void> {
  const role = admin.escapeIdentifier(name);
  const verifier = admin.escapeLiteral(scramSha256Verifier(password));
  const verb = (await roleExists(admin, name)) ? 'ALTER' : 'CREATE';
  await admin.query(`${verb} ROLE ${role} WITH LOGIN PASSWORD ${verifier}`);
  for (const group of groups) {
    await admin.query(`GRANT ${admin.escapeIdentifier(group)} TO ${role}`);
  }
  await assertPlainLogin(admin, name);
}

async function assertPlainLogin(admin: AdminClient, name: string): Promise<void> {
  const { rows } = await admin.query<{ elevated: boolean }>(
    `SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls AS elevated
       FROM pg_catalog.pg_roles WHERE rolname = $1`,
    [name],
  );
  if (rows[0]?.elevated !== false) {
    throw new Error(`Role ${name} has an elevated attribute; remove it before bootstrapping.`);
  }
}

/**
 * Idempotent. Creates the NOLOGIN groups when absent (migration 0001 needs them
 * and the migrator cannot create roles), then the three logins:
 * `wringy_migrator`, `wringy_api_login` IN ROLE `wringy_api` and
 * `wringy_worker_login` IN ROLE `wringy_worker`. Passwords reach the server only
 * as SCRAM verifiers.
 */
export async function ensureRoles(admin: AdminClient, passwords: LoginPasswords): Promise<void> {
  for (const group of [ROLES.apiGroup, ROLES.workerGroup]) {
    if (!(await roleExists(admin, group))) {
      await admin.query(`CREATE ROLE ${admin.escapeIdentifier(group)} NOLOGIN`);
    }
  }
  await ensureLogin(admin, ROLES.migrator, passwords.migrator, []);
  await ensureLogin(admin, ROLES.apiLogin, passwords.api, [ROLES.apiGroup]);
  await ensureLogin(admin, ROLES.workerLogin, passwords.worker, [ROLES.workerGroup]);
}

/**
 * Only the two runtime groups (and the owner) may connect. By default PUBLIC has
 * CONNECT and TEMPORARY on every database; this removes both. Database ACLs are
 * not copied by CREATE DATABASE … TEMPLATE, so the test harness calls this for
 * every clone as well.
 */
export async function restrictDatabaseAccess(admin: AdminClient, database: string): Promise<void> {
  const db = admin.escapeIdentifier(database);
  await admin.query(`REVOKE ALL ON DATABASE ${db} FROM PUBLIC`);
  await admin.query(
    `GRANT CONNECT ON DATABASE ${db} TO ${admin.escapeIdentifier(ROLES.apiGroup)}, ${admin.escapeIdentifier(ROLES.workerGroup)}`,
  );
}

/** Idempotent. The application database, owned by the migrator, UTF-8. */
export async function ensureDatabase(admin: AdminClient, database: string): Promise<'created' | 'existed'> {
  const db = admin.escapeIdentifier(database);
  const owner = admin.escapeIdentifier(ROLES.migrator);
  const { rows } = await admin.query<{ owner: string }>(
    'SELECT pg_catalog.pg_get_userbyid(datdba) AS owner FROM pg_catalog.pg_database WHERE datname = $1',
    [database],
  );
  const existing = rows[0];
  if (existing === undefined) {
    await admin.query(`CREATE DATABASE ${db} WITH OWNER ${owner} ENCODING 'UTF8' TEMPLATE template0`);
  } else if (existing.owner !== ROLES.migrator) {
    await admin.query(`ALTER DATABASE ${db} OWNER TO ${owner}`);
  }
  await restrictDatabaseAccess(admin, database);
  return existing === undefined ? 'created' : 'existed';
}
