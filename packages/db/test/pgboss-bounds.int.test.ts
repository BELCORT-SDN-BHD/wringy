import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXPECTED_MIGRATION_HEAD, EXPECTED_PGBOSS_VERSION } from '../src/expected-head';
import { listMigrations, migrateDatabase, runMigrations } from '../src/migrate';
import { PgBossQueueRefusedError } from '../src/pgboss';
import { createTestDatabase, sqlState, withClientAt, type TestDatabase } from './harness';

/** The migration that bounds the worker's pg-boss rights (and everything after it). */
const BOUNDS = '0006_pgboss_runtime_bounds';

/** The planted row of the review's reproduction: a table name carrying an index definition on a business table. */
const PLANTED_TABLE_NAME = 'worker_chose_this ON app.campaigns (title) --';

const plantQueue = (client: pg.ClientBase, name: string) =>
  client.query(
    `INSERT INTO pgboss.queue (name, policy, retry_limit, retry_delay, retry_backoff, expire_seconds,
                               retention_seconds, deletion_seconds, partition, table_name)
     VALUES ($1, 'standard', 0, 0, false, 60, 60, 60, true, $2)`,
    [name, PLANTED_TABLE_NAME],
  );

async function plantedIndexes(db: TestDatabase): Promise<string[]> {
  return withClientAt(db.urls.migrator, async (client) => {
    const { rows } = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_catalog.pg_indexes WHERE indexname LIKE 'worker_chose_this%'`,
    );
    return rows.map((row) => row.indexname);
  });
}

/**
 * `pnpm db:migrate` runs the pg-boss CLI as the migrator, and the CLI builds DDL
 * from pgboss.version and pgboss.queue, which the worker login can write
 * (migration 0005). Migration 0006 and installPgBossSchema() keep that data out
 * of the migrator's DDL path.
 */
describe('M2-AC01/2 the worker login cannot steer the DDL the migrator runs', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db?.drop();
  });

  it('M2-AC01/2 the worker login cannot change pgboss.version (42501), but stamps the timestamps pg-boss writes at run time', async () => {
    await withClientAt(db.urls.worker, async (worker) => {
      expect(await sqlState(worker.query('UPDATE pgboss.version SET version = 39'))).toBe('42501');
      expect(await sqlState(worker.query('INSERT INTO pgboss.version (version) VALUES (39)'))).toBe('42501');
      expect(await sqlState(worker.query('DELETE FROM pgboss.version'))).toBe('42501');
      for (const column of ['cron_on', 'bam_on', 'flow_on', 'reindex_on', 'monitor_backoff_on']) {
        const result = await worker.query(`UPDATE pgboss.version SET ${column} = now()`);
        expect(result.rowCount, column).toBe(1);
      }
    });
    const version = await withClientAt(db.urls.migrator, (m) => m.query<{ version: number }>('SELECT version FROM pgboss.version'));
    expect(version.rows).toEqual([{ version: EXPECTED_PGBOSS_VERSION }]);
  });

  it('M2-AC01/2 the worker login cannot plant a partitioned queue or another job table (23514)', async () => {
    await withClientAt(db.urls.worker, async (worker) => {
      const planted = await plantQueue(worker, 'planted-queue').then(
        () => undefined,
        (error: { code?: string; constraint?: string }) => ({ code: error.code, constraint: error.constraint }),
      );
      expect(planted).toEqual({ code: '23514', constraint: 'wringy_queue_shared_table_only' });

      // Through pg-boss's own function, as a queue created with partition: true would be.
      expect(
        await sqlState(worker.query(`SELECT pgboss.create_queue('partitioned-queue', '{"policy": "standard", "partition": true}'::jsonb)`)),
      ).toBe('23514');

      // An existing queue cannot be pointed at another table either.
      await worker.query(`SELECT pgboss.create_queue('plain-queue', '{"policy": "standard"}'::jsonb)`);
      expect(
        await sqlState(worker.query(`UPDATE pgboss.queue SET table_name = $1 WHERE name = 'plain-queue'`, [PLANTED_TABLE_NAME])),
      ).toBe('23514');
      const { rows } = await worker.query<{ partition: boolean; table_name: string }>(
        `SELECT partition, table_name FROM pgboss.queue WHERE name = 'plain-queue'`,
      );
      expect(rows).toEqual([{ partition: false, table_name: 'job_common' }]);
    });
  });

  it('M2-AC01/2 replaying the review reproduction on a database from before 0006: pnpm db:migrate refuses before the pg-boss CLI, and no index is created', async () => {
    // The database as 0005 left it: the real down migrations of 0006 and later.
    const all = listMigrations();
    const newer = all.slice(all.indexOf(BOUNDS));
    await runMigrations({ databaseUrl: db.urls.migrator, direction: 'down', count: newer.length });

    // As the worker login, exactly as reproduced: rewind the version, plant the row.
    await withClientAt(db.urls.worker, async (worker) => {
      expect((await worker.query('UPDATE pgboss.version SET version = 39')).rowCount).toBe(1);
      await plantQueue(worker, 'planted-queue');
    });

    const lines: string[] = [];
    const refused = await migrateDatabase({ databaseUrl: db.urls.migrator, log: (line) => lines.push(line) }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(refused).toBeInstanceOf(PgBossQueueRefusedError);
    expect((refused as PgBossQueueRefusedError).count).toBe(1);
    expect((refused as Error).message).not.toContain(PLANTED_TABLE_NAME);
    // The CLI never ran: no "Migrating pg-boss schema" line, the version untouched, no planted index.
    expect(lines.some((line) => /Migrating pg-boss schema/.test(line))).toBe(false);
    expect(await plantedIndexes(db)).toEqual([]);

    // Recovery by the migrator: remove the planted row and restore the version, then migrate.
    await withClientAt(db.urls.migrator, async (migrator) => {
      const { rows } = await migrator.query<{ version: number }>('SELECT version FROM pgboss.version');
      expect(rows).toEqual([{ version: 39 }]);
      await migrator.query(`DELETE FROM pgboss.queue WHERE name = 'planted-queue'`);
      await migrator.query('UPDATE pgboss.version SET version = $1', [EXPECTED_PGBOSS_VERSION]);
    });
    const recovered = await migrateDatabase({ databaseUrl: db.urls.migrator });
    expect(recovered).toMatchObject({ migrations: newer, head: EXPECTED_MIGRATION_HEAD });
    expect(recovered.pgboss).toMatchObject({ outcome: 'unchanged', to: EXPECTED_PGBOSS_VERSION });
    expect(await plantedIndexes(db)).toEqual([]);

    // And the worker's rights are bounded again.
    expect(
      await sqlState(withClientAt(db.urls.worker, (worker) => worker.query('UPDATE pgboss.version SET version = 39'))),
    ).toBe('42501');
  });
});
