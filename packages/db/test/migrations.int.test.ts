import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureDatabase } from '../src/bootstrap';
import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE, listMigrations, runMigrations } from '../src/migrate';
import { ROLES } from '../src/roles';
import { cluster, urlFor, withAdmin } from './harness';

/**
 * These tests migrate their own empty database rather than cloning the
 * template, because "from zero" is the point.
 */
describe('M2-AC01/2 migrations from zero', () => {
  const name = `wringy_t_${cluster().runId}_fresh`;
  const migratorUrl = urlFor(ROLES.migrator, cluster().passwords.migrator, name);

  async function query<T extends pg.QueryResultRow>(sql: string): Promise<T[]> {
    const client = new pg.Client({ connectionString: migratorUrl });
    await client.connect();
    try {
      return (await client.query<T>(sql)).rows;
    } finally {
      await client.end();
    }
  }

  beforeAll(async () => {
    await withAdmin((admin) => ensureDatabase(admin, name));
  });

  afterAll(async () => {
    await withAdmin((admin) => admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(name)} WITH (FORCE)`));
  });

  it('M2-AC01/2 a fresh database migrates from zero as the migrator, and a second run applies nothing', async () => {
    const all = listMigrations();
    expect(all[0]).toBe('0001_schemas_roles');

    expect(await runMigrations({ databaseUrl: migratorUrl })).toEqual(all);
    expect(await runMigrations({ databaseUrl: migratorUrl })).toEqual([]);

    const applied = await query<{ name: string }>(
      `SELECT name FROM ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} ORDER BY run_on, id`,
    );
    expect(applied.map((row) => row.name)).toEqual(all);
  });

  it('M2-AC01/2 the migrator owns app and ops, and nothing is created in public', async () => {
    const owners = await query<{ nspname: string; owner: string }>(
      `SELECT nspname, pg_catalog.pg_get_userbyid(nspowner) AS owner
         FROM pg_catalog.pg_namespace WHERE nspname IN ('app', 'ops') ORDER BY nspname`,
    );
    expect(owners).toEqual([
      { nspname: 'app', owner: ROLES.migrator },
      { nspname: 'ops', owner: ROLES.migrator },
    ]);

    const inPublic = await query<{ count: string }>(
      `SELECT (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace)
            + (SELECT count(*) FROM pg_catalog.pg_proc WHERE pronamespace = 'public'::regnamespace) AS count`,
    );
    expect(inPublic[0]?.count).toBe('0');
  });

  it('M2-AC01/2 no migration grants anything to PUBLIC or to a role outside the reviewed set', async () => {
    const grantees = await query<{ grantee: string }>(
      `SELECT DISTINCT CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee
         FROM pg_catalog.pg_namespace n, LATERAL aclexplode(n.nspacl) a
        WHERE n.nspname IN ('app', 'ops')
        ORDER BY 1`,
    );
    expect(grantees.map((row) => row.grantee)).toEqual(
      [ROLES.apiGroup, ROLES.workerGroup, ROLES.migrator].sort(),
    );
  });

  it('reverts to zero and applies again (down sections run locally only)', async () => {
    const all = listMigrations();
    expect(await runMigrations({ databaseUrl: migratorUrl, direction: 'down', count: all.length })).toEqual(
      [...all].reverse(),
    );
    expect(await query<{ nspname: string }>(`SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname = 'app'`)).toEqual(
      [],
    );
    expect(await runMigrations({ databaseUrl: migratorUrl })).toEqual(all);
  });

  it('refuses a second concurrent run instead of interleaving (advisory lock)', async () => {
    const holder = new pg.Client({ connectionString: migratorUrl });
    await holder.connect();
    try {
      // node-pg-migrate's PG_MIGRATE_LOCK_ID, held as another migration would hold it.
      const { PG_MIGRATE_LOCK_ID } = await import('node-pg-migrate');
      await holder.query('SELECT pg_advisory_lock($1)', [PG_MIGRATE_LOCK_ID]);
      await expect(runMigrations({ databaseUrl: migratorUrl })).rejects.toThrow(/Another migration is already running/);
    } finally {
      await holder.end();
    }
  });
});
