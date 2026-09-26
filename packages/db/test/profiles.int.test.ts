import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTestDatabase,
  failureIn,
  setTestEnvironment,
  sqlState,
  withClientAt,
  withRollback,
  type TestDatabase,
} from './harness';

const SUBJECT = 'd3f0a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b';
const OTHER_SUBJECT = 'e4a1b2c3-d4e5-4f60-9a8b-1c2d3e4f5a6b';

/** The insert the API makes at a first sign-in (migration 0008). */
const INSERT = `INSERT INTO app.profiles (id, display_name, contact_email, last_sign_in_at)
                VALUES ($1, $2, $3, now())
             RETURNING id, status, locale_pref, locale_pref_set_at, created_at, updated_at`;

describe('M2-AC02/2 app.profiles is written by the API login only, and never deleted', () => {
  let db: TestDatabase;
  /** A second clone marked production, where fixtures are not allowed. */
  let noFixtures: TestDatabase;
  let api: pg.Pool;
  /** The operator's account: the only one that may write `status` since 0010. */
  let migrator: pg.Pool;

  beforeAll(async () => {
    db = await createTestDatabase();
    noFixtures = await createTestDatabase();
    await setTestEnvironment(noFixtures, 'production');
    api = new pg.Pool({ connectionString: db.urls.api, max: 2 });
    migrator = new pg.Pool({ connectionString: db.urls.migrator, max: 2 });
  });

  afterAll(async () => {
    await api?.end();
    await migrator?.end();
    await db?.drop();
    await noFixtures?.drop();
  });

  it('M2-AC02/2 the API login inserts a profile and updates it, and the defaults are active with no locale', async () => {
    await withRollback(api, async (client) => {
      const { rows } = await client.query<{
        id: string;
        status: string;
        locale_pref: string | null;
        locale_pref_set_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>(INSERT, [SUBJECT, 'Tester One', 'tester.one@example.com']);
      expect(rows[0]).toMatchObject({
        id: SUBJECT,
        status: 'active',
        locale_pref: null,
        locale_pref_set_at: null,
      });

      // The sign-in refresh (ruling D7): contact_email, display_name, last_sign_in_at.
      const updated = await client.query<{ contact_email: string; display_name: string | null }>(
        `UPDATE app.profiles
            SET contact_email = $2, display_name = $3, last_sign_in_at = now()
          WHERE id = $1
      RETURNING contact_email, display_name`,
        [SUBJECT, 'renamed@example.com', null],
      );
      expect(updated.rows[0]).toEqual({ contact_email: 'renamed@example.com', display_name: null });
    });
  });

  it('M2-AC02/2 the API login cannot delete a profile (42501), so no request erases an identity', async () => {
    await withClientAt(db.urls.api, async (client) => {
      await client.query(INSERT, [SUBJECT, 'Tester One', 'tester.one@example.com']);
    });
    try {
      expect(await sqlState(withClientAt(db.urls.api, (c) => c.query('DELETE FROM app.profiles')))).toBe('42501');
      expect(
        await sqlState(withClientAt(db.urls.api, (c) => c.query('TRUNCATE app.profiles'))),
      ).toBe('42501');
      // The row is still there, and the migrator may remove it.
      expect(
        (await withClientAt(db.urls.api, (c) => c.query<{ count: string }>('SELECT count(*) FROM app.profiles'))).rows[0]
          ?.count,
      ).toBe('1');
    } finally {
      await withClientAt(db.urls.migrator, (c) => c.query('DELETE FROM app.profiles'));
    }
  });

  it('M2-AC02/2 the API login may write only the columns a sign-in refreshes: status, locale_pref and locale_pref_set_at are 42501 (0010)', async () => {
    await withClientAt(db.urls.api, async (client) => {
      await client.query(INSERT, [SUBJECT, 'Tester One', 'tester.one@example.com']);
    });
    try {
      // 0010 replaced 0008's table-level INSERT/UPDATE with column grants, so the
      // runtime role cannot disable or re-enable an account (ruling D12) and cannot
      // write the locale columns M2-04 owns.
      for (const sql of [
        `UPDATE app.profiles SET status = 'disabled'`,
        `UPDATE app.profiles SET status = 'active'`,
        `UPDATE app.profiles SET locale_pref = 'en-MY'`,
        `UPDATE app.profiles SET locale_pref_set_at = now()`,
      ]) {
        expect(await sqlState(withClientAt(db.urls.api, (c) => c.query(sql))), sql).toBe('42501');
      }
      // An INSERT that names `status` is refused for the same reason.
      expect(
        await sqlState(
          withClientAt(db.urls.api, (c) =>
            c.query(
              `INSERT INTO app.profiles (id, contact_email, status, last_sign_in_at)
                    VALUES ($1, 'other@example.com', 'disabled', now())`,
              [OTHER_SUBJECT],
            ),
          ),
        ),
      ).toBe('42501');
      // And the three columns a sign-in refreshes are still writable.
      await withClientAt(db.urls.api, (c) =>
        c.query(
          `UPDATE app.profiles SET contact_email = $2, display_name = $3, last_sign_in_at = now() WHERE id = $1`,
          [SUBJECT, 'renamed@example.com', null],
        ),
      );
    } finally {
      await withClientAt(db.urls.migrator, (c) => c.query('DELETE FROM app.profiles'));
    }
  });

  it('M2-AC02/2 the locale CHECK admits only the three supported codes, and the status CHECK only active or disabled', async () => {
    // As the migrator: since 0010 only the operator's account may write `status`
    // and the locale columns, so the CHECKs are proved on the account that can.
    await withRollback(migrator, async (client) => {
      await client.query(INSERT, [SUBJECT, null, 'tester.one@example.com']);

      for (const locale of ['en-MY', 'ms-MY', 'zh-Hans-MY']) {
        const failure = await failureIn(client, () =>
          client.query(`UPDATE app.profiles SET locale_pref = $2, locale_pref_set_at = now() WHERE id = $1`, [
            SUBJECT,
            locale,
          ]),
        );
        expect(failure, locale).toBeUndefined();
      }
      for (const locale of ['en', 'en-US', 'zh-Hant-MY', 'ms', '']) {
        const failure = await failureIn(client, () =>
          client.query(`UPDATE app.profiles SET locale_pref = $2 WHERE id = $1`, [SUBJECT, locale]),
        );
        expect({ locale, code: failure?.code, constraint: failure?.constraint }).toEqual({
          locale,
          code: '23514',
          constraint: 'profiles_locale_pref_check',
        });
      }

      const status = await failureIn(client, () =>
        client.query(`UPDATE app.profiles SET status = 'suspended' WHERE id = $1`, [SUBJECT]),
      );
      expect({ code: status?.code, constraint: status?.constraint }).toEqual({
        code: '23514',
        constraint: 'profiles_status_check',
      });
      // `disabled` is the one other value the CHECK admits.
      expect(
        await failureIn(client, () =>
          client.query(`UPDATE app.profiles SET status = 'disabled' WHERE id = $1`, [SUBJECT]),
        ),
      ).toBeUndefined();
    });
  });

  it('M2-AC02/2 the updated_at trigger stamps the database clock on every update', async () => {
    await withRollback(api, async (client) => {
      const inserted = await client.query<{ created_at: Date; updated_at: Date }>(INSERT, [
        SUBJECT,
        null,
        'tester.one@example.com',
      ]);
      const { rows } = await client.query<{ updated_at: Date; db_now: Date; created_at: Date }>(
        `UPDATE app.profiles SET last_sign_in_at = now() WHERE id = $1
      RETURNING updated_at, created_at, now() AS db_now`,
        [SUBJECT],
      );
      expect(rows[0]?.updated_at).toEqual(rows[0]?.db_now);
      // created_at never moves.
      expect(rows[0]?.created_at).toEqual(inserted.rows[0]?.created_at);
    });
  });

  it('M2-AC02/2 a profile is never a fixture row: the insert works where fixtures_allowed is false', async () => {
    const marker = await withClientAt(noFixtures.urls.api, async (client) => {
      const { rows } = await client.query<{ name: string; fixtures_allowed: boolean }>(
        'SELECT name, fixtures_allowed FROM ops.environment',
      );
      return rows[0];
    });
    expect(marker).toEqual({ name: 'production', fixtures_allowed: false });

    // No data_origin column, so ops.assert_fixture_allowed() has nothing to
    // refuse and no such trigger exists on the table (M2-02 R6).
    await withClientAt(noFixtures.urls.api, async (client) => {
      const { rows } = await client.query<{ id: string }>(INSERT, [
        OTHER_SUBJECT,
        'Production Tester',
        'prod.tester@example.com',
      ]);
      expect(rows[0]?.id).toBe(OTHER_SUBJECT);
    });
    await withClientAt(noFixtures.urls.migrator, (c) => c.query('DELETE FROM app.profiles'));
  });

  it('M2-AC02/2 the catalog shows no data_origin column and no fixture trigger on app.profiles, and the updated_at trigger is the shared one', async () => {
    await withClientAt(db.urls.migrator, async (client) => {
      const { rows: columns } = await client.query<{ attname: string }>(
        `SELECT a.attname FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'app.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY a.attnum`,
      );
      expect(columns.map((row) => row.attname)).toEqual([
        'id',
        'display_name',
        'contact_email',
        'locale_pref',
        'locale_pref_set_at',
        'status',
        'last_sign_in_at',
        'created_at',
        'updated_at',
      ]);

      const { rows: triggers } = await client.query<{ tgname: string; function: string }>(
        `SELECT t.tgname, p.oid::regprocedure::text AS function
           FROM pg_catalog.pg_trigger t
           JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
          WHERE t.tgrelid = 'app.profiles'::regclass AND NOT t.tgisinternal
          ORDER BY t.tgname`,
      );
      expect(triggers).toEqual([
        { tgname: 'profiles_touch_updated_at', function: 'ops.touch_updated_at()' },
      ]);
    });
  });
});
