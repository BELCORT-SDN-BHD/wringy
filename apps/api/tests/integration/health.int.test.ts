import { healthResponseSchema, type HealthResponse } from '@wringy/contracts';
import { EXPECTED_MIGRATION_HEAD, EXPECTED_PGBOSS_VERSION, runMigrations } from '@wringy/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CACHE_CONTROL } from '../../src/app';
import { buildTestApi, createTestDatabase, type TestApi, type TestDatabase } from './support';

describe('M2-AC01 GET /health on a freshly migrated database', () => {
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

  it('M2-AC01/2 reads the migration head and pg-boss version as the runtime role and reports ok', async () => {
    const response = await api.app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE_CONTROL);
    const body = healthResponseSchema.parse(response.json());
    expect(body).toMatchObject({
      status: 'ok',
      checks: { database: 'ok', migrations: 'ok', queueSchema: 'ok' },
      migrationHead: EXPECTED_MIGRATION_HEAD,
      queueSchemaVersion: EXPECTED_PGBOSS_VERSION,
    });
    expect(Number.isNaN(Date.parse(body.dbNow ?? ''))).toBe(false);
  });

  it('GET /health/live answers 200 without touching the database', async () => {
    const response = await api.app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('/health reports unavailable when the migration head is behind what the build expects', async () => {
    // This build expects a migration the database has not run yet.
    const newer = await buildTestApi(db.urls.api, {
      expected: { migrationHead: '0006_not_applied_yet', pgbossVersion: EXPECTED_PGBOSS_VERSION },
    });
    try {
      const response = await newer.app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        status: 'unavailable',
        checks: { database: 'ok', migrations: 'failing', queueSchema: 'ok' },
        migrationHead: EXPECTED_MIGRATION_HEAD,
      });
    } finally {
      await newer.close();
    }
  });

  it('/health reports unavailable when the pg-boss schema version differs', async () => {
    const other = await buildTestApi(db.urls.api, {
      expected: { migrationHead: EXPECTED_MIGRATION_HEAD, pgbossVersion: EXPECTED_PGBOSS_VERSION + 1 },
    });
    try {
      const response = await other.app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        status: 'unavailable',
        checks: { database: 'ok', migrations: 'ok', queueSchema: 'failing' },
        queueSchemaVersion: EXPECTED_PGBOSS_VERSION,
      });
    } finally {
      await other.close();
    }
  });
});

describe('M2-AC01 GET /health after the newest migration was rolled back', () => {
  let db: TestDatabase;
  let api: TestApi;

  beforeAll(async () => {
    db = await createTestDatabase();
    // The real down migration of the head (0005), as the migrator.
    const reverted = await runMigrations({ databaseUrl: db.urls.migrator, direction: 'down', count: 1 });
    expect(reverted).toEqual([EXPECTED_MIGRATION_HEAD]);
    api = await buildTestApi(db.urls.api);
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  it('/health reports unavailable when the migration head is behind, with codes in the log only', async () => {
    const response = await api.app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(503);
    const body = response.json() as HealthResponse;
    expect(body.status).toBe('unavailable');
    expect(body.checks.database).toBe('ok');
    // 0005 also granted the API its read of ops.pgmigrations and pgboss.version, so
    // without it neither head can be read: both checks fail rather than pass.
    expect(body.checks.migrations).toBe('failing');
    expect(body.checks.queueSchema).toBe('failing');
    expect(body.migrationHead).toBeNull();
    expect(response.body).not.toMatch(/permission denied|42501/);

    const failures = api.logs.records.filter((record) => record.msg === 'health check failing');
    expect(failures.map((record) => [record.check, record.code])).toEqual([
      ['migrations', '42501'],
      ['queueSchema', '42501'],
    ]);
  });
});
