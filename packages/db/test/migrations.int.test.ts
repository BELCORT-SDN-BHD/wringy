import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureDatabase } from '../src/bootstrap';
import { EXPECTED_MIGRATION_HEAD, EXPECTED_PGBOSS_VERSION } from '../src/expected-head';
import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE, listMigrations, migrateDatabase, runMigrations } from '../src/migrate';
import { ROLES } from '../src/roles';
import { cluster, urlFor, withAdmin, withClientAt } from './harness';

const SCHEMAS = ['app', 'ops', 'pgboss'];

/**
 * Everything the migrations and pg-boss define in app, ops and pgboss, without
 * OIDs: schemas, relations, columns (with their column-level ACLs),
 * constraints, indexes, triggers, functions, types, ACLs and default ACLs. Two
 * databases with equal snapshots have the same schema and the same privileges.
 */
async function catalogSnapshot(url: string) {
  const queries = {
    schemas: `SELECT n.nspname || ' owner=' || pg_get_userbyid(n.nspowner) || ' acl=' || coalesce(n.nspacl::text, '-')
                FROM pg_namespace n WHERE n.nspname = ANY($1)`,
    relations: `SELECT n.nspname || '.' || c.relname || ' kind=' || c.relkind::text || ' owner=' || pg_get_userbyid(c.relowner)
                       || ' acl=' || coalesce(c.relacl::text, '-')
                  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ANY($1)`,
    columns: `SELECT n.nspname || '.' || c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
                     || CASE WHEN a.attnotnull THEN ' not null' ELSE '' END
                     || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
                     || coalesce(' acl=' || a.attacl::text, '')
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
               WHERE n.nspname = ANY($1) AND a.attnum > 0 AND NOT a.attisdropped`,
    constraints: `SELECT conrelid::regclass::text || ' ' || conname || ' ' || pg_get_constraintdef(c.oid)
                    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = ANY($1)`,
    indexes: `SELECT pg_get_indexdef(i.indexrelid)
                FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = ANY($1)`,
    triggers: `SELECT pg_get_triggerdef(t.oid)
                 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = ANY($1) AND NOT t.tgisinternal`,
    functions: `SELECT p.oid::regprocedure::text || ' owner=' || pg_get_userbyid(p.proowner) || ' acl=' || coalesce(p.proacl::text, '-')
                       || ' md5=' || md5(pg_get_functiondef(p.oid))
                  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = ANY($1) AND p.prokind IN ('f', 'p')`,
    types: `SELECT n.nspname || '.' || t.typname || ' ' || t.typtype::text
                   || coalesce(' ' || (SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid), '')
              FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = ANY($1)`,
    defaultAcls: `SELECT pg_get_userbyid(d.defaclrole) || ' ' || coalesce(n.nspname, '*') || ' ' || d.defaclobjtype::text
                         || ' ' || d.defaclacl::text
                    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace`,
  };
  return withClientAt(url, async (client) => {
    const snapshot = {} as Record<keyof typeof queries, string[]>;
    for (const [name, sql] of Object.entries(queries) as [keyof typeof queries, string][]) {
      const { rows } = await client.query<Record<string, string>>(sql, sql.includes('$1') ? [SCHEMAS] : []);
      snapshot[name] = rows.map((row) => String(Object.values(row)[0])).sort();
    }
    return snapshot;
  });
}

/**
 * These tests migrate their own empty databases rather than cloning the
 * template, because "from zero" is the point.
 */
describe('M2-AC01/2 migrations from zero', () => {
  const name = `wringy_t_${cluster().runId}_fresh`;
  const orderName = `wringy_t_${cluster().runId}_order`;
  const migratorUrl = urlFor(ROLES.migrator, cluster().passwords.migrator, name);

  async function query<T extends pg.QueryResultRow>(sql: string, url = migratorUrl): Promise<T[]> {
    return withClientAt(url, async (client) => (await client.query<T>(sql)).rows);
  }

  beforeAll(async () => {
    await withAdmin(async (admin) => {
      await ensureDatabase(admin, name);
      await ensureDatabase(admin, orderName);
    });
  });

  afterAll(async () => {
    await withAdmin(async (admin) => {
      for (const db of [name, orderName]) {
        await admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(db)} WITH (FORCE)`);
      }
    });
  });

  it('M2-AC01/2 a fresh database migrates from zero as the migrator (pg-boss schema, then every SQL migration), and a second run changes nothing', async () => {
    const all = listMigrations();
    expect(all[0]).toBe('0001_schemas_roles');
    expect(all.at(-1)).toBe(EXPECTED_MIGRATION_HEAD);

    const lines: string[] = [];
    const first = await migrateDatabase({ databaseUrl: migratorUrl, log: (line) => lines.push(line) });
    expect(first).toEqual({
      pgboss: { schema: 'pgboss', from: null, to: EXPECTED_PGBOSS_VERSION, outcome: 'installed' },
      migrations: all,
      head: EXPECTED_MIGRATION_HEAD,
    });
    // The pg-boss CLI's own report, and never the connection string.
    expect(lines.some((line) => /^pg-boss: Successfully created pg-boss schema "pgboss"/.test(line))).toBe(true);
    expect(lines.join('\n')).not.toContain(cluster().passwords.migrator);

    const second = await migrateDatabase({ databaseUrl: migratorUrl });
    expect(second).toEqual({
      pgboss: { schema: 'pgboss', from: EXPECTED_PGBOSS_VERSION, to: EXPECTED_PGBOSS_VERSION, outcome: 'unchanged' },
      migrations: [],
      head: EXPECTED_MIGRATION_HEAD,
    });

    const applied = await query<{ name: string }>(`SELECT name FROM ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} ORDER BY id`);
    expect(applied.map((row) => row.name)).toEqual(all);
    expect(await query<{ version: number }>('SELECT version FROM pgboss.version')).toEqual([
      { version: EXPECTED_PGBOSS_VERSION },
    ]);
  });

  it('M2-AC01/2 after the fresh migration the API login reads the migration head and the pg-boss version', async () => {
    const apiUrl = urlFor(ROLES.apiLogin, cluster().passwords.api, name);
    expect(
      await query<{ head: string; pgboss: number; campaigns: number }>(
        `SELECT (SELECT name FROM ops.pgmigrations ORDER BY id DESC LIMIT 1) AS head,
                (SELECT version FROM ops.pgboss_schema_version) AS pgboss,
                (SELECT count(*)::int FROM app.campaigns) AS campaigns`,
        apiUrl,
      ),
    ).toEqual([{ head: EXPECTED_MIGRATION_HEAD, pgboss: EXPECTED_PGBOSS_VERSION, campaigns: 0 }]);
  });

  it('M2-AC01/2 node-pg-migrate alone stops at 0005 until pg-boss is installed, and the whole batch rolls back', async () => {
    const url = urlFor(ROLES.migrator, cluster().passwords.migrator, orderName);
    await expect(runMigrations({ databaseUrl: url })).rejects.toThrow(/schema pgboss is missing/);
    expect(
      await query<{ app: string | null; environment: string | null; orgs: string | null }>(
        `SELECT to_regnamespace('app')::text AS app, to_regclass('ops.environment')::text AS environment,
                to_regclass('app.orgs')::text AS orgs`,
        url,
      ),
    ).toEqual([{ app: null, environment: null, orgs: null }]);

    // pnpm db:migrate's order (pg-boss first) then succeeds on the same database.
    expect((await migrateDatabase({ databaseUrl: url })).head).toBe(EXPECTED_MIGRATION_HEAD);
  });

  it('M2-AC01/2 the migrator owns app, ops and pgboss, and nothing is created in public', async () => {
    const owners = await query<{ nspname: string; owner: string }>(
      `SELECT nspname, pg_catalog.pg_get_userbyid(nspowner) AS owner
         FROM pg_catalog.pg_namespace WHERE nspname IN ('app', 'ops', 'pgboss') ORDER BY nspname`,
    );
    expect(owners).toEqual([
      { nspname: 'app', owner: ROLES.migrator },
      { nspname: 'ops', owner: ROLES.migrator },
      { nspname: 'pgboss', owner: ROLES.migrator },
    ]);

    const inPublic = await query<{ count: string }>(
      `SELECT (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace)
            + (SELECT count(*) FROM pg_catalog.pg_proc WHERE pronamespace = 'public'::regnamespace)
            + (SELECT count(*) FROM pg_catalog.pg_type WHERE typnamespace = 'public'::regnamespace) AS count`,
    );
    expect(inPublic[0]?.count).toBe('0');
  });

  it('M2-AC01/2 no migration grants a schema privilege to PUBLIC or to a role outside the reviewed set', async () => {
    const grantees = await query<{ grantee: string }>(
      `SELECT DISTINCT CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee
         FROM pg_catalog.pg_namespace n, LATERAL aclexplode(n.nspacl) a
        WHERE n.nspname IN ('app', 'ops', 'pgboss')
        ORDER BY 1`,
    );
    expect(grantees.map((row) => row.grantee)).toEqual([ROLES.apiGroup, ROLES.workerGroup, ROLES.migrator].sort());
  });

  it('M2-AC01/2 reverting every migration after 0001 and migrating up again leaves the schema and privileges identical', async () => {
    const all = listMigrations();
    const before = await catalogSnapshot(migratorUrl);
    expect(before.relations.some((row) => row.startsWith('app.campaigns '))).toBe(true);
    expect(before.columns.some((row) => /^pgboss\.version\.cron_on .* acl=/.test(row))).toBe(true);

    const reverted = await runMigrations({ databaseUrl: migratorUrl, direction: 'down', count: all.length - 1 });
    expect(reverted).toEqual(all.slice(1).reverse());
    const down = await catalogSnapshot(migratorUrl);
    expect(
      down.relations.some((row) =>
        /^(app\.campaigns|app\.orgs|ops\.environment|ops\.worker_heartbeat|ops\.pgboss_schema_version) /.test(row),
      ),
    ).toBe(false);
    expect(down.functions.some((row) => row.startsWith('ops.'))).toBe(false);
    expect(down.constraints.some((row) => row.includes('wringy_queue_shared_table_only'))).toBe(false);

    expect((await migrateDatabase({ databaseUrl: migratorUrl })).migrations).toEqual(listMigrations().slice(1));
    expect(await catalogSnapshot(migratorUrl)).toEqual(before);
  });

  it('reverts to zero and applies again (down sections run locally only; pgboss stays)', async () => {
    const all = listMigrations();
    expect(await runMigrations({ databaseUrl: migratorUrl, direction: 'down', count: all.length })).toEqual(
      [...all].reverse(),
    );
    expect(await query<{ nspname: string }>(`SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname IN ('app', 'pgboss')`)).toEqual([
      { nspname: 'pgboss' },
    ]);
    expect((await migrateDatabase({ databaseUrl: migratorUrl })).migrations).toEqual(all);
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
