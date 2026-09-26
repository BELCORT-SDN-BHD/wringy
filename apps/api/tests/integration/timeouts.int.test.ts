import { createServer, connect, type Server, type Socket } from 'node:net';

import type { HealthResponse } from '@wringy/contracts';
import { cluster, withClientAt } from '@wringy/db/testing';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_APPLICATION_NAME, API_QUERY_TIMEOUT_MS, API_STATEMENT_TIMEOUT_MS } from '../../src/database';
import { errorBody } from '../../src/errors';
import { createTestIdentity } from './jwt-support';
import {
  buildTestApi,
  createTestDatabase,
  seedFixtures,
  signedIn,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

/** Backends the API login holds in `database`, and how many of them wait on a lock (read as the cluster admin). */
async function apiBackends(database: string): Promise<{ total: number; waiting: number }> {
  return withClientAt(cluster().adminUrl, async (admin) => {
    const { rows } = await admin.query<{ total: number; waiting: number }>(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE wait_event_type = 'Lock')::int AS waiting
         FROM pg_catalog.pg_stat_activity WHERE datname = $1 AND application_name = $2`,
      [database, API_APPLICATION_NAME],
    );
    return rows[0]!;
  });
}

/** Holds `lock` on `table` as the migrator (a migration in its single transaction) until release(). */
async function holdLock(db: TestDatabase, table: string): Promise<{ release(): Promise<void> }> {
  const migrator = new pg.Client({ connectionString: db.urls.migrator, application_name: 'wringy-test-lock' });
  await migrator.connect();
  await migrator.query('BEGIN');
  await migrator.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
  return {
    release: async () => {
      await migrator.query('ROLLBACK').catch(() => {});
      await migrator.end();
    },
  };
}

/**
 * The API's two limits against a real PostgreSQL: the server-side
 * statement_timeout (a read waiting on a migration's lock) and the client-side
 * query_timeout (a server that stops answering).
 */
describe('M2-AC01 API reads under a held lock (server-side statement_timeout)', () => {
  let db: TestDatabase;
  let api: TestApi;
  let caller: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedFixtures(db);
    const identity = await createTestIdentity();
    caller = await signedIn(db, identity);
    api = await buildTestApi(db.urls.api, { identity });
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  it('M2-AC01/2 reads blocked by a migration lock end as 503 at the server-side limit and leave no backend waiting', async () => {
    const lock = await holdLock(db, 'app.campaigns');
    try {
      for (const round of [1, 2, 3]) {
        const started = Date.now();
        const responses = await Promise.all(
          Array.from({ length: 10 }, () =>
            api.app.inject({ method: 'GET', url: '/internal/campaigns', headers: caller.headers }),
          ),
        );
        const elapsed = Date.now() - started;
        expect(responses.map((response) => response.statusCode), `round ${round}`).toEqual(Array(10).fill(503));
        expect(responses[0]!.json()).toEqual(errorBody('database_unavailable'));
        // The server gave up at statement_timeout, before the client-side limit would have.
        expect(elapsed, `round ${round}`).toBeGreaterThanOrEqual(API_STATEMENT_TIMEOUT_MS - 250);
        expect(elapsed, `round ${round}`).toBeLessThan(API_QUERY_TIMEOUT_MS + 2_000);
        // No backend is left waiting on the lock, and the pool never grows past its max.
        const backends = await apiBackends(db.name);
        expect(backends.waiting, `round ${round}`).toBe(0);
        expect(backends.total, `round ${round}`).toBeLessThanOrEqual(10);
      }
    } finally {
      await lock.release();
    }
    // The same pool reads again once the lock is gone.
    expect(
      (await api.app.inject({ method: 'GET', url: '/internal/campaigns', headers: caller.headers })).statusCode,
    ).toBe(200);
  }, 60_000);

  it('M2-AC01/2 /health with ops.pgmigrations locked: the migrations check fails at the server-side limit, the queue check still runs, and the next /health still reaches the database', async () => {
    const lock = await holdLock(db, 'ops.pgmigrations');
    try {
      for (const round of [1, 2]) {
        const started = Date.now();
        const response = await api.app.inject({ method: 'GET', url: '/health' });
        const elapsed = Date.now() - started;
        expect(response.statusCode, `round ${round}`).toBe(503);
        expect((response.json() as HealthResponse).checks, `round ${round}`).toEqual({
          database: 'ok',
          migrations: 'failing',
          queueSchema: 'ok',
        });
        expect(elapsed, `round ${round}`).toBeLessThan(API_QUERY_TIMEOUT_MS + 2_000);
      }
      const failures = api.logs.records.filter((record) => record.msg === 'health check failing');
      expect(failures.map((record) => [record.check, record.code])).toEqual([
        ['migrations', '57014'],
        ['migrations', '57014'],
      ]);
      expect((await apiBackends(db.name)).waiting).toBe(0);
    } finally {
      await lock.release();
    }
    expect((await api.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  }, 60_000);
});

/**
 * A TCP proxy in front of PostgreSQL that, per connection, stops passing the
 * server's replies back once that connection sends a query naming `trigger`:
 * from then on the client sees a server that accepted its query and never
 * answers.
 */
async function freezingProxy(target: { host: string; port: number }, trigger: string): Promise<{ port: number; close(): Promise<void> }> {
  const sockets = new Set<Socket>();
  const server: Server = createServer((client) => {
    let frozen = false;
    const upstream = connect(target.port, target.host);
    sockets.add(client);
    sockets.add(upstream);
    client.on('data', (chunk) => {
      if (chunk.includes(trigger)) frozen = true;
      upstream.write(chunk);
    });
    upstream.on('data', (chunk) => {
      if (!frozen) client.write(chunk);
    });
    const end = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on('close', end).on('error', end);
    upstream.on('close', end).on('error', end);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address !== 'object') throw new Error('no proxy port');
  return {
    port: address.port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe('M2-AC01 /health against a database that stops answering (client-side query_timeout)', () => {
  let db: TestDatabase;
  let api: TestApi;
  let proxy: Awaited<ReturnType<typeof freezingProxy>>;

  beforeAll(async () => {
    db = await createTestDatabase();
    const target = new URL(db.urls.api);
    proxy = await freezingProxy({ host: target.hostname, port: Number(target.port) }, 'pgmigrations');
    target.hostname = '127.0.0.1';
    target.port = String(proxy.port);
    api = await buildTestApi(target.toString());
  });

  afterAll(async () => {
    await api?.close();
    await proxy?.close();
    await db?.drop();
  });

  it('M2-AC01/2 a query the server never answers ends /health at the client-side limit, and the stuck client is not handed to the next /health', async () => {
    for (const round of [1, 2]) {
      const started = Date.now();
      const response = await api.app.inject({ method: 'GET', url: '/health' });
      const elapsed = Date.now() - started;
      expect(response.statusCode, `round ${round}`).toBe(503);
      // SELECT 1 answers; the migrations query is swallowed. The queue check is not run on the
      // stuck connection, so /health waits one limit, not two.
      expect((response.json() as HealthResponse).checks, `round ${round}`).toEqual({
        database: 'ok',
        migrations: 'failing',
        queueSchema: 'failing',
      });
      expect(elapsed, `round ${round}`).toBeGreaterThanOrEqual(API_QUERY_TIMEOUT_MS - 250);
      expect(elapsed, `round ${round}`).toBeLessThan(2 * API_QUERY_TIMEOUT_MS);
    }
    // Round 2 reached the database on a fresh connection: had the stuck client gone back to the
    // pool, its SELECT 1 would have been swallowed too and `database` would read failing.
    const failures = api.logs.records.filter((record) => record.msg === 'health check failing');
    expect(failures.map((record) => record.check)).toEqual(['migrations', 'migrations']);
  }, 60_000);
});
