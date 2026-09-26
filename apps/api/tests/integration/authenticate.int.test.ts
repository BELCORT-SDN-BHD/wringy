/**
 * What the authentication hook refuses, and what it never confuses with a refusal
 * (kickoff-package.md §4.4, §4.9 "forged"/"stale"; M2-02 R9).
 *
 * The verifier is the real one (src/authenticate.ts, jose 6.2.12). The only thing
 * these tests stand in for is the Supabase project: the key set is generated in
 * the process, so every forged shape can be produced without a credential.
 */
import { createRemoteJWKSet } from 'jose';
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { MeResponse } from '@wringy/contracts';

import { buildApp, CACHE_CONTROL } from '../../src/app';
import { createSupabaseAuthenticate } from '../../src/authenticate';
import { createApiPool, withDatabase } from '../../src/database';
import { errorBody, ERROR_MESSAGES } from '../../src/errors';
import { readProfileById } from '../../src/profiles';
import { bearer, createTestIdentity, TEST_PUBLISHABLE_KEY, type TestIdentity } from './jwt-support';
import {
  buildTestApi,
  createTestDatabase,
  seedFixtures,
  seedProfile,
  signedIn,
  stubLiveness,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

const OTHER_USER = '55555555-5555-4555-8555-555555555555';

/** A port nothing listens on: bound, read, released. */
function unusedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (address && typeof address === 'object' ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

describe('M2-AC02 the authentication hook', () => {
  let db: TestDatabase;
  let api: TestApi;
  let identity: TestIdentity;
  let caller: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedFixtures(db);
    identity = await createTestIdentity();
    caller = await signedIn(db, identity);
    await seedProfile(db, { id: OTHER_USER, contactEmail: 'other@example.test', displayName: 'Other Person' });
    api = await buildTestApi(db.urls.api, { identity });
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  /** Every token shape that must answer the one 401 `unauthenticated` body. */
  it('M2-AC02/3 forged: no token, an unknown key, alg=none, HS256 with the publishable key, a wrong issuer or audience, a missing claim, a wrong role, an anonymous token and an OAuth-client token are all one refusal', async () => {
    const forged: Array<[string, string | undefined]> = [
      ['no bearer at all', undefined],
      ['a bearer that is not a JWT', 'not-a-token'],
      ['signed by an unknown key', await identity.signWithUnknownKey({ sub: caller.userId, sessionId: caller.sessionId })],
      ['alg=none', identity.signUnsecured({ sub: caller.userId, sessionId: caller.sessionId })],
      ['HS256 signed with the publishable key', await identity.signHs256(TEST_PUBLISHABLE_KEY, { sub: caller.userId })],
      ['a wrong issuer', await identity.signToken({ sub: caller.userId, overrides: { claims: { iss: 'https://evil.example/auth/v1' } } })],
      ['a wrong audience', await identity.signToken({ sub: caller.userId, overrides: { claims: { aud: 'anon' } } })],
      ['no sub', await identity.signToken({ overrides: { claims: { sub: undefined } } })],
      ['no session_id', await identity.signToken({ sub: caller.userId, overrides: { claims: { session_id: undefined } } })],
      ['no aal', await identity.signToken({ sub: caller.userId, overrides: { claims: { aal: undefined } } })],
      ['role anon', await identity.signToken({ sub: caller.userId, overrides: { claims: { role: 'anon' } } })],
      ['role service_role', await identity.signToken({ sub: caller.userId, overrides: { claims: { role: 'service_role' } } })],
      ['an anonymous token', await identity.signToken({ sub: caller.userId, overrides: { claims: { is_anonymous: true } } })],
      ['an OAuth-client token', await identity.signToken({ sub: caller.userId, overrides: { claims: { client_id: 'oauth-app' } } })],
      ['a key id the project does not publish', await identity.signToken({ sub: caller.userId, overrides: { header: { kid: 'rotated-away' } } })],
    ];

    for (const [label, token] of forged) {
      for (const url of ['/internal/campaigns', '/me']) {
        const response = await api.app.inject({
          method: 'GET',
          url,
          ...(token === undefined ? {} : { headers: bearer(token) }),
        });
        expect(response.statusCode, `${label} on ${url}`).toBe(401);
        expect(response.json(), `${label} on ${url}`).toEqual(errorBody('unauthenticated'));
        // One message for every reason: the refusal says nothing about which check failed.
        expect(response.body, label).not.toMatch(/iss|aud|kid|signature|session_id|anonymous/i);
      }
    }
  });

  it('M2-AC02/3 forged: identity comes only from the token — X-User-Id, X-Role and a body userId or orgId are ignored', async () => {
    const asCaller = {
      ...caller.headers,
      'x-user-id': OTHER_USER,
      'x-role': 'service_role',
      'x-wringy-user': OTHER_USER,
    };
    const me = await api.app.inject({ method: 'GET', url: '/me', headers: asCaller });
    expect(me.statusCode).toBe(200);
    // A valid token of A carrying B's id in every header we might be tempted to read still acts as A.
    expect((me.json() as MeResponse).profile.id).toBe(caller.userId);
    expect(me.body).not.toContain(OTHER_USER);

    const probe = await api.app.inject({
      method: 'POST',
      url: '/me/session/probe',
      headers: { ...asCaller, 'content-type': 'application/json' },
      payload: { userId: OTHER_USER, orgId: OTHER_USER, role: 'service_role' },
    });
    expect(probe.statusCode).toBe(200);

    const signIn = await api.app.inject({
      method: 'POST',
      url: '/identity/sign-in',
      headers: { ...asCaller, 'content-type': 'application/json' },
      payload: { userId: OTHER_USER, orgId: OTHER_USER },
    });
    expect(signIn.statusCode).toBe(200);
    expect(signIn.json()).toMatchObject({ profile: { id: caller.userId } });
    // B's row was not touched by A's request.
    const other = await api.app.inject({ method: 'GET', url: '/internal/campaigns', headers: asCaller });
    expect(other.statusCode).toBe(200);
  });

  it('M2-AC02/3 stale: an expired token is told apart from a forged one, with auth.expired', async () => {
    const stale = await identity.signToken({ sub: caller.userId, sessionId: caller.sessionId, expiresIn: -120 });
    const response = await api.app.inject({ method: 'GET', url: '/me', headers: bearer(stale) });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(errorBody('auth.expired'));

    // Five seconds of clock tolerance: a token that has just turned over is still taken.
    const edge = await identity.signToken({ sub: caller.userId, sessionId: caller.sessionId, expiresIn: -2 });
    expect((await api.app.inject({ method: 'GET', url: '/me', headers: bearer(edge) })).statusCode).toBe(200);
  });

  it('M2-AC02/3 stale: an unreachable JWKS is 503 auth_unavailable, never a 401 and never a session that ended', async () => {
    const pool = createApiPool(db.urls.api, () => {});
    const dead = await unusedPort();
    const app = buildApp({
      pool,
      liveness: stubLiveness('live'),
      authenticate: createSupabaseAuthenticate({
        issuer: identity.issuer,
        // A key set that cannot be fetched: the transport fails, no keys are cached.
        jwks: createRemoteJWKSet(new URL(`http://127.0.0.1:${dead}/auth/v1/.well-known/jwks.json`)),
        readProfile: (userId) => withDatabase(pool, (client) => readProfileById(client, userId)),
      }),
    });
    try {
      for (const url of ['/internal/campaigns', '/me']) {
        const response = await app.inject({ method: 'GET', url, headers: caller.headers });
        expect(response.statusCode, url).toBe(503);
        expect(response.json(), url).toEqual(errorBody('auth_unavailable'));
        // The session is emphatically NOT treated as ended: no sign-out is implied.
        expect(response.body, url).not.toContain('session.revoked');
        expect(response.body, url).not.toContain(ERROR_MESSAGES['session.revoked']);
        expect(response.headers['cache-control'], url).toBe(CACHE_CONTROL);
      }
    } finally {
      await app.close();
      await pool.end().catch(() => {});
    }
  });

  it('M2-AC02/3 the captured logs never contain the token, the session id or a claim value', async () => {
    const before = api.logs.lines.length;
    // Two forgeries, because jose's error classes carry different things and only
    // one of them can prove this property. A bad signature raises
    // `JWSSignatureVerificationFailed`, which carries no payload at all — logging
    // that error object would reveal nothing, so a bad-signature token cannot
    // detect a violation. A valid signature with a wrong `aud` raises
    // `JWTClaimValidationFailed`, which keeps the WHOLE decoded payload (and
    // repeats it under `cause`), and `serializeError` (src/logger.ts) copies an
    // error's own enumerable fields through a pattern that matches none of
    // `payload`, `session_id`, `email` or `sub`. So this is the token that bites if
    // a later edit ever logs `{ err: error }` instead of the code.
    const badSignature = await identity.signWithUnknownKey({ sub: caller.userId, sessionId: caller.sessionId });
    const badClaim = await identity.signToken({
      sub: caller.userId,
      sessionId: caller.sessionId,
      email: caller.contactEmail,
      overrides: { claims: { aud: 'anon' } },
    });
    await api.app.inject({ method: 'GET', url: '/me', headers: caller.headers });
    await api.app.inject({ method: 'POST', url: '/me/session/probe', headers: caller.headers });
    for (const [label, forged] of [
      ['a bad signature', badSignature],
      ['a valid signature with a wrong audience', badClaim],
    ] as const) {
      const response = await api.app.inject({ method: 'GET', url: '/internal/campaigns', headers: bearer(forged) });
      expect(response.statusCode, label).toBe(401);
    }

    const written = api.logs.lines.slice(before).join('');
    expect(written).not.toContain(caller.token);
    expect(written).not.toContain(badSignature);
    expect(written).not.toContain(badClaim);
    expect(written).not.toContain(caller.sessionId);
    // The claim-validation error carried these too; neither may be in a log line.
    expect(written).not.toContain(caller.contactEmail);
    expect(written).not.toContain(caller.userId);
    // The refusal is still useful: it names a reason word.
    expect(written).toContain('request not authenticated');
  });

  it('M2-AC02/3 forged: every route but /health and /health/live refuses a request with no token', async () => {
    // The README states this as an invariant, but the hook is added inside each
    // plugin, so nothing at the root enforces it: a later ticket that registers a
    // read on the root instance (or in a new plugin that forgets the hook) would
    // serve it to anybody. Enumerating the built app's own route table is the one
    // check that grows with the route table instead of needing a new hard-coded
    // list each time (R8, R18).
    const routes = api.app.routeTable.filter(({ method }) => method !== 'OPTIONS');
    expect(routes.length, 'the route table was collected').toBeGreaterThanOrEqual(7);

    const unauthenticated = ['/health', '/health/live'];
    for (const { method, url } of routes) {
      const response = await api.app.inject({ method: method as 'GET', url });
      const label = `${method} ${url}`;
      if (unauthenticated.includes(url)) {
        expect(response.statusCode, label).not.toBe(401);
        // R18: a route that does not read Authorization must not claim to vary by it.
        expect(response.headers.vary, label).toBeUndefined();
        continue;
      }
      expect(response.statusCode, label).toBe(401);
      if (method !== 'HEAD') expect(response.json(), label).toEqual(errorBody('unauthenticated'));
      expect(response.headers.vary, label).toBe('Authorization');
      expect(response.headers['cache-control'], label).toBe(CACHE_CONTROL);
    }
  });
});
