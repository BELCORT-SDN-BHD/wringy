/**
 * `POST /me/locale`, the account's language preference (M2-04 R2, R13 *api int*;
 * localization-v1 "用户明确选择优先并持久保存"). Titles carry `M2-AC04/1` for
 * the language codes the command accepts and refuses, and `M2-AC04/2` for the
 * preference being saved to the account and kept there.
 *
 * The command's shape is the probe's (liveness on the transaction client) with
 * the sign-in's lock rule (the row locked first, the locked row decides, then the
 * write), so the rows here prove each step: liveness refuses a signed-out
 * session, the lock refuses a gone or disabled row, the UPDATE writes the pair
 * and answers the profile, and nothing else — no audit row, no other person's
 * row, no reset by a later sign-in.
 *
 * **Barrier rows** (`underProfileBarrier`, support.ts): the migrator holds the
 * caller's profile row `FOR UPDATE` in an open transaction until the request
 * waits on it (polled in `pg_stat_activity`, as the org barrier rows do), so the
 * operator's disable and a second call by the same person meet the command at
 * its lock, every time. Identities are simulated: tokens signed by an in-process
 * key pair and verified by the real hook (jwt-support.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { MeResponse, Profile, SetLocaleResponse, SignInResponse } from '@wringy/contracts';

import { CACHE_CONTROL } from '../../src/app';
import { createApiPool } from '../../src/database';
import { errorBody } from '../../src/errors';
import { databaseLiveness } from '../../src/session-liveness';
import { createTestIdentity, type TestIdentity } from './jwt-support';
import {
  apiAuditCount,
  asMigrator,
  buildTestApi,
  createTestDatabase,
  insertLiveSession,
  person,
  signedIn,
  underProfileBarrier,
  type PersonSpec,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

const FIONA: PersonSpec = {
  userId: '0f10a000-0000-4000-8000-000000000007',
  sessionId: '5e550000-0000-4000-8000-00000000f407',
  email: 'fiona@example.test',
  name: 'Fiona Chen',
};
const GOPAL: PersonSpec = {
  userId: '06a0a100-0000-4000-8000-000000000008',
  sessionId: '5e550000-0000-4000-8000-00000000a408',
  email: 'gopal@example.test',
  name: 'Gopal Nair',
};
/** Disabled by the operator in the barrier row. */
const HANA: PersonSpec = {
  userId: '0a4a0000-0000-4000-8000-000000000009',
  sessionId: '5e550000-0000-4000-8000-00000000a409',
  email: 'hana@example.test',
  name: 'Hana Ismail',
};
/** Signed out on the hosted project in the revoked-session row. */
const IVAN: PersonSpec = {
  userId: '01a40000-0000-4000-8000-00000000000a',
  sessionId: '5e550000-0000-4000-8000-00000000a40a',
  email: 'ivan@example.test',
  name: 'Ivan Lim',
};
/** A verified subject that has never completed sign-in. */
const GHOST = { userId: '06a05700-0000-4000-8000-00000000000b', sessionId: '5e550000-0000-4000-8000-00000000a40b' };

const LOCALES = ['en-MY', 'ms-MY', 'zh-Hans-MY'] as const;

interface LocaleRow {
  status: string;
  locale_pref: string | null;
  /** The instant as PostgreSQL prints it, to the microsecond. */
  set_at_text: string | null;
  set_at: Date | null;
  last_sign_in_at: Date;
}

describe('M2-AC04 POST /me/locale saves the language preference to the account (simulated identities)', () => {
  let db: TestDatabase;
  let api: TestApi;
  let identity: TestIdentity;
  let fiona: SignedIn;
  let gopal: SignedIn;
  let hana: SignedIn;

  const localeRow = async (userId: string): Promise<LocaleRow | undefined> =>
    (
      await asMigrator<LocaleRow>(
        db,
        `SELECT status, locale_pref, locale_pref_set_at::text AS set_at_text, locale_pref_set_at AS set_at, last_sign_in_at
           FROM app.profiles WHERE id = $1`,
        [userId],
      )
    )[0];

  const setLocale = (who: SignedIn | undefined, payload?: unknown, on: TestApi = api) =>
    on.app.inject({
      method: 'POST',
      url: '/me/locale',
      ...(who === undefined ? {} : { headers: who.headers }),
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });

  /** Log records carrying `reason`, for the reason word a refusal must log. */
  const reasonsLogged = (reason: string) => api.logs.records.filter((record) => record.reason === reason).length;

  beforeAll(async () => {
    db = await createTestDatabase();
    identity = await createTestIdentity();
    fiona = await person(db, identity, FIONA);
    gopal = await person(db, identity, GOPAL);
    hana = await person(db, identity, HANA);
    api = await buildTestApi(db.urls.api, { identity });
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  it('M2-AC04/2 POST /me/locale writes both columns and answers the profile, and GET /me answers the same pair', async () => {
    const response = await setLocale(fiona, { locale: 'zh-Hans-MY' });
    expect(response.statusCode).toBe(200);
    const { profile } = response.json() as SetLocaleResponse;
    expect(profile).toMatchObject({
      id: FIONA.userId,
      contactEmail: FIONA.email,
      displayName: FIONA.name,
      status: 'active',
      localePref: 'zh-Hans-MY',
    });

    // The row holds the pair, and the answer is the row (the database's instant).
    const row = await localeRow(FIONA.userId);
    expect(row?.locale_pref).toBe('zh-Hans-MY');
    expect(row?.set_at).not.toBeNull();
    expect(profile.localePrefSetAt).toBe(row?.set_at?.toISOString());

    // GET /me reads it back through the hook's profile.
    const me = await api.app.inject({ method: 'GET', url: '/me', headers: fiona.headers });
    expect(me.statusCode).toBe(200);
    const body = me.json() as MeResponse;
    expect(body.profile.localePref).toBe('zh-Hans-MY');
    expect(body.profile.localePrefSetAt).toBe(profile.localePrefSetAt);
  });

  it('M2-AC04/2 a second call moves locale_pref_set_at forward: later to the microsecond as the migrator reads it, and never earlier in the API’s answer', async () => {
    const first = await setLocale(fiona, { locale: 'ms-MY' });
    expect(first.statusCode).toBe(200);
    const firstRow = await localeRow(FIONA.userId);
    const second = await setLocale(fiona, { locale: 'en-MY' });
    expect(second.statusCode).toBe(200);
    const secondRow = await localeRow(FIONA.userId);

    // `now()` is each command's transaction start: two sequential commands are
    // strictly ordered at microsecond precision in the database.
    const [{ later } = { later: false }] = await asMigrator<{ later: boolean }>(
      db,
      'SELECT $2::timestamptz > $1::timestamptz AS later',
      [firstRow?.set_at_text, secondRow?.set_at_text],
    );
    expect(later).toBe(true);
    // Through `pg` and toISOString() the API's instants have millisecond
    // precision, so two commands within one millisecond may answer equal ones.
    const firstAt = Date.parse((first.json() as SetLocaleResponse).profile.localePrefSetAt ?? '');
    const secondAt = Date.parse((second.json() as SetLocaleResponse).profile.localePrefSetAt ?? '');
    expect(secondAt).toBeGreaterThanOrEqual(firstAt);
    expect(secondRow?.locale_pref).toBe('en-MY');
  });

  it('M2-AC04/1 each of the three codes is accepted and saved exactly as sent', async () => {
    for (const locale of LOCALES) {
      const response = await setLocale(gopal, { locale });
      expect(response.statusCode, locale).toBe(200);
      expect((response.json() as SetLocaleResponse).profile.localePref, locale).toBe(locale);
      expect((await localeRow(GOPAL.userId))?.locale_pref, locale).toBe(locale);
    }
  });

  it('M2-AC04/1 a locale outside the three (en, en-US, zh-Hant-MY, an empty string, a missing body, a non-string) is 400 bad_request and writes nothing', async () => {
    expect((await setLocale(gopal, { locale: 'ms-MY' })).statusCode).toBe(200);
    const before = await localeRow(GOPAL.userId);

    const refused: Array<[string, unknown]> = [
      ['en', { locale: 'en' }],
      ['en-US', { locale: 'en-US' }],
      ['zh-Hant-MY', { locale: 'zh-Hant-MY' }],
      ['an empty string', { locale: '' }],
      ['a missing body', undefined],
      ['a non-string', { locale: 7 }],
    ];
    for (const [label, payload] of refused) {
      const response = await setLocale(gopal, payload);
      expect(response.statusCode, label).toBe(400);
      expect(response.json(), label).toEqual(errorBody('bad_request'));
    }
    expect(await localeRow(GOPAL.userId)).toEqual(before);
  });

  it('M2-AC04/2 a body naming another person’s userId changes only the caller’s row', async () => {
    expect((await setLocale(gopal, { locale: 'ms-MY' })).statusCode).toBe(200);
    const gopalBefore = await localeRow(GOPAL.userId);

    // The body schema is a plain z.object: `userId` is stripped, and the token
    // alone names the row.
    const response = await setLocale(fiona, { locale: 'zh-Hans-MY', userId: GOPAL.userId });
    expect(response.statusCode).toBe(200);
    expect((response.json() as SetLocaleResponse).profile.id).toBe(FIONA.userId);
    expect((await localeRow(FIONA.userId))?.locale_pref).toBe('zh-Hans-MY');
    expect(await localeRow(GOPAL.userId)).toEqual(gopalBefore);
  });

  it('M2-AC04/2 no token is 401 unauthenticated and writes nothing', async () => {
    const before = await localeRow(FIONA.userId);
    const response = await setLocale(undefined, { locale: 'ms-MY' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(errorBody('unauthenticated'));
    expect(await localeRow(FIONA.userId)).toEqual(before);
  });

  it('M2-AC04/2 a revoked session is 401 session.revoked and writes nothing: liveness is asked on the command’s own connection', async () => {
    // The real `platform.session_is_live` on the stub `auth.sessions`, the way
    // the probe's rows ask it; the default app answers liveness with a stub.
    const ivan = await person(db, identity, IVAN);
    const pool = createApiPool(db.urls.api, () => {});
    const live = await buildTestApi(db.urls.api, { identity, liveness: databaseLiveness(pool) });
    try {
      // Live: the same app saves.
      expect((await setLocale(ivan, { locale: 'ms-MY' }, live)).statusCode).toBe(200);
      const saved = await localeRow(IVAN.userId);
      expect(saved?.locale_pref).toBe('ms-MY');

      // Signed out: the session row's `not_after` has passed.
      await insertLiveSession(db, {
        sessionId: IVAN.sessionId,
        userId: IVAN.userId,
        notAfter: new Date(Date.now() - 60_000),
      });
      const revoked = await setLocale(ivan, { locale: 'zh-Hans-MY' }, live);
      expect(revoked.statusCode).toBe(401);
      expect(revoked.json()).toEqual(errorBody('session.revoked'));
      expect(await localeRow(IVAN.userId)).toEqual(saved);
    } finally {
      await live.close();
      await pool.end().catch(() => {});
    }
  });

  it('M2-AC04/2 a subject with no profile is 403 profile.missing, from the hook and from the command’s own lock, and no row is created', async () => {
    const ghost = await signedIn(db, identity, {
      userId: GHOST.userId,
      sessionId: GHOST.sessionId,
      contactEmail: 'ghost@example.test',
      withProfile: false,
    });
    const missing = await setLocale(ghost, { locale: 'ms-MY' });
    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toEqual(errorBody('profile.missing'));

    // A row that has gone between the hook's read and the command: the hook is
    // made to see a profile, the lock finds none (the seam of identity.int.test.ts).
    const seenByTheHook: Profile = {
      id: GHOST.userId,
      displayName: null,
      contactEmail: 'ghost@example.test',
      status: 'active',
      lastSignInAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      localePref: null,
      localePrefSetAt: null,
    };
    const vanished = await buildTestApi(db.urls.api, { identity, readProfile: async () => seenByTheHook });
    try {
      const response = await setLocale(ghost, { locale: 'ms-MY' }, vanished);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual(errorBody('profile.missing'));
      expect(vanished.logs.records.some((record) => record.reason === 'profile_missing')).toBe(true);
    } finally {
      await vanished.close();
    }
    expect(await localeRow(GHOST.userId)).toBeUndefined();
  });

  it('M2-AC04/2 barrier: an operator disables the account while the command waits on the profile row, and the command answers 403 account.disabled with nothing written', async () => {
    const before = await localeRow(HANA.userId);
    expect(before).toMatchObject({ status: 'active', locale_pref: null, set_at: null });
    const refusalsBefore = reasonsLogged('account_disabled');

    // The hook reads `active` (a plain SELECT does not wait on the barrier); the
    // command then waits at its lock while the operator's UPDATE commits, and the
    // locked row it is granted says `disabled`.
    const [response] = await underProfileBarrier(db, HANA.userId, [() => setLocale(hana, { locale: 'ms-MY' })], {
      beforeCommit: (barrier) =>
        barrier.query(`UPDATE app.profiles SET status = 'disabled' WHERE id = $1`, [HANA.userId]),
    });
    expect(response?.statusCode).toBe(403);
    expect(response?.json()).toEqual(errorBody('account.disabled'));
    expect(await localeRow(HANA.userId)).toMatchObject({ status: 'disabled', locale_pref: null, set_at: null });
    // Logged as a reason word, like the probe; never the address.
    expect(reasonsLogged('account_disabled')).toBe(refusalsBefore + 1);
    expect(api.logs.text).not.toContain(HANA.email);
  });

  it('M2-AC04/2 barrier: two calls by one person, in order, both answer 200 with no deadlock, and the row holds the second', async () => {
    const [first, second] = await underProfileBarrier(
      db,
      GOPAL.userId,
      [() => setLocale(gopal, { locale: 'en-MY' }), () => setLocale(gopal, { locale: 'zh-Hans-MY' })],
      { inOrder: true },
    );
    expect([first?.statusCode, second?.statusCode]).toEqual([200, 200]);
    // Share-then-write would have ended one of them in 40P01 (a 500).
    expect(api.logs.text).not.toContain('40P01');

    const answered = (second?.json() as SetLocaleResponse).profile;
    const row = await localeRow(GOPAL.userId);
    expect({ localePref: row?.locale_pref, localePrefSetAt: row?.set_at?.toISOString() }).toEqual({
      localePref: answered.localePref,
      localePrefSetAt: answered.localePrefSetAt,
    });
    expect(answered.localePref).toBe('zh-Hans-MY');
  });

  it('M2-AC04/2 a later POST /identity/sign-in keeps the preference and refreshes only the sign-in columns', async () => {
    expect((await setLocale(fiona, { locale: 'ms-MY' })).statusCode).toBe(200);
    const before = await localeRow(FIONA.userId);

    const signIn = await api.app.inject({ method: 'POST', url: '/identity/sign-in', headers: fiona.headers });
    expect(signIn.statusCode).toBe(200);
    const { profile } = signIn.json() as SignInResponse;
    expect(profile.localePref).toBe('ms-MY');
    expect(profile.localePrefSetAt).toBe(before?.set_at?.toISOString());

    const after = await localeRow(FIONA.userId);
    expect({ locale_pref: after?.locale_pref, set_at_text: after?.set_at_text }).toEqual({
      locale_pref: before?.locale_pref,
      set_at_text: before?.set_at_text,
    });
    expect(after!.last_sign_in_at.getTime()).toBeGreaterThanOrEqual(before!.last_sign_in_at.getTime());
  });

  it('M2-AC04/2 the command writes no audit row, whether it saves or is refused', async () => {
    const before = await apiAuditCount(db);
    expect((await setLocale(fiona, { locale: 'en-MY' })).statusCode).toBe(200);
    expect((await setLocale(fiona, { locale: 'en' })).statusCode).toBe(400);
    expect(await apiAuditCount(db)).toBe(before);
  });

  it('M2-AC04/2 POST /me/locale is in the route table the hook-scope check walks, so it is covered by the every-route 401 row', async () => {
    expect(api.app.routeTable).toContainEqual({ method: 'POST', url: '/me/locale' });
  });

  it('M2-AC04/2 every answer carries Vary: Authorization and Cache-Control: private, no-store', async () => {
    const answers = [
      ['200', await setLocale(fiona, { locale: 'zh-Hans-MY' })],
      ['400', await setLocale(fiona, { locale: 'zh-Hant-MY' })],
      ['401', await setLocale(undefined, { locale: 'zh-Hans-MY' })],
    ] as const;
    for (const [label, response] of answers) {
      expect(response.statusCode.toString(), label).toBe(label);
      expect(response.headers.vary, label).toBe('Authorization');
      expect(response.headers['cache-control'], label).toBe(CACHE_CONTROL);
    }
  });
});
