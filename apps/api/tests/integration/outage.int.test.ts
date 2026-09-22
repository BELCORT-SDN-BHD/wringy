import type { HealthResponse } from '@wringy/contracts';
import type { Pool } from '@wringy/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { createApiPool } from '../../src/database';
import { errorBody } from '../../src/errors';
import { createTestDatabase, LogCapture, seedFixtures, type TestDatabase } from './support';

describe('database outage', () => {
  let db: TestDatabase;
  let pool: Pool;
  let logs: LogCapture;
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedFixtures(db);
    logs = new LogCapture();
    pool = createApiPool(db.urls.api, () => {});
    app = buildApp({ pool, logStream: logs });
  });

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  });

  it('a database outage yields 503 and no stack/URL', async () => {
    // Up: the routes answer from PostgreSQL.
    expect((await app.inject({ method: 'GET', url: '/internal/campaigns' })).statusCode).toBe(200);

    // Down: the pool is gone (as after the server dropped every connection).
    await pool.end();
    const { password } = new URL(db.urls.api);

    for (const url of ['/internal/campaigns', '/internal/worker-health']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode, url).toBe(503);
      expect(response.json()).toEqual(errorBody('database_unavailable'));
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.body).not.toContain(password);
      expect(response.body).not.toMatch(/stack|postgres:\/\/|pool/i);
    }

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(503);
    expect(health.json()).toEqual({
      status: 'unavailable',
      checks: { database: 'failing', migrations: 'failing', queueSchema: 'failing' },
      migrationHead: null,
      queueSchemaVersion: null,
      dbNow: null,
    } satisfies HealthResponse);

    // Liveness does not depend on the database.
    expect((await app.inject({ method: 'GET', url: '/health/live' })).statusCode).toBe(200);
    expect(logs.text).not.toContain(password);
    expect(logs.records.filter((record) => record.msg === 'database unavailable')).toHaveLength(2);
  });
});
