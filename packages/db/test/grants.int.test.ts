import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXPECTED_MIGRATION_HEAD, EXPECTED_PGBOSS_VERSION } from '../src/expected-head';
import { ROLES } from '../src/roles';
import {
  GRANT_MANIFEST,
  MANIFEST_SCHEMAS,
  SCHEMA_PRIVILEGES,
  SEQUENCE_PRIVILEGES,
  TABLE_PRIVILEGES,
  type RoleGrants,
} from './grant-manifest';
import { createTestDatabase, sqlState, withClientAt, type TestDatabase } from './harness';

type Privileges = Record<string, string[]>;

/** Orders `privileges` as `order` lists them, so the comparison ignores grant order. */
const ordered = (privileges: readonly string[], order: readonly string[]) =>
  order.filter((privilege) => privileges.includes(privilege));

/** The manifest entry for `schema.name`: an exact name wins over `schema.*`. */
function lookup<T>(entries: Readonly<Record<string, T>>, object: string): T | undefined {
  const schema = object.slice(0, object.indexOf('.'));
  return entries[object] ?? entries[`${schema}.*`];
}

describe('M2-AC01/2 runtime role privileges', () => {
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

  /** Every privilege `login` effectively holds in the manifest schemas, keyed `<kind> <object>`. */
  async function effective(login: string): Promise<Privileges> {
    const schemas = [...MANIFEST_SCHEMAS];
    const actual: Privileges = {};
    const add = (rows: { object: string; privileges: string[] }[], kind: string) => {
      for (const row of rows) actual[`${kind} ${row.object}`] = row.privileges;
    };

    add(
      (
        await migrator.query<{ object: string; privileges: string[] }>(
          `SELECT n.nspname AS object, array_agg(p.priv ORDER BY p.ord) AS privileges
             FROM pg_catalog.pg_namespace n
             CROSS JOIN unnest($2::text[]) WITH ORDINALITY AS p(priv, ord)
            WHERE n.nspname = ANY($1) AND has_schema_privilege($3, n.oid, p.priv)
            GROUP BY 1`,
          [schemas, SCHEMA_PRIVILEGES, login],
        )
      ).rows,
      'schema',
    );
    add(
      (
        await migrator.query<{ object: string; privileges: string[] }>(
          `SELECT n.nspname || '.' || c.relname AS object, array_agg(p.priv ORDER BY p.ord) AS privileges
             FROM pg_catalog.pg_class c
             JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             CROSS JOIN unnest($2::text[]) WITH ORDINALITY AS p(priv, ord)
            WHERE n.nspname = ANY($1) AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
              AND has_table_privilege($3, c.oid, p.priv)
            GROUP BY 1`,
          [schemas, TABLE_PRIVILEGES, login],
        )
      ).rows,
      'table',
    );
    add(
      (
        await migrator.query<{ object: string; privileges: string[] }>(
          `SELECT n.nspname || '.' || c.relname AS object, array_agg(p.priv ORDER BY p.ord) AS privileges
             FROM pg_catalog.pg_class c
             JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             CROSS JOIN unnest($2::text[]) WITH ORDINALITY AS p(priv, ord)
            WHERE n.nspname = ANY($1) AND c.relkind = 'S'
              AND has_sequence_privilege($3, c.oid, p.priv)
            GROUP BY 1`,
          [schemas, SEQUENCE_PRIVILEGES, login],
        )
      ).rows,
      'sequence',
    );
    add(
      (
        await migrator.query<{ object: string; privileges: string[] }>(
          `SELECT p.oid::regprocedure::text AS object, ARRAY['EXECUTE'] AS privileges
             FROM pg_catalog.pg_proc p
             JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = ANY($1) AND has_function_privilege($2, p.oid, 'EXECUTE')`,
          [schemas, login],
        )
      ).rows,
      'function',
    );
    return actual;
  }

  /** What the manifest allows `grants` on every object that exists in the manifest schemas. */
  async function expected(grants: RoleGrants): Promise<Privileges> {
    const want: Privileges = {};
    for (const [schema, privileges] of Object.entries(grants.schemas)) {
      want[`schema ${schema}`] = ordered(privileges, SCHEMA_PRIVILEGES);
    }
    const { rows: relations } = await migrator.query<{ object: string; kind: string }>(
      `SELECT n.nspname || '.' || c.relname AS object, c.relkind AS kind
         FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY($1) AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')`,
      [[...MANIFEST_SCHEMAS]],
    );
    for (const { object, kind } of relations) {
      if (kind === 'S') {
        const privileges = lookup(grants.sequences, object);
        if (privileges?.length) want[`sequence ${object}`] = ordered(privileges, SEQUENCE_PRIVILEGES);
      } else {
        const privileges = lookup(grants.tables, object);
        if (privileges?.length) want[`table ${object}`] = ordered(privileges, TABLE_PRIVILEGES);
      }
    }
    // An exact table name the manifest lists must exist; `effective` would not report it otherwise.
    for (const object of Object.keys(grants.tables).filter((name) => !name.endsWith('.*'))) {
      if (!relations.some((relation) => relation.object === object)) want[`table ${object}`] = ['<missing>'];
    }
    const { rows: functions } = await migrator.query<{ object: string; name: string }>(
      `SELECT p.oid::regprocedure::text AS object, n.nspname || '.' || p.proname AS name
         FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = ANY($1)`,
      [[...MANIFEST_SCHEMAS]],
    );
    for (const { object, name } of functions) {
      const schema = name.slice(0, name.indexOf('.'));
      if (grants.functions.includes(name) || grants.functions.includes(`${schema}.*`)) {
        want[`function ${object}`] = ['EXECUTE'];
      }
    }
    return want;
  }

  it('M2-AC01/2 runtime role privileges match reviewed grant manifest', async () => {
    for (const grants of Object.values(GRANT_MANIFEST)) {
      const actual = await effective(grants.login);
      expect({ login: grants.login, privileges: actual }).toEqual({
        login: grants.login,
        privileges: await expected(grants),
      });
    }
  });

  it('M2-AC01/2 the worker has job rights on every pg-boss table and function, and the API only the version table', async () => {
    const worker = await effective(ROLES.workerLogin);
    const api = await effective(ROLES.apiLogin);
    expect(worker['table pgboss.job']).toEqual(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
    expect(worker['table pgboss.queue']).toEqual(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
    expect(Object.keys(worker).some((key) => key.startsWith('function pgboss.create_queue('))).toBe(true);
    expect(Object.keys(api).filter((key) => key.includes('pgboss'))).toEqual(['schema pgboss', 'table pgboss.version']);
  });

  it('M2-AC01/2 only the migrator and the two runtime groups appear in any ACL; PUBLIC and the logins hold nothing directly', async () => {
    const { rows } = await migrator.query<{ grantee: string }>(
      `WITH acls AS (
         SELECT n.nspacl AS acl FROM pg_catalog.pg_namespace n WHERE n.nspname = ANY($1)
         UNION ALL
         SELECT c.relacl FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = ANY($1)
         UNION ALL
         SELECT p.proacl FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = ANY($1)
       )
       SELECT DISTINCT CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee
         FROM acls, LATERAL aclexplode(acls.acl) a
        ORDER BY 1`,
      [[...MANIFEST_SCHEMAS]],
    );
    expect(rows.map((row) => row.grantee)).toEqual([ROLES.apiGroup, ROLES.workerGroup, ROLES.migrator].sort());

    // Functions pg-boss created before 0001's default ran start with PUBLIC EXECUTE
    // (ACL NULL); 0005 revoked it, so no pgboss function is left on the default.
    const { rows: defaults } = await migrator.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'pgboss' AND p.proacl IS NULL`,
    );
    expect(defaults[0]?.count).toBe(0);
  });

  it('M2-AC01/2 wringy_worker_login cannot read app.campaigns or app.orgs (42501)', async () => {
    expect(await sqlState(withClientAt(db.urls.worker, (c) => c.query('SELECT * FROM app.campaigns')))).toBe('42501');
    expect(await sqlState(withClientAt(db.urls.worker, (c) => c.query('SELECT * FROM app.orgs')))).toBe('42501');
  });

  it('M2-AC01/2 wringy_api_login cannot write ops.worker_heartbeat nor read pgboss.job (42501)', async () => {
    expect(
      await sqlState(
        withClientAt(db.urls.api, (c) =>
          c.query(
            `INSERT INTO ops.worker_heartbeat (worker_id, started_at, last_beat_at, image_ref)
             VALUES ('api-probe', now(), now(), 'probe')`,
          ),
        ),
      ),
    ).toBe('42501');
    expect(await sqlState(withClientAt(db.urls.api, (c) => c.query('SELECT * FROM pgboss.job')))).toBe('42501');
    expect(await sqlState(withClientAt(db.urls.api, (c) => c.query('SELECT * FROM pgboss.queue')))).toBe('42501');
    expect(await sqlState(withClientAt(db.urls.api, (c) => c.query('UPDATE app.campaigns SET title = title')))).toBe(
      '42501',
    );
  });

  it('M2-AC01/2 neither runtime login can change the environment marker (42501)', async () => {
    for (const url of [db.urls.api, db.urls.worker]) {
      expect(
        await sqlState(withClientAt(url, (c) => c.query('UPDATE ops.environment SET fixtures_allowed = true'))),
      ).toBe('42501');
      expect(await sqlState(withClientAt(url, (c) => c.query('DELETE FROM ops.environment')))).toBe('42501');
    }
  });

  it('the API login reads what GET /health and /internal/* need', async () => {
    const row = await withClientAt(db.urls.api, async (c) => {
      const { rows } = await c.query<{ head: string; pgboss: number; env: string; campaigns: number; workers: number }>(
        `SELECT (SELECT name FROM ops.pgmigrations ORDER BY id DESC LIMIT 1) AS head,
                (SELECT version FROM pgboss.version) AS pgboss,
                (SELECT name FROM ops.environment) AS env,
                (SELECT count(*)::int FROM app.campaigns c JOIN app.orgs o ON o.id = c.org_id) AS campaigns,
                (SELECT count(*)::int FROM ops.worker_heartbeat) AS workers`,
      );
      return rows[0];
    });
    expect(row).toEqual({ head: EXPECTED_MIGRATION_HEAD, pgboss: EXPECTED_PGBOSS_VERSION, env: 'ci', campaigns: 0, workers: 0 });
  });

  it('the worker login upserts its heartbeat on the database clock and reads the marker', async () => {
    const upsert = `INSERT INTO ops.worker_heartbeat (worker_id, started_at, last_beat_at, image_ref)
                    VALUES ('probe-worker', now(), now(), 'local-probe')
                    ON CONFLICT (worker_id) DO UPDATE SET last_beat_at = now()
                    RETURNING last_beat_at, updated_at, now() AS db_now`;
    const [first, second, env] = await withClientAt(db.urls.worker, async (c) => {
      const a = (await c.query<{ last_beat_at: Date; updated_at: Date; db_now: Date }>(upsert)).rows[0];
      const b = (await c.query<{ last_beat_at: Date; updated_at: Date; db_now: Date }>(upsert)).rows[0];
      const marker = (await c.query<{ name: string }>('SELECT name FROM ops.environment')).rows[0];
      return [a, b, marker];
    });
    expect(first?.last_beat_at).toEqual(first?.db_now);
    // The update path fired ops.touch_updated_at() under the worker login.
    expect(second?.updated_at).toEqual(second?.db_now);
    expect(second!.last_beat_at.getTime()).toBeGreaterThanOrEqual(first!.last_beat_at.getTime());
    expect(env).toEqual({ name: 'ci' });
    expect(
      await sqlState(withClientAt(db.urls.worker, (c) => c.query(`DELETE FROM ops.worker_heartbeat`))),
    ).toBe('42501');
  });
});
