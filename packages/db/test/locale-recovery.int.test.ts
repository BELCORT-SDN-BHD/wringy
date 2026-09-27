/**
 * Recovery, as M2-04 defines it: "回退保持已有偏好数据可读" (the ticket's
 * Verification line; m2-04-code-review.md R15 a). Reverting the two migrations
 * this ticket adds takes the API's right to write a preference away and keeps
 * every saved preference readable; migrating up again gives the right back.
 *
 * On a clone of its own (`createTestDatabase()`), because it moves that
 * database's migration head and no other file may see a head other than
 * EXPECTED_MIGRATION_HEAD. The preference is arranged as the migrator — the
 * operator's account, which could write the pair before 0018 and after its Down
 * — so the arrangement does not depend on the grant under test.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXPECTED_MIGRATION_HEAD } from '../src/expected-head';
import { listMigrations, runMigrations } from '../src/migrate';
import { createTestDatabase, sqlState, withClientAt, type TestDatabase } from './harness';

const SUBJECT = 'f1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5c';

/** `POST /me/locale`'s write (M2-04 R2), as the API login runs it. */
const SET_LOCALE = `UPDATE app.profiles SET locale_pref = $2, locale_pref_set_at = now() WHERE id = $1
                  RETURNING locale_pref, locale_pref_set_at`;

interface PreferenceRow {
  locale_pref: string | null;
  set_at: string | null;
}

describe('M2-AC04/2 a saved language preference survives a rollback of the migrations that let the API write it (R15 a)', () => {
  let db: TestDatabase;

  /** The pair as the API login reads it; the instant as text, so microseconds are compared too. */
  const readAsApi = () =>
    withClientAt(db.urls.api, async (client) => {
      const { rows } = await client.query<PreferenceRow>(
        'SELECT locale_pref, locale_pref_set_at::text AS set_at FROM app.profiles WHERE id = $1',
        [SUBJECT],
      );
      return rows;
    });

  const pairCheckExists = () =>
    withClientAt(db.urls.migrator, async (client) => {
      const { rows } = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_catalog.pg_constraint
            WHERE conrelid = 'app.profiles'::regclass AND conname = 'profiles_locale_pref_pair_check'
         ) AS exists`,
      );
      return rows[0]?.exists;
    });

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db?.drop();
  });

  it('M2-AC04/2 recovery: reverting 0018 and 0017 leaves a saved preference readable by the API login, its writes refused (42501) and the pair CHECK gone; migrating up again lets the API write it', async () => {
    const all = listMigrations();
    expect(all.slice(-2)).toEqual(['0017_profiles_locale_pair_check', EXPECTED_MIGRATION_HEAD]);

    await withClientAt(db.urls.migrator, (client) =>
      client.query(
        `INSERT INTO app.profiles (id, contact_email, display_name, last_sign_in_at, locale_pref, locale_pref_set_at)
              VALUES ($1, 'recovery@example.test', 'Recovery Tester', now(), 'zh-Hans-MY', now())`,
        [SUBJECT],
      ),
    );
    const saved = await readAsApi();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.locale_pref).toBe('zh-Hans-MY');
    expect(saved[0]?.set_at).not.toBeNull();

    // The real Downs, newest first, as the migrator (local and CI only; R15 b).
    expect(await runMigrations({ databaseUrl: db.urls.migrator, direction: 'down', count: 2 })).toEqual([
      EXPECTED_MIGRATION_HEAD,
      '0017_profiles_locale_pair_check',
    ]);

    // Readable, unchanged to the microsecond: SELECT never depended on 0018.
    expect(await readAsApi()).toEqual(saved);
    // Not writable: either column, and the command's own statement, are 42501 again.
    for (const sql of [
      `UPDATE app.profiles SET locale_pref = 'en-MY' WHERE id = $1`,
      `UPDATE app.profiles SET locale_pref_set_at = now() WHERE id = $1`,
    ]) {
      expect(await sqlState(withClientAt(db.urls.api, (c) => c.query(sql, [SUBJECT]))), sql).toBe('42501');
    }
    expect(
      await sqlState(withClientAt(db.urls.api, (c) => c.query(SET_LOCALE, [SUBJECT, 'en-MY']))),
    ).toBe('42501');
    expect(await pairCheckExists()).toBe(false);
    // The refusals wrote nothing.
    expect(await readAsApi()).toEqual(saved);

    // Up again: the constraint returns over the saved row (which holds the whole
    // pair), and the API writes the preference as the command does.
    expect(await runMigrations({ databaseUrl: db.urls.migrator })).toEqual([
      '0017_profiles_locale_pair_check',
      EXPECTED_MIGRATION_HEAD,
    ]);
    expect(await pairCheckExists()).toBe(true);
    expect(await readAsApi()).toEqual(saved);

    const written = await withClientAt(db.urls.api, async (client) => {
      const { rows } = await client.query<{ locale_pref: string; locale_pref_set_at: Date }>(SET_LOCALE, [
        SUBJECT,
        'ms-MY',
      ]);
      return rows;
    });
    expect(written).toHaveLength(1);
    expect(written[0]?.locale_pref).toBe('ms-MY');
    // The instant is the new write's, later than the one saved before the rollback.
    const after = await withClientAt(db.urls.api, async (client) => {
      const { rows } = await client.query<{ locale_pref: string; later: boolean }>(
        'SELECT locale_pref, locale_pref_set_at > $2::timestamptz AS later FROM app.profiles WHERE id = $1',
        [SUBJECT, saved[0]?.set_at],
      );
      return rows;
    });
    expect(after).toEqual([{ locale_pref: 'ms-MY', later: true }]);
  });
});
