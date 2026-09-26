import type { Pool } from '@wringy/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_APPLICATION_NAME, createApiPool } from '../../src/database';
import { createTestDatabase, seedFixtures, sqlState, withClientAt, type TestDatabase } from './support';

const CAMPAIGN = 'c0000000-0000-4000-8000-000000000001';
const ORG = 'a0000000-0000-4000-8000-000000000001';
/** A signed-in person, so an org the API creates can name its creator (0011's foreign key). */
const CREATOR = '0c4ea704-0000-4000-8000-00000000c001';

describe('M2-AC01 the API process connects as the runtime role', () => {
  let db: TestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedFixtures(db);
    // The same pool factory src/server.ts uses, on the URL the API is configured with.
    pool = createApiPool(db.urls.api, () => {});
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it('M2-AC01/2 the API runs as the runtime role and cannot write app.campaigns', async () => {
    const { rows } = await pool.query<{
      current_user: string;
      app: string;
      in_api_group: boolean;
      in_migrator: boolean;
      in_worker_group: boolean;
    }>(
      `SELECT current_user,
              current_setting('application_name') AS app,
              pg_has_role(current_user, 'wringy_api', 'MEMBER') AS in_api_group,
              pg_has_role(current_user, 'wringy_migrator', 'MEMBER') AS in_migrator,
              pg_has_role(current_user, 'wringy_worker', 'MEMBER') AS in_worker_group`,
    );
    expect(rows[0]).toEqual({
      current_user: 'wringy_api_login',
      app: API_APPLICATION_NAME,
      in_api_group: true,
      in_migrator: false,
      in_worker_group: false,
    });

    // Reading is allowed; every kind of write is refused with 42501 insufficient_privilege.
    expect((await pool.query('SELECT count(*)::int AS n FROM app.campaigns')).rows[0]).toEqual({ n: 3 });
    // Thunks, so each refusal is awaited as it happens (no unhandled rejection).
    const refused: Array<[string, () => Promise<unknown>]> = [
      [
        'INSERT campaign',
        () =>
          pool.query(
            `INSERT INTO app.campaigns (id, org_id, title, status, data_origin)
             VALUES ('c0000000-0000-4000-8000-0000000000ff', $1, 'Injected', 'draft', 'fixture')`,
            [ORG],
          ),
      ],
      ['UPDATE campaign', () => pool.query(`UPDATE app.campaigns SET title = 'Changed' WHERE id = $1`, [CAMPAIGN])],
      ['DELETE campaign', () => pool.query(`DELETE FROM app.campaigns WHERE id = $1`, [CAMPAIGN])],
      ['TRUNCATE campaigns', () => pool.query('TRUNCATE app.campaigns')],
      // Amended by M2-03 (0011, code review R1/R13): the API may now insert an org
      // naming (name, created_by) only, so this row still fails, because it names
      // `id` (and `data_origin`), which stay ungranted.
      [
        'INSERT org naming id (42501)',
        () => pool.query(`INSERT INTO app.orgs (id, name, data_origin) VALUES ('a0000000-0000-4000-8000-0000000000ff', 'x', 'live')`),
      ],
    ];
    for (const [label, attempt] of refused) expect(await sqlState(attempt()), label).toBe('42501');

    // Nothing changed.
    const after = await pool.query<{ title: string }>('SELECT title FROM app.campaigns WHERE id = $1', [CAMPAIGN]);
    expect(after.rows[0]?.title).toBe('Morning brew launch');
  });

  it('M2-AC01/2 amended by M2-03: the API creates an org naming only name and created_by, and renames it; it cannot choose an id, relabel an org or change its creator (42501)', async () => {
    await withClientAt(db.urls.migrator, (client) =>
      client.query(
        `INSERT INTO app.profiles (id, contact_email, display_name, last_sign_in_at)
         VALUES ($1, 'runtime.role@example.test', 'Runtime Role', now())`,
        [CREATOR],
      ),
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // INSERT (name, created_by): the id and the label are the database's (live).
      const created = await client.query<{ id: string; data_origin: string; created_by: string }>(
        `INSERT INTO app.orgs (name, created_by) VALUES ('Runtime Role Org', $1) RETURNING id, data_origin, created_by`,
        [CREATOR],
      );
      expect(created.rows[0]).toEqual({ id: expect.any(String), data_origin: 'live', created_by: CREATOR });
      const id = created.rows[0]!.id;
      // UPDATE (name): a rename.
      const renamed = await client.query<{ name: string }>(
        `UPDATE app.orgs SET name = 'Runtime Role Org, renamed' WHERE id = $1 RETURNING name`,
        [id],
      );
      expect(renamed.rows).toEqual([{ name: 'Runtime Role Org, renamed' }]);
      await client.query('ROLLBACK');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }

    const refused: Array<[string, () => Promise<unknown>]> = [
      ['UPDATE org data_origin', () => pool.query(`UPDATE app.orgs SET data_origin = 'live' WHERE id = $1`, [ORG])],
      ['UPDATE org created_by', () => pool.query(`UPDATE app.orgs SET created_by = $2 WHERE id = $1`, [ORG, CREATOR])],
      ['UPDATE org id', () => pool.query(`UPDATE app.orgs SET id = id WHERE id = $1`, [ORG])],
      ['INSERT org naming data_origin', () => pool.query(`INSERT INTO app.orgs (name, data_origin) VALUES ('x', 'fixture')`)],
      ['DELETE org', () => pool.query(`DELETE FROM app.orgs WHERE id = $1`, [ORG])],
    ];
    for (const [label, attempt] of refused) expect(await sqlState(attempt()), label).toBe('42501');

    // The fixture org is untouched: still fixture, still no creator.
    const { rows } = await pool.query<{ data_origin: string; created_by: string | null }>(
      'SELECT data_origin, created_by FROM app.orgs WHERE id = $1',
      [ORG],
    );
    expect(rows).toEqual([{ data_origin: 'fixture', created_by: null }]);
  });

  it('M2-AC01/2 the API cannot write the heartbeat or the marker, nor touch schema pgboss: it reads the version through ops', async () => {
    expect(
      await sqlState(
        pool.query(
          `INSERT INTO ops.worker_heartbeat (worker_id, started_at, last_beat_at, image_ref) VALUES ('fake', now(), now(), 'x')`,
        ),
      ),
    ).toBe('42501');
    expect(await sqlState(pool.query(`UPDATE ops.environment SET fixtures_allowed = false`))).toBe('42501');
    expect(await sqlState(pool.query('SELECT count(*) FROM pgboss.job'))).toBe('42501');
    expect(await sqlState(pool.query('SELECT version FROM pgboss.version'))).toBe('42501');
    expect(await sqlState(pool.query('SELECT version FROM ops.pgboss_schema_version'))).toBeUndefined();
    // The view is an aggregate, so no role can write through it (55000: not automatically updatable).
    expect(await sqlState(pool.query('UPDATE ops.pgboss_schema_version SET version = 1'))).toBe('55000');
  });
});
