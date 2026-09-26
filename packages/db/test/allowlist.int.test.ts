import { createHash } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InvalidEmailError, addAllowlistEntry, listAllowlist, normalizeEmail, removeAllowlistEntry } from '../src/allowlist';
import { ROLES } from '../src/roles';
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
      removeAllowlistEntry(client, { email: ' TESTER.one@example.com ', reason: 'left the team', by: 'founder' }),
    );
    expect(removed).toMatchObject({ emailNorm: 'tester.one@example.com', outcome: 'removed' });
    const absent = await withClientAt(db.urls.migrator, (client) =>
      removeAllowlistEntry(client, { email: 'tester.one@example.com', reason: 'again', by: 'founder' }),
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

    // The gate finds it by the same normal form, and a second spelling is the same
    // row — including the DECOMPOSED spelling of the same letter, which is what NFC
    // is for: `A` + U+0308 COMBINING DIAERESIS is the same mailbox as U+00C4.
    const second = await allowlistAdd(db, { email: '  teÄster@example.TEST ', reason: 'again', addedBy: 'operator' });
    expect(second.outcome).toBe('updated');
    const found = await withClientAt(db.urls.api, async (client) => {
      const { rows } = await client.query<{ email_norm: string }>(
        'SELECT email_norm FROM app.sign_in_allowlist WHERE email_norm = $1',
        [normalizeEmail('TEÄSTER@EXAMPLE.TEST')],
      );
      return rows[0]?.email_norm;
    });
    expect(found).toBe('teäster@example.test');
    expect((await withClientAt(db.urls.migrator, (client) => listAllowlist(client))).length).toBe(1);
    await withClientAt(db.urls.migrator, (client) => client.query('DELETE FROM app.sign_in_allowlist'));
  });

  it('M2-AC02/2 the CLI stores the NFC form, so a look-alike non-ASCII address is its own row and never borrows the ASCII one', async () => {
    // NFC, not NFKC (R5 rev 3). Under NFKC the full-width `Ｊ` and the `ﬁ`
    // ligature would fold onto the ASCII spelling, and listing `john.doe+x@…`
    // would admit a different mailbox. Under NFC each is listed, or not, on its own.
    const ascii = await allowlistAdd(db, { email: ' John.Doe+x@Example.COM ', reason: 'ascii', addedBy: 'founder' });
    expect(ascii.entry.emailNorm).toBe('john.doe+x@example.com');

    // U+FF2A FULLWIDTH LATIN CAPITAL LETTER J, pasted from a message.
    const pasted = 'Ｊohn.Doe+x@Example.COM ';
    const lookAlike = await allowlistAdd(db, { email: pasted, reason: 'pasted from a message', addedBy: 'founder' });
    // The CLI stores the NFC form: trimmed and lower-cased, the code point intact.
    expect(lookAlike.entry.emailNorm).toBe('ｊohn.doe+x@example.com');
    expect(lookAlike.entry.emailNorm).toBe(normalizeEmail(pasted));
    // A row of its own, not an update of the ASCII one.
    expect(lookAlike.outcome).toBe('added');
    expect((await withClientAt(db.urls.migrator, (client) => listAllowlist(client))).length).toBe(2);

    // The gate's own lookup separates them: the ASCII key finds the ASCII row only.
    const found = await withClientAt(db.urls.api, async (client) => {
      const { rows } = await client.query<{ email_norm: string }>(
        'SELECT email_norm FROM app.sign_in_allowlist WHERE email_norm = $1',
        [normalizeEmail(' john.DOE+x@EXAMPLE.com')],
      );
      return rows.map((row) => row.email_norm);
    });
    expect(found).toEqual(['john.doe+x@example.com']);

    // And an address nobody listed stays unlisted, however much it looks like one
    // that is: U+FB01 LATIN SMALL LIGATURE FI against a listed `afile@…`.
    await allowlistAdd(db, { email: 'afile@example.com', reason: 'ascii', addedBy: 'founder' });
    const ligature = await withClientAt(db.urls.api, async (client) => {
      const { rows } = await client.query<{ email_norm: string }>(
        'SELECT email_norm FROM app.sign_in_allowlist WHERE email_norm = $1',
        [normalizeEmail('Aﬁle@Example.com')],
      );
      return rows.map((row) => row.email_norm);
    });
    expect(ligature, 'a ligature address does not match a listed ASCII one').toEqual([]);

    await withClientAt(db.urls.migrator, (client) => client.query('DELETE FROM app.sign_in_allowlist'));
  });
});

/**
 * Since M2-03 every allow-list change writes its audit row in the same statement,
 * and the row names the address only by its sha256 (M2-03 code review R3, R6).
 */
describe('M2-AC03/3 allow-list changes are audited, pseudonymously, in the same statement', () => {
  let db: TestDatabase;
  let migrator: pg.Pool;

  const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

  const auditRows = async () =>
    (
      await migrator.query<{
        recorded_by: string;
        actor_kind: string;
        actor_user_id: string | null;
        actor_label: string;
        context_org_id: string | null;
        action: string;
        target_type: string;
        target_id: string;
        outcome: string;
        reason: string;
        summary: unknown;
        request_id: string | null;
        session_ref: string | null;
      }>(
        `SELECT recorded_by::text AS recorded_by, actor_kind, actor_user_id, actor_label, context_org_id, action,
                target_type, target_id, outcome, reason, summary, request_id, session_ref
           FROM app.audit_log WHERE action LIKE 'allowlist.%' ORDER BY id`,
      )
    ).rows;

  beforeAll(async () => {
    db = await createTestDatabase();
    migrator = new pg.Pool({ connectionString: db.urls.migrator, max: 2 });
  });

  afterAll(async () => {
    await migrator?.end();
    await db?.drop();
  });

  it('M2-AC03/3 add, re-add and remove each write one bootstrap row whose target is the sha256 of the normal form, and removing nothing writes nothing', async () => {
    const email = ' Audit.Tester@Example.TEST ';
    const norm = 'audit.tester@example.test';
    await withClientAt(db.urls.migrator, (client) =>
      addAllowlistEntry(client, { email, reason: 'new tester', addedBy: 'founder' }),
    );
    await withClientAt(db.urls.migrator, (client) =>
      addAllowlistEntry(client, { email: norm, reason: 'renewed', addedBy: 'operator' }),
    );
    await withClientAt(db.urls.migrator, (client) =>
      removeAllowlistEntry(client, { email, reason: 'left the pilot', by: 'founder' }),
    );
    const absent = await withClientAt(db.urls.migrator, (client) =>
      removeAllowlistEntry(client, { email, reason: 'twice', by: 'founder' }),
    );
    expect(absent.outcome).toBe('absent');

    const common = {
      recorded_by: ROLES.migrator,
      actor_kind: 'bootstrap',
      actor_user_id: null,
      context_org_id: null,
      target_type: 'sign_in_allowlist',
      target_id: sha256(norm),
      outcome: 'allowed',
      summary: null,
      request_id: null,
      session_ref: null,
    };
    expect(await auditRows()).toEqual([
      { ...common, action: 'allowlist.add', actor_label: 'founder', reason: 'new tester' },
      { ...common, action: 'allowlist.add', actor_label: 'operator', reason: 'renewed' },
      { ...common, action: 'allowlist.remove', actor_label: 'founder', reason: 'left the pilot' },
    ]);
    expect(sha256(norm)).toMatch(/^[0-9a-f]{64}$/);

    // No spelling of the address, local part included, is anywhere in the log.
    const { rows } = await migrator.query<{ row: string }>(`SELECT row_to_json(a)::text AS row FROM app.audit_log a`);
    const text = rows.map((row) => row.row).join('\n').toLowerCase();
    expect(text).not.toContain('audit.tester');
    expect(text).not.toContain('example.test');
    expect(text).not.toContain('@');
  });

  it('M2-AC03/3 an address in --by or --reason is refused by the library too, and nothing is written', async () => {
    const before = (await auditRows()).length;
    for (const author of [
      { reason: 'r', addedBy: 'founder@example.test' },
      { reason: 'asked by boss@example.test', addedBy: 'founder' },
    ]) {
      await expect(
        withClientAt(db.urls.migrator, (client) =>
          addAllowlistEntry(client, { email: 'someone@example.test', ...author }),
        ),
      ).rejects.toBeInstanceOf(InvalidEmailError);
    }
    await expect(
      withClientAt(db.urls.migrator, (client) =>
        removeAllowlistEntry(client, { email: 'someone@example.test', reason: 'r', by: 'founder@example.test' }),
      ),
    ).rejects.toThrow(/--by\) may not contain "@"/);
    expect((await auditRows()).length).toBe(before);
    expect(await withClientAt(db.urls.migrator, (client) => listAllowlist(client))).toEqual([]);
  });

  it('M2-AC03/3 an allow-list change cannot be written without its audit row (a planted trigger refuses the audit insert)', async () => {
    await withClientAt(db.urls.migrator, (client) =>
      addAllowlistEntry(client, { email: 'kept@example.test', reason: 'before the trigger', addedBy: 'founder' }),
    );
    await migrator.query(`CREATE FUNCTION ops.wringy_test_refuse_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit insert refused by the test';
      END
      $$`);
    await migrator.query(`CREATE TRIGGER wringy_test_refuse_audit BEFORE INSERT ON app.audit_log
                            FOR EACH ROW EXECUTE FUNCTION ops.wringy_test_refuse_audit()`);
    try {
      await expect(
        withClientAt(db.urls.migrator, (client) =>
          addAllowlistEntry(client, { email: 'refused@example.test', reason: 'r', addedBy: 'founder' }),
        ),
      ).rejects.toThrow(/audit insert refused by the test/);
      await expect(
        withClientAt(db.urls.migrator, (client) =>
          removeAllowlistEntry(client, { email: 'kept@example.test', reason: 'r', by: 'founder' }),
        ),
      ).rejects.toThrow(/audit insert refused by the test/);
    } finally {
      await migrator.query('DROP TRIGGER wringy_test_refuse_audit ON app.audit_log');
      await migrator.query('DROP FUNCTION ops.wringy_test_refuse_audit()');
    }
    const listed = await withClientAt(db.urls.migrator, (client) => listAllowlist(client));
    expect(listed.map((entry) => entry.emailNorm)).toEqual(['kept@example.test']);
  });
});
