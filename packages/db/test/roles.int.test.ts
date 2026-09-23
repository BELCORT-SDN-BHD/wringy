import { randomBytes } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '../src/roles';
import {
  cluster,
  createTestDatabase,
  sqlState,
  urlFor,
  withAdmin,
  withRollback,
  type TestDatabase,
} from './harness';

/** Runs one statement on a fresh connection as the given login. */
async function runAs(url: string, sql: string): Promise<pg.QueryResult> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

describe('M2-AC01/2 migration and runtime accounts are separated', () => {
  let db: TestDatabase;
  let migrator: pg.Pool;

  beforeAll(async () => {
    db = await createTestDatabase();
    migrator = new pg.Pool({ connectionString: db.urls.migrator, max: 2 });
  });

  afterAll(async () => {
    await migrator?.end();
    await db?.drop();
  });

  it('M2-AC01/2 wringy_api_login cannot create objects in app or ops (42501)', async () => {
    expect(await sqlState(runAs(db.urls.api, 'CREATE TABLE app.api_probe (id int)'))).toBe('42501');
    expect(await sqlState(runAs(db.urls.api, 'CREATE TABLE ops.api_probe (id int)'))).toBe('42501');
    expect(await sqlState(runAs(db.urls.api, 'CREATE SCHEMA api_probe'))).toBe('42501');
  });

  it('M2-AC01/2 wringy_worker_login has no privilege on schema app', async () => {
    const { rows } = await migrator.query<{ usage: boolean; create: boolean }>(
      `SELECT has_schema_privilege($1, 'app', 'USAGE') AS usage, has_schema_privilege($1, 'app', 'CREATE') AS create`,
      [ROLES.workerLogin],
    );
    expect(rows[0]).toEqual({ usage: false, create: false });
    expect(await sqlState(runAs(db.urls.worker, 'CREATE TABLE app.worker_probe (id int)'))).toBe('42501');
  });

  it('M2-AC01/2 default privileges: new app tables are readable by the API only; new ops tables are writable by the worker', async () => {
    await withRollback(migrator, async (client) => {
      await client.query('CREATE TABLE app.default_probe (id int)');
      await client.query('CREATE TABLE ops.default_probe (id int)');
      const { rows } = await client.query<Record<string, boolean>>(
        `SELECT
           has_table_privilege($1, 'app.default_probe', 'SELECT') AS api_app_select,
           has_table_privilege($1, 'app.default_probe', 'INSERT') AS api_app_insert,
           has_table_privilege($2, 'app.default_probe', 'SELECT') AS worker_app_select,
           has_table_privilege($1, 'ops.default_probe', 'SELECT') AS api_ops_select,
           has_table_privilege($1, 'ops.default_probe', 'UPDATE') AS api_ops_update,
           has_table_privilege($2, 'ops.default_probe', 'SELECT') AS worker_ops_select,
           has_table_privilege($2, 'ops.default_probe', 'INSERT') AS worker_ops_insert,
           has_table_privilege($2, 'ops.default_probe', 'UPDATE') AS worker_ops_update,
           has_table_privilege($2, 'ops.default_probe', 'DELETE') AS worker_ops_delete,
           has_table_privilege($2, 'ops.default_probe', 'TRUNCATE') AS worker_ops_truncate`,
        [ROLES.apiLogin, ROLES.workerLogin],
      );
      expect(rows[0]).toEqual({
        api_app_select: true,
        api_app_insert: false,
        worker_app_select: false,
        api_ops_select: true,
        api_ops_update: false,
        worker_ops_select: true,
        worker_ops_insert: true,
        worker_ops_update: true,
        worker_ops_delete: false,
        worker_ops_truncate: false,
      });
    });

    // The probes were rolled back with the transaction.
    const { rows } = await migrator.query(`SELECT to_regclass('app.default_probe') AS app, to_regclass('ops.default_probe') AS ops`);
    expect(rows[0]).toEqual({ app: null, ops: null });
  });

  it('M2-AC01/2 functions the migrator creates are not executable by PUBLIC', async () => {
    await withRollback(migrator, async (client) => {
      await client.query('CREATE FUNCTION app.probe_fn() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$');
      const { rows } = await client.query<{ api: boolean }>(
        `SELECT has_function_privilege($1, 'app.probe_fn()', 'EXECUTE') AS api`,
        [ROLES.apiLogin],
      );
      expect(rows[0]?.api).toBe(false);
    });
  });

  it('M2-AC01/2 runtime logins hold no elevated attribute and are not members of the migrator', async () => {
    const { rows } = await migrator.query<{ rolname: string; elevated: boolean; in_migrator: boolean }>(
      `SELECT rolname,
              rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls AS elevated,
              pg_has_role(rolname, $3, 'MEMBER') AS in_migrator
         FROM pg_catalog.pg_roles WHERE rolname IN ($1, $2) ORDER BY rolname`,
      [ROLES.apiLogin, ROLES.workerLogin, ROLES.migrator],
    );
    expect(rows).toEqual([
      { rolname: ROLES.apiLogin, elevated: false, in_migrator: false },
      { rolname: ROLES.workerLogin, elevated: false, in_migrator: false },
    ]);
  });

  it('M2-AC01/2 a runtime login may connect only where its group has CONNECT', async () => {
    // Allowed on the application database (restrictDatabaseAccess granted it) ...
    const { rows } = await runAs(db.urls.api, 'SELECT current_user AS who');
    expect(rows[0]).toEqual({ who: ROLES.apiLogin });

    // ... refused on a database where PUBLIC's default CONNECT was revoked and nothing granted.
    const closed = `${db.name}_closed_${randomBytes(2).toString('hex')}`;
    await withAdmin(async (admin) => {
      await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(closed)}`);
      await admin.query(`REVOKE ALL ON DATABASE ${admin.escapeIdentifier(closed)} FROM PUBLIC`);
    });
    try {
      const { passwords } = cluster();
      expect(await sqlState(runAs(urlFor(ROLES.apiLogin, passwords.api, closed), 'SELECT 1'))).toBe('42501');
      expect(await sqlState(runAs(urlFor(ROLES.workerLogin, passwords.worker, closed), 'SELECT 1'))).toBe('42501');
    } finally {
      await withAdmin((admin) => admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(closed)} WITH (FORCE)`));
    }
  });
});
