import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXPECTED_MIGRATION_HEAD, EXPECTED_PGBOSS_VERSION } from '../src/expected-head';
import { SESSION_IS_LIVE_SIGNATURE } from '../src/platform';
import { AUTH_SCHEMA, PLATFORM_SCHEMA, ROLES } from '../src/roles';
import {
  COLUMN_PRIVILEGES,
  GRANT_MANIFEST,
  PLATFORM_BOOTSTRAP_SCHEMAS,
  SCHEMA_PRIVILEGES,
  SEQUENCE_PRIVILEGES,
  SYSTEM_SCHEMAS,
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

  /** Every non-system schema of the clone: all but `pg_*` and information_schema. Filled in beforeAll. */
  let schemas: string[] = [];

  beforeAll(async () => {
    db = await createTestDatabase();
    migrator = new pg.Pool({ connectionString: db.urls.migrator, max: 2 });
    const { rows } = await migrator.query<{ nspname: string }>(
      `SELECT nspname FROM pg_catalog.pg_namespace
        WHERE nspname !~ '^pg_' AND nspname <> ALL($1) ORDER BY nspname`,
      [[...SYSTEM_SCHEMAS]],
    );
    schemas = rows.map((row) => row.nspname);
  });

  afterAll(async () => {
    await migrator?.end();
    await db?.drop();
  });

  /** Every privilege `login` effectively holds in the non-system schemas, keyed `<kind> <object>`. */
  async function effective(login: string): Promise<Privileges> {
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
    // Column grants: a privilege the login holds on a column but not on its table.
    add(
      (
        await migrator.query<{ object: string; privileges: string[] }>(
          `SELECT n.nspname || '.' || c.relname || '.' || a.attname AS object, array_agg(p.priv ORDER BY p.ord) AS privileges
             FROM pg_catalog.pg_attribute a
             JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
             JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             CROSS JOIN unnest($2::text[]) WITH ORDINALITY AS p(priv, ord)
            WHERE n.nspname = ANY($1) AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
              AND a.attnum > 0 AND NOT a.attisdropped
              AND has_column_privilege($3, c.oid, a.attnum, p.priv)
              AND NOT has_table_privilege($3, c.oid, p.priv)
            GROUP BY 1`,
          [schemas, COLUMN_PRIVILEGES, login],
        )
      ).rows,
      'column',
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

  /** What the manifest allows `grants` on every object that exists in the non-system schemas. */
  async function expected(grants: RoleGrants): Promise<Privileges> {
    const want: Privileges = {};
    for (const [schema, privileges] of Object.entries(grants.schemas)) {
      want[`schema ${schema}`] = ordered(privileges, SCHEMA_PRIVILEGES);
    }
    for (const [column, privileges] of Object.entries(grants.columns)) {
      want[`column ${column}`] = ordered(privileges, COLUMN_PRIVILEGES);
    }
    const { rows: relations } = await migrator.query<{ object: string; kind: string }>(
      `SELECT n.nspname || '.' || c.relname AS object, c.relkind AS kind
         FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY($1) AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')`,
      [schemas],
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
      [schemas],
    );
    for (const { object, name } of functions) {
      const schema = name.slice(0, name.indexOf('.'));
      // `object` is the regprocedure text, so a manifest entry may name the
      // argument types when an overload would otherwise be ambiguous.
      if (grants.functions.includes(object) || grants.functions.includes(name) || grants.functions.includes(`${schema}.*`)) {
        want[`function ${object}`] = ['EXECUTE'];
      }
    }
    return want;
  }

  it('M2-AC01/2 runtime role privileges match reviewed grant manifest', async () => {
    // The scan covers every schema the migrations and pg-boss create, public, and
    // the two the platform bootstrap installs (M2-AC02/2).
    expect(schemas).toEqual(
      expect.arrayContaining(['app', 'ops', 'pgboss', 'public', ...PLATFORM_BOOTSTRAP_SCHEMAS]),
    );
    for (const grants of Object.values(GRANT_MANIFEST)) {
      const actual = await effective(grants.login);
      expect({ login: grants.login, privileges: actual }).toEqual({
        login: grants.login,
        privileges: await expected(grants),
      });
    }
  });

  it('M2-AC01/2 the worker has job rights on every pg-boss table and function but may not change pgboss.version, and the API has nothing in pgboss', async () => {
    const worker = await effective(ROLES.workerLogin);
    const api = await effective(ROLES.apiLogin);
    expect(worker['table pgboss.job']).toEqual(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
    expect(worker['table pgboss.queue']).toEqual(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
    expect(worker['table pgboss.version']).toEqual(['SELECT']);
    expect(Object.keys(worker).some((key) => key.startsWith('function pgboss.create_queue('))).toBe(true);
    // The API reaches the pg-boss schema version only through the migrator-owned view in ops.
    expect(Object.keys(api).filter((key) => /^(schema pgboss$|\w+ pgboss\.)/.test(key))).toEqual([]);
    expect(api['table ops.pgboss_schema_version']).toEqual(['SELECT']);
    expect(worker['table ops.pgboss_schema_version']).toBeUndefined();
  });

  it('M2-AC01/2 only the migrator and the two runtime groups appear in any ACL, column ACLs included; PUBLIC and the logins hold nothing directly', async () => {
    // Schema public keeps PostgreSQL's own ACL (checked below); the two platform
    // bootstrap schemas have another owner on purpose and are asserted in the
    // next test; every other ACL in every non-system schema is ours.
    const bootstrapped: readonly string[] = PLATFORM_BOOTSTRAP_SCHEMAS;
    const migratorOwned = schemas.filter((schema) => schema !== 'public' && !bootstrapped.includes(schema));
    const scanned = schemas.filter((schema) => !bootstrapped.includes(schema));
    const ours = migratorOwned;
    const { rows } = await migrator.query<{ grantee: string }>(
      `WITH acls AS (
         SELECT n.nspacl AS acl FROM pg_catalog.pg_namespace n WHERE n.nspname = ANY($1)
         UNION ALL
         SELECT c.relacl FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = ANY($2)
         UNION ALL
         SELECT a.attacl FROM pg_catalog.pg_attribute a
           JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
           JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = ANY($2) AND a.attnum > 0 AND NOT a.attisdropped
         UNION ALL
         SELECT p.proacl FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = ANY($2)
       )
       SELECT DISTINCT CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee
         FROM acls, LATERAL aclexplode(acls.acl) a
        ORDER BY 1`,
      [ours, scanned],
    );
    expect(rows.map((row) => row.grantee)).toEqual([ROLES.apiGroup, ROLES.workerGroup, ROLES.migrator].sort());

    // public: PostgreSQL's default ACL (its owner, and USAGE for PUBLIC), and nothing in it.
    const { rows: publicSchema } = await migrator.query<{ acl: string[]; objects: number }>(
      `SELECT (SELECT array_agg(a.privilege_type || ' to ' || CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END)
                 FROM pg_catalog.pg_namespace n, LATERAL aclexplode(n.nspacl) a WHERE n.nspname = 'public') AS acl,
              (SELECT count(*)::int FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace)
            + (SELECT count(*)::int FROM pg_catalog.pg_proc WHERE pronamespace = 'public'::regnamespace) AS objects`,
    );
    expect({ ...publicSchema[0], acl: [...(publicSchema[0]?.acl ?? [])].sort() }).toEqual({
      acl: ['CREATE to pg_database_owner', 'USAGE to PUBLIC', 'USAGE to pg_database_owner'],
      objects: 0,
    });

    // Functions pg-boss created before 0001's default ran start with PUBLIC EXECUTE
    // (ACL NULL); 0005 revoked it, so no pgboss function is left on the default.
    const { rows: defaults } = await migrator.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'pgboss' AND p.proacl IS NULL`,
    );
    expect(defaults[0]?.count).toBe(0);
  });

  it('M2-AC02/2 the platform schema and its function are owned by the non-superuser wringy_platform_admin and grant only wringy_api', async () => {
    const { rows: owners } = await migrator.query<{
      schema_owner: string;
      function_owner: string;
      owner_is_superuser: boolean;
      security_definer: boolean;
      volatility: string;
      config: string[] | null;
    }>(
      `SELECT pg_catalog.pg_get_userbyid(n.nspowner) AS schema_owner,
              pg_catalog.pg_get_userbyid(p.proowner) AS function_owner,
              (SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.oid = p.proowner) AS owner_is_superuser,
              p.prosecdef AS security_definer,
              p.provolatile::text AS volatility,
              p.proconfig AS config
         FROM pg_catalog.pg_namespace n
         JOIN pg_catalog.pg_proc p ON p.pronamespace = n.oid
        WHERE n.nspname = $1 AND p.proname = 'session_is_live'`,
      [PLATFORM_SCHEMA],
    );
    expect(owners[0]).toEqual({
      schema_owner: ROLES.platformAdmin,
      function_owner: ROLES.platformAdmin,
      owner_is_superuser: false,
      security_definer: true,
      volatility: 's',
      config: ['search_path=""'],
    });

    // Its ACLs name the owner and the API group, and nothing else: not PUBLIC,
    // not the migrator, not the worker.
    const { rows: grantees } = await migrator.query<{ grantee: string }>(
      `WITH acls AS (
         SELECT n.nspacl AS acl FROM pg_catalog.pg_namespace n WHERE n.nspname = $1
         UNION ALL
         SELECT p.proacl FROM pg_catalog.pg_proc p
           JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = $1
       )
       SELECT DISTINCT CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee
         FROM acls, LATERAL aclexplode(acls.acl) a
        ORDER BY 1`,
      [PLATFORM_SCHEMA],
    );
    expect(grantees.map((row) => row.grantee)).toEqual([ROLES.apiGroup, ROLES.platformAdmin].sort());
  });

  it('M2-AC02/2 wringy_api_login has no USAGE on auth and cannot read auth.sessions (42501), only EXECUTE on the liveness function', async () => {
    // Every privilege is asked by OID: resolving `auth.sessions` from its name
    // would itself need USAGE on the schema, which is exactly what is absent
    // (the migrator running this query has none either).
    const { rows } = await migrator.query<{ usage: boolean; create: boolean; sessions: boolean; execute: boolean }>(
      `SELECT has_schema_privilege($1, n.oid, 'USAGE') AS usage,
              has_schema_privilege($1, n.oid, 'CREATE') AS create,
              has_table_privilege($1, c.oid, 'SELECT') AS sessions,
              (SELECT has_function_privilege($1, p.oid, 'EXECUTE')
                 FROM pg_catalog.pg_proc p
                 JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
                WHERE pn.nspname = $3 AND p.proname = 'session_is_live') AS execute
         FROM pg_catalog.pg_namespace n
         JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = 'sessions'
        WHERE n.nspname = $2`,
      [ROLES.apiLogin, AUTH_SCHEMA, PLATFORM_SCHEMA],
    );
    expect(rows[0]).toEqual({ usage: false, create: false, sessions: false, execute: true });

    for (const url of [db.urls.api, db.urls.worker]) {
      expect(await sqlState(withClientAt(url, (c) => c.query(`SELECT * FROM ${AUTH_SCHEMA}.sessions`)))).toBe('42501');
    }
    // The worker has no EXECUTE either: liveness is the API's question.
    const { rows: worker } = await migrator.query<{ signature: string; execute: boolean }>(
      `SELECT p.oid::regprocedure::text AS signature, has_function_privilege($1, p.oid, 'EXECUTE') AS execute
         FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = $2`,
      [ROLES.workerLogin, PLATFORM_SCHEMA],
    );
    expect(worker).toEqual([{ signature: SESSION_IS_LIVE_SIGNATURE, execute: false }]);
  });

  it('M2-AC02/2 UPDATE app.profiles SET status … as wringy_api_login → 42501, and only an operator can disable an account', async () => {
    // 0010 turned 0008's table-level UPDATE into a column grant, so `status` is
    // outside the runtime role's reach (ruling D12). The row has to exist first,
    // or the UPDATE would find nothing and succeed vacuously.
    const subject = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    await withClientAt(db.urls.migrator, (c) =>
      c.query(
        `INSERT INTO app.profiles (id, contact_email, display_name, last_sign_in_at)
              VALUES ($1, 'grants.probe@example.test', 'Grants Probe', now())
         ON CONFLICT (id) DO NOTHING`,
        [subject],
      ),
    );
    try {
      for (const sql of [
        `UPDATE app.profiles SET status = 'disabled'`,
        `UPDATE app.profiles SET status = 'active' WHERE id = '${subject}'`,
        // The other two columns the API may not write either (M2-04 owns them).
        `UPDATE app.profiles SET locale_pref = 'en-MY'`,
        `UPDATE app.profiles SET locale_pref_set_at = now()`,
      ]) {
        expect(await sqlState(withClientAt(db.urls.api, (c) => c.query(sql))), sql).toBe('42501');
      }

      // The migrator — the operator's account — is the one that can.
      await withClientAt(db.urls.migrator, (c) =>
        c.query(`UPDATE app.profiles SET status = 'disabled' WHERE id = $1`, [subject]),
      );
      const status = await withClientAt(db.urls.api, async (c) => {
        const { rows } = await c.query<{ status: string }>('SELECT status FROM app.profiles WHERE id = $1', [subject]);
        return rows[0]?.status;
      });
      expect(status).toBe('disabled');

      // And what a sign-in does write still works, on the same row.
      await withClientAt(db.urls.api, (c) =>
        c.query(
          `UPDATE app.profiles SET contact_email = $2, display_name = $3, last_sign_in_at = now() WHERE id = $1`,
          [subject, 'grants.probe+2@example.test', 'Grants Probe Two'],
        ),
      );
    } finally {
      await withClientAt(db.urls.migrator, (c) => c.query('DELETE FROM app.profiles WHERE id = $1', [subject]));
    }
  });

  it('M2-AC02/2 INSERT app.profiles with an explicit status column as wringy_api_login → 42501, while the column list a sign-in writes is allowed', async () => {
    const subject = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
    try {
      expect(
        await sqlState(
          withClientAt(db.urls.api, (c) =>
            c.query(
              `INSERT INTO app.profiles (id, contact_email, display_name, status, last_sign_in_at)
                    VALUES ($1, 'insert.probe@example.test', 'Insert Probe', 'active', now())`,
              [subject],
            ),
          ),
        ),
      ).toBe('42501');
      // An INSERT with no column list names every column positionally, so it is
      // refused for the same reason: the API must name the four it may write.
      expect(
        await sqlState(
          withClientAt(db.urls.api, (c) =>
            c.query(
              `INSERT INTO app.profiles
                    VALUES ($1, 'Insert Probe', 'insert.probe@example.test', NULL, NULL, 'active', now(), now(), now())`,
              [subject],
            ),
          ),
        ),
      ).toBe('42501');

      // The four columns writeProfileOnSignIn names are granted, and `status`
      // takes its default.
      const inserted = await withClientAt(db.urls.api, async (c) => {
        const { rows } = await c.query<{ status: string }>(
          `INSERT INTO app.profiles (id, contact_email, display_name, last_sign_in_at)
                VALUES ($1, 'insert.probe@example.test', 'Insert Probe', now())
           RETURNING status`,
          [subject],
        );
        return rows[0]?.status;
      });
      expect(inserted).toBe('active');

      // `SELECT … FOR UPDATE` and `FOR SHARE` need UPDATE on a column of the row,
      // not on the table: the sign-in command and the session probe re-read
      // `status` that way inside their own transaction (M2-02 R6).
      const locked = await withClientAt(db.urls.api, async (c) => {
        await c.query('BEGIN');
        try {
          const forUpdate = await c.query<{ status: string }>(
            'SELECT status FROM app.profiles WHERE id = $1 FOR UPDATE',
            [subject],
          );
          const forShare = await c.query<{ status: string }>(
            'SELECT status FROM app.profiles WHERE id = $1 FOR SHARE',
            [subject],
          );
          return [forUpdate.rows[0]?.status, forShare.rows[0]?.status];
        } finally {
          await c.query('ROLLBACK');
        }
      });
      expect(locked).toEqual(['active', 'active']);
    } finally {
      await withClientAt(db.urls.migrator, (c) => c.query('DELETE FROM app.profiles WHERE id = $1', [subject]));
    }
  });

  it('M2-AC03/3 app.audit_log is append-only for wringy_api_login: SELECT, UPDATE, DELETE and an INSERT naming occurred_at or recorded_by → 42501', async () => {
    // 0016 revoked the SELECT 0001's default gave and granted INSERT per column,
    // never on id, occurred_at or recorded_by (M2-03 code review R3).
    const row = `'system', 'org.read', 'denied', 'org.forbidden'`;
    for (const sql of [
      'SELECT * FROM app.audit_log',
      'SELECT count(*) FROM app.audit_log',
      `UPDATE app.audit_log SET reason = 'rewritten'`,
      'DELETE FROM app.audit_log',
      'TRUNCATE app.audit_log',
      `INSERT INTO app.audit_log (occurred_at, actor_kind, action, outcome, denial_code) VALUES (now() - interval '1 day', ${row})`,
      `INSERT INTO app.audit_log (recorded_by, actor_kind, action, outcome, denial_code) VALUES ('wringy_migrator', ${row})`,
      `INSERT INTO app.audit_log (id, actor_kind, action, outcome, denial_code) OVERRIDING SYSTEM VALUE VALUES (1, ${row})`,
      // RETURNING reads the row back, which needs SELECT: the API writes without it.
      `INSERT INTO app.audit_log (actor_kind, action, outcome, denial_code) VALUES (${row}) RETURNING id`,
    ]) {
      expect(await sqlState(withClientAt(db.urls.api, (c) => c.query(sql))), sql).toBe('42501');
    }
    // The worker has no USAGE on schema app at all.
    expect(await sqlState(withClientAt(db.urls.worker, (c) => c.query('SELECT * FROM app.audit_log')))).toBe('42501');
  });

  it('M2-AC03/3 the API login appends an audit row with no sequence privilege, and the row records wringy_api_login as its writer', async () => {
    const { rows: sequence } = await migrator.query<{ usage: boolean; select: boolean; update: boolean }>(
      `SELECT has_sequence_privilege($1, s.oid, 'USAGE') AS usage,
              has_sequence_privilege($1, s.oid, 'SELECT') AS select,
              has_sequence_privilege($1, s.oid, 'UPDATE') AS update
         FROM pg_catalog.pg_class s
        WHERE s.oid = pg_get_serial_sequence('app.audit_log', 'id')::regclass`,
      [ROLES.apiLogin],
    );
    expect(sequence).toEqual([{ usage: false, select: false, update: false }]);

    const requestId = '7d3f0c8e-2a41-4b6e-9f10-3c5d7e9a1b2c';
    const sessionRef = 'a'.repeat(64);
    const actor = 'c0ffee00-0000-4000-8000-00000000a0d1';
    await withClientAt(db.urls.api, (c) =>
      c.query(
        `INSERT INTO app.audit_log
              (actor_kind, actor_user_id, context_org_id, action, target_type, target_id, outcome, denial_code,
               reason, request_id, session_ref)
         VALUES ('user', $1, $2, 'org.read', 'org', $5, 'denied', 'org.forbidden', 'not_a_member', $3, $4)`,
        [actor, 'a0000000-0000-4000-8000-00000000ffff', requestId, sessionRef, 'a0000000-0000-4000-8000-00000000ffff'],
      ),
    );
    const { rows } = await migrator.query<{ recorded_by: string; id: string; fresh: boolean }>(
      `SELECT recorded_by, id::text AS id, occurred_at > now() - interval '1 minute' AS fresh
         FROM app.audit_log WHERE request_id = $1`,
      [requestId],
    );
    expect(rows).toEqual([{ recorded_by: ROLES.apiLogin, id: expect.stringMatching(/^\d+$/), fresh: true }]);
  });

  it('M2-AC03/1 wringy_api_login cannot write a capability grant: INSERT, UPDATE or DELETE on app.admin_scopes and app.platform_grants → 42501', async () => {
    const subject = 'c0ffee00-0000-4000-8000-00000000a0d2';
    for (const sql of [
      `INSERT INTO app.admin_scopes (user_id, org_id, capability, granted_by_operator, reason)
            VALUES ('${subject}', 'a0000000-0000-4000-8000-000000000001', 'review', 'api', 'self-service')`,
      `INSERT INTO app.admin_scopes (user_id, org_id, capability, granted_by_operator, reason)
            VALUES ('${subject}', 'a0000000-0000-4000-8000-000000000001', 'finance', 'api', 'self-service')`,
      `INSERT INTO app.platform_grants (user_id, capability, granted_by_operator, reason)
            VALUES ('${subject}', 'ops_runtime', 'api', 'self-service')`,
      `UPDATE app.admin_scopes SET capability = 'finance'`,
      `UPDATE app.platform_grants SET reason = 'changed'`,
      'DELETE FROM app.admin_scopes',
      'DELETE FROM app.platform_grants',
    ]) {
      expect(await sqlState(withClientAt(db.urls.api, (c) => c.query(sql))), sql).toBe('42501');
    }
  });

  it('M2-AC03/2 wringy_api_login cannot delete a membership, write an org id, data origin or creator, or change the role, expiry or token hash of an invitation (42501)', async () => {
    for (const sql of [
      'DELETE FROM app.org_members',
      'DELETE FROM app.org_invitations',
      'DELETE FROM app.orgs',
      `UPDATE app.org_members SET org_id = org_id`,
      `UPDATE app.org_members SET user_id = user_id`,
      `UPDATE app.org_invitations SET role = 'admin'`,
      `UPDATE app.org_invitations SET expires_at = now() + interval '1 year'`,
      `UPDATE app.org_invitations SET token_hash = repeat('0', 64)`,
      `UPDATE app.org_invitations SET invitee_email_norm = 'someone@example.test'`,
      `UPDATE app.orgs SET data_origin = 'fixture'`,
      `UPDATE app.orgs SET created_by = NULL`,
      `INSERT INTO app.orgs (id, name) VALUES (gen_random_uuid(), 'Chosen id')`,
      `INSERT INTO app.orgs (name, data_origin) VALUES ('Relabelled', 'fixture')`,
    ]) {
      expect(await sqlState(withClientAt(db.urls.api, (c) => c.query(sql))), sql).toBe('42501');
    }
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
                (SELECT version FROM ops.pgboss_schema_version) AS pgboss,
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
