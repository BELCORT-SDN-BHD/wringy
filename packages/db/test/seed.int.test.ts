import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FixturesRefusedError, seedFixtures as applyFixtureSeed } from '../src/fixtures';
import {
  createTestDatabase,
  seedFixtures,
  setTestEnvironment,
  sqlState,
  withClientAt,
  type TestDatabase,
} from './harness';

interface CampaignRow {
  id: string;
  org_id: string;
  org_name: string;
  title: string;
  status: string;
  data_origin: string;
  created_at: Date;
  updated_at: Date;
}

const READ_CAMPAIGNS = `SELECT c.id, c.org_id, o.name AS org_name, c.title, c.status, c.data_origin, c.created_at, c.updated_at
                          FROM app.campaigns c JOIN app.orgs o ON o.id = c.org_id AND o.data_origin = c.data_origin
                         ORDER BY c.id`;

const countRows = (url: string) =>
  withClientAt(url, async (client) => {
    const { rows } = await client.query<{ orgs: number; campaigns: number }>(
      `SELECT (SELECT count(*) FROM app.orgs)::int AS orgs, (SELECT count(*) FROM app.campaigns)::int AS campaigns`,
    );
    return rows[0];
  });

/** `pnpm db:seed:fixtures` (seedFixtures) on clones with committed rows. */
describe('M2-AC01/2 fixture seed', () => {
  let allowed: TestDatabase;
  let refused: TestDatabase;

  beforeAll(async () => {
    [allowed, refused] = await Promise.all([createTestDatabase(), createTestDatabase()]);
  });

  afterAll(async () => {
    await Promise.all([allowed?.drop(), refused?.drop()]);
  });

  it('M2-AC01/2 seeds two fixture orgs and three fixture campaigns that the API login can read', async () => {
    expect(await seedFixtures(allowed)).toEqual({ environment: 'ci', written: 5, orgs: 2, campaigns: 3 });

    const rows = await withClientAt(allowed.urls.api, async (client) => (await client.query<CampaignRow>(READ_CAMPAIGNS)).rows);
    expect(rows.map(({ org_name, title, status, data_origin }) => ({ org_name, title, status, data_origin }))).toEqual([
      { org_name: 'Kopi Kita', title: 'Morning brew launch', status: 'published', data_origin: 'fixture' },
      { org_name: 'Kopi Kita', title: 'Hari Raya open house', status: 'draft', data_origin: 'fixture' },
      { org_name: 'Nusantara Fit', title: 'Weekend run club', status: 'published', data_origin: 'fixture' },
    ]);
  });

  it('M2-AC01/2 a second seed run writes nothing and leaves every row as it was', async () => {
    const before = await withClientAt(allowed.urls.migrator, async (c) => (await c.query<CampaignRow>(READ_CAMPAIGNS)).rows);
    expect(await seedFixtures(allowed)).toEqual({ environment: 'ci', written: 0, orgs: 2, campaigns: 3 });
    const after = await withClientAt(allowed.urls.migrator, async (c) => (await c.query<CampaignRow>(READ_CAMPAIGNS)).rows);
    expect(after).toEqual(before);
  });

  it('puts back a fixture title changed by hand, and never touches a live row', async () => {
    await withClientAt(allowed.urls.migrator, async (client) => {
      await client.query(`UPDATE app.campaigns SET title = 'Edited by hand' WHERE title = 'Weekend run club'`);
      await client.query(`INSERT INTO app.orgs (id, name, data_origin) VALUES ('e0000000-0000-4000-8000-000000000001', 'A live org', 'live')`);
    });
    expect((await seedFixtures(allowed)).written).toBe(1);
    const titles = await withClientAt(allowed.urls.migrator, async (client) =>
      (await client.query<{ title: string }>(`SELECT title FROM app.campaigns ORDER BY id`)).rows.map((row) => row.title),
    );
    expect(titles).toEqual(['Morning brew launch', 'Hari Raya open house', 'Weekend run club']);
    expect(await countRows(allowed.urls.migrator)).toEqual({ orgs: 3, campaigns: 3 });
  });

  it('M2-AC01/2 the seed is refused, writing nothing, in an environment that does not allow fixtures', async () => {
    await setTestEnvironment(refused, 'production');
    await expect(seedFixtures(refused)).rejects.toThrow(FixturesRefusedError);
    await expect(seedFixtures(refused)).rejects.toThrow(/"production" does not allow fixtures/);
    expect(await countRows(refused.urls.migrator)).toEqual({ orgs: 0, campaigns: 0 });

    // Even run by hand, the rows are refused inside the database.
    expect(
      await sqlState(
        withClientAt(refused.urls.migrator, (client) =>
          client.query(`INSERT INTO app.orgs (id, name, data_origin) VALUES ('a0000000-0000-4000-8000-000000000001', 'Kopi Kita', 'fixture')`),
        ),
      ),
    ).toBe('23514');
  });

  it('M2-AC01/2 the seed is refused without a marker, or when WRINGY_ENV names another environment', async () => {
    await setTestEnvironment(refused, 'staging');
    await expect(
      withClientAt(refused.urls.migrator, (client) => applyFixtureSeed(client, { expectedEnv: 'local' })),
    ).rejects.toThrow(/WRINGY_ENV is "local" but this database is marked "staging"/);

    await withClientAt(refused.urls.migrator, (client) => client.query('DELETE FROM ops.environment'));
    await expect(seedFixtures(refused)).rejects.toThrow(/no ops\.environment marker; run pnpm db:env first/);
    expect(await countRows(refused.urls.migrator)).toEqual({ orgs: 0, campaigns: 0 });
  });
});
