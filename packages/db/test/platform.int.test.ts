import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SESSION_IS_LIVE_SIGNATURE, installPlatform } from '../src/platform';

import { AUTH_SCHEMA, ROLES } from '../src/roles';
import {
  createTestDatabase,
  endSession,
  insertLiveSession,
  sqlState,
  withDatabaseAdmin,
  withClientAt,
  type TestDatabase,
} from './harness';

const USER = '9f8e7d6c-5b4a-4321-8fed-cba987654321';
const OTHER_USER = '1a2b3c4d-5e6f-4708-9a1b-2c3d4e5f6071';
const LIVE = '11111111-2222-4333-8444-555555555555';
const MISSING = '99999999-8888-4777-8666-555555555554';

/** Asks the question the API asks, as the API login: EXECUTE and nothing else. */
async function sessionIsLive(db: TestDatabase, sessionId: string, userId: string): Promise<boolean | null> {
  return withClientAt(db.urls.api, async (client) => {
    const { rows } = await client.query<{ live: boolean | null }>(
      'SELECT platform.session_is_live($1, $2) AS live',
      [sessionId, userId],
    );
    return rows[0]?.live ?? null;
  });
}

describe('M2-AC02/2 platform.session_is_live answers for the API login only', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db?.drop();
  });

  it('M2-AC02/2 true for a live session, false for one that was never there', async () => {
    await insertLiveSession(db, { sessionId: LIVE, userId: USER });
    expect(await sessionIsLive(db, LIVE, USER)).toBe(true);
    expect(await sessionIsLive(db, MISSING, USER)).toBe(false);
    // The session id alone is not enough: it must belong to this subject.
    expect(await sessionIsLive(db, LIVE, OTHER_USER)).toBe(false);
  });

  it('M2-AC02/2 false once the session is gone, which is what a sign-out leaves behind', async () => {
    await insertLiveSession(db, { sessionId: LIVE, userId: USER });
    expect(await sessionIsLive(db, LIVE, USER)).toBe(true);
    await endSession(db, LIVE);
    expect(await sessionIsLive(db, LIVE, USER)).toBe(false);
  });

  it('M2-AC02/2 false when not_after is in the past and true when it is in the future', async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60 * 60_000);
    await insertLiveSession(db, { sessionId: LIVE, userId: USER, notAfter: past });
    expect(await sessionIsLive(db, LIVE, USER)).toBe(false);
    await insertLiveSession(db, { sessionId: LIVE, userId: USER, notAfter: future });
    expect(await sessionIsLive(db, LIVE, USER)).toBe(true);
    // A null not_after means "no expiry recorded", which stays live.
    await insertLiveSession(db, { sessionId: LIVE, userId: USER, notAfter: null });
    expect(await sessionIsLive(db, LIVE, USER)).toBe(true);
    await endSession(db, LIVE);
  });

  it('M2-AC02/2 the grant manifest names this exact function, so a renamed or re-signatured one fails review', async () => {
    const { rows } = await withClientAt(db.urls.migrator, (client) =>
      client.query<{ signature: string }>(
        `SELECT p.oid::regprocedure::text AS signature
           FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'platform'`,
      ),
    );
    expect(rows.map((row) => row.signature)).toEqual([SESSION_IS_LIVE_SIGNATURE]);
  });

  it('M2-AC02/2 wringy_api cannot read auth.sessions itself: the function is the whole of its reach', async () => {
    await insertLiveSession(db, { sessionId: LIVE, userId: USER });
    try {
      for (const url of [db.urls.api, db.urls.worker, db.urls.migrator]) {
        expect(await sqlState(withClientAt(url, (c) => c.query(`SELECT * FROM ${AUTH_SCHEMA}.sessions`)))).toBe('42501');
        expect(
          await sqlState(withClientAt(url, (c) => c.query(`SELECT count(*) FROM ${AUTH_SCHEMA}.sessions`))),
        ).toBe('42501');
      }
      // ...yet the question is still answerable through the function.
      expect(await sessionIsLive(db, LIVE, USER)).toBe(true);
      // And the API may not create anything of its own in either schema.
      expect(await sqlState(withClientAt(db.urls.api, (c) => c.query('CREATE TABLE platform.probe (id int)')))).toBe(
        '42501',
      );
    } finally {
      await endSession(db, LIVE);
    }
  });

  it('M2-AC02/2 the install is idempotent: a second run changes nothing and keeps the non-superuser owner', async () => {
    const before = await withClientAt(db.urls.migrator, async (client) => {
      const { rows } = await client.query<{ owner: string; definition: string }>(
        `SELECT pg_catalog.pg_get_userbyid(p.proowner) AS owner, pg_catalog.pg_get_functiondef(p.oid) AS definition
           FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'platform' AND p.proname = 'session_is_live'`,
      );
      return rows[0];
    });
    expect(before?.owner).toBe(ROLES.platformAdmin);

    const result = await withDatabaseAdmin(db, (admin) =>
      installPlatform(admin, { databaseName: db.name, stubAuth: true }),
    );
    expect(result).toEqual({ owner: ROLES.platformAdmin, adminIsSuperuser: true, stubbedAuth: true });

    const after = await withClientAt(db.urls.migrator, async (client) => {
      const { rows } = await client.query<{ owner: string; definition: string }>(
        `SELECT pg_catalog.pg_get_userbyid(p.proowner) AS owner, pg_catalog.pg_get_functiondef(p.oid) AS definition
           FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'platform' AND p.proname = 'session_is_live'`,
      );
      return rows[0];
    });
    expect(after).toEqual(before);
  });
});
