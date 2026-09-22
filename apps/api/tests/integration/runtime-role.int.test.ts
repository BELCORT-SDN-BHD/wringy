import type { Pool } from '@wringy/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_APPLICATION_NAME, createApiPool } from '../../src/database';
import { createTestDatabase, seedFixtures, sqlState, type TestDatabase } from './support';

const CAMPAIGN = 'c0000000-0000-4000-8000-000000000001';
const ORG = 'a0000000-0000-4000-8000-000000000001';

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
      [
        'INSERT org',
        () => pool.query(`INSERT INTO app.orgs (id, name, data_origin) VALUES ('a0000000-0000-4000-8000-0000000000ff', 'x', 'live')`),
      ],
    ];
    for (const [label, attempt] of refused) expect(await sqlState(attempt()), label).toBe('42501');

    // Nothing changed.
    const after = await pool.query<{ title: string }>('SELECT title FROM app.campaigns WHERE id = $1', [CAMPAIGN]);
    expect(after.rows[0]?.title).toBe('Morning brew launch');
  });

  it('M2-AC01/2 the API cannot write the heartbeat or the marker, nor touch pg-boss beyond its version', async () => {
    expect(
      await sqlState(
        pool.query(
          `INSERT INTO ops.worker_heartbeat (worker_id, started_at, last_beat_at, image_ref) VALUES ('fake', now(), now(), 'x')`,
        ),
      ),
    ).toBe('42501');
    expect(await sqlState(pool.query(`UPDATE ops.environment SET fixtures_allowed = false`))).toBe('42501');
    expect(await sqlState(pool.query('SELECT count(*) FROM pgboss.job'))).toBe('42501');
    expect(await sqlState(pool.query('SELECT version FROM pgboss.version'))).toBeUndefined();
  });
});
