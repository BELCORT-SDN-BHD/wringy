import { internalCampaignsResponseSchema, type InternalCampaignsResponse } from '@wringy/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CACHE_CONTROL } from '../../src/app';
import { errorBody } from '../../src/errors';
import {
  asMigrator,
  buildTestApi,
  createTestDatabase,
  seedFixtures,
  withClientAt,
  type TestApi,
  type TestDatabase,
} from './support';

/** The fixture seed (packages/db/fixtures/internal-campaigns.sql), as the API must return it. */
const SEEDED = [
  { id: 'c0000000-0000-4000-8000-000000000001', title: 'Morning brew launch', status: 'published', orgName: 'Kopi Kita' },
  { id: 'c0000000-0000-4000-8000-000000000002', title: 'Hari Raya open house', status: 'draft', orgName: 'Kopi Kita' },
  { id: 'c0000000-0000-4000-8000-000000000003', title: 'Weekend run club', status: 'published', orgName: 'Nusantara Fit' },
];
const CONTRACT_KEYS = ['dataOrigin', 'id', 'orgName', 'status', 'title', 'updatedAt'];

const LIVE_ORG = 'b0000000-0000-4000-8000-0000000000aa';
const LIVE_CAMPAIGN = 'd0000000-0000-4000-8000-0000000000aa';

async function dbNow(db: TestDatabase): Promise<Date> {
  const [row] = await asMigrator<{ now: Date }>(db, 'SELECT now() AS now');
  return row!.now;
}

describe('M2-AC01 GET /internal/campaigns', () => {
  let db: TestDatabase;
  let api: TestApi;

  beforeAll(async () => {
    db = await createTestDatabase();
    const seeded = await seedFixtures(db);
    expect(seeded).toMatchObject({ orgs: 2, campaigns: 3 });
    // A live org and campaign in the same database must never be listed.
    await asMigrator(db, `INSERT INTO app.orgs (id, name, data_origin) VALUES ($1, 'Live org', 'live')`, [LIVE_ORG]);
    await asMigrator(
      db,
      `INSERT INTO app.campaigns (id, org_id, title, status, data_origin) VALUES ($1, $2, 'Live campaign', 'published', 'live')`,
      [LIVE_CAMPAIGN, LIVE_ORG],
    );
    api = await buildTestApi(db.urls.api);
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  it('M2-AC01/2 page→Fastify→PostgreSQL read: GET /internal/campaigns returns the seeded fixture campaigns', async () => {
    const before = await dbNow(db);
    const response = await api.app.inject({ method: 'GET', url: '/internal/campaigns' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE_CONTROL);
    expect(response.headers['content-type']).toMatch(/^application\/json/);

    const body = internalCampaignsResponseSchema.parse(response.json()) as InternalCampaignsResponse;
    expect(body.items.map(({ id, title, status, orgName }) => ({ id, title, status, orgName })).sort((a, b) => a.id.localeCompare(b.id))).toEqual(SEEDED);
    expect(body.items.every((item) => item.dataOrigin === 'fixture')).toBe(true);
    expect(response.body).not.toContain(LIVE_CAMPAIGN);
    expect(response.body).not.toContain('Live campaign');

    // dataAsOf is the database clock at read time, not a host timestamp.
    const dataAsOf = new Date(body.dataAsOf).getTime();
    expect(dataAsOf).toBeGreaterThanOrEqual(before.getTime());
    expect(dataAsOf - before.getTime()).toBeLessThan(10_000);
  });

  it('orders by updated_at, newest first', async () => {
    // The seed inserts all three in one statement; touching one makes it the newest.
    // Two statements, two transactions: ops.touch_updated_at() stamps each with its own now().
    await asMigrator(db, `UPDATE app.campaigns SET status = status WHERE id = $1`, [SEEDED[2]!.id]);
    await asMigrator(db, `UPDATE app.campaigns SET status = 'draft' WHERE id = $1`, [SEEDED[0]!.id]);
    const body = (await api.app.inject({ method: 'GET', url: '/internal/campaigns' })).json() as InternalCampaignsResponse;

    expect(body.items[0]?.id).toBe(SEEDED[0]!.id);
    expect(body.items[0]?.status).toBe('draft');
    expect(body.items.map((item) => item.id)).toEqual([SEEDED[0]!.id, SEEDED[2]!.id, SEEDED[1]!.id]);
    const stamps = body.items.map((item) => Date.parse(item.updatedAt));
    expect([...stamps].sort((a, b) => b - a)).toEqual(stamps);
  });

  it('M2-AC01/2 the response schema is the allow-list: an extra column never reaches the response', async () => {
    await asMigrator(db, `ALTER TABLE app.campaigns ADD COLUMN internal_note text NOT NULL DEFAULT 'LEAK-CANARY-COLUMN'`);
    const response = await api.app.inject({ method: 'GET', url: '/internal/campaigns' });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain('LEAK-CANARY-COLUMN');
    const body = response.json() as InternalCampaignsResponse;
    expect(Object.keys(body).sort()).toEqual(['dataAsOf', 'items']);
    for (const item of body.items) expect(Object.keys(item).sort()).toEqual(CONTRACT_KEYS);
  });

  it('M2-AC01/2 the serializer strips what a handler over-selects: every column of the real rows, only contract keys out', async () => {
    const probe = await buildTestApi(db.urls.api);
    try {
      // A deliberately careless handler: every campaign column as the API role,
      // passed straight through with extra keys. Only the response schema stands in the way.
      probe.app.get(
        '/internal/leak-probe',
        { schema: { response: { 200: internalCampaignsResponseSchema } } },
        async () => {
          const rows = await selectEverythingAsApi(db.urls.api);
          return {
            items: rows.map((row) => ({
              ...row,
              id: row.id as string,
              title: row.title as string,
              status: row.status as 'draft' | 'published',
              orgName: row.name as string,
              dataOrigin: row.data_origin as 'fixture',
              updatedAt: (row.updated_at as Date).toISOString(),
              debugSql: 'SELECT * FROM app.campaigns',
            })),
            dataAsOf: new Date().toISOString(),
            connectionString: db.urls.api,
          };
        },
      );
      const response = await probe.app.inject({ method: 'GET', url: '/internal/leak-probe' });
      expect(response.statusCode).toBe(200);
      const body = response.json() as InternalCampaignsResponse;
      expect(body.items).toHaveLength(3);
      for (const item of body.items) expect(Object.keys(item).sort()).toEqual(CONTRACT_KEYS);
      for (const leaked of ['LEAK-CANARY-COLUMN', 'org_id', 'internal_note', 'debugSql', 'connectionString', 'postgres://']) {
        expect(response.body).not.toContain(leaked);
      }
    } finally {
      await probe.close();
    }
  });

  it('runs the authenticate hook first on every /internal route (the M2-02 hook point)', async () => {
    const guarded = await buildTestApi(db.urls.api, {
      authenticate: async (_request, reply) =>
        reply.code(401).send({ error: { code: 'unauthenticated', message: 'Sign in first.' } }),
    });
    try {
      for (const url of ['/internal/campaigns', '/internal/worker-health']) {
        const response = await guarded.app.inject({ method: 'GET', url });
        expect(response.statusCode, url).toBe(401);
        expect(response.json()).toEqual({ error: { code: 'unauthenticated', message: 'Sign in first.' } });
      }
      expect((await guarded.app.inject({ method: 'GET', url: '/health/live' })).statusCode).toBe(200);
    } finally {
      await guarded.close();
    }
  });

  it('answers an unknown route with 404 not_found', async () => {
    const response = await api.app.inject({ method: 'GET', url: '/internal/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(errorBody('not_found'));
    expect(response.headers['cache-control']).toBe(CACHE_CONTROL);
  });
});

describe('M2-AC01 GET /internal/campaigns on a database without fixtures', () => {
  let db: TestDatabase;
  let api: TestApi;

  beforeAll(async () => {
    db = await createTestDatabase();
    api = await buildTestApi(db.urls.api);
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  it('is an empty list with the database clock, not an error', async () => {
    const response = await api.app.inject({ method: 'GET', url: '/internal/campaigns' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as InternalCampaignsResponse;
    expect(body.items).toEqual([]);
    expect(Number.isNaN(Date.parse(body.dataAsOf))).toBe(false);
  });
});

/** Every campaign column plus the org name, read as the API login (its table SELECT covers added columns). */
async function selectEverythingAsApi(apiUrl: string): Promise<Array<Record<string, unknown>>> {
  return withClientAt(apiUrl, async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT c.*, o.name FROM app.campaigns AS c
         JOIN app.orgs AS o ON o.id = c.org_id AND o.data_origin = c.data_origin
        WHERE c.data_origin = 'fixture'`,
    );
    return rows;
  });
}
