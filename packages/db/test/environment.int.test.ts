import { setTimeout as sleep } from 'node:timers/promises';

import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

const ORG = 'b0000000-0000-4000-8000-0000000000b1';
const CAMPAIGN = 'd0000000-0000-4000-8000-0000000000d1';

/** How long a blocked statement must stay unfinished to count as blocked. */
const STILL_BLOCKED_MS = 1_000;

/** A connected client as the migrator, named so pg_stat_activity shows which is which. */
async function connect(url: string, applicationName: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url, application_name: applicationName });
  await client.connect();
  return client;
}

async function backendPid(client: pg.ClientBase): Promise<number> {
  const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
  return rows[0]!.pid;
}

/** Resolves once `blocker` holds a lock `waiter` is waiting for (pg_blocking_pids); fails after 10 s. */
async function waitUntilBlocked(observer: pg.ClientBase, waiter: number, blocker: number): Promise<void> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const { rows } = await observer.query<{ blocked: boolean }>(
      'SELECT $2::int = ANY (pg_catalog.pg_blocking_pids($1::int)) AS blocked',
      [waiter, blocker],
    );
    if (rows[0]?.blocked) return;
    if (Date.now() > deadline) throw new Error(`backend ${waiter} was never blocked by backend ${blocker}`);
    await sleep(25);
  }
}

/** 'pending' when `promise` has not settled within `ms`. */
function stateAfter(promise: Promise<unknown>, ms: number): Promise<'pending' | 'settled'> {
  return Promise.race([promise.then(() => 'settled' as const), sleep(ms).then(() => 'pending' as const)]);
}

/**
 * The review's race (M2-01 cross-vendor review): the fixture check and the
 * marker update of `pnpm db:env --relabel` used to be separate, unlocked
 * statements, so a fixture write could commit between them and leave a
 * production-marked database holding fixture rows. setEnvironment now locks
 * every data_origin table in SHARE mode before it counts. Each test uses its
 * own clone, marked `ci`, with committed rows and three connections.
 */
describe('M2-AC01/2 the production relabel is serialised with fixture writes', () => {
  let db: TestDatabase;
  let writer: pg.Client;
  let relabeller: pg.Client;
  let observer: pg.Client;

  beforeEach(async () => {
    db = await createTestDatabase();
    writer = await connect(db.urls.migrator, 'wringy-test-fixture-writer');
    relabeller = await connect(db.urls.migrator, 'wringy-test-relabel');
    observer = await connect(db.urls.migrator, 'wringy-test-observer');
  });

  afterEach(async () => {
    for (const client of [writer, relabeller, observer]) await client?.end().catch(() => {});
    await db?.drop();
  });

  const insertOrg = (client: pg.ClientBase) =>
    client.query(`INSERT INTO app.orgs (id, name, data_origin) VALUES ($1, 'Race org', 'fixture')`, [ORG]);
  const insertCampaign = (client: pg.ClientBase) =>
    client.query(
      `INSERT INTO app.campaigns (id, org_id, title, status, data_origin) VALUES ($1, $2, 'Race campaign', 'draft', 'fixture')`,
      [CAMPAIGN, ORG],
    );

  it('M2-AC01/2 a relabel to production waits for an uncommitted fixture write, then refuses it once committed (FixturesPresentError)', async () => {
    const [writerPid, relabellerPid] = [await backendPid(writer), await backendPid(relabeller)];

    await writer.query('BEGIN');
    await insertOrg(writer);

    // The relabel runs in its own transaction and blocks on the writer's lock ...
    const relabel = setEnvironment(relabeller, 'production', { relabel: true }).then(
      (result) => ({ result }),
      (error: unknown) => ({ error }),
    );
    await waitUntilBlocked(observer, relabellerPid, writerPid);
    expect(await stateAfter(relabel, STILL_BLOCKED_MS)).toBe('pending');

    // ... the writer finishes in the fixture seed's order (orgs, then campaigns)
    // without a deadlock, because the tables are locked in creation order ...
    await insertCampaign(writer);
    await writer.query('COMMIT');

    // ... and the relabel then counts the committed rows and refuses.
    const outcome = await relabel;
    expect(outcome).not.toHaveProperty('result');
    const refused = (outcome as { error: unknown }).error;
    expect(refused).toBeInstanceOf(FixturesPresentError);
    expect((refused as FixturesPresentError).counts).toEqual({ 'app.campaigns': 1, 'app.orgs': 1 });

    // The marker did not move, and the relabel's transaction was rolled back.
    expect(await readEnvironment(observer)).toMatchObject({ name: TEST_WRINGY_ENV, fixturesAllowed: true });
    expect(relabeller.getTransactionStatus()).toBe('I');
  });

  it('M2-AC01/2 a fixture write that starts during a relabel to production waits for it, then is refused by the trigger (23514)', async () => {
    const [writerPid, relabellerPid] = [await backendPid(writer), await backendPid(relabeller)];

    // The refusal below relies on the trigger reading the marker afresh for each
    // row: a VOLATILE function takes a new snapshot per statement (0002).
    const { rows } = await observer.query<{ volatility: string }>(
      `SELECT provolatile AS volatility FROM pg_catalog.pg_proc WHERE oid = 'ops.assert_fixture_allowed()'::regprocedure`,
    );
    expect(rows).toEqual([{ volatility: 'v' }]);

    // The relabel runs inside a transaction that stays open, holding its locks.
    await relabeller.query('BEGIN');
    expect(await setEnvironment(relabeller, 'production', { relabel: true })).toMatchObject({
      outcome: 'relabelled',
      marker: { name: 'production', fixturesAllowed: false },
    });

    // A fixture insert on another connection blocks on those locks ...
    const write = insertOrg(writer).then(
      () => ({ error: undefined }),
      (error: unknown) => ({ error: error as { code?: string; constraint?: string; message: string } }),
    );
    await waitUntilBlocked(observer, writerPid, relabellerPid);
    expect(await stateAfter(write, STILL_BLOCKED_MS)).toBe('pending');

    // ... and once the relabel commits, the trigger sees production and refuses it.
    await relabeller.query('COMMIT');
    const { error } = await write;
    expect(error).toMatchObject({ code: '23514', constraint: 'ops_environment_fixtures_allowed' });
    expect(error?.message).toMatch(/environment production does not allow fixtures/);

    expect(await readEnvironment(observer)).toMatchObject({ name: 'production', fixturesAllowed: false });
    expect(await countFixtureRows(observer)).toEqual({});
  });
});
