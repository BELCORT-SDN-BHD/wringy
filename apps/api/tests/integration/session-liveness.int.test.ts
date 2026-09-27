/**
 * Session liveness, both adapters, against the reserved fund-sensitive stub
 * `POST /me/session/probe` (M2-AC02/2 "revoked"; kickoff-package.md §4.6,
 * M2-02 R2).
 *
 * The point of every row here is the same: a definite "that session is gone" is
 * 401 `session.revoked`, and everything else — a 5xx, a rate limit, a timeout, a
 * transport failure — is 503 `session_check_unavailable`. A blip must not sign a
 * tester out of the internal build.
 *
 * Mechanism A runs against the real `platform.session_is_live` on the stub
 * `auth.sessions` the platform bootstrap installs (packages/db/src/platform.ts);
 * Mechanism B runs against an in-process fake of `GET /auth/v1/user`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SessionProbeResponse } from '@wringy/contracts';

import {
  authServerLiveness,
  databaseLiveness,
  requireLiveSession,
  type LivenessClient,
  type SessionLiveness,
} from '../../src/session-liveness';
import { createApiPool, withTransaction } from '../../src/database';
import { errorBody } from '../../src/errors';
import { createTestIdentity, fakeAuthUserServer, TEST_PUBLISHABLE_KEY, type FakeAuthUserServer, type TestIdentity } from './jwt-support';
import {
  asMigrator,
  buildTestApi,
  createTestDatabase,
  endSession,
  insertLiveSession,
  signedIn,
  stubLiveness,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

describe('M2-AC02 session liveness, database adapter', () => {
  let db: TestDatabase;
  let api: TestApi;
  let identity: TestIdentity;
  let caller: SignedIn;
  let pool: ReturnType<typeof createApiPool>;

  beforeAll(async () => {
    db = await createTestDatabase();
    identity = await createTestIdentity();
    caller = await signedIn(db, identity);
    // The adapter needs its own pool as the runtime role, the way startServer
    // gives it the app's pool; the app under test then uses the same function.
    pool = createApiPool(db.urls.api, () => {});
    api = await buildTestApi(db.urls.api, { identity, liveness: databaseLiveness(pool) });
  });

  afterAll(async () => {
    await api?.close();
    await pool?.end().catch(() => {});
    await db?.drop();
  });

  it('M2-AC02/2 revoked: a live session row passes the probe, a signed-out one is 401 session.revoked, and an expired not_after is the same', async () => {
    // Live: the reserved command answers, on the database clock.
    const ok = await api.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers });
    expect(ok.statusCode).toBe(200);
    const body = ok.json() as SessionProbeResponse;
    expect(body.ok).toBe(true);
    expect(Number.isNaN(Date.parse(body.checkedAt))).toBe(false);
    expect(Math.abs(Date.parse(body.checkedAt) - Date.now())).toBeLessThan(60_000);

    // A sign-out on the hosted project removes the session row.
    await endSession(db, caller.sessionId);
    const revoked = await api.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers });
    expect(revoked.statusCode).toBe(401);
    expect(revoked.json()).toEqual(errorBody('session.revoked'));
    expect(revoked.headers.vary).toBe('Authorization');

    // A row whose not_after has passed is just as gone.
    await insertLiveSession(db, {
      sessionId: caller.sessionId,
      userId: caller.userId,
      notAfter: new Date(Date.now() - 60_000),
    });
    const expired = await api.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers });
    expect(expired.statusCode).toBe(401);
    expect(expired.json()).toEqual(errorBody('session.revoked'));

    // A session of the right id but another user is not this caller's session.
    await insertLiveSession(db, {
      sessionId: caller.sessionId,
      userId: '66666666-6666-4666-8666-666666666666',
      notAfter: null,
    });
    const foreign = await api.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers });
    expect(foreign.statusCode).toBe(401);

    // Live again, and the same guard lets it through: nothing is cached.
    await insertLiveSession(db, { sessionId: caller.sessionId, userId: caller.userId, notAfter: null });
    expect(
      (await api.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers })).statusCode,
    ).toBe(200);
  });

  it('M2-AC02/2 revoked: the check runs on the command’s own connection, and a database it cannot reach is unavailable (503), never revoked (401)', async () => {
    const actor = {
      userId: caller.userId,
      sessionId: caller.sessionId,
      email: caller.contactEmail,
      displayName: caller.displayName,
      token: caller.token,
      expiresAt: new Date(Date.now() + 3_600_000),
    };

    // Given the command's transaction client, the adapter asks on *that* client,
    // inside the transaction of the write it guards (§4.6).
    const asked: string[] = [];
    const recording: LivenessClient = {
      query: async (sql) => {
        asked.push(sql);
        return { rows: [{ live: true }] };
      },
    };
    const verdict = await databaseLiveness(pool).check(actor, recording);
    expect(verdict).toBe('live');
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('platform.session_is_live');

    // With no client of its own it takes one from the pool; a pool that cannot
    // give one is `unavailable`, which is a retry, not a sign-out.
    const dead = createApiPool('postgres://wringy_api_login:no-such-pw@127.0.0.1:1/wringy', () => {});
    await dead.end();
    expect(await databaseLiveness(dead).check(actor)).toBe('unavailable');

    // And that verdict is the 503, never the 401.
    const offline = await buildTestApi(db.urls.api, { identity, liveness: stubLiveness('unavailable') });
    try {
      const response = await offline.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual(errorBody('session_check_unavailable'));
      expect(response.body).not.toContain('session.revoked');
    } finally {
      await offline.close();
    }
  });

  it('M2-AC02/2 revoked: a read does not ask, so it still answers while a command is refused', async () => {
    await endSession(db, caller.sessionId);
    try {
      // Reads rely on the token alone (§4.6): valid for at most its lifetime.
      expect((await api.app.inject({ method: 'GET', url: '/me', headers: caller.headers })).statusCode).toBe(200);
      expect(
        (await api.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers })).statusCode,
      ).toBe(401);
    } finally {
      await insertLiveSession(db, { sessionId: caller.sessionId, userId: caller.userId, notAfter: null });
    }
  });
});

describe('M2-AC02 session liveness, auth_server adapter', () => {
  let db: TestDatabase;
  let api: TestApi;
  let fake: FakeAuthUserServer;
  let caller: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    const identity = await createTestIdentity();
    caller = await signedIn(db, identity, { withSession: false });
    fake = await fakeAuthUserServer(TEST_PUBLISHABLE_KEY);
    api = await buildTestApi(db.urls.api, {
      identity,
      liveness: authServerLiveness({
        supabaseUrl: fake.url,
        publishableKey: TEST_PUBLISHABLE_KEY,
        timeoutMs: 1_000,
      }),
    });
  });

  afterAll(async () => {
    await api?.close();
    await fake?.close();
    await db?.drop();
  });

  const probe = () => api.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers });

  it('M2-AC02/2 revoked: 200 is live; session_not_found, user_not_found and user_banned are 401 session.revoked', async () => {
    fake.respond({ status: 200, body: { id: caller.userId, aud: 'authenticated' } });
    expect((await probe()).statusCode).toBe(200);

    for (const [status, code] of [
      [403, 'session_not_found'],
      [401, 'user_not_found'],
      [401, 'user_banned'],
    ] as const) {
      fake.respond({ status, body: { code, message: 'no' } });
      const response = await probe();
      expect(response.statusCode, code).toBe(401);
      expect(response.json(), code).toEqual(errorBody('session.revoked'));
    }

    // GoTrue's older shape names the same thing `error_code`.
    fake.respond({ status: 401, body: { error_code: 'session_not_found', msg: 'no' } });
    expect((await probe()).statusCode).toBe(401);
  });

  it('M2-AC02/2 revoked: a 500, a 429, an unknown 401 code, a body that is not JSON and a timeout are all 503 session_check_unavailable', async () => {
    for (const response of [
      { status: 500, body: { message: 'boom' } },
      { status: 429, body: { code: 'over_request_rate_limit' } },
      { status: 502, body: 'upstream down' },
      { status: 401, body: { code: 'bad_jwt' } },
      { status: 403, body: 'not json at all' },
    ]) {
      fake.respond(response);
      const answer = await probe();
      expect(answer.statusCode, `${response.status}`).toBe(503);
      expect(answer.json(), `${response.status}`).toEqual(errorBody('session_check_unavailable'));
    }

    // Slower than the adapter's timeout: aborted, and still never a 401.
    fake.respond({ status: 200, delayMs: 4_000, body: { id: caller.userId } });
    const started = Date.now();
    const timedOut = await probe();
    expect(timedOut.statusCode).toBe(503);
    expect(timedOut.json()).toEqual(errorBody('session_check_unavailable'));
    expect(Date.now() - started).toBeLessThan(3_500);
  }, 30_000);

  it('M2-AC02/2 revoked: the call carries the publishable key, the caller’s own bearer token and the API version', async () => {
    fake.respond({ status: 200, body: { id: caller.userId } });
    const before = fake.seen.length;
    expect((await probe()).statusCode).toBe(200);

    const sent = fake.seen.slice(before);
    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request?.method).toBe('GET');
    expect(request?.path).toBe('/auth/v1/user');
    expect(request?.apikeyMatched).toBe(true);
    expect(request?.authScheme).toBe('Bearer');
    // The caller's own token, not a key of ours.
    expect(request?.bearerIs(caller.token)).toBe(true);
    expect(request?.apiVersion).toBe('2024-01-01');
  });

  it('M2-AC02/2 revoked: the adapter needs no session row in the app database at all', async () => {
    // This describe never wrote auth.sessions; Mechanism B is the only adapter
    // that can answer where the app database is not the identity store's.
    const rows = await api.app.inject({ method: 'GET', url: '/me', headers: caller.headers });
    expect(rows.statusCode).toBe(200);
    fake.respond({ status: 200, body: { id: caller.userId } });
    expect((await probe()).statusCode).toBe(200);
  });
});

describe('M2-AC02 every command asks the liveness question on its own transaction client', () => {
  let db: TestDatabase;
  let identity: TestIdentity;
  let caller: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    identity = await createTestIdentity();
    caller = await signedIn(db, identity, {
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      contactEmail: 'transaction.client@example.test',
    });
  });

  afterAll(async () => {
    await db?.drop();
  });

  interface Recorded {
    /** True when the command handed the port a client at all. */
    gotClient: boolean;
    /** True when `pg_stat_activity` says that client is inside an open transaction. */
    midTransaction: boolean;
  }

  /**
   * A liveness port that answers `live` only when it was given the command's own
   * transaction client AND that connection is mid-transaction — so a command that
   * checked liveness on a second connection, or before `BEGIN`, is refused.
   *
   * `xact_start < query_start` is the test: in an implicit single-statement
   * transaction PostgreSQL sets both to the same instant, while inside an explicit
   * one the transaction started before this statement did. The column is aliased
   * `live` because that is the one shape `LivenessClient` speaks (it exists so the
   * port never has to know about `pg`), which is also why this double is honest:
   * it is exactly what the database adapter is handed.
   */
  const recordingLiveness = (log: Recorded[]): SessionLiveness => ({
    check: async (_actor, client) => {
      if (client === undefined) {
        log.push({ gotClient: false, midTransaction: false });
        return 'unavailable';
      }
      const { rows } = await client.query(
        `SELECT (xact_start < query_start) AS live FROM pg_stat_activity WHERE pid = pg_backend_pid()`,
        [],
      );
      const midTransaction = rows[0]?.live === true;
      log.push({ gotClient: true, midTransaction });
      return midTransaction ? 'live' : 'unavailable';
    },
  });

  const commands: ReadonlyArray<{ url: string; payload?: Record<string, unknown>; expected: number }> = [
    { url: '/identity/sign-in', expected: 200 },
    { url: '/me/session/probe', expected: 200 },
    // M2-04's command maps the verdict itself instead of using the guard, so only
    // this row notices if it stops handing the port its transaction client: the
    // revoked-session row in locale.int.test.ts asks the real adapter, which
    // falls back to a pooled connection of its own and answers the same.
    { url: '/me/locale', payload: { locale: 'ms-MY' }, expected: 200 },
  ];
  for (const { url, payload, expected } of commands) {
    it(`M2-AC02/2 revoked: POST ${url} checks liveness on the command's own connection, inside its open transaction`, async () => {
      const log: Recorded[] = [];
      const api = await buildTestApi(db.urls.api, { identity, liveness: recordingLiveness(log) });
      try {
        const response = await api.app.inject({ method: 'POST', url, headers: caller.headers, payload });

        // The port only answered `live` because both halves held, so a green status
        // here IS the assertion; the log says which half was observed.
        expect(log).toEqual([{ gotClient: true, midTransaction: true }]);
        expect(response.statusCode).toBe(expected);
      } finally {
        await api.close();
      }
    });
  }

  it('M2-AC02/2 revoked: called as a plain preHandler the same port gets no client, which is how the rows above can fail', async () => {
    // The negative control: `requireLiveSession` with two arguments is an ordinary
    // Fastify hook and passes no client, so a command that guarded itself that way
    // would be recorded as `gotClient: false` and refused 503. Without this row the
    // two above could pass for a port that ignored its argument.
    const log: Recorded[] = [];
    const port = recordingLiveness(log);
    const actor = {
      userId: caller.userId,
      sessionId: caller.sessionId,
      email: caller.contactEmail,
      displayName: caller.displayName,
      token: caller.token,
      expiresAt: new Date(Date.now() + 3_600_000),
    };
    expect(await port.check(actor)).toBe('unavailable');
    expect(log).toEqual([{ gotClient: false, midTransaction: false }]);
  });
});

describe('M2-AC02 the liveness guard stops the command that awaits it (found by M2-04)', () => {
  let db: TestDatabase;
  let identity: TestIdentity;
  let caller: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    identity = await createTestIdentity();
    caller = await signedIn(db, identity);
  });

  afterAll(async () => {
    await db?.drop();
  });

  /**
   * A port that answers `revoked` on the command's own connection and, from that
   * verdict on, records every statement the command sends on that connection.
   * `arm` resets the record for the next request, so the BEGIN before the verdict
   * is never counted. The wrapper goes on each client once; the pools are ended
   * with the row.
   */
  function revokedAndWatching(): { liveness: SessionLiveness; after: string[]; arm(): void } {
    const after: string[] = [];
    const wrapped = new WeakSet<object>();
    let armed = false;
    const liveness: SessionLiveness = {
      check: async (_actor, client) => {
        if (client === undefined) throw new Error('the guard must ask on the command transaction client');
        const target = client as unknown as { query: (...args: unknown[]) => unknown };
        if (!wrapped.has(target)) {
          wrapped.add(target);
          const original = target.query.bind(target);
          target.query = (...args: unknown[]) => {
            if (armed) {
              const [sql] = args;
              after.push(typeof sql === 'string' ? sql : String((sql as { text?: unknown }).text));
            }
            return original(...args);
          };
        }
        armed = true;
        return 'revoked';
      },
    };
    return {
      liveness,
      after,
      arm: () => {
        after.length = 0;
        armed = false;
      },
    };
  }

  it('M2-AC02/2 revoked: after a revoked verdict from requireLiveSession, a guarded command writes nothing and runs no further statement, and neither does the probe (found by M2-04)', async () => {
    const watch = revokedAndWatching();
    const api = await buildTestApi(db.urls.api, { identity, liveness: watch.liveness });
    const guard = requireLiveSession(watch.liveness);
    const writePool = createApiPool(db.urls.api, () => {});
    // A command in the shape me.ts documents for M3's fund-sensitive commands:
    // the guard on the transaction client, then a write the runtime role may make.
    api.app.register(async (scope) => {
      scope.addHook('onRequest', scope.authenticate);
      scope.post('/probe/guarded-write', async (request, reply) => {
        await withTransaction(writePool, async (client) => {
          if (await guard(request, reply, client)) return;
          await client.query('UPDATE app.profiles SET display_name = $2 WHERE id = $1', [
            caller.userId,
            'written after a refusal',
          ]);
        });
        return reply.sent ? reply : reply.code(200).send({ ok: true });
      });
    });
    const profileRow = () =>
      asMigrator<{ display_name: string | null; updated_at: Date }>(
        db,
        'SELECT display_name, updated_at FROM app.profiles WHERE id = $1',
        [caller.userId],
      );

    try {
      const before = await profileRow();
      expect(before).toHaveLength(1);

      watch.arm();
      const write = await api.app.inject({ method: 'POST', url: '/probe/guarded-write', headers: caller.headers });
      expect(write.statusCode).toBe(401);
      expect(write.json()).toEqual(errorBody('session.revoked'));
      // Only the transaction's end follows the verdict: the UPDATE never ran.
      expect(watch.after).toEqual(['COMMIT']);
      expect(await profileRow()).toEqual(before);

      watch.arm();
      const probe = await api.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers });
      expect(probe.statusCode).toBe(401);
      expect(probe.json()).toEqual(errorBody('session.revoked'));
      // No `FOR SHARE` re-read and no clock read after the verdict.
      expect(watch.after).toEqual(['COMMIT']);

      // Fastify warns when a handler sends twice; before the fix the probe did.
      expect(api.logs.records.filter((record) => Number(record.level) >= 40)).toEqual([]);
    } finally {
      await api.close();
      await writePool.end().catch(() => {});
    }
  });
});
