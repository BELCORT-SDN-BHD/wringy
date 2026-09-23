import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  EnvironmentMismatchError,
  EnvironmentTableMissingError,
  FixturesPresentError,
  countFixtureRows,
  readEnvironment,
  setEnvironment,
} from '../src/environment';
import { seedFixtures as applyFixtureSeed } from '../src/fixtures';
import { TEST_WRINGY_ENV, createTestDatabase, failureIn, withRollback, type TestDatabase } from './harness';

/** `pnpm db:env` (setEnvironment) on a clone marked `ci` by the harness. */
describe('M2-AC01/2 environment marker (pnpm db:env)', () => {
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

  it('the harness marks every clone as the test environment, with fixtures allowed', async () => {
    const marker = await readEnvironment(migrator);
    expect(marker).toMatchObject({ name: TEST_WRINGY_ENV, fixturesAllowed: true });
  });

  it('inserts the marker once, then reports unchanged; fixtures_allowed follows the environment', async () => {
    await withRollback(migrator, async (client) => {
      await client.query('DELETE FROM ops.environment');
      expect(await readEnvironment(client)).toBeNull();

      expect(await setEnvironment(client, 'local')).toMatchObject({
        outcome: 'inserted',
        marker: { name: 'local', fixturesAllowed: true },
      });
      expect((await setEnvironment(client, 'local')).outcome).toBe('unchanged');

      // A marker edited by hand is put back.
      await client.query('UPDATE ops.environment SET fixtures_allowed = false');
      expect(await setEnvironment(client, 'local')).toMatchObject({
        outcome: 'updated',
        marker: { fixturesAllowed: true },
      });
    });
  });

  it('M2-AC01/2 refuses to re-mark a database as another environment unless asked to relabel', async () => {
    await withRollback(migrator, async (client) => {
      const refused = await failureIn(client, () => setEnvironment(client, 'production'));
      expect(refused?.message).toMatch(/marked as environment "ci", not "production"/);
      await expect(setEnvironment(client, 'production')).rejects.toBeInstanceOf(EnvironmentMismatchError);

      expect(await setEnvironment(client, 'production', { relabel: true })).toMatchObject({
        outcome: 'relabelled',
        marker: { name: 'production', fixturesAllowed: false },
      });
      expect(await setEnvironment(client, 'staging', { relabel: true })).toMatchObject({
        outcome: 'relabelled',
        marker: { name: 'staging', fixturesAllowed: true },
      });
    });
  });

  it('M2-AC01/2 refuses to mark a database production while it holds fixture rows, and allows it once they are deleted', async () => {
    await withRollback(migrator, async (client) => {
      await applyFixtureSeed(client);
      expect(await countFixtureRows(client)).toEqual({ 'app.campaigns': 3, 'app.orgs': 2 });

      const refused = await setEnvironment(client, 'production', { relabel: true }).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(refused).toBeInstanceOf(FixturesPresentError);
      expect((refused as FixturesPresentError).counts).toEqual({ 'app.campaigns': 3, 'app.orgs': 2 });
      expect((refused as Error).message).toMatch(/does not allow fixtures, while it holds fixture rows \(app\.campaigns 3, app\.orgs 2\)/);
      // The marker did not move.
      expect(await readEnvironment(client)).toMatchObject({ name: TEST_WRINGY_ENV, fixturesAllowed: true });

      // A first mark as production is refused the same way.
      await client.query('DELETE FROM ops.environment');
      await expect(setEnvironment(client, 'production')).rejects.toBeInstanceOf(FixturesPresentError);
      await setEnvironment(client, TEST_WRINGY_ENV);

      // Relabelling to an environment that allows fixtures is not affected.
      expect((await setEnvironment(client, 'staging', { relabel: true })).outcome).toBe('relabelled');

      await client.query(`DELETE FROM app.campaigns WHERE data_origin = 'fixture'`);
      await client.query(`DELETE FROM app.orgs WHERE data_origin = 'fixture'`);
      expect(await countFixtureRows(client)).toEqual({});
      expect(await setEnvironment(client, 'production', { relabel: true })).toMatchObject({
        outcome: 'relabelled',
        marker: { name: 'production', fixturesAllowed: false },
      });
    });
  });

  it('says to run pnpm db:migrate when the marker table does not exist yet', async () => {
    await withRollback(migrator, async (client) => {
      await client.query('DROP TABLE ops.environment');
      await expect(readEnvironment(client)).rejects.toBeInstanceOf(EnvironmentTableMissingError);
    });
  });
});
