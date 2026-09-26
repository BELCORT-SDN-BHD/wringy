import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, failureIn, seedFixtures, withClientAt, withRollback, type TestDatabase } from './harness';

/**
 * Organisations, memberships, invitations and the audit log at the database
 * level (migrations 0011–0016; M2-03 code review R1, R3, R7, R13 *db int*).
 *
 * The composition refusals run as the migrator inside a rolled-back
 * transaction, so what they prove is the constraint and not a missing privilege
 * (the owner holds every privilege). The command shapes of R5 and R7 — creating
 * an org, the admin membership, the invitation, the re-activation upsert, the
 * row locks — run as `wringy_api_login`, so they also prove the column grants
 * are enough for them.
 */

const ALICE = '0a11ce00-0000-4000-8000-00000000d001';
const BOB = '0b0b0000-0000-4000-8000-00000000d002';
const CAROL = '0ca70100-0000-4000-8000-00000000d003';
const DAVE = '0da4e000-0000-4000-8000-00000000d004';

const TOKEN_HASH_A = 'a'.repeat(64);
const TOKEN_HASH_B = 'b'.repeat(64);
const TOKEN_HASH_C = 'c'.repeat(64);

/** What `POST /orgs` writes as the API (R1, R2): name and creator; id and data_origin are the database's. */
const CREATE_ORG = `INSERT INTO app.orgs (name, created_by) VALUES ($1, $2)
                    RETURNING id, data_origin, created_by, created_at, updated_at`;

/** The creator's admin membership, written by the same command. */
const CREATOR_MEMBERSHIP = `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, granted_by)
                            VALUES ($1, $2, 'admin', 'org_created', $2)`;

/**
 * What `POST /orgs/:orgId/invitations` writes as the API (R7). The lifetime is
 * bound as an integer: 7 is INVITATION_LIFETIME_DAYS of packages/contracts
 * (ruling D2), which packages/db may not import.
 */
const CREATE_INVITATION = `INSERT INTO app.org_invitations (org_id, invited_by, invitee_email_norm, role, token_hash, expires_at)
                           VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6))
                           RETURNING id, created_at, expires_at`;

/** R7's accept upsert, verbatim in shape: it re-activates a removed row and never rewrites an active one. */
const ACCEPT_UPSERT = `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, invitation_id, granted_by)
                       VALUES ($1, $2, $3, 'invitation', $4, $5)
                       ON CONFLICT (org_id, user_id) DO UPDATE
                         SET status = 'active', role = excluded.role, grant_basis = 'invitation',
                             invitation_id = excluded.invitation_id, granted_by = excluded.granted_by,
                             granted_at = now(), removed_by = NULL, removed_at = NULL, removal_basis = NULL
                         WHERE app.org_members.status = 'removed'
                       RETURNING org_id, user_id, role, status, grant_basis, invitation_id, removed_at`;

describe('M2-AC03 organisations, memberships and invitations in PostgreSQL', () => {
  let db: TestDatabase;
  let migrator: pg.Pool;
  let api: pg.Pool;
  /** Alice's org and Bob's org, created through the API's own statements. */
  let orgA = '';
  let orgB = '';

  beforeAll(async () => {
    db = await createTestDatabase();
    migrator = new pg.Pool({ connectionString: db.urls.migrator, max: 2 });
    api = new pg.Pool({ connectionString: db.urls.api, max: 2 });

    for (const [id, name] of [
      [ALICE, 'alice'],
      [BOB, 'bob'],
      [CAROL, 'carol'],
      [DAVE, 'dave'],
    ] as const) {
      await migrator.query(
        `INSERT INTO app.profiles (id, contact_email, display_name, last_sign_in_at) VALUES ($1, $2, $3, now())`,
        [id, `${name}@example.test`, name],
      );
    }
    const create = async (name: string, creator: string) =>
      withClientAt(db.urls.api, async (client) => {
        await client.query('BEGIN');
        const { rows } = await client.query<{ id: string }>(CREATE_ORG, [name, creator]);
        const id = rows[0]!.id;
        await client.query(CREATOR_MEMBERSHIP, [id, creator]);
        await client.query('COMMIT');
        return id;
      });
    orgA = await create('Alice Studio', ALICE);
    orgB = await create('Bob Retail', BOB);
  });

  afterAll(async () => {
    await api?.end();
    await migrator?.end();
    await db?.drop();
  });

  it('M2-AC03/1 an org the API creates is live with a database-chosen id, its creator recorded, and its admin membership is org_created', async () => {
    const { rows } = await migrator.query<{
      data_origin: string;
      created_by: string;
      role: string;
      status: string;
      grant_basis: string;
      granted_by: string;
      invitation_id: string | null;
      creator_ref: string;
    }>(
      `SELECT o.data_origin, o.created_by, m.role, m.status, m.grant_basis, m.granted_by, m.invitation_id, m.creator_ref
         FROM app.orgs o JOIN app.org_members m ON m.org_id = o.id WHERE o.id = $1`,
      [orgA],
    );
    expect(rows).toEqual([
      {
        data_origin: 'live',
        created_by: ALICE,
        role: 'admin',
        status: 'active',
        grant_basis: 'org_created',
        granted_by: ALICE,
        invitation_id: null,
        creator_ref: ALICE,
      },
    ]);
    // A rename as the API stamps updated_at through the trigger.
    await withRollback(api, async (client) => {
      const before = await client.query<{ updated_at: Date }>('SELECT updated_at FROM app.orgs WHERE id = $1', [orgA]);
      await client.query(`SELECT pg_sleep(0.01)`);
      const { rows: renamed } = await client.query<{ name: string; updated_at: Date; db_now: Date }>(
        `UPDATE app.orgs SET name = 'Alice Studio Renamed' WHERE id = $1 RETURNING name, updated_at, now() AS db_now`,
        [orgA],
      );
      expect(renamed[0]?.name).toBe('Alice Studio Renamed');
      expect(renamed[0]?.updated_at).toEqual(renamed[0]?.db_now);
      expect(renamed[0]!.updated_at.getTime()).toBeGreaterThanOrEqual(before.rows[0]!.updated_at.getTime());
    });
  });

  it('M2-AC03/1 an org_created row can exist only for the creator of that org (23503 org_members_creator_fkey)', async () => {
    await withRollback(migrator, async (client) => {
      // Carol claims to have created Alice's org.
      const failure = await failureIn(client, () =>
        client.query(
          `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, granted_by)
           VALUES ($1, $2, 'admin', 'org_created', $2)`,
          [orgA, CAROL],
        ),
      );
      expect({ code: failure?.code, constraint: failure?.constraint }).toEqual({
        code: '23503',
        constraint: 'org_members_creator_fkey',
      });
    });
  });

  it('M2-AC03/1 an org_created row granted by somebody else is refused (23514 org_members_org_created_self_check)', async () => {
    await withRollback(migrator, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO app.orgs (name, created_by) VALUES ('Carol Studio', $1) RETURNING id`,
        [CAROL],
      );
      const failure = await failureIn(client, () =>
        client.query(
          `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, granted_by)
           VALUES ($1, $2, 'admin', 'org_created', $3)`,
          [rows[0]!.id, CAROL, DAVE],
        ),
      );
      expect({ code: failure?.code, constraint: failure?.constraint }).toEqual({
        code: '23514',
        constraint: 'org_members_org_created_self_check',
      });
    });
  });

  it('M2-AC03/1 a membership needs a grant record: an invitation row without an invitation, or an org_created row with one, is refused (23514 org_members_invitation_basis_check)', async () => {
    await withRollback(migrator, async (client) => {
      const invitation = await client.query<{ id: string }>(CREATE_INVITATION, [
        orgA,
        ALICE,
        'carol@example.test',
        'member',
        TOKEN_HASH_A,
        7,
      ]);
      for (const [label, sql, params] of [
        [
          'invitation basis, no invitation',
          `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, granted_by)
           VALUES ($1, $2, 'member', 'invitation', $3)`,
          [orgA, CAROL, ALICE],
        ],
        [
          'org_created basis with an invitation',
          `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, invitation_id, granted_by)
           VALUES ($1, $2, 'admin', 'org_created', $3, $2)`,
          [orgA, ALICE, invitation.rows[0]!.id],
        ],
      ] as const) {
        const failure = await failureIn(client, () => client.query(sql, [...params]));
        expect({ label, code: failure?.code, constraint: failure?.constraint }).toEqual({
          label,
          code: '23514',
          constraint: 'org_members_invitation_basis_check',
        });
      }
    });
  });

  it('M2-AC03/2 an invitation of org A cannot back a membership of org B (23503 org_members_invitation_fkey)', async () => {
    await withRollback(migrator, async (client) => {
      const invitation = await client.query<{ id: string }>(CREATE_INVITATION, [
        orgA,
        ALICE,
        'carol@example.test',
        'member',
        TOKEN_HASH_A,
        7,
      ]);
      const failure = await failureIn(client, () =>
        client.query(
          `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, invitation_id, granted_by)
           VALUES ($1, $2, 'member', 'invitation', $3, $4)`,
          [orgB, CAROL, invitation.rows[0]!.id, BOB],
        ),
      );
      expect({ code: failure?.code, constraint: failure?.constraint }).toEqual({
        code: '23503',
        constraint: 'org_members_invitation_fkey',
      });
      // The same invitation backs a membership of its own org.
      expect(
        await failureIn(client, () =>
          client.query(
            `INSERT INTO app.org_members (org_id, user_id, role, grant_basis, invitation_id, granted_by)
             VALUES ($1, $2, 'member', 'invitation', $3, $4)`,
            [orgA, CAROL, invitation.rows[0]!.id, ALICE],
          ),
        ),
      ).toBeUndefined();
    });
  });

  it('M2-AC03/2 an invitation whose inviter is not a member of that org is refused (23503 org_invitations_inviter_fkey)', async () => {
    await withRollback(migrator, async (client) => {
      // Bob is an admin of org B, not a member of org A.
      const failure = await failureIn(client, () =>
        client.query(CREATE_INVITATION, [orgA, BOB, 'carol@example.test', 'admin', TOKEN_HASH_A, 7]),
      );
      expect({ code: failure?.code, constraint: failure?.constraint }).toEqual({
        code: '23503',
        constraint: 'org_invitations_inviter_fkey',
      });
    });
  });

  it('M2-AC03/2 removal fields are all set or none, and invitation states carry exactly their fields (23514)', async () => {
    await withRollback(migrator, async (client) => {
      for (const [label, sql, constraint] of [
        [
          'removed without who and why',
          `UPDATE app.org_members SET status = 'removed', removed_at = now() WHERE org_id = $1 AND user_id = $2`,
          'org_members_removal_check',
        ],
        [
          'removed without a basis',
          `UPDATE app.org_members SET status = 'removed', removed_at = now(), removed_by = $2 WHERE org_id = $1 AND user_id = $2`,
          'org_members_removal_check',
        ],
        [
          'active with removal fields',
          `UPDATE app.org_members SET removed_at = now(), removed_by = $2, removal_basis = 'left' WHERE org_id = $1 AND user_id = $2`,
          'org_members_removal_check',
        ],
      ] as const) {
        const failure = await failureIn(client, () => client.query(sql, [orgA, ALICE]));
        expect({ label, code: failure?.code, constraint: failure?.constraint }).toEqual({
          label,
          code: '23514',
          constraint,
        });
      }
      // All three together, with status, is a removal.
      expect(
        await failureIn(client, () =>
          client.query(
            `UPDATE app.org_members SET status = 'removed', removed_at = now(), removed_by = $2, removal_basis = 'left'
              WHERE org_id = $1 AND user_id = $2`,
            [orgA, ALICE],
          ),
        ),
      ).toBeUndefined();

      const invitation = await client.query<{ id: string }>(CREATE_INVITATION, [
        orgB,
        BOB,
        'dave@example.test',
        'member',
        TOKEN_HASH_B,
        7,
      ]);
      const id = invitation.rows[0]!.id;
      for (const [label, sql, constraint] of [
        ['accepted with no acceptor', `UPDATE app.org_invitations SET status = 'accepted', accepted_at = now() WHERE id = $1`, 'org_invitations_accepted_check'],
        ['pending with an acceptor', `UPDATE app.org_invitations SET accepted_at = now(), accepted_by = '${DAVE}' WHERE id = $1`, 'org_invitations_accepted_check'],
        ['revoked with no revoker', `UPDATE app.org_invitations SET status = 'revoked', revoked_at = now() WHERE id = $1`, 'org_invitations_revoked_check'],
        ['an upper-case address', `UPDATE app.org_invitations SET invitee_email_norm = 'Dave@example.test' WHERE id = $1`, 'org_invitations_email_norm_check'],
        ['an empty address', `UPDATE app.org_invitations SET invitee_email_norm = '' WHERE id = $1`, 'org_invitations_email_norm_check'],
        ['a token hash that is not sha256 hex', `UPDATE app.org_invitations SET token_hash = upper(token_hash) WHERE id = $1`, 'org_invitations_token_hash_check'],
        ['a role outside the domain', `UPDATE app.org_invitations SET role = 'owner' WHERE id = $1`, 'org_invitations_role_check'],
      ] as const) {
        const failure = await failureIn(client, () => client.query(sql, [id]));
        expect({ label, code: failure?.code, constraint: failure?.constraint }).toEqual({
          label,
          code: '23514',
          constraint,
        });
      }
    });
  });

  it('M2-AC03/1 one pending invitation per address and org; a revoked one frees the address (23505 org_invitations_pending_address_key)', async () => {
    await withRollback(api, async (client) => {
      const first = await client.query<{ id: string }>(CREATE_INVITATION, [
        orgA,
        ALICE,
        'dave@example.test',
        'member',
        TOKEN_HASH_A,
        7,
      ]);
      const failure = await failureIn(client, () =>
        client.query(CREATE_INVITATION, [orgA, ALICE, 'dave@example.test', 'admin', TOKEN_HASH_B, 7]),
      );
      expect({ code: failure?.code, constraint: failure?.constraint }).toEqual({
        code: '23505',
        constraint: 'org_invitations_pending_address_key',
      });
      // The same address may be pending in another org at the same time.
      expect(
        await failureIn(client, () =>
          client.query(CREATE_INVITATION, [orgB, BOB, 'dave@example.test', 'member', TOKEN_HASH_C, 7]),
        ),
      ).toBeUndefined();
      // Revoking the first (what create does to an expired pending one) frees the address in org A.
      await client.query(
        `UPDATE app.org_invitations SET status = 'revoked', revoked_by = $2, revoked_at = now() WHERE id = $1`,
        [first.rows[0]!.id, ALICE],
      );
      expect(
        await failureIn(client, () =>
          client.query(CREATE_INVITATION, [orgA, ALICE, 'dave@example.test', 'admin', TOKEN_HASH_B, 7]),
        ),
      ).toBeUndefined();
    });
  });

  it('M2-AC03/1 an invitation expires INVITATION_LIFETIME_DAYS (7) after it is created, bound through make_interval(days => $n)', async () => {
    await withRollback(api, async (client) => {
      const { rows } = await client.query<{ id: string; created_at: Date; expires_at: Date }>(CREATE_INVITATION, [
        orgA,
        ALICE,
        'carol@example.test',
        'member',
        TOKEN_HASH_A,
        7,
      ]);
      const { rows: lifetime } = await client.query<{ lifetime: string }>(
        `SELECT (expires_at - created_at)::text AS lifetime FROM app.org_invitations WHERE id = $1`,
        [rows[0]!.id],
      );
      expect(lifetime[0]?.lifetime).toBe('7 days');
      expect(rows[0]!.expires_at.getTime() - rows[0]!.created_at.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  it('M2-AC03/1 the accept upsert as the API re-activates a removed membership and returns no row for an active one', async () => {
    await withRollback(api, async (client) => {
      // Carol joins org A through an invitation.
      const first = await client.query<{ id: string }>(CREATE_INVITATION, [
        orgA,
        ALICE,
        'carol@example.test',
        'member',
        TOKEN_HASH_A,
        7,
      ]);
      const joined = await client.query(ACCEPT_UPSERT, [orgA, CAROL, 'member', first.rows[0]!.id, ALICE]);
      expect(joined.rows).toEqual([
        {
          org_id: orgA,
          user_id: CAROL,
          role: 'member',
          status: 'active',
          grant_basis: 'invitation',
          invitation_id: first.rows[0]!.id,
          removed_at: null,
        },
      ]);
      await client.query(
        `UPDATE app.org_invitations SET status = 'accepted', accepted_by = $2, accepted_at = now() WHERE id = $1`,
        [first.rows[0]!.id, CAROL],
      );

      // An admin removes her; the row stays, removed.
      await client.query(
        `UPDATE app.org_members SET status = 'removed', removed_by = $3, removed_at = now(), removal_basis = 'removed_by_admin'
          WHERE org_id = $1 AND user_id = $2`,
        [orgA, CAROL, ALICE],
      );

      // A new invitation, accepted: the same row is active again, as an admin this time.
      const second = await client.query<{ id: string }>(CREATE_INVITATION, [
        orgA,
        ALICE,
        'carol@example.test',
        'admin',
        TOKEN_HASH_B,
        7,
      ]);
      const rejoined = await client.query(ACCEPT_UPSERT, [orgA, CAROL, 'admin', second.rows[0]!.id, ALICE]);
      expect(rejoined.rows).toEqual([
        {
          org_id: orgA,
          user_id: CAROL,
          role: 'admin',
          status: 'active',
          grant_basis: 'invitation',
          invitation_id: second.rows[0]!.id,
          removed_at: null,
        },
      ]);

      // On an active row the WHERE holds nothing back: no row, nothing rewritten.
      await client.query(
        `UPDATE app.org_invitations SET status = 'accepted', accepted_by = $2, accepted_at = now() WHERE id = $1`,
        [second.rows[0]!.id, CAROL],
      );
      const third = await client.query<{ id: string }>(CREATE_INVITATION, [
        orgA,
        ALICE,
        'carol@example.test',
        'member',
        TOKEN_HASH_C,
        7,
      ]);
      const again = await client.query(ACCEPT_UPSERT, [orgA, CAROL, 'member', third.rows[0]!.id, ALICE]);
      expect(again.rowCount).toBe(0);
      expect(again.rows).toEqual([]);
      const { rows: unchanged } = await client.query(
        `SELECT role, invitation_id FROM app.org_members WHERE org_id = $1 AND user_id = $2`,
        [orgA, CAROL],
      );
      expect(unchanged).toEqual([{ role: 'admin', invitation_id: second.rows[0]!.id }]);
    });
  });

  it('M2-AC03/2 the API can take the org row lock FOR NO KEY UPDATE, then an invitation and a member row FOR UPDATE', async () => {
    await withRollback(api, async (client) => {
      const invitation = await client.query<{ id: string }>(CREATE_INVITATION, [
        orgA,
        ALICE,
        'dave@example.test',
        'member',
        TOKEN_HASH_A,
        7,
      ]);
      // R5's one global order: the org row first, then the target rows.
      const org = await client.query('SELECT id FROM app.orgs WHERE id = $1 FOR NO KEY UPDATE', [orgA]);
      expect(org.rows).toEqual([{ id: orgA }]);
      const locked = await client.query('SELECT status FROM app.org_invitations WHERE id = $1 FOR UPDATE', [
        invitation.rows[0]!.id,
      ]);
      expect(locked.rows).toEqual([{ status: 'pending' }]);
      const member = await client.query(
        'SELECT role FROM app.org_members WHERE org_id = $1 AND user_id = $2 FOR UPDATE',
        [orgA, ALICE],
      );
      expect(member.rows).toEqual([{ role: 'admin' }]);
      // Holding the org lock, the API still reads the capability tables (SELECT only, never locked).
      await client.query('SELECT 1 FROM app.admin_scopes WHERE org_id = $1', [orgA]);
      await client.query('SELECT 1 FROM app.platform_grants WHERE user_id = $1', [ALICE]);
    });
  });

  it('M2-AC03/1 0011 is expand-only: the fixture seed still applies, twice, and a fixture org has no creator', async () => {
    const first = await seedFixtures(db);
    expect(first).toMatchObject({ written: 5, orgs: 2, campaigns: 3 });
    // A rerun writes nothing: the ON CONFLICT … WHERE of the seed still sees no change.
    expect(await seedFixtures(db)).toEqual({ ...first, written: 0 });
    const { rows } = await migrator.query<{ name: string; data_origin: string; created_by: string | null }>(
      `SELECT name, data_origin, created_by FROM app.orgs WHERE data_origin = 'fixture' ORDER BY name`,
    );
    expect(rows).toEqual([
      { name: 'Kopi Kita', data_origin: 'fixture', created_by: null },
      { name: 'Nusantara Fit', data_origin: 'fixture', created_by: null },
    ]);
    // A live org inserted the M2-01 way (explicit id and label, no creator) is still accepted.
    await withRollback(migrator, async (client) => {
      await client.query(
        `INSERT INTO app.orgs (id, name, data_origin) VALUES ('b0000000-0000-4000-8000-0000000000b1', 'Legacy live', 'live')`,
      );
    });
  });

  it('M2-AC03/3 the CHECKs of app.audit_log: denial code iff denied, user rows correlated, bootstrap rows labelled, noun.verb actions (23514)', async () => {
    const insert = (columns: Record<string, string | null>) => {
      const names = Object.keys(columns);
      return {
        sql: `INSERT INTO app.audit_log (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')})`,
        params: Object.values(columns),
      };
    };
    const sessionRef = 'd'.repeat(64);
    const requestId = '3e1c7a90-5b2d-4f6e-8a1b-2c3d4e5f6a7b';
    const user = {
      actor_kind: 'user',
      actor_user_id: ALICE,
      action: 'org.read',
      outcome: 'allowed',
      request_id: requestId,
      session_ref: sessionRef,
    };
    await withRollback(migrator, async (client) => {
      for (const [label, columns, constraint] of [
        ['denied without a code', { ...user, outcome: 'denied' }, 'audit_log_denial_code_check'],
        ['allowed with a code', { ...user, denial_code: 'org.forbidden' }, 'audit_log_denial_code_check'],
        ['a user row without the user', { ...user, actor_user_id: null }, 'audit_log_actor_user_check'],
        ['a system row naming a user', { ...user, actor_kind: 'system' }, 'audit_log_actor_user_check'],
        ['a user row without session_ref', { ...user, session_ref: null }, 'audit_log_user_correlation_check'],
        ['a user row without request_id', { ...user, request_id: null }, 'audit_log_user_correlation_check'],
        [
          'a bootstrap row without a label',
          { actor_kind: 'bootstrap', action: 'capability.grant', outcome: 'allowed' },
          'audit_log_bootstrap_label_check',
        ],
        ['an action without a verb', { ...user, action: 'org' }, 'audit_log_action_check'],
        ['an action in capitals', { ...user, action: 'Org.Read' }, 'audit_log_action_check'],
        ['an action with two dots', { ...user, action: 'org.read.more' }, 'audit_log_action_check'],
        ['a session id instead of its hash', { ...user, session_ref: requestId }, 'audit_log_session_ref_check'],
        ['an unknown actor kind', { ...user, actor_kind: 'admin' }, 'audit_log_actor_kind_check'],
        ['an unknown outcome', { ...user, outcome: 'maybe' }, 'audit_log_outcome_check'],
      ] as const) {
        const { sql, params } = insert(columns);
        const failure = await failureIn(client, () => client.query(sql, params));
        expect({ label, code: failure?.code, constraint: failure?.constraint }).toEqual({
          label,
          code: '23514',
          constraint,
        });
      }

      // The well-formed shapes of each actor kind are accepted.
      const accepted: Record<string, string | null>[] = [
        user,
        { ...user, outcome: 'denied', denial_code: 'org.forbidden', reason: 'not_a_member', context_org_id: orgA },
        { actor_kind: 'system', action: 'invitation.revoke', outcome: 'allowed' },
        {
          actor_kind: 'bootstrap',
          actor_label: 'founder',
          action: 'capability.grant',
          outcome: 'allowed',
          target_type: 'admin_scope',
          target_id: CAROL,
          reason: 'first reviewer',
        },
      ];
      for (const columns of accepted) {
        const { sql, params } = insert(columns);
        expect(await failureIn(client, () => client.query(sql, params))).toBeUndefined();
      }
      // recorded_by is the writing login, here the migrator.
      const { rows } = await client.query<{ recorded_by: string }>(
        `SELECT DISTINCT recorded_by::text AS recorded_by FROM app.audit_log`,
      );
      expect(rows).toEqual([{ recorded_by: 'wringy_migrator' }]);
    });
  });
});
