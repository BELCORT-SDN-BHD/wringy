/**
 * The first-sign-in gate, the profile upsert, and what a disabled or missing
 * profile does to every other route (M2-AC02/2; kickoff-package.md §3.2, §4.4;
 * M2-02 R4, R5, R6, R8, R18).
 *
 * The allow-list is a **first-sign-in** gate, not a session check: once a profile
 * exists it is never re-checked, so removing an address signs nobody out.
 * Disabling the profile is the lever that does (ruling D12).
 */
import { createServer } from 'node:net';

import { normalizeEmail } from '@wringy/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { MeResponse, Profile, SignInResponse } from '@wringy/contracts';

import { buildApp, CACHE_CONTROL } from '../../src/app';
import { createApiPool } from '../../src/database';
import { errorBody } from '../../src/errors';
import { identityWiringFor } from '../../src/server';
import { bearer, createTestIdentity, serveJwks, TEST_PUBLISHABLE_KEY, type TestIdentity } from './jwt-support';
import {
  asMigrator,
  buildTestApi,
  createTestDatabase,
  seedFixtures,
  signedIn,
  stubLiveness,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

const LISTED_USER = '77777777-7777-4777-8777-777777777777';
const UNLISTED_USER = '88888888-8888-4888-8888-888888888888';
const METADATA_USER = '99999999-9999-4999-8999-999999999999';
const SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** The address as a person would type it; the gate normalises it, the row does not. */
const LISTED_EMAIL = '  Alice.Tan@Example.TEST  ';
const LISTED_NORM = normalizeEmail(LISTED_EMAIL);
/** What `app.profiles.contact_email` must hold: the verified claim, only trimmed. */
const LISTED_VERIFIED = LISTED_EMAIL.trim();
/**
 * Two look-alike addresses, for the rule the normal form is chosen by (R5 rev 3:
 * NFC, not NFKC). U+FB01 is the `fi` ligature and U+FF43 is the full-width `c`;
 * NFKC would fold each onto its ASCII spelling, so listing `afile@…` or
 * `alice@…` would admit a mailbox nobody invited. Under NFC they are other
 * addresses, and an address nobody listed is refused.
 */
const LIGATURE_USER = '66666666-6666-4666-8666-666666666666';
const LIGATURE_EMAIL = 'A\uFB01le@Example.test';
const LIGATURE_NORM = normalizeEmail(LIGATURE_EMAIL);
const FULLWIDTH_USER = '55555555-5555-4555-8555-555555555555';
const FULLWIDTH_EMAIL = 'Ali\uFF43e@Example.test';
const FULLWIDTH_NORM = normalizeEmail(FULLWIDTH_EMAIL);

interface ProfileRow {
  contact_email: string;
  display_name: string | null;
  status: string;
  last_sign_in_at: Date;
}

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

describe('M2-AC02 POST /identity/sign-in', () => {
  let db: TestDatabase;
  let api: TestApi;
  let identity: TestIdentity;

  const profileRow = (id: string) =>
    asMigrator<ProfileRow>(db, 'SELECT contact_email, display_name, status, last_sign_in_at FROM app.profiles WHERE id = $1', [id]);

  beforeAll(async () => {
    db = await createTestDatabase();
    identity = await createTestIdentity();
    await asMigrator(
      db,
      `INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by) VALUES ($1, 'integration test', 'wringy-test')`,
      [LISTED_NORM],
    );
    api = await buildTestApi(db.urls.api, { identity, liveness: stubLiveness('live') });
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  const signIn = async (token: string) =>
    api.app.inject({ method: 'POST', url: '/identity/sign-in', headers: bearer(token) });

  it('M2-AC02/2 sign-in gate: an address that is not listed is refused 403 sign_in.not_allowed and writes no profile row', async () => {
    const token = await identity.signToken({
      sub: UNLISTED_USER,
      sessionId: SESSION,
      email: 'mallory@example.test',
      displayName: 'Mallory Ng',
    });
    const response = await signIn(token);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(errorBody('sign_in.not_allowed'));
    expect(response.headers['cache-control']).toBe(CACHE_CONTROL);
    expect(response.headers.vary).toBe('Authorization');
    // The transaction rolled back: there is nothing to clean up afterwards.
    expect(await profileRow(UNLISTED_USER)).toEqual([]);
    // Nor does the refusal say which address it judged.
    expect(response.body).not.toContain('mallory@example.test');
  });

  it('M2-AC02/2 sign-in gate: a listed address creates the profile with the verified email, the display name and the sign-in stamp; a second sign-in refreshes them; removing the address from the list signs nobody out', async () => {
    const token = await identity.signToken({
      sub: LISTED_USER,
      sessionId: SESSION,
      email: LISTED_EMAIL,
      displayName: 'Alice Tan',
    });
    const created = await signIn(token);
    expect(created.statusCode).toBe(200);
    const body = created.json() as SignInResponse;
    // The gate compared the normal form (that is what the list holds), but the row
    // keeps the address as the provider spells it: `contact_email` is the
    // notification address, and normalisation is a comparison key, not a rewrite
    // of where somebody is written to (§3.2, D7, R5).
    expect(LISTED_VERIFIED).not.toBe(LISTED_NORM);
    expect(body.profile).toMatchObject({
      id: LISTED_USER,
      contactEmail: LISTED_VERIFIED,
      displayName: 'Alice Tan',
      status: 'active',
    });

    const [first] = await profileRow(LISTED_USER);
    expect(first).toMatchObject({ contact_email: LISTED_VERIFIED, display_name: 'Alice Tan', status: 'active' });
    expect(first?.last_sign_in_at).toBeInstanceOf(Date);

    // A second sign-in with a refreshed provider profile: the same row, restamped.
    const again = await identity.signToken({
      sub: LISTED_USER,
      sessionId: SESSION,
      email: 'ALICE.TAN+work@example.test',
      displayName: 'Alice Tan Wei',
    });
    const updated = await signIn(again);
    expect(updated.statusCode).toBe(200);
    const [second] = await profileRow(LISTED_USER);
    expect(second).toMatchObject({
      contact_email: 'ALICE.TAN+work@example.test',
      display_name: 'Alice Tan Wei',
    });
    expect(second!.last_sign_in_at.getTime()).toBeGreaterThanOrEqual(first!.last_sign_in_at.getTime());
    // One row, not two: the subject is the key, never the address.
    expect(await profileRow(LISTED_USER)).toHaveLength(1);

    // Removed from the list afterwards: an existing profile is never re-checked.
    await asMigrator(db, 'DELETE FROM app.sign_in_allowlist WHERE email_norm = $1', [LISTED_NORM]);
    await asMigrator(db, 'DELETE FROM app.sign_in_allowlist WHERE email_norm = $1', ['alice.tan+work@example.test']);
    const afterRemoval = await signIn(again);
    expect(afterRemoval.statusCode).toBe(200);
    expect(await profileRow(LISTED_USER)).toHaveLength(1);
  });

  it('M2-AC02/2 sign-in gate: a listed ASCII address never admits a look-alike non-ASCII mailbox (NFC, not NFKC)', async () => {
    // R5 rev 3. Under NFKC the gate's key for the U+FB01 ligature address would be
    // `afile@example.test` and the key for the full-width `c` one would be
    // `alice@example.test`, so listing the ASCII address would let a mailbox nobody
    // invited sign in — and the two would share one allow-list row, so removing one
    // could not remove the other. Under NFC the normal form keeps the code point,
    // and an address nobody listed is refused.
    const listed = ['afile@example.test', 'alice@example.test'];
    for (const email of listed) {
      await asMigrator(
        db,
        `INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by) VALUES ($1, 'integration test', 'wringy-test')
         ON CONFLICT (email_norm) DO NOTHING`,
        [email],
      );
    }
    // The normal form is the verified spelling, trimmed and lower-cased: nothing
    // was folded away, so neither key is one of the listed ASCII keys.
    expect(LIGATURE_NORM).toBe(LIGATURE_EMAIL.toLowerCase());
    expect(LIGATURE_NORM).not.toBe('afile@example.test');
    expect(FULLWIDTH_NORM).not.toBe('alice@example.test');

    for (const [subject, email] of [
      [LIGATURE_USER, LIGATURE_EMAIL],
      [FULLWIDTH_USER, FULLWIDTH_EMAIL],
    ] as const) {
      const response = await signIn(await identity.signToken({ sub: subject, sessionId: SESSION, email }));

      expect(response.statusCode, email).toBe(403);
      expect(response.json(), email).toEqual(errorBody('sign_in.not_allowed'));
      expect(await profileRow(subject), email).toEqual([]);
    }

    // Listing the address as it is actually spelled admits it: the allow-list CLI
    // stores the same NFC form the gate asks with (packages/db/src/allowlist.ts).
    // `contact_email` still keeps the provider's spelling character for character,
    // because the normal form is a comparison key and not an address.
    await asMigrator(
      db,
      `INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by) VALUES ($1, 'integration test', 'wringy-test')
       ON CONFLICT (email_norm) DO NOTHING`,
      [LIGATURE_NORM],
    );
    const admitted = await signIn(
      await identity.signToken({ sub: LIGATURE_USER, sessionId: SESSION, email: LIGATURE_EMAIL }),
    );
    expect(admitted.statusCode).toBe(200);
    const [row] = await profileRow(LIGATURE_USER);
    expect(row?.contact_email).toBe(LIGATURE_EMAIL);
    // The ASCII neighbour it looks like is a different subject, still unclaimed.
    expect(await profileRow(FULLWIDTH_USER)).toEqual([]);
  });
  it('M2-AC02/2 sign-in gate: a token with no email claim is 401, and a user_metadata.email that is listed does not open the gate', async () => {
    // Listed again, because the previous row proved that removing it signs nobody
    // out; this row is what the metadata claim would have to borrow.
    await asMigrator(
      db,
      `INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by) VALUES ($1, 'integration test', 'wringy-test')
       ON CONFLICT (email_norm) DO NOTHING`,
      [LISTED_NORM],
    );
    const noEmail = await identity.signToken({ sub: UNLISTED_USER, sessionId: SESSION, email: null });
    const refusedForNoEmail = await signIn(noEmail);
    expect(refusedForNoEmail.statusCode).toBe(401);
    expect(refusedForNoEmail.json()).toEqual(errorBody('unauthenticated'));

    // Metadata is never used for authorisation: only the top-level claim GoTrue
    // sets from the identity store decides, and this token's is not listed.
    const metadata = await identity.signToken({
      sub: METADATA_USER,
      sessionId: SESSION,
      email: 'not-listed@example.test',
      overrides: { claims: { user_metadata: { email: LISTED_NORM, full_name: 'Sneaky' } } },
    });
    const refusedForMetadata = await signIn(metadata);
    expect(refusedForMetadata.statusCode).toBe(403);
    expect(refusedForMetadata.json()).toEqual(errorBody('sign_in.not_allowed'));
    expect(await profileRow(METADATA_USER)).toEqual([]);
  });

  it('M2-AC02/2 sign-in gate: a revoked session is refused before any write, and an unanswerable liveness check is 503', async () => {
    await asMigrator(
      db,
      `INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by) VALUES ($1, 'integration test', 'wringy-test')
       ON CONFLICT (email_norm) DO NOTHING`,
      ['fresh@example.test'],
    );
    const freshUser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const token = await identity.signToken({ sub: freshUser, sessionId: SESSION, email: 'fresh@example.test' });

    const revoked = await buildTestApi(db.urls.api, { identity, liveness: stubLiveness('revoked') });
    try {
      const response = await revoked.app.inject({ method: 'POST', url: '/identity/sign-in', headers: bearer(token) });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual(errorBody('session.revoked'));
      // The check ran first, so the allow-list was never even consulted.
      expect(await profileRow(freshUser)).toEqual([]);
    } finally {
      await revoked.close();
    }

    const unavailable = await buildTestApi(db.urls.api, { identity, liveness: stubLiveness('unavailable') });
    try {
      const response = await unavailable.app.inject({ method: 'POST', url: '/identity/sign-in', headers: bearer(token) });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual(errorBody('session_check_unavailable'));
      expect(await profileRow(freshUser)).toEqual([]);
    } finally {
      await unavailable.close();
    }

    // And with a live session the same token does create the row.
    expect((await signIn(token)).statusCode).toBe(200);
    expect(await profileRow(freshUser)).toHaveLength(1);
  });
});

describe('M2-AC02 a disabled or missing profile', () => {
  let db: TestDatabase;
  let api: TestApi;
  let identity: TestIdentity;
  let disabled: SignedIn;
  let noProfile: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedFixtures(db);
    identity = await createTestIdentity();
    disabled = await signedIn(db, identity, {
      userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      sessionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      contactEmail: 'disabled@example.test',
      status: 'disabled',
    });
    noProfile = await signedIn(db, identity, {
      userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      sessionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      contactEmail: 'never-signed-in@example.test',
      withProfile: false,
    });
    api = await buildTestApi(db.urls.api, { identity, liveness: stubLiveness('live') });
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  it('M2-AC02/2 sign-in gate: a disabled profile is refused 403 account.disabled on every route, sign-in included', async () => {
    const calls = [
      { method: 'GET' as const, url: '/me' },
      { method: 'GET' as const, url: '/internal/campaigns' },
      { method: 'GET' as const, url: '/internal/worker-health' },
      { method: 'POST' as const, url: '/identity/sign-in' },
      { method: 'POST' as const, url: '/me/session/probe' },
    ];
    for (const call of calls) {
      const response = await api.app.inject({ ...call, headers: disabled.headers });
      expect(response.statusCode, call.url).toBe(403);
      expect(response.json(), call.url).toEqual(errorBody('account.disabled'));
      expect(response.headers['cache-control'], call.url).toBe(CACHE_CONTROL);
      expect(response.headers.vary, call.url).toBe('Authorization');
      // No private data escapes with the refusal.
      expect(response.body, call.url).not.toContain('disabled@example.test');
      expect(response.body, call.url).not.toContain('Morning brew launch');
    }
  });

  it('M2-AC02/2 sign-in gate: an account disabled after the hook read it is still refused 403 account.disabled by the command itself', async () => {
    // The race R6 closes: the hook reads `app.profiles` on its own connection,
    // before the command opens its transaction, so an operator disabling the
    // account in between would be invisible to the work that read allowed —
    // `POST /identity/sign-in` would upsert over it and stamp a fresh sign-in, and
    // the probe would answer ok. `app.inject` cannot interleave a real UPDATE
    // between the hook and the command, so the race is arranged the other way
    // round: the row IS disabled, and the hook is the thing that says `active`.
    // Everything else — the routes, the transactions, the locks, the SQL — is real.
    const seenByTheHook: Profile = {
      id: disabled.userId,
      displayName: disabled.displayName,
      contactEmail: disabled.contactEmail,
      status: 'active',
      lastSignInAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const stale = await buildTestApi(db.urls.api, {
      identity,
      liveness: stubLiveness('live'),
      readProfile: async (userId) => (userId === disabled.userId ? seenByTheHook : null),
    });
    try {
      // The hook let it through, so the guard being tested is the only thing left.
      for (const call of [
        { method: 'POST' as const, url: '/identity/sign-in' },
        { method: 'POST' as const, url: '/me/session/probe' },
      ]) {
        const response = await stale.app.inject({ ...call, headers: disabled.headers });
        expect(response.statusCode, call.url).toBe(403);
        expect(response.json(), call.url).toEqual(errorBody('account.disabled'));
        expect(response.body, call.url).not.toContain(disabled.contactEmail);
      }

      // And the refusal wrote nothing: the row is still disabled, with the address
      // and the sign-in stamp the arrangement gave it.
      const [row] = await asMigrator<ProfileRow>(
        db,
        'SELECT contact_email, display_name, status, last_sign_in_at FROM app.profiles WHERE id = $1',
        [disabled.userId],
      );
      expect(row).toMatchObject({ status: 'disabled', contact_email: disabled.contactEmail });

      // A profile that has gone between the hook's read and the command is the
      // hook's own answer, from the same guard.
      const vanished = await buildTestApi(db.urls.api, {
        identity,
        liveness: stubLiveness('live'),
        readProfile: async () => ({ ...seenByTheHook, id: noProfile.userId }),
      });
      try {
        const response = await vanished.app.inject({
          method: 'POST',
          url: '/me/session/probe',
          headers: noProfile.headers,
        });
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual(errorBody('profile.missing'));
      } finally {
        await vanished.close();
      }
    } finally {
      await stale.close();
    }
  });

  it('M2-AC02/2 sign-in gate: a verified subject with no profile is 403 profile.missing everywhere but POST /identity/sign-in', async () => {
    for (const call of [
      { method: 'GET' as const, url: '/me' },
      { method: 'GET' as const, url: '/internal/campaigns' },
      { method: 'POST' as const, url: '/me/session/probe' },
    ]) {
      const response = await api.app.inject({ ...call, headers: noProfile.headers });
      expect(response.statusCode, call.url).toBe(403);
      expect(response.json(), call.url).toEqual(errorBody('profile.missing'));
    }

    // The one route that may see no row is the one that creates it; this address
    // is not listed, so the gate still refuses it — with its own code.
    const signIn = await api.app.inject({ method: 'POST', url: '/identity/sign-in', headers: noProfile.headers });
    expect(signIn.statusCode).toBe(403);
    expect(signIn.json()).toEqual(errorBody('sign_in.not_allowed'));
  });
});

describe('M2-AC02 the app as the process builds it', () => {
  let db: TestDatabase;
  let jwks: Awaited<ReturnType<typeof serveJwks>>;
  let pool: ReturnType<typeof createApiPool>;
  let app: ReturnType<typeof buildApp>;
  let caller: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedFixtures(db);
    // The key set is served at the origin the process is configured with, so the
    // hook finds it exactly where startServer looks for it.
    jwks = await serveJwks();
    const identity = await createTestIdentity(jwks.origin);
    jwks.publish(identity.jwksJson);
    caller = await signedIn(db, identity);
    pool = createApiPool(db.urls.api, () => {});
    app = buildApp({
      pool,
      ...identityWiringFor(
        {
          WRINGY_ENV: 'ci',
          DATABASE_URL: db.urls.api,
          SUPABASE_URL: jwks.origin,
          SUPABASE_PUBLISHABLE_KEY: TEST_PUBLISHABLE_KEY,
          SESSION_LIVENESS: 'database',
          HOST: '127.0.0.1',
          PORT: 3200,
          LOG_LEVEL: 'info',
        },
        pool,
      ),
    });
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end().catch(() => {});
    await jwks?.close();
    await db?.drop();
  });

  it('M2-AC02/2 startServer-shaped: an unauthenticated GET /internal/campaigns is refused 401 by the wiring the process uses', async () => {
    const response = await app.inject({ method: 'GET', url: '/internal/campaigns' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(errorBody('unauthenticated'));
    expect(response.body).not.toContain('Morning brew launch');
  });

  it('M2-AC02/3 headers: a hooked response carries Vary: Authorization and private, no-store; /health carries no Vary', async () => {
    for (const url of ['/internal/campaigns', '/internal/worker-health', '/me']) {
      const response = await app.inject({ method: 'GET', url, headers: caller.headers });
      expect(response.statusCode, url).toBe(200);
      expect(response.headers['cache-control'], url).toBe(CACHE_CONTROL);
      expect(response.headers.vary, url).toBe('Authorization');
    }
    // A 401 depends on Authorization too, so it varies by it as well.
    const refused = await app.inject({ method: 'GET', url: '/me' });
    expect(refused.statusCode).toBe(401);
    expect(refused.headers.vary).toBe('Authorization');

    // R18: /health and /health/live do not read the header, and must not claim to.
    for (const url of ['/health', '/health/live']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode, url).toBe(200);
      expect(response.headers['cache-control'], url).toBe(CACHE_CONTROL);
      expect(response.headers.vary, url).toBeUndefined();
    }
  });

  it('M2-AC02/2 startServer-shaped: GET /me is the profile and the access token’s own expiry, and no token', async () => {
    const response = await app.inject({ method: 'GET', url: '/me', headers: caller.headers });
    expect(response.statusCode).toBe(200);
    const body = response.json() as MeResponse;
    expect(body.profile).toMatchObject({ id: caller.userId, contactEmail: caller.contactEmail, status: 'active' });
    expect(Object.keys(body).sort()).toEqual(['profile', 'session']);
    expect(Object.keys(body.session)).toEqual(['expiresAt']);
    expect(Date.parse(body.session.expiresAt)).toBeGreaterThan(Date.now());
    expect(response.body).not.toContain(caller.token);
    expect(response.body).not.toContain(caller.sessionId);
  });

  it('M2-AC02/3 the key set is fetched from the configured issuer, and a token of another issuer is refused', async () => {
    // One fetch served the requests above; the URL came from configuration, never
    // from the token's own `iss`.
    expect(jwks.requests).toBeGreaterThanOrEqual(1);
    const elsewhere = await createTestIdentity(`http://127.0.0.1:${await unusedPort()}`);
    const foreign = await elsewhere.signToken({ sub: caller.userId, sessionId: caller.sessionId });
    const response = await app.inject({ method: 'GET', url: '/me', headers: bearer(foreign) });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(errorBody('unauthenticated'));
  });
});
