import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listAllowlist, normalizeEmail, removeAllowlistEntry } from '../src/allowlist';
import { allowlistAdd, createTestDatabase, failureIn, sqlState, withClientAt, withRollback, type TestDatabase } from './harness';

describe('M2-AC02/2 app.sign_in_allowlist is written by the migrator only, read by the API', () => {
  let db: TestDatabase;
  let migrator: pg.Pool;

  beforeAll(async () => {
    db = await createTestDatabase();
    migrator = new pg.Pool({ connectionString: db.urls.migrator, max: 2 });
  });

  afterAll(async () => {
    await migrator?.end();
    await db?.drop();
  });

  it('M2-AC02/2 the API login may SELECT the list and nothing else (42501)', async () => {
    const readable = await withClientAt(db.urls.api, async (client) => {
      const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM app.sign_in_allowlist');
      return rows[0]?.count;
    });
    expect(readable).toBe('0');

    for (const sql of [
      `INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by) VALUES ('a@b.co', 'r', 'api')`,
      `UPDATE app.sign_in_allowlist SET reason = 'changed'`,
      `DELETE FROM app.sign_in_allowlist`,
    ]) {
      expect(await sqlState(withClientAt(db.urls.api, (c) => c.query(sql))), sql).toBe('42501');
    }
    // The worker has no USAGE on schema app at all.
    expect(
      await sqlState(withClientAt(db.urls.worker, (c) => c.query('SELECT * FROM app.sign_in_allowlist'))),
    ).toBe('42501');
  });

  it('M2-AC02/2 the CHECK refuses an empty or not-already-lower-cased email_norm (23514)', async () => {
    await withRollback(migrator, async (client) => {
      for (const email of ['', 'Tester@Example.com', 'TESTER@example.com']) {
        const failure = await failureIn(client, () =>
          client.query(`INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by) VALUES ($1, 'r', 'operator')`, [
            email,
          ]),
        );
        expect({ email, code: failure?.code, constraint: failure?.constraint }).toEqual({
          email,
          code: '23514',
          constraint: 'sign_in_allowlist_email_norm_check',
        });
      }
      // reason and added_by are NOT NULL: an unaudited row cannot be written.
      for (const column of ['reason', 'added_by']) {
        const failure = await failureIn(client, () =>
          client.query(
            `INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by)
             VALUES ('tester@example.com', ${column === 'reason' ? 'NULL' : `'r'`}, ${column === 'added_by' ? 'NULL' : `'operator'`})`,
          ),
        );
        expect({ column, code: failure?.code }).toEqual({ column, code: '23502' });
      }
    });
  });

  it('M2-AC02/2 add, list and remove as the migrator, with the reason and the author kept on the row', async () => {
    const added = await allowlistAdd(db, {
      email: 'Tester.One@Example.COM',
      reason: 'M2-02 internal tester',
      addedBy: 'founder',
    });
    expect(added.outcome).toBe('added');
    expect(added.entry).toMatchObject({
      emailNorm: 'tester.one@example.com',
      reason: 'M2-02 internal tester',
      addedBy: 'founder',
    });

    // Adding the same address again replaces the reason and the author.
    const again = await allowlistAdd(db, { email: 'tester.one@example.com', reason: 'renewed', addedBy: 'operator' });
    expect(again.outcome).toBe('updated');
    expect(again.entry).toMatchObject({ emailNorm: 'tester.one@example.com', reason: 'renewed', addedBy: 'operator' });

    await allowlistAdd(db, { email: 'another@example.com', reason: 'second tester', addedBy: 'founder' });
    const listed = await withClientAt(db.urls.migrator, (client) => listAllowlist(client));
    expect(listed.map((entry) => entry.emailNorm)).toEqual(['another@example.com', 'tester.one@example.com']);
    // The API sees exactly the same rows.
    const seenByApi = await withClientAt(db.urls.api, (client) => listAllowlist(client));
    expect(seenByApi.map((entry) => entry.emailNorm)).toEqual(listed.map((entry) => entry.emailNorm));

    const removed = await withClientAt(db.urls.migrator, (client) =>
      removeAllowlistEntry(client, { email: ' TESTER.one@example.com ' }),
    );
    expect(removed).toMatchObject({ emailNorm: 'tester.one@example.com', outcome: 'removed' });
    const absent = await withClientAt(db.urls.migrator, (client) =>
      removeAllowlistEntry(client, { email: 'tester.one@example.com' }),
    );
    expect(absent).toEqual({ emailNorm: 'tester.one@example.com', outcome: 'absent' });
    expect((await withClientAt(db.urls.migrator, (client) => listAllowlist(client))).map((e) => e.emailNorm)).toEqual([
      'another@example.com',
    ]);
    await withClientAt(db.urls.migrator, (client) => client.query('DELETE FROM app.sign_in_allowlist'));
  });

  it('M2-AC02/2 a non-ASCII upper-case letter is lower-cased on the way in, whatever the cluster locale folds', async () => {
    // The table CHECK (email_norm = lower(email_norm)) is the cluster's LC_CTYPE,
    // and both clusters this repository creates are initdb'd with --locale=C, where
    // lower() folds ASCII only — so the CHECK would accept 'teÄster@…' on this
    // machine and refuse it on a UTF-8 cluster. The guarantee is therefore the JS
    // normal form on every write path, which lower-cases the whole Unicode range:
    // no row the CLI or the API writes can differ from what the gate compares.
    const added = await allowlistAdd(db, { email: 'TeÄSTER@Example.test', reason: 'umlaut', addedBy: 'founder' });
    expect(added.entry.emailNorm).toBe('teäster@example.test');
    expect(added.entry.emailNorm).toBe(normalizeEmail('TeÄSTER@Example.test'));

    // The gate finds it by the same normal form, and a second spelling is the same row.
    const second = await allowlistAdd(db, { email: '  teÄster@example.TEST ', reason: 'again', addedBy: 'operator' });
    expect(second.outcome).toBe('updated');
    const found = await withClientAt(db.urls.api, async (client) => {
      const { rows } = await client.query<{ email_norm: string }>(
        'SELECT email_norm FROM app.sign_in_allowlist WHERE email_norm = $1',
        [normalizeEmail('TEÄSTER@EXAMPLE.TEST')],
      );
      return rows[0]?.email_norm;
    });
    expect(found).toBe('teäster@example.test');
    await withClientAt(db.urls.migrator, (client) => client.query('DELETE FROM app.sign_in_allowlist'));
  });

  it('M2-AC02/2 a full-width, mixed-case, padded address becomes one row the primary key recognises', async () => {
    // U+FF2A FULLWIDTH LATIN CAPITAL LETTER J.
    const pasted = 'Ｊohn.Doe+x@Example.COM ';
    const added = await allowlistAdd(db, { email: pasted, reason: 'pasted from a message', addedBy: 'founder' });
    expect(added.entry.emailNorm).toBe('john.doe+x@example.com');
    expect(added.entry.emailNorm).toBe(normalizeEmail(pasted));

    // The same address in a second spelling updates the one row instead of adding another.
    const second = await allowlistAdd(db, { email: 'JOHN.DOE+X@example.com', reason: 'again', addedBy: 'operator' });
    expect(second.outcome).toBe('updated');
    expect((await withClientAt(db.urls.migrator, (client) => listAllowlist(client))).length).toBe(1);

    // And the gate's own lookup finds it by the same normal form.
    const found = await withClientAt(db.urls.api, async (client) => {
      const { rows } = await client.query<{ email_norm: string }>(
        'SELECT email_norm FROM app.sign_in_allowlist WHERE email_norm = $1',
        [normalizeEmail(' john.DOE+x@EXAMPLE.com')],
      );
      return rows[0]?.email_norm;
    });
    expect(found).toBe('john.doe+x@example.com');
    await withClientAt(db.urls.migrator, (client) => client.query('DELETE FROM app.sign_in_allowlist'));
  });
});
