/**
 * Organisations and memberships through the API (M2-03 code review R1, R2, R5,
 * R10, R12, R13 *api int*, R18). The identities are simulated: tokens signed by
 * a key pair generated in the process and verified by the real hook
 * (jwt-support.ts); the database is a real PostgreSQL 17, read by the app as
 * `wringy_api_login`, and the audit log is read back as the migrator (the
 * runtime role has no SELECT on it).
 *
 * Every row arranges its own orgs through the API's own routes, so each can run
 * alone (`-t`) and prove the same thing.
 */
import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  ChangeRoleResponse,
  CreateOrgResponse,
  LeaveOrgResponse,
  OrgDetailResponse,
  RemoveMemberResponse,
  RenameOrgResponse,
  WorkspacesResponse,
} from '@wringy/contracts';

import { createApiPool } from '../../src/database';
import { errorBody } from '../../src/errors';
import { databaseLiveness } from '../../src/session-liveness';
import { createTestIdentity, type TestIdentity } from './jwt-support';
import {
  apiAuditCount,
  asMigrator,
  asOrgMember,
  auditRows,
  buildTestApi,
  createOrgAs,
  createTestDatabase,
  endSession,
  grantCapability,
  grantPlatform,
  insertLiveSession,
  inviteAs,
  logsOfRequest,
  person,
  revokeCapability,
  type PersonSpec,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

const CAROL: PersonSpec = {
  userId: '0ca70100-0000-4000-8000-000000000004',
  sessionId: '5e550000-0000-4000-8000-00000000c004',
  email: 'carol@example.test',
  name: 'Carol Wong',
};
const DAVE: PersonSpec = {
  userId: '0da4e000-0000-4000-8000-000000000005',
  sessionId: '5e550000-0000-4000-8000-00000000d005',
  email: 'dave@example.test',
  name: 'Dave Raj',
};
const ERIN: PersonSpec = {
  userId: '0e410000-0000-4000-8000-000000000006',
  sessionId: '5e550000-0000-4000-8000-00000000e006',
  email: 'erin@example.test',
  name: 'Erin Lee',
};
const FRANK: PersonSpec = {
  userId: '0f4a0000-0000-4000-8000-000000000007',
  sessionId: '5e550000-0000-4000-8000-00000000f007',
  email: 'frank@example.test',
  name: 'Frank Tan',
};
const GRACE: PersonSpec = {
  userId: '06ace000-0000-4000-8000-000000000008',
  sessionId: '5e550000-0000-4000-8000-000000006008',
  email: 'grace@example.test',
  name: 'Grace Ong',
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('M2-AC03 organisations and memberships through the API (simulated identities)', () => {
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
  const memberRow = async (orgId: string, userId: string) =>
    (
      await asMigrator<{ role: string; status: string; removed_by: string | null; removal_basis: string | null }>(
        db,
        `SELECT role, status, removed_by, removal_basis FROM app.org_members WHERE org_id = $1 AND user_id = $2`,
        [orgId, userId],
      )
    )[0];
  const orgName = async (orgId: string) =>
    (await asMigrator<{ name: string }>(db, 'SELECT name FROM app.orgs WHERE id = $1', [orgId]))[0]?.name;

  it('M2-AC03/1 creating an org makes the creator its admin on an org_created grant; the org is live and the change is audited with the request id and a session reference', async () => {
    const response = await post(carol, '/orgs', { name: '  Carol Studio  ' });
    expect(response.statusCode).toBe(201);
    expect(response.headers.vary).toBe('Authorization');
    const body = response.json() as CreateOrgResponse;
    expect(body.org).toMatchObject({ name: 'Carol Studio', dataOrigin: 'live' });
    expect(body.membership).toMatchObject({
      orgId: body.org.id,
      userId: CAROL.userId,
      role: 'admin',
      status: 'active',
      grantBasis: 'org_created',
    });

    const [row] = await asMigrator<{ created_by: string; data_origin: string; granted_by: string; invitation_id: string | null }>(
      db,
      `SELECT o.created_by, o.data_origin, m.granted_by, m.invitation_id
         FROM app.orgs o JOIN app.org_members m ON m.org_id = o.id WHERE o.id = $1`,
      [body.org.id],
    );
    expect(row).toEqual({ created_by: CAROL.userId, data_origin: 'live', granted_by: CAROL.userId, invitation_id: null });

    const audit = await auditRows(db, { action: 'org.create', contextOrgId: body.org.id });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      recorded_by: 'wringy_api_login',
      actor_kind: 'user',
      actor_user_id: CAROL.userId,
      target_type: 'org',
      target_id: body.org.id,
      outcome: 'allowed',
      denial_code: null,
      summary: { after: { name: 'Carol Studio', role: 'admin' } },
      session_ref: sha256(CAROL.sessionId),
    });
    // R11: the request id is a UUID and the key of this request's log lines.
    expect(audit[0]!.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(logsOfRequest(api.logs, audit[0]!.request_id!).length).toBeGreaterThan(0);
  });

  it('M2-AC03/1 a body cannot choose the id, the label or the creator of a new org', async () => {
    const chosenId = 'a0000000-0000-4000-8000-0000000000aa';
    const response = await post(carol, '/orgs', {
      name: 'Chosen Nothing',
      id: chosenId,
      dataOrigin: 'fixture',
      data_origin: 'fixture',
      createdBy: DAVE.userId,
      orgId: chosenId,
    });
    expect(response.statusCode).toBe(201);
    const { org } = response.json() as CreateOrgResponse;
    expect(org.id).not.toBe(chosenId);
    const [row] = await asMigrator<{ created_by: string; data_origin: string }>(
      db,
      'SELECT created_by, data_origin FROM app.orgs WHERE id = $1',
      [org.id],
    );
    expect(row).toEqual({ created_by: CAROL.userId, data_origin: 'live' });
    expect(await asMigrator(db, 'SELECT 1 FROM app.orgs WHERE id = $1', [chosenId])).toEqual([]);
  });

  it('M2-AC03/2 a member cannot invite, rename, change roles or remove, and cannot make themselves an admin: each is 403 org.admin_required with a denial row, and nothing changes', async () => {
    const orgId = await createOrgAs(api, carol, 'Member Limits');
    await asOrgMember(api, carol, orgId, dave);
    await asOrgMember(api, carol, orgId, erin);

    // Thunks, sent one after another: the denial rows are compared in order below, so
    // the requests must not race each other to the audit log.
    const attempts = [
      ['invitation.create', () => post(dave, `/orgs/${orgId}/invitations`, { email: 'someone@example.test', role: 'member' })],
      ['org.rename', () => post(dave, `/orgs/${orgId}/rename`, { name: 'Taken Over' })],
      ['member.role_change', () => post(dave, `/orgs/${orgId}/members/${ERIN.userId}/role`, { role: 'admin' })],
      ['member.remove', () => post(dave, `/orgs/${orgId}/members/${ERIN.userId}/remove`)],
      ['member.role_change', () => post(dave, `/orgs/${orgId}/members/${DAVE.userId}/role`, { role: 'admin' })],
    ] as const;
    for (const [action, attempt] of attempts) {
      const response = await attempt();
      expect(response.statusCode, action).toBe(403);
      expect(response.json(), action).toEqual(errorBody('org.admin_required'));
    }

    const denials = await auditRows(db, { contextOrgId: orgId, actorUserId: DAVE.userId, outcome: 'denied' });
    expect(denials.map((row) => [row.action, row.denial_code, row.reason])).toEqual(
      attempts.map(([action]) => [action, 'org.admin_required', 'admin_required']),
    );
    expect(await orgName(orgId)).toBe('Member Limits');
    expect(await memberRow(orgId, DAVE.userId)).toMatchObject({ role: 'member', status: 'active' });
    expect(await memberRow(orgId, ERIN.userId)).toMatchObject({ role: 'member', status: 'active' });
    expect(
      await asMigrator(db, `SELECT 1 FROM app.org_invitations WHERE org_id = $1 AND status = 'pending'`, [orgId]),
    ).toEqual([]);
  });

  it('M2-AC03/2 the last active admin cannot leave or be demoted (409 org.last_admin), and an admin whose account is disabled does not count', async () => {
    const orgId = await createOrgAs(api, carol, 'Last Admin');

    const leave = await post(carol, `/orgs/${orgId}/leave`);
    expect(leave.statusCode).toBe(409);
    expect(leave.json()).toEqual(errorBody('org.last_admin'));
    const demote = await post(carol, `/orgs/${orgId}/members/${CAROL.userId}/role`, { role: 'member' });
    expect(demote.statusCode).toBe(409);
    expect(demote.json()).toEqual(errorBody('org.last_admin'));

    // A second admin whose account an operator has disabled keeps nobody in charge.
    await asOrgMember(api, carol, orgId, frank, 'admin');
    await asMigrator(db, `UPDATE app.profiles SET status = 'disabled' WHERE id = $1`, [FRANK.userId]);
    try {
      expect((await post(carol, `/orgs/${orgId}/leave`)).statusCode).toBe(409);
      expect((await post(carol, `/orgs/${orgId}/members/${CAROL.userId}/role`, { role: 'member' })).statusCode).toBe(409);
    } finally {
      await asMigrator(db, `UPDATE app.profiles SET status = 'active' WHERE id = $1`, [FRANK.userId]);
    }

    const denials = await auditRows(db, { contextOrgId: orgId, denialCode: 'org.last_admin' });
    expect(denials.map((row) => row.action)).toEqual(['member.leave', 'member.role_change', 'member.leave', 'member.role_change']);
    expect(await memberRow(orgId, CAROL.userId)).toMatchObject({ role: 'admin', status: 'active' });

    // With an active second admin, the first may step down.
    const stepDown = await post(carol, `/orgs/${orgId}/members/${CAROL.userId}/role`, { role: 'member' });
    expect(stepDown.statusCode).toBe(200);
    expect((stepDown.json() as ChangeRoleResponse).membership).toMatchObject({ role: 'member', status: 'active' });
    const [allowed] = await auditRows(db, { contextOrgId: orgId, action: 'member.role_change', outcome: 'allowed' });
    expect(allowed).toMatchObject({
      target_type: 'org_member',
      target_id: CAROL.userId,
      summary: { before: { role: 'admin' }, after: { role: 'member' } },
    });
  });

  it('M2-AC03/2 an admin removes a member and a member leaves: the rows stay, removed, with who and why; removing oneself is 409 member.self', async () => {
    const orgId = await createOrgAs(api, carol, 'Comings And Goings');
    await asOrgMember(api, carol, orgId, dave);
    await asOrgMember(api, carol, orgId, erin);

    const removed = await post(carol, `/orgs/${orgId}/members/${DAVE.userId}/remove`);
    expect(removed.statusCode).toBe(200);
    expect((removed.json() as RemoveMemberResponse).membership).toMatchObject({ userId: DAVE.userId, status: 'removed' });
    expect(await memberRow(orgId, DAVE.userId)).toEqual({
      role: 'member',
      status: 'removed',
      removed_by: CAROL.userId,
      removal_basis: 'removed_by_admin',
    });

    const left = await post(erin, `/orgs/${orgId}/leave`);
    expect(left.statusCode).toBe(200);
    expect((left.json() as LeaveOrgResponse).membership).toMatchObject({ userId: ERIN.userId, status: 'removed' });
    expect(await memberRow(orgId, ERIN.userId)).toEqual({
      role: 'member',
      status: 'removed',
      removed_by: ERIN.userId,
      removal_basis: 'left',
    });

    const self = await post(carol, `/orgs/${orgId}/members/${CAROL.userId}/remove`);
    expect(self.statusCode).toBe(409);
    expect(self.json()).toEqual(errorBody('member.self'));
    // A removed member is no longer a member of this org: 404, audited as not_in_org.
    const again = await post(carol, `/orgs/${orgId}/members/${DAVE.userId}/remove`);
    expect(again.statusCode).toBe(404);
    expect(again.json()).toEqual(errorBody('member.not_found'));
    // And a removed member has lost access to the org at once.
    expect((await get(dave, `/orgs/${orgId}`)).statusCode).toBe(403);

    const rows = await auditRows(db, { contextOrgId: orgId });
    const byAction = (action: string, outcome: string) => rows.filter((row) => row.action === action && row.outcome === outcome);
    expect(byAction('member.remove', 'allowed')[0]).toMatchObject({
      actor_user_id: CAROL.userId,
      target_id: DAVE.userId,
      summary: { before: { role: 'member', status: 'active' }, after: { status: 'removed' } },
    });
    expect(byAction('member.leave', 'allowed')[0]).toMatchObject({ actor_user_id: ERIN.userId, target_id: ERIN.userId });
    expect(byAction('member.remove', 'denied').map((row) => [row.denial_code, row.reason])).toEqual([
      ['member.self', 'self'],
      ['member.not_found', 'not_in_org'],
    ]);
  });

  it('M2-AC03/2 M2-AC03/3 a path id is one id however it is cased: an upper-cased own id is still member.self (409), and every audit row names its target in lower case', async () => {
    const orgId = await createOrgAs(api, carol, 'Cased Paths');
    // A second admin, so the last-admin rule cannot be what refuses Carol.
    await asOrgMember(api, carol, orgId, dave, 'admin');
    const ORG = orgId.toUpperCase();

    const self = await post(carol, `/orgs/${ORG}/members/${CAROL.userId.toUpperCase()}/remove`);
    expect(self.statusCode).toBe(409);
    expect(self.json()).toEqual(errorBody('member.self'));
    expect(await memberRow(orgId, CAROL.userId)).toMatchObject({ role: 'admin', status: 'active', removal_basis: null });

    expect((await post(carol, `/orgs/${ORG}/rename`, { name: 'Cased Paths Renamed' })).statusCode).toBe(200);
    expect((await post(carol, `/orgs/${ORG}/members/${DAVE.userId.toUpperCase()}/role`, { role: 'member' })).statusCode).toBe(200);
    expect((await get(erin, `/orgs/${ORG}`)).statusCode).toBe(403);

    const rows = await auditRows(db, { contextOrgId: orgId });
    expect(rows.map((row) => [row.action, row.outcome, row.denial_code, row.target_id])).toEqual([
      ['org.create', 'allowed', null, orgId],
      ['invitation.create', 'allowed', null, expect.any(String)],
      ['invitation.accept', 'allowed', null, expect.any(String)],
      ['member.remove', 'denied', 'member.self', CAROL.userId],
      ['org.rename', 'allowed', null, orgId],
      ['member.role_change', 'allowed', null, DAVE.userId],
      ['org.read', 'denied', 'org.forbidden', orgId],
    ]);
    for (const row of rows) expect(row.target_id, row.action).toBe(row.target_id?.toLowerCase());
    // So the operator's exact-match query finds every row about the org, the crafted ones included.
    const byTarget = await asMigrator<{ action: string }>(db, 'SELECT action FROM app.audit_log WHERE target_id = $1 ORDER BY id', [orgId]);
    expect(byTarget.map((row) => row.action)).toEqual(['org.create', 'org.rename', 'org.read']);
  });

  it('M2-AC03/2 an admin renames the org: the stored name is the trimmed NFC form, the change is audited before and after, and an unsafe name is 400 and not audited', async () => {
    const orgId = await createOrgAs(api, carol, 'Old Name');
    const before = await apiAuditCount(db);
    const response = await post(carol, `/orgs/${orgId}/rename`, { name: ' Café Nouveau ' });
    expect(response.statusCode).toBe(200);
    expect((response.json() as RenameOrgResponse).org.name).toBe('Café Nouveau');
    expect(await orgName(orgId)).toBe('Café Nouveau');
    const [row] = await auditRows(db, { contextOrgId: orgId, action: 'org.rename' });
    expect(row).toMatchObject({ outcome: 'allowed', summary: { before: { name: 'Old Name' }, after: { name: 'Café Nouveau' } } });
    expect(await apiAuditCount(db)).toBe(before + 1);

    for (const name of ['', '   ', 'x'.repeat(101), 'Evil‮eman', 'Tab\there']) {
      const refused = await post(carol, `/orgs/${orgId}/rename`, { name });
      expect(refused.statusCode, JSON.stringify(name)).toBe(400);
      expect(refused.json()).toEqual(errorBody('bad_request'));
    }
    expect(await apiAuditCount(db)).toBe(before + 1);
    expect(await orgName(orgId)).toBe('Café Nouveau');
  });

  it('M2-AC03/2 a body orgId never redirects a command: the path decides, and an outsider is refused on the path org', async () => {
    const orgA = await createOrgAs(api, carol, 'Path A');
    const orgB = await createOrgAs(api, dave, 'Path B');

    const own = await post(carol, `/orgs/${orgA}/rename`, { name: 'Path A Renamed', orgId: orgB });
    expect(own.statusCode).toBe(200);
    expect(await orgName(orgA)).toBe('Path A Renamed');
    expect(await orgName(orgB)).toBe('Path B');

    // Dave is B's admin; naming B in the body gives him nothing in A.
    const foreign = await post(dave, `/orgs/${orgA}/rename`, { name: 'Hijacked', orgId: orgB });
    expect(foreign.statusCode).toBe(403);
    expect(foreign.json()).toEqual(errorBody('org.forbidden'));
    expect(await orgName(orgA)).toBe('Path A Renamed');
    expect(await orgName(orgB)).toBe('Path B');
    const [denial] = await auditRows(db, { actorUserId: DAVE.userId, contextOrgId: orgA });
    expect(denial).toMatchObject({ action: 'org.rename', denial_code: 'org.forbidden', reason: 'not_a_member' });
    expect(await auditRows(db, { actorUserId: DAVE.userId, contextOrgId: orgB, outcome: 'denied' })).toEqual([]);
  });

  it('M2-AC03/2 cross-org: changing or removing a B-only member through A’s path is 404 member.not_found with a denial row, and B is untouched', async () => {
    const orgA = await createOrgAs(api, carol, 'Cross A');
    const orgB = await createOrgAs(api, dave, 'Cross B');
    await asOrgMember(api, dave, orgB, frank);

    const role = await post(carol, `/orgs/${orgA}/members/${FRANK.userId}/role`, { role: 'admin' });
    expect(role.statusCode).toBe(404);
    expect(role.json()).toEqual(errorBody('member.not_found'));
    const remove = await post(carol, `/orgs/${orgA}/members/${FRANK.userId}/remove`);
    expect(remove.statusCode).toBe(404);

    expect(await memberRow(orgB, FRANK.userId)).toMatchObject({ role: 'member', status: 'active' });
    expect(await memberRow(orgA, FRANK.userId)).toBeUndefined();
    const denials = await auditRows(db, { actorUserId: CAROL.userId, contextOrgId: orgA, outcome: 'denied' });
    expect(denials.map((row) => [row.action, row.denial_code, row.reason, row.target_type, row.target_id])).toEqual([
      ['member.role_change', 'member.not_found', 'not_in_org', 'org_member', FRANK.userId],
      ['member.remove', 'member.not_found', 'not_in_org', 'org_member', FRANK.userId],
    ]);
    expect(await auditRows(db, { contextOrgId: orgB, actorUserId: CAROL.userId })).toEqual([]);
  });

  it('M2-AC03/2 an account disabled after the hook read it is refused inside the command (403 account.disabled): no business row and no audit row', async () => {
    const orgId = await createOrgAs(api, carol, 'Disabled Inside');
    // The hook sees an active profile; the row says disabled — the race an operator
    // disabling an account mid-request creates (M2-02 R6).
    const racing = await buildTestApi(db.urls.api, {
      identity,
      readProfile: async (userId) => ({
        id: userId,
        displayName: CAROL.name,
        contactEmail: CAROL.email,
        status: 'active',
        lastSignInAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }),
    });
    await asMigrator(db, `UPDATE app.profiles SET status = 'disabled' WHERE id = $1`, [CAROL.userId]);
    try {
      const before = await apiAuditCount(db);
      const attempts = [
        racing.app.inject({ method: 'POST', url: '/orgs', headers: carol.headers, payload: { name: 'Never Created' } }),
        racing.app.inject({ method: 'POST', url: `/orgs/${orgId}/rename`, headers: carol.headers, payload: { name: 'Never' } }),
        racing.app.inject({ method: 'POST', url: `/orgs/${orgId}/capabilities`, headers: carol.headers }),
      ];
      for (const attempt of attempts) {
        const response = await attempt;
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual(errorBody('account.disabled'));
      }
      expect(await apiAuditCount(db)).toBe(before);
      expect(await asMigrator(db, `SELECT 1 FROM app.orgs WHERE name = 'Never Created'`)).toEqual([]);
      expect(await orgName(orgId)).toBe('Disabled Inside');
    } finally {
      await asMigrator(db, `UPDATE app.profiles SET status = 'active' WHERE id = $1`, [CAROL.userId]);
      await racing.close();
    }
  });

  it('M2-AC03/2 a signed-out session is refused inside the command (401 session.revoked): no business row and no audit row', async () => {
    const orgId = await createOrgAs(api, carol, 'Signed Out');
    const pool = createApiPool(db.urls.api, () => {});
    const live = await buildTestApi(db.urls.api, { identity, liveness: databaseLiveness(pool) });
    await endSession(db, CAROL.sessionId);
    try {
      const before = await apiAuditCount(db);
      for (const [url, payload] of [
        ['/orgs', { name: 'After Sign Out' }],
        [`/orgs/${orgId}/rename`, { name: 'After Sign Out' }],
        [`/orgs/${orgId}/invitations`, { email: 'later@example.test', role: 'member' }],
        [`/orgs/${orgId}/leave`, undefined],
      ] as const) {
        const response = await live.app.inject({
          method: 'POST',
          url,
          headers: carol.headers,
          ...(payload === undefined ? {} : { payload }),
        });
        expect(response.statusCode, url).toBe(401);
        expect(response.json(), url).toEqual(errorBody('session.revoked'));
      }
      expect(await apiAuditCount(db)).toBe(before);
      expect(await asMigrator(db, `SELECT 1 FROM app.orgs WHERE name = 'After Sign Out'`)).toEqual([]);
      expect(await asMigrator(db, `SELECT 1 FROM app.org_invitations WHERE org_id = $1`, [orgId])).toEqual([]);
      expect(await memberRow(orgId, CAROL.userId)).toMatchObject({ status: 'active' });
    } finally {
      await insertLiveSession(db, { sessionId: CAROL.sessionId, userId: CAROL.userId });
      await live.close();
      await pool.end().catch(() => {});
    }
  });

  it('M2-AC03/1 GET /me/workspaces lists the personal context, active memberships by name and the grants; a removal drops the org and a revoked, then re-granted capability shows on the next request', async () => {
    const zeta = await createOrgAs(api, grace, 'Zeta Works');
    const alpha = await createOrgAs(api, dave, 'Alpha Shop');
    await asOrgMember(api, dave, alpha, grace);
    const workspaces = async () => {
      const response = await get(grace, '/me/workspaces');
      expect(response.statusCode).toBe(200);
      expect(response.headers.vary).toBe('Authorization');
      return response.json() as WorkspacesResponse;
    };

    expect(await workspaces()).toEqual({
      personal: { userId: GRACE.userId },
      orgs: [
        { orgId: alpha, name: 'Alpha Shop', role: 'member', dataOrigin: 'live' },
        { orgId: zeta, name: 'Zeta Works', role: 'admin', dataOrigin: 'live' },
      ],
      grants: { org: [], platform: [] },
    });

    // A grant is not a membership: a review grant on an org Grace is not in is listed as a grant only.
    const outside = await createOrgAs(api, carol, 'Outside Grace');
    await grantCapability(db, { userId: GRACE.userId, orgId: outside, capability: 'review' });
    await grantPlatform(db, { userId: GRACE.userId, capability: 'ops_runtime' });
    let now = await workspaces();
    expect(now.orgs.map((org) => org.orgId)).toEqual([alpha, zeta]);
    expect(now.grants).toEqual({ org: [{ orgId: outside, capability: 'review' }], platform: ['ops_runtime'] });

    await revokeCapability(db, { userId: GRACE.userId, orgId: outside, capability: 'review' });
    expect((await workspaces()).grants.org).toEqual([]);
    await grantCapability(db, { userId: GRACE.userId, orgId: outside, capability: 'review' });
    expect((await workspaces()).grants.org).toEqual([{ orgId: outside, capability: 'review' }]);

    // Dave removes Grace from Alpha: the next request no longer lists it.
    expect((await post(dave, `/orgs/${alpha}/members/${GRACE.userId}/remove`)).statusCode).toBe(200);
    now = await workspaces();
    expect(now.orgs).toEqual([{ orgId: zeta, name: 'Zeta Works', role: 'admin', dataOrigin: 'live' }]);
    // Reading the switcher is not audited.
    expect(await auditRows(db, { actorUserId: GRACE.userId, action: 'org.read' })).toEqual([]);
  });

  it('M2-AC03/3 leak probes: a member’s GET /orgs/:orgId has no invitations key and no address; an admin’s lists the pending invitations but never a member’s contact address', async () => {
    const orgId = await createOrgAs(api, carol, 'Leak Probe');
    await asOrgMember(api, carol, orgId, dave);
    const { invitationId } = await inviteAs(api, carol, orgId, 'pending.person@example.test');

    const asMember = await get(dave, `/orgs/${orgId}`);
    expect(asMember.statusCode).toBe(200);
    const memberView = asMember.json() as OrgDetailResponse;
    expect(Object.keys(memberView).sort()).toEqual(['members', 'org', 'self']);
    expect(memberView.self).toEqual({ userId: DAVE.userId, role: 'member' });
    expect(asMember.body).not.toContain('@');
    expect(asMember.body).not.toMatch(/contact|email|token/i);
    expect(memberView.members.map((member) => [member.userId, member.displayName, member.role])).toEqual([
      [CAROL.userId, CAROL.name, 'admin'],
      [DAVE.userId, DAVE.name, 'member'],
    ]);

    const asAdmin = await get(carol, `/orgs/${orgId}`);
    expect(asAdmin.statusCode).toBe(200);
    const adminView = asAdmin.json() as OrgDetailResponse;
    expect(adminView.self).toEqual({ userId: CAROL.userId, role: 'admin' });
    expect(adminView.invitations).toEqual([
      expect.objectContaining({ id: invitationId, inviteeEmailNorm: 'pending.person@example.test', role: 'member' }),
    ]);
    expect(asAdmin.body).not.toContain(CAROL.email);
    expect(asAdmin.body).not.toContain(DAVE.email);
    expect(asAdmin.body).not.toMatch(/contact|token|hash/i);
  });

  it('M2-AC03/1 POST /orgs/:orgId/capabilities is refused and audited for everyone, grants nothing, and never reads its body', async () => {
    const orgId = await createOrgAs(api, carol, 'No Self Service');
    await asOrgMember(api, carol, orgId, dave);
    const crafted = { capability: 'finance', userId: CAROL.userId, orgId, role: 'admin' };

    const outsider = await post(erin, `/orgs/${orgId}/capabilities`, crafted);
    expect(outsider.statusCode).toBe(403);
    expect(outsider.json()).toEqual(errorBody('org.forbidden'));
    for (const who of [dave, carol]) {
      const response = await post(who, `/orgs/${orgId}/capabilities`, crafted);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual(errorBody('capability.script_only'));
    }
    // No body at all reaches the same refusal.
    expect((await post(carol, `/orgs/${orgId}/capabilities`)).statusCode).toBe(403);
    // So does a body Fastify has no parser for, and one that does not parse (R18 rev 3): the
    // route never reads a body, so no body can turn the attempt into an unaudited 4xx.
    const bodies = [
      ['application/x-www-form-urlencoded', `capability=finance&userId=${CAROL.userId}`],
      ['text/xml', '<grant capability="finance"/>'],
      ['application/json', '{"capability": "finance",'],
      ['application/octet-stream', 'finance'],
    ] as const;
    for (const [contentType, payload] of bodies) {
      const response = await api.app.inject({
        method: 'POST',
        url: `/orgs/${orgId}/capabilities`,
        headers: { ...carol.headers, 'content-type': contentType },
        payload,
      });
      expect(response.statusCode, contentType).toBe(403);
      expect(response.json(), contentType).toEqual(errorBody('capability.script_only'));
    }

    const denials = await auditRows(db, { contextOrgId: orgId, action: 'capability.grant' });
    expect(denials.map((row) => [row.actor_user_id, row.outcome, row.denial_code, row.reason])).toEqual([
      [ERIN.userId, 'denied', 'org.forbidden', 'not_a_member'],
      [DAVE.userId, 'denied', 'capability.script_only', 'script_only'],
      [CAROL.userId, 'denied', 'capability.script_only', 'script_only'],
      [CAROL.userId, 'denied', 'capability.script_only', 'script_only'],
      ...bodies.map(() => [CAROL.userId, 'denied', 'capability.script_only', 'script_only']),
    ]);
    // Only this route takes any body: every other command still refuses one it cannot parse.
    const elsewhere = await api.app.inject({
      method: 'POST',
      url: `/orgs/${orgId}/rename`,
      headers: { ...carol.headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'name=Form',
    });
    expect(elsewhere.statusCode).toBe(415);
    expect(await asMigrator(db, 'SELECT 1 FROM app.admin_scopes WHERE org_id = $1', [orgId])).toEqual([]);
    expect(await asMigrator(db, 'SELECT 1 FROM app.platform_grants WHERE user_id = ANY($1::uuid[])', [[CAROL.userId, DAVE.userId, ERIN.userId]])).toEqual([]);
  });
});
