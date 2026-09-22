import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  EnvironmentMismatchError,
  EnvironmentTableMissingError,
  readEnvironment,
  setEnvironment,
} from '../src/environment';
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

  it('says to run pnpm db:migrate when the marker table does not exist yet', async () => {
    await withRollback(migrator, async (client) => {
      await client.query('DROP TABLE ops.environment');
      await expect(readEnvironment(client)).rejects.toBeInstanceOf(EnvironmentTableMissingError);
    });
  });
});
