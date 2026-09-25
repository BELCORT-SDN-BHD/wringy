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

import { authServerLiveness, databaseLiveness, type LivenessClient } from '../../src/session-liveness';
import { createApiPool } from '../../src/database';
import { errorBody } from '../../src/errors';
import { createTestIdentity, fakeAuthUserServer, TEST_PUBLISHABLE_KEY, type FakeAuthUserServer, type TestIdentity } from './jwt-support';
import {
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
    // so the answer and the write it guards cannot be separated (§4.6).
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
