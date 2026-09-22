import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPool, withClient, withTransaction, type Pool } from '../src/pool';
import { createTestDatabase, type TestDatabase } from './harness';

describe('M2-AC01 pool helpers on a real PostgreSQL', () => {
  let db: TestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    db = await createTestDatabase();
    pool = createPool({ connectionString: db.urls.migrator, applicationName: 'wringy-db-test', max: 2 });
    await pool.query('CREATE TABLE app.tx_probe (id int PRIMARY KEY)');
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it('names the connection and uses UTC', async () => {
    const row = await withClient(pool, async (client) => {
      const { rows } = await client.query<{ app: string; tz: string }>(
        `SELECT current_setting('application_name') AS app, current_setting('TimeZone') AS tz`,
      );
      return rows[0];
    });
    expect(row?.app).toBe('wringy-db-test');
    // The embedded cluster is started with TimeZone=UTC; the postgres:17 image
    // that CI points TEST_DATABASE_URL at initialises with its container zone.
    expect(row?.tz).toMatch(/^(Etc\/)?UTC$/);
  });

  it('withTransaction commits on success and rolls back when the callback throws', async () => {
    await withTransaction(pool, (client) => client.query('INSERT INTO app.tx_probe VALUES (1)'));
    await expect(
      withTransaction(pool, async (client) => {
        await client.query('INSERT INTO app.tx_probe VALUES (2)');
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');

    const { rows } = await pool.query<{ id: number }>('SELECT id FROM app.tx_probe ORDER BY id');
    expect(rows).toEqual([{ id: 1 }]);
  });
});
