import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { setEnvironment } from '../src/environment';
import { createTestDatabase, failureIn, withRollback, type TestDatabase } from './harness';

const ORG = 'b0000000-0000-4000-8000-0000000000a1';
const OTHER_ORG = 'b0000000-0000-4000-8000-0000000000a2';
const CAMPAIGN = 'd0000000-0000-4000-8000-0000000000c1';

const insertOrg = (client: pg.ClientBase, id: string, dataOrigin: string) =>
  client.query(`INSERT INTO app.orgs (id, name, data_origin) VALUES ($1, 'Probe org', $2)`, [id, dataOrigin]);

const insertCampaign = (client: pg.ClientBase, orgId: string, dataOrigin: string, status = 'draft') =>
  client.query(
    `INSERT INTO app.campaigns (id, org_id, title, status, data_origin) VALUES ($1, $2, 'Probe campaign', $3, $4)`,
    [CAMPAIGN, orgId, status, dataOrigin],
  );

/**
 * Record-level isolation of fixture and live data (Implementation Decision 5):
 * the trigger ops.assert_fixture_allowed(), the composite foreign key and the
 * environment marker's own constraints. Each test runs in a rolled-back
 * transaction as the migrator on a clone marked `ci`.
 */
describe('M2-AC01/2 fixture and live rows stay apart', () => {
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

  it('M2-AC01/2 the fixture trigger refuses fixture rows where fixtures are not allowed and accepts them where they are', async () => {
    await withRollback(migrator, async (client) => {
      // The template is marked ci: fixtures allowed.
      expect(await failureIn(client, () => insertOrg(client, ORG, 'fixture'))).toBeUndefined();
      expect(await failureIn(client, () => insertCampaign(client, ORG, 'fixture'))).toBeUndefined();

      await setEnvironment(client, 'production', { relabel: true });
      const refused = await failureIn(client, () => insertOrg(client, OTHER_ORG, 'fixture'));
      expect(refused).toMatchObject({ code: '23514', constraint: 'ops_environment_fixtures_allowed' });
      expect(refused?.message).toMatch(/environment production does not allow fixtures/);

      // Existing fixture rows cannot be changed there either ...
      expect(
        await failureIn(client, () => client.query(`UPDATE app.campaigns SET status = 'published' WHERE id = $1`, [CAMPAIGN])),
      ).toMatchObject({ code: '23514', constraint: 'ops_environment_fixtures_allowed' });
      // ... a live row is not affected ...
      expect(await failureIn(client, () => insertOrg(client, OTHER_ORG, 'live'))).toBeUndefined();
      // ... and a live row cannot be turned into a fixture.
      expect(
        await failureIn(client, () =>
          client.query(`UPDATE app.orgs SET data_origin = 'fixture' WHERE id = $1`, [OTHER_ORG]),
        ),
      ).toMatchObject({ code: '23514' });

      await setEnvironment(client, 'staging', { relabel: true });
      expect(
        await failureIn(client, () => client.query(`UPDATE app.campaigns SET status = 'published' WHERE id = $1`, [CAMPAIGN])),
      ).toBeUndefined();
    });
  });

  it('M2-AC01/2 the fixture trigger fails closed when the database has no environment marker', async () => {
    await withRollback(migrator, async (client) => {
      await client.query('DELETE FROM ops.environment');
      const refused = await failureIn(client, () => insertOrg(client, ORG, 'fixture'));
      expect(refused).toMatchObject({ code: '23514', constraint: 'ops_environment_fixtures_allowed' });
      expect(refused?.message).toMatch(/no ops\.environment marker/);
      expect(await failureIn(client, () => insertOrg(client, ORG, 'live'))).toBeUndefined();
    });
  });

  it('M2-AC01/2 the composite foreign key refuses a campaign whose data origin differs from its org', async () => {
    await withRollback(migrator, async (client) => {
      await insertOrg(client, ORG, 'fixture');
      await insertOrg(client, OTHER_ORG, 'live');
      expect(await failureIn(client, () => insertCampaign(client, ORG, 'live'))).toMatchObject({
        code: '23503',
        constraint: 'campaigns_org_data_origin_fkey',
      });
      expect(await failureIn(client, () => insertCampaign(client, OTHER_ORG, 'fixture'))).toMatchObject({
        code: '23503',
        constraint: 'campaigns_org_data_origin_fkey',
      });
      expect(await failureIn(client, () => insertCampaign(client, ORG, 'fixture'))).toBeUndefined();
      // Moving the org to the other origin would orphan its campaign.
      expect(
        await failureIn(client, () => client.query(`UPDATE app.orgs SET data_origin = 'live' WHERE id = $1`, [ORG])),
      ).toMatchObject({ code: '23503' });
    });
  });

  it('refuses a data origin or status outside the allowed values', async () => {
    await withRollback(migrator, async (client) => {
      expect(await failureIn(client, () => insertOrg(client, ORG, 'demo'))).toMatchObject({
        code: '23514',
        constraint: 'orgs_data_origin_check',
      });
      await insertOrg(client, ORG, 'live');
      expect(await failureIn(client, () => insertCampaign(client, ORG, 'live', 'archived'))).toMatchObject({
        code: '23514',
        constraint: 'campaigns_status_check',
      });
    });
  });

  it('the marker is a single row, and a production marker can never allow fixtures', async () => {
    await withRollback(migrator, async (client) => {
      expect(
        await failureIn(client, () =>
          client.query(`INSERT INTO ops.environment (name, fixtures_allowed) VALUES ('local', true)`),
        ),
      ).toMatchObject({ code: '23505', constraint: 'environment_single_row' });
      expect(
        await failureIn(client, () =>
          client.query(`UPDATE ops.environment SET name = 'production', fixtures_allowed = true`),
        ),
      ).toMatchObject({ code: '23514', constraint: 'environment_production_refuses_fixtures' });
      expect(
        await failureIn(client, () => client.query(`UPDATE ops.environment SET name = 'qa'`)),
      ).toMatchObject({ code: '23514', constraint: 'environment_name_check' });
    });
  });

  it('updated_at on campaigns and the marker is stamped with the database clock on every update', async () => {
    await withRollback(migrator, async (client) => {
      await insertOrg(client, ORG, 'live');
      await insertCampaign(client, ORG, 'live');
      const { rows } = await client.query<{ stamped: boolean; marker: boolean }>(
        `WITH c AS (UPDATE app.campaigns SET updated_at = '2000-01-01T00:00:00Z' WHERE id = $1 RETURNING updated_at),
              e AS (UPDATE ops.environment SET updated_at = '2000-01-01T00:00:00Z' RETURNING updated_at)
         SELECT (SELECT updated_at FROM c) = now() AS stamped, (SELECT updated_at FROM e) = now() AS marker`,
        [CAMPAIGN],
      );
      expect(rows[0]).toEqual({ stamped: true, marker: true });
    });
  });
});
