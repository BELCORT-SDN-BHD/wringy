/**
 * Authorisation at the edges (M2-03 code review R4, R5, R11, R13 *api int*):
 * the one answer for an outsider and an unknown org and the correlation of its
 * denial row with the request's log line; the lock order under real contention;
 * and the capability guards for the tickets that first put an action behind a
 * grant. Identities are simulated (a local key pair, the real hook); the database
 * is a real PostgreSQL 17 read by the app as `wringy_api_login`.
 *
 * **Barrier rows.** Each concurrency row holds the org row `FOR UPDATE` as the
 * migrator in an open transaction, fires both requests, waits (polling
 * `pg_stat_activity` every 25 ms, as the cluster admin: PostgreSQL shows another
 * role's `wait_event_type` only to a superuser or a `pg_read_all_stats` member,
 * which is how timeouts.int.test.ts reads it too) until both API backends wait
 * on a lock, then commits. Both requests therefore contend for the org lock at
 * the same moment, every time, inside the 4.5 s statement timeout. No request may
 * answer 500: revision 1's lock order ended these cases in a deadlock (`40P01`).
 * The ordered variant fires the requests one at a time instead, each only once the
 * one before it waits on the lock, so the order they reach the lock is fixed:
 * PostgreSQL hands a row lock to its waiters in the order they queued (the first
 * waiter holds the tuple lock, the others queue behind it).
 */
import { createHash } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cluster } from '@wringy/db/testing';

import { requireOrgCapability, requirePlatformGrant } from '../../src/authorize';
import { API_APPLICATION_NAME, API_STATEMENT_TIMEOUT_MS, createApiPool } from '../../src/database';
import { errorBody } from '../../src/errors';
import { createTestIdentity, type TestIdentity } from './jwt-support';
import {
  asMigrator,
  asOrgMember,
  auditRows,
  buildTestApi,
  createOrgAs,
  createTestDatabase,
  grantCapability,
  grantPlatform,
  logsOfRequest,
  person,
  withClientAt,
  type PersonSpec,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

const CAROL: PersonSpec = {
  userId: '0ca70100-0000-4000-8000-000000000004',
  sessionId: '5e550000-0000-4000-8000-00000000c204',
  email: 'carol@example.test',
  name: 'Carol Wong',
};
const DAVE: PersonSpec = {
  userId: '0da4e000-0000-4000-8000-000000000005',
  sessionId: '5e550000-0000-4000-8000-00000000d205',
  email: 'dave@example.test',
  name: 'Dave Raj',
};
const ERIN: PersonSpec = {
  userId: '0e410000-0000-4000-8000-000000000006',
  sessionId: '5e550000-0000-4000-8000-00000000e206',
  email: 'erin@example.test',
  name: 'Erin Lee',
};
const FRANK: PersonSpec = {
  userId: '0f4a0000-0000-4000-8000-000000000007',
  sessionId: '5e550000-0000-4000-8000-00000000f207',
  email: 'frank@example.test',
  name: 'Frank Tan',
};
const GRACE: PersonSpec = {
  userId: '06ace000-0000-4000-8000-000000000008',
  sessionId: '5e550000-0000-4000-8000-000000006208',
  email: 'grace@example.test',
  name: 'Grace Ong',
};

const UNKNOWN_ORG = 'a0000000-0000-4000-8000-00000000dead';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('M2-AC03 authorisation: one answer, one lock order, independent capabilities (simulated identities)', () => {
  let db: TestDatabase;
  let identity: TestIdentity;
  let api: TestApi;
  let carol: SignedIn;
  let dave: SignedIn;
  let erin: SignedIn;
  let frank: SignedIn;
  let grace: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    identity = await createTestIdentity();
    carol = await person(db, identity, CAROL);
    dave = await person(db, identity, DAVE);
    erin = await person(db, identity, ERIN);
    frank = await person(db, identity, FRANK);
    grace = await person(db, identity, GRACE);
    api = await buildTestApi(db.urls.api, { identity });
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  const post = (who: SignedIn, url: string, payload?: object) =>
    api.app.inject({ method: 'POST', url, headers: who.headers, ...(payload === undefined ? {} : { payload }) });
  const get = (who: SignedIn, url: string) => api.app.inject({ method: 'GET', url, headers: who.headers });

  /**
   * Holds `orgId`'s row `FOR UPDATE` as the migrator, starts `requests`, waits
   * until `requests.length` API backends wait on a lock, commits, and returns the
   * responses — all inside the API's statement timeout. With `inOrder`, each
   * request is started only once every one before it waits on the lock, so they
   * are granted it in the order given.
   */
  async function underBarrier<T>(orgId: string, requests: Array<() => Promise<T>>, { inOrder = false } = {}): Promise<T[]> {
    const barrier = new pg.Client({ connectionString: db.urls.migrator, application_name: 'wringy-test-barrier' });
    await barrier.connect();
    let open = false;
    try {
      await barrier.query('BEGIN');
      open = true;
      await barrier.query('SELECT id FROM app.orgs WHERE id = $1 FOR UPDATE', [orgId]);
      const started = Date.now();
      const waitingOnTheLock = (count: number) =>
        withClientAt(cluster().adminUrl, async (admin) => {
          for (;;) {
            const { rows } = await admin.query<{ waiting: number }>(
              `SELECT count(*)::int AS waiting FROM pg_catalog.pg_stat_activity
                WHERE datname = $1 AND application_name = $2 AND wait_event_type = 'Lock'`,
              [db.name, API_APPLICATION_NAME],
            );
            if ((rows[0]?.waiting ?? 0) >= count) return;
            if (Date.now() - started > 3_000) throw new Error('the requests never reached the org lock');
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
        });
      let pending: Promise<T[]>;
      if (inOrder) {
        const fired: Array<Promise<T>> = [];
        for (const request of requests) {
          const one = request();
          one.catch(() => {});
          fired.push(one);
          await waitingOnTheLock(fired.length);
        }
        pending = Promise.all(fired);
      } else {
        pending = Promise.all(requests.map((request) => request()));
        pending.catch(() => {});
        await waitingOnTheLock(requests.length);
      }
      await barrier.query('COMMIT');
      open = false;
      const responses = await pending;
      expect(Date.now() - started).toBeLessThan(API_STATEMENT_TIMEOUT_MS);
      return responses;
    } finally {
      if (open) await barrier.query('ROLLBACK').catch(() => {});
      await barrier.end();
    }
  }

  it('M2-AC03/2 an outsider and an unknown org get the same 403 org.forbidden; each denial row carries the request id of its log line and the sha256 of the session id', async () => {
    const orgId = await createOrgAs(api, carol, 'Correlated');
    const outsider = await get(erin, `/orgs/${orgId}`);
    const unknown = await get(erin, `/orgs/${UNKNOWN_ORG}`);
    for (const response of [outsider, unknown]) {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual(errorBody('org.forbidden'));
    }
    expect(outsider.body).toBe(unknown.body);

    const rows = [
      ...(await auditRows(db, { actorUserId: ERIN.userId, contextOrgId: orgId })),
      ...(await auditRows(db, { actorUserId: ERIN.userId, contextOrgId: UNKNOWN_ORG })),
    ];
    expect(rows.map((row) => [row.action, row.outcome, row.denial_code, row.reason, row.target_type])).toEqual([
      ['org.read', 'denied', 'org.forbidden', 'not_a_member', 'org'],
      ['org.read', 'denied', 'org.forbidden', 'org_unknown', 'org'],
    ]);
    for (const [row, url] of [
      [rows[0]!, `/orgs/${orgId}`],
      [rows[1]!, `/orgs/${UNKNOWN_ORG}`],
    ] as const) {
      expect(row).toMatchObject({ recorded_by: 'wringy_api_login', actor_kind: 'user', session_ref: sha256(ERIN.sessionId) });
      const lines = logsOfRequest(api.logs, row.request_id!);
      expect(lines.length, url).toBeGreaterThan(0);
      expect(lines.some((line) => (line.req as { url?: string } | undefined)?.url === url), url).toBe(true);
      expect(lines.some((line) => line.msg === 'request refused' && line.reason === row.reason), url).toBe(true);
      expect(JSON.stringify(row)).not.toContain(ERIN.sessionId);
    }
    // The two requests had two ids.
    expect(rows[0]!.request_id).not.toBe(rows[1]!.request_id);
  });

  it('M2-AC03/2 the denial row of a refused command survives the rollback of its transaction, and the command wrote nothing', async () => {
    const orgId = await createOrgAs(api, carol, 'Survives Rollback');
    await asOrgMember(api, carol, orgId, dave);
    const outsider = await post(erin, `/orgs/${orgId}/rename`, { name: 'Erin Was Here' });
    expect(outsider.statusCode).toBe(403);
    const member = await post(dave, `/orgs/${orgId}/invitations`, { email: 'friend@example.test', role: 'admin' });
    expect(member.statusCode).toBe(403);

    expect((await asMigrator<{ name: string }>(db, 'SELECT name FROM app.orgs WHERE id = $1', [orgId]))[0]?.name).toBe(
      'Survives Rollback',
    );
    expect(
      await asMigrator(db, `SELECT 1 FROM app.org_invitations WHERE org_id = $1 AND invitee_email_norm = 'friend@example.test'`, [
        orgId,
      ]),
    ).toEqual([]);
    const denials = await auditRows(db, { contextOrgId: orgId, outcome: 'denied' });
    expect(denials.map((row) => [row.actor_user_id, row.action, row.denial_code])).toEqual([
      [ERIN.userId, 'org.rename', 'org.forbidden'],
      [DAVE.userId, 'invitation.create', 'org.admin_required'],
    ]);
  });

  it('M2-AC03/2 barrier: A removes B while B leaves — one succeeds, the other is refused on the state the first left, and nothing answers 500', async () => {
    const orgId = await createOrgAs(api, carol, 'Barrier Remove Leave');
    await asOrgMember(api, carol, orgId, dave, 'admin');

    const [remove, leave] = await underBarrier(orgId, [
      () => post(carol, `/orgs/${orgId}/members/${DAVE.userId}/remove`),
      () => post(dave, `/orgs/${orgId}/leave`),
    ]);
    const statuses = [remove!.statusCode, leave!.statusCode];
    expect(statuses).not.toContain(500);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    const [row] = await asMigrator<{ status: string; removal_basis: string }>(
      db,
      'SELECT status, removal_basis FROM app.org_members WHERE org_id = $1 AND user_id = $2',
      [orgId, DAVE.userId],
    );
    if (remove!.statusCode === 200) {
      // Dave's leave ran second: he was no longer a member.
      expect(leave!.statusCode).toBe(403);
      expect(leave!.json()).toEqual(errorBody('org.forbidden'));
      expect(row).toEqual({ status: 'removed', removal_basis: 'removed_by_admin' });
    } else {
      // Carol's remove ran second: Dave was no longer a member of this org.
      expect(remove!.statusCode).toBe(404);
      expect(remove!.json()).toEqual(errorBody('member.not_found'));
      expect(row).toEqual({ status: 'removed', removal_basis: 'left' });
    }
    expect(await auditRows(db, { contextOrgId: orgId, outcome: 'denied' })).toHaveLength(1);
  });

  it('M2-AC03/2 barrier: A demotes B while B renames — the rename is decided by the role B holds when it runs, not the one it read before the lock, and nothing answers 500', async () => {
    const demoteDave = (orgId: string) => () => post(carol, `/orgs/${orgId}/members/${DAVE.userId}/role`, { role: 'member' });
    const renameAsDave = (orgId: string) => () => post(dave, `/orgs/${orgId}/rename`, { name: 'Renamed By Dave' });
    const nameOf = async (orgId: string) =>
      (await asMigrator<{ name: string }>(db, 'SELECT name FROM app.orgs WHERE id = $1', [orgId]))[0]?.name;
    const daveRole = async (orgId: string) =>
      (
        await asMigrator<{ role: string }>(db, 'SELECT role FROM app.org_members WHERE org_id = $1 AND user_id = $2', [
          orgId,
          DAVE.userId,
        ])
      )[0]?.role;

    // The demote reaches the lock first. Both requests read Dave as an admin before the lock
    // (step 3); only the role re-read under it (step 5) can refuse the rename.
    const first = await createOrgAs(api, carol, 'Barrier Demote First');
    await asOrgMember(api, carol, first, dave, 'admin');
    const [demote, rename] = await underBarrier(first, [demoteDave(first), renameAsDave(first)], { inOrder: true });
    expect(demote!.statusCode).toBe(200);
    expect(rename!.statusCode).toBe(403);
    expect(rename!.json()).toEqual(errorBody('org.admin_required'));
    expect(await nameOf(first)).toBe('Barrier Demote First');
    expect(await daveRole(first)).toBe('member');
    const denied = await auditRows(db, { contextOrgId: first, outcome: 'denied' });
    expect(denied.map((row) => [row.actor_user_id, row.action, row.denial_code])).toEqual([[DAVE.userId, 'org.rename', 'org.admin_required']]);

    // The rename reaches the lock first: Dave is still an admin when it runs.
    const second = await createOrgAs(api, carol, 'Barrier Rename First');
    await asOrgMember(api, carol, second, dave, 'admin');
    const [renamed, demoted] = await underBarrier(second, [renameAsDave(second), demoteDave(second)], { inOrder: true });
    expect(renamed!.statusCode).toBe(200);
    expect(demoted!.statusCode).toBe(200);
    expect(await nameOf(second)).toBe('Renamed By Dave');
    expect(await daveRole(second)).toBe('member');
  });

  it('M2-AC03/2 barrier: two admins leave together — exactly one leaves, the other is 409 org.last_admin, and one active admin remains', async () => {
    const orgId = await createOrgAs(api, carol, 'Barrier Two Leave');
    await asOrgMember(api, carol, orgId, dave, 'admin');

    const responses = await underBarrier(orgId, [
      () => post(carol, `/orgs/${orgId}/leave`),
      () => post(dave, `/orgs/${orgId}/leave`),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.statusCode === 409)!.json()).toEqual(errorBody('org.last_admin'));
    const admins = await asMigrator(
      db,
      `SELECT user_id FROM app.org_members WHERE org_id = $1 AND status = 'active' AND role = 'admin'`,
      [orgId],
    );
    expect(admins).toHaveLength(1);
    expect(await auditRows(db, { contextOrgId: orgId, denialCode: 'org.last_admin' })).toHaveLength(1);
  });

  it('M2-AC03/2 barrier: the lock order holds whatever isolation the database defaults to — with REPEATABLE READ as the login’s default, two admins leaving still leave one admin', async () => {
    const orgId = await createOrgAs(api, carol, 'Barrier Repeatable Read');
    await asOrgMember(api, carol, orgId, dave, 'admin');
    // From here every new session of the runtime login in this database starts with
    // REPEATABLE READ as its default, as a server, database or role setting would
    // make it (the cluster admin sets it: only a superuser may). R5 step 5's re-read
    // and the last-admin count need a fresh snapshot per statement, which READ
    // COMMITTED gives. `strict` is a new app, so its pool's sessions all start after it.
    const setDefault = (sql: string) =>
      withClientAt(cluster().adminUrl, (admin) => admin.query(`ALTER ROLE wringy_api_login IN DATABASE ${pg.escapeIdentifier(db.name)} ${sql}`));
    await setDefault(`SET default_transaction_isolation = 'repeatable read'`);
    const strict = await buildTestApi(db.urls.api, { identity });
    try {
      const [setting] = await withClientAt(db.urls.api, async (client) =>
        (await client.query<{ default_transaction_isolation: string }>('SHOW default_transaction_isolation')).rows,
      );
      expect(setting).toEqual({ default_transaction_isolation: 'repeatable read' });

      const leave = (who: SignedIn) => () => strict.app.inject({ method: 'POST', url: `/orgs/${orgId}/leave`, headers: who.headers });
      const responses = await underBarrier(orgId, [leave(carol), leave(dave)]);
      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
      const admins = await asMigrator(
        db,
        `SELECT user_id FROM app.org_members WHERE org_id = $1 AND status = 'active' AND role = 'admin'`,
        [orgId],
      );
      expect(admins).toHaveLength(1);
    } finally {
      await strict.close();
      await setDefault('RESET default_transaction_isolation');
    }
  });

  it('M2-AC03/2 barrier: two invitations of one address at once — one 201, one 409 invitation.pending, one pending invitation', async () => {
    const orgId = await createOrgAs(api, carol, 'Barrier Two Invites');
    await asOrgMember(api, carol, orgId, dave, 'admin');

    const responses = await underBarrier(orgId, [
      () => post(carol, `/orgs/${orgId}/invitations`, { email: 'same.person@example.test', role: 'member' }),
      () => post(dave, `/orgs/${orgId}/invitations`, { email: 'Same.Person@example.test', role: 'admin' }),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.statusCode === 409)!.json()).toEqual(errorBody('invitation.pending'));
    const pending = await asMigrator(db, `SELECT id FROM app.org_invitations WHERE org_id = $1 AND status = 'pending'`, [orgId]);
    expect(pending).toHaveLength(1);
  });

  it('M2-AC03/3 capabilities are independent and imply no membership: review on A gives nothing on B, review and finance refuse each other, only ops_runtime opens the platform route, and none opens an org', async () => {
    const orgA = await createOrgAs(api, carol, 'Capability A');
    const orgB = await createOrgAs(api, dave, 'Capability B');
    await grantCapability(db, { userId: ERIN.userId, orgId: orgA, capability: 'review' });
    await grantCapability(db, { userId: FRANK.userId, orgId: orgA, capability: 'finance' });
    await grantPlatform(db, { userId: GRACE.userId, capability: 'ops_runtime' });

    // The guards on routes of a later ticket, registered before the first request.
    const pool = createApiPool(db.urls.api, () => {});
    const guarded = await buildTestApi(db.urls.api, { identity });
    guarded.app.register(async (scope) => {
      scope.addHook('onRequest', scope.authenticate);
      scope.addHook('preHandler', requireOrgCapability(pool, 'review'));
      scope.get('/probe/review/:orgId', async () => ({ ok: true }));
    });
    guarded.app.register(async (scope) => {
      scope.addHook('onRequest', scope.authenticate);
      scope.addHook('preHandler', requireOrgCapability(pool, 'finance'));
      scope.get('/probe/finance/:orgId', async () => ({ ok: true }));
    });
    guarded.app.register(async (scope) => {
      scope.addHook('onRequest', scope.authenticate);
      scope.addHook('preHandler', requirePlatformGrant(pool, 'ops_runtime'));
      scope.get('/probe/ops', async () => ({ ok: true }));
    });

    try {
      const probe = (who: SignedIn, url: string) => guarded.app.inject({ method: 'GET', url, headers: who.headers });
      const cases: Array<[string, SignedIn, string, number]> = [
        ['review holder, own org', erin, `/probe/review/${orgA}`, 200],
        ['review holder, another org', erin, `/probe/review/${orgB}`, 403],
        ['review holder, finance', erin, `/probe/finance/${orgA}`, 403],
        ['review holder, ops', erin, '/probe/ops', 403],
        ['finance holder, finance', frank, `/probe/finance/${orgA}`, 200],
        ['finance holder, review', frank, `/probe/review/${orgA}`, 403],
        ['finance holder, ops', frank, '/probe/ops', 403],
        ['admin without grants, review', carol, `/probe/review/${orgA}`, 403],
        ['admin without grants, finance', carol, `/probe/finance/${orgA}`, 403],
        ['admin without grants, ops', carol, '/probe/ops', 403],
        ['ops holder, ops', grace, '/probe/ops', 200],
        ['ops holder, review', grace, `/probe/review/${orgA}`, 403],
        ['ops holder, finance', grace, `/probe/finance/${orgA}`, 403],
      ];
      for (const [label, who, url, status] of cases) {
        const response = await probe(who, url);
        expect(response.statusCode, label).toBe(status);
        if (status === 403) expect(response.json(), label).toEqual(errorBody('capability.required'));
        else expect(response.json(), label).toEqual({ ok: true });
      }
      // A path that names no org is refused before any read, and not audited.
      expect((await probe(erin, '/probe/review/not-a-uuid')).statusCode).toBe(400);

      // No grant opens an org: a review holder and an ops holder are outsiders of A.
      for (const who of [erin, frank, grace]) {
        const read = await get(who, `/orgs/${orgA}`);
        expect(read.statusCode).toBe(403);
        expect(read.json()).toEqual(errorBody('org.forbidden'));
        expect((await post(who, `/orgs/${orgA}/rename`, { name: 'By Grant' })).statusCode).toBe(403);
      }

      const refusals = (await auditRows(db, { action: 'capability.use' })).map((row) => [
        row.actor_user_id,
        row.context_org_id,
        row.denial_code,
        row.reason,
      ]);
      expect(refusals).toHaveLength(cases.filter(([, , , status]) => status === 403).length);
      expect(refusals).toContainEqual([ERIN.userId, orgB, 'capability.required', 'capability_required']);
      expect(refusals).toContainEqual([CAROL.userId, null, 'capability.required', 'platform_grant_required']);
      expect(refusals).toContainEqual([GRACE.userId, orgA, 'capability.required', 'capability_required']);
    } finally {
      await guarded.close();
      await pool.end().catch(() => {});
    }
  });
});
