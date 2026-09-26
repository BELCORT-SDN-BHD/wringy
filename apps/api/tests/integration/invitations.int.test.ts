/**
 * Invitations through the API (M2-03 code review R7, R8, R12, R13 *api int*;
 * ruling D2 "single-use link; expiry 7 days"). The identities are simulated
 * (tokens from a key pair generated in the process, verified by the real hook);
 * the database is a real PostgreSQL 17 and the app reads it as
 * `wringy_api_login`.
 *
 * What these rows pin down: the token is answered once and stored only as its
 * sha256; the verified address decides who may see and accept an invitation, so a
 * mis-delivered link grants nothing; a link works once, expires on the database
 * clock, can be revoked, and an existing member who accepts closes it.
 */
import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  INVITATION_LIFETIME_DAYS,
  type AcceptInvitationResponse,
  type CreateInvitationResponse,
  type InvitationPreviewResponse,
  type RevokeInvitationResponse,
} from '@wringy/contracts';

import { errorBody } from '../../src/errors';
import { bearer, createTestIdentity, type TestIdentity } from './jwt-support';
import {
  apiAuditCount,
  asMigrator,
  asOrgMember,
  auditRows,
  buildTestApi,
  createOrgAs,
  createTestDatabase,
  inviteAs,
  person,
  type PersonSpec,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

const CAROL: PersonSpec = {
  userId: '0ca70100-0000-4000-8000-000000000004',
  sessionId: '5e550000-0000-4000-8000-00000000c104',
  email: 'carol@example.test',
  name: 'Carol Wong',
};
const DAVE: PersonSpec = {
  userId: '0da4e000-0000-4000-8000-000000000005',
  sessionId: '5e550000-0000-4000-8000-00000000d105',
  email: 'dave@example.test',
  name: 'Dave Raj',
};
const ERIN: PersonSpec = {
  userId: '0e410000-0000-4000-8000-000000000006',
  sessionId: '5e550000-0000-4000-8000-00000000e106',
  email: 'erin@example.test',
  name: 'Erin Lee',
};
const FRANK: PersonSpec = {
  userId: '0f4a0000-0000-4000-8000-000000000007',
  sessionId: '5e550000-0000-4000-8000-00000000f107',
  email: 'frank@example.test',
  name: 'Frank Tan',
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
/** A well-formed token nobody issued. */
const UNKNOWN_TOKEN = 'A'.repeat(43);

describe('M2-AC03 invitations through the API (simulated identities)', () => {
  let db: TestDatabase;
  let identity: TestIdentity;
  let api: TestApi;
  let carol: SignedIn;
  let dave: SignedIn;
  let erin: SignedIn;
  let frank: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    identity = await createTestIdentity();
    carol = await person(db, identity, CAROL);
    dave = await person(db, identity, DAVE);
    erin = await person(db, identity, ERIN);
    frank = await person(db, identity, FRANK);
    api = await buildTestApi(db.urls.api, { identity });
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  const post = (headers: { authorization: string }, url: string, payload?: object) =>
    api.app.inject({ method: 'POST', url, headers, ...(payload === undefined ? {} : { payload }) });
  const preview = (who: SignedIn, token: string) => post(who.headers, '/invitations/preview', { token });
  const accept = (who: SignedIn, token: string) => post(who.headers, '/invitations/accept', { token });
  const invitationRow = async (id: string) =>
    (
      await asMigrator<{
        status: string;
        accepted_by: string | null;
        revoked_by: string | null;
        invitee_email_norm: string;
        token_hash: string;
      }>(db, 'SELECT status, accepted_by, revoked_by, invitee_email_norm, token_hash FROM app.org_invitations WHERE id = $1', [id])
    )[0];
  const memberRow = async (orgId: string, userId: string) =>
    (
      await asMigrator<{
        role: string;
        status: string;
        grant_basis: string;
        invitation_id: string | null;
        granted_by: string;
        removed_at: Date | null;
        removed_by: string | null;
        removal_basis: string | null;
      }>(
        db,
        `SELECT role, status, grant_basis, invitation_id, granted_by, removed_at, removed_by, removal_basis
           FROM app.org_members WHERE org_id = $1 AND user_id = $2`,
        [orgId, userId],
      )
    )[0];

  it('M2-AC03/1 the lifecycle: create answers the token once and stores only its sha256; the addressed person previews and accepts; the link cannot be used twice', async () => {
    const orgId = await createOrgAs(api, carol, 'Lifecycle Org');
    const created = await post(carol.headers, `/orgs/${orgId}/invitations`, { email: '  Dave@Example.TEST ', role: 'member' });
    expect(created.statusCode).toBe(201);
    expect(created.headers.vary).toBe('Authorization');
    const { invitation, token } = created.json() as CreateInvitationResponse;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invitation).toMatchObject({ inviteeEmailNorm: 'dave@example.test', role: 'member' });

    // Only the hash is stored, and the lifetime is exactly the contract's number of days, on the database clock.
    const stored = await invitationRow(invitation.id);
    expect(stored).toMatchObject({ status: 'pending', token_hash: sha256(token), invitee_email_norm: 'dave@example.test' });
    const [lifetime] = await asMigrator<{ exact: boolean }>(
      db,
      `SELECT expires_at - created_at = make_interval(days => $2) AS exact FROM app.org_invitations WHERE id = $1`,
      [invitation.id, INVITATION_LIFETIME_DAYS],
    );
    expect(lifetime).toEqual({ exact: true });
    const everyColumn = await asMigrator<{ row: string }>(db, 'SELECT row_to_json(i)::text AS row FROM app.org_invitations i');
    for (const { row } of everyColumn) expect(row).not.toContain(token);

    // The addressed person sees the org, the role and the expiry.
    const seen = await preview(dave, token);
    expect(seen.statusCode).toBe(200);
    expect(seen.json()).toEqual({
      state: 'pending',
      org: { id: orgId, name: 'Lifecycle Org' },
      role: 'member',
      expiresAt: invitation.expiresAt,
    });
    // Anybody else learns only that it is not theirs.
    const other = await preview(erin, token);
    expect(other.statusCode).toBe(200);
    expect(other.json()).toEqual({ state: 'email_mismatch' });

    const accepted = await accept(dave, token);
    expect(accepted.statusCode).toBe(200);
    const body = accepted.json() as AcceptInvitationResponse;
    expect(body.org).toMatchObject({ id: orgId, name: 'Lifecycle Org', dataOrigin: 'live' });
    expect(body.membership).toMatchObject({ orgId, userId: DAVE.userId, role: 'member', status: 'active', grantBasis: 'invitation' });
    expect(await memberRow(orgId, DAVE.userId)).toMatchObject({
      grant_basis: 'invitation',
      invitation_id: invitation.id,
      granted_by: CAROL.userId,
    });
    expect(await invitationRow(invitation.id)).toMatchObject({ status: 'accepted', accepted_by: DAVE.userId });
    expect(((await preview(dave, token)).json() as InvitationPreviewResponse).state).toBe('accepted');

    // Single use.
    const again = await accept(dave, token);
    expect(again.statusCode).toBe(403);
    expect(again.json()).toEqual(errorBody('invitation.used'));

    const rows = await auditRows(db, { contextOrgId: orgId });
    expect(rows.map((row) => [row.action, row.outcome, row.actor_user_id, row.denial_code])).toEqual([
      ['org.create', 'allowed', CAROL.userId, null],
      ['invitation.create', 'allowed', CAROL.userId, null],
      ['invitation.accept', 'allowed', DAVE.userId, null],
      ['invitation.accept', 'denied', DAVE.userId, 'invitation.used'],
    ]);
    expect(rows[1]).toMatchObject({ target_type: 'org_invitation', target_id: invitation.id, summary: { after: { role: 'member', status: 'pending' } } });
    expect(rows[2]).toMatchObject({
      target_type: 'org_invitation',
      target_id: invitation.id,
      summary: { before: { status: 'pending' }, after: { status: 'accepted', role: 'member' } },
    });
  });

  it('M2-AC03/2 a wrong account cannot accept (403 invitation.email_mismatch, audited): no membership, and the link still works for its addressee', async () => {
    const orgId = await createOrgAs(api, carol, 'Wrong Recipient');
    const { invitationId, token } = await inviteAs(api, carol, orgId, DAVE.email);

    const wrong = await accept(erin, token);
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toEqual(errorBody('invitation.email_mismatch'));
    expect(await memberRow(orgId, ERIN.userId)).toBeUndefined();
    expect(await invitationRow(invitationId)).toMatchObject({ status: 'pending' });
    const [denial] = await auditRows(db, { actorUserId: ERIN.userId, contextOrgId: orgId });
    expect(denial).toMatchObject({
      action: 'invitation.accept',
      outcome: 'denied',
      denial_code: 'invitation.email_mismatch',
      target_type: 'org_invitation',
      target_id: invitationId,
    });

    // A token without an email claim has no verified address to judge: 401, like sign-in, and not audited.
    const noClaim = await identity.signToken({ sub: ERIN.userId, sessionId: ERIN.sessionId, email: null });
    const before = await apiAuditCount(db);
    for (const url of ['/invitations/preview', '/invitations/accept']) {
      const response = await post(bearer(noClaim), url, { token });
      expect(response.statusCode, url).toBe(401);
      expect(response.json(), url).toEqual(errorBody('unauthenticated'));
    }
    expect(await apiAuditCount(db)).toBe(before);

    expect((await accept(dave, token)).statusCode).toBe(200);
  });

  it('M2-AC03/2 an expired invitation previews as expired and is refused at accept (403 invitation.expired); re-inviting the address supersedes it', async () => {
    const orgId = await createOrgAs(api, carol, 'Expiry Org');
    const first = await inviteAs(api, carol, orgId, FRANK.email);
    await asMigrator(db, `UPDATE app.org_invitations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [first.invitationId]);

    expect(((await preview(frank, first.token)).json() as InvitationPreviewResponse).state).toBe('expired');
    const late = await accept(frank, first.token);
    expect(late.statusCode).toBe(403);
    expect(late.json()).toEqual(errorBody('invitation.expired'));
    expect(await memberRow(orgId, FRANK.userId)).toBeUndefined();

    // A pending but expired invitation does not block a new one: it is revoked by the inviter.
    const second = await inviteAs(api, carol, orgId, FRANK.email);
    expect(await invitationRow(first.invitationId)).toMatchObject({ status: 'revoked', revoked_by: CAROL.userId });
    expect(await invitationRow(second.invitationId)).toMatchObject({ status: 'pending' });
    const superseded = await auditRows(db, { contextOrgId: orgId, action: 'invitation.revoke' });
    expect(superseded).toEqual([
      expect.objectContaining({
        outcome: 'allowed',
        target_id: first.invitationId,
        summary: { before: { status: 'pending' }, after: { status: 'revoked' } },
      }),
    ]);

    const old = await accept(frank, first.token);
    expect(old.statusCode).toBe(403);
    expect(old.json()).toEqual(errorBody('invitation.invalid'));
    expect((await accept(frank, second.token)).statusCode).toBe(200);
    expect(await auditRows(db, { contextOrgId: orgId, denialCode: 'invitation.expired' })).toHaveLength(1);
  });

  it('M2-AC03/2 a second pending invitation for the same address (in any case) is 409 invitation.pending with a denial row', async () => {
    const orgId = await createOrgAs(api, carol, 'Pending Twice');
    const { invitationId } = await inviteAs(api, carol, orgId, 'twice@example.test');
    const response = await post(carol.headers, `/orgs/${orgId}/invitations`, { email: 'TWICE@example.test', role: 'admin' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(errorBody('invitation.pending'));
    const pending = await asMigrator(db, `SELECT id FROM app.org_invitations WHERE org_id = $1 AND status = 'pending'`, [orgId]);
    expect(pending).toEqual([{ id: invitationId }]);
    const [denial] = await auditRows(db, { contextOrgId: orgId, denialCode: 'invitation.pending' });
    expect(denial).toMatchObject({ action: 'invitation.create', reason: 'pending_exists', target_id: invitationId });
    // The row never carries the address.
    expect(JSON.stringify(denial)).not.toContain('twice@');
  });

  it('M2-AC03/2 revoking: an admin revokes a pending invitation; a second revoke is 409 invitation.not_pending; the revoked link is 403 invitation.invalid at preview and at accept', async () => {
    const orgId = await createOrgAs(api, carol, 'Revoke Org');
    const { invitationId, token } = await inviteAs(api, carol, orgId, DAVE.email);

    const revoked = await post(carol.headers, `/orgs/${orgId}/invitations/${invitationId}/revoke`);
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toEqual({ invitation: { id: invitationId, status: 'revoked' } } satisfies RevokeInvitationResponse);
    expect(await invitationRow(invitationId)).toMatchObject({ status: 'revoked', revoked_by: CAROL.userId });

    const twice = await post(carol.headers, `/orgs/${orgId}/invitations/${invitationId}/revoke`);
    expect(twice.statusCode).toBe(409);
    expect(twice.json()).toEqual(errorBody('invitation.not_pending'));

    for (const response of [await preview(dave, token), await accept(dave, token)]) {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual(errorBody('invitation.invalid'));
    }
    expect(await memberRow(orgId, DAVE.userId)).toBeUndefined();

    const rows = await auditRows(db, { contextOrgId: orgId, outcome: 'denied' });
    expect(rows.map((row) => [row.action, row.denial_code, row.reason])).toEqual([
      ['invitation.revoke', 'invitation.not_pending', 'not_pending'],
      ['invitation.preview', 'invitation.invalid', 'revoked'],
      ['invitation.accept', 'invitation.invalid', 'revoked'],
    ]);
    const [allowed] = await auditRows(db, { contextOrgId: orgId, action: 'invitation.revoke', outcome: 'allowed' });
    expect(allowed).toMatchObject({ target_id: invitationId, summary: { before: { status: 'pending' }, after: { status: 'revoked' } } });
  });

  it('M2-AC03/1 an existing member who accepts closes the invitation (revoked by themselves) and gets 409 invitation.already_member with exactly one denial row', async () => {
    const orgId = await createOrgAs(api, carol, 'Already In');
    await asOrgMember(api, carol, orgId, dave);
    const { invitationId, token } = await inviteAs(api, carol, orgId, DAVE.email, 'admin');

    const before = await apiAuditCount(db);
    const response = await accept(dave, token);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(errorBody('invitation.already_member'));
    expect(await apiAuditCount(db)).toBe(before + 1);

    expect(await invitationRow(invitationId)).toMatchObject({ status: 'revoked', revoked_by: DAVE.userId });
    // The active row was not rewritten: still a member, on the first grant.
    expect(await memberRow(orgId, DAVE.userId)).toMatchObject({ role: 'member', status: 'active' });
    const [denial] = await auditRows(db, { contextOrgId: orgId, denialCode: 'invitation.already_member' });
    expect(denial).toMatchObject({
      action: 'invitation.accept',
      actor_user_id: DAVE.userId,
      target_id: invitationId,
      summary: { before: { status: 'pending' }, after: { status: 'revoked' } },
    });
  });

  it('M2-AC03/1 a person removed and invited again: accepting makes the same membership row active on the new grant', async () => {
    const orgId = await createOrgAs(api, carol, 'Come Back');
    await asOrgMember(api, carol, orgId, frank);
    expect((await post(carol.headers, `/orgs/${orgId}/members/${FRANK.userId}/remove`)).statusCode).toBe(200);
    expect(await memberRow(orgId, FRANK.userId)).toMatchObject({ status: 'removed', removal_basis: 'removed_by_admin' });

    const { invitationId, token } = await inviteAs(api, carol, orgId, FRANK.email, 'admin');
    const response = await accept(frank, token);
    expect(response.statusCode).toBe(200);
    expect(await memberRow(orgId, FRANK.userId)).toEqual({
      role: 'admin',
      status: 'active',
      grant_basis: 'invitation',
      invitation_id: invitationId,
      granted_by: CAROL.userId,
      removed_at: null,
      removed_by: null,
      removal_basis: null,
    });
    expect(await asMigrator(db, 'SELECT 1 FROM app.org_members WHERE org_id = $1 AND user_id = $2', [orgId, FRANK.userId])).toHaveLength(1);
  });

  it('M2-AC03/2 cross-org: revoking B’s invitation through A’s path is 404 invitation.not_found with a denial row, and B’s invitation stays pending', async () => {
    const orgA = await createOrgAs(api, carol, 'Invite Cross A');
    const orgB = await createOrgAs(api, dave, 'Invite Cross B');
    const inB = await inviteAs(api, dave, orgB, ERIN.email);

    const response = await post(carol.headers, `/orgs/${orgA}/invitations/${inB.invitationId}/revoke`);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual(errorBody('invitation.not_found'));
    expect(await invitationRow(inB.invitationId)).toMatchObject({ status: 'pending' });
    const [denial] = await auditRows(db, { actorUserId: CAROL.userId, contextOrgId: orgA, outcome: 'denied' });
    expect(denial).toMatchObject({
      action: 'invitation.revoke',
      denial_code: 'invitation.not_found',
      reason: 'not_in_org',
      target_type: 'org_invitation',
      target_id: inB.invitationId,
    });
    // And an outsider cannot revoke it through its own org's path either.
    const outsider = await post(erin.headers, `/orgs/${orgB}/invitations/${inB.invitationId}/revoke`);
    expect(outsider.statusCode).toBe(403);
    expect(outsider.json()).toEqual(errorBody('org.forbidden'));
    expect(await invitationRow(inB.invitationId)).toMatchObject({ status: 'pending' });
  });

  it('M2-AC03/2 malformed input is 400 and not audited; a well-formed unknown token is 403 invitation.invalid and audited, with no org', async () => {
    const orgId = await createOrgAs(api, carol, 'Bad Input');
    const before = await apiAuditCount(db);
    const malformed = [
      post(carol.headers, `/orgs/${orgId}/invitations`, { email: 'not-an-address', role: 'member' }),
      post(carol.headers, `/orgs/${orgId}/invitations`, { email: 'x@example.test', role: 'owner' }),
      post(carol.headers, `/orgs/not-a-uuid/invitations`, { email: 'x@example.test', role: 'member' }),
      post(carol.headers, `/orgs/${orgId}/invitations/not-a-uuid/revoke`),
      post(dave.headers, '/invitations/preview', { token: 'short' }),
      post(dave.headers, '/invitations/accept', { token: `${'A'.repeat(42)}+` }),
      post(dave.headers, '/invitations/accept', {}),
    ];
    for (const attempt of malformed) {
      const response = await attempt;
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(errorBody('bad_request'));
    }
    expect(await apiAuditCount(db)).toBe(before);

    for (const [url, action] of [
      ['/invitations/preview', 'invitation.preview'],
      ['/invitations/accept', 'invitation.accept'],
    ] as const) {
      const response = await post(dave.headers, url, { token: UNKNOWN_TOKEN });
      expect(response.statusCode, url).toBe(403);
      expect(response.json(), url).toEqual(errorBody('invitation.invalid'));
      const rows = await auditRows(db, { actorUserId: DAVE.userId, action, denialCode: 'invitation.invalid' });
      expect(rows.at(-1), url).toMatchObject({ reason: 'unknown_token', context_org_id: null, target_id: null });
    }
    expect(await apiAuditCount(db)).toBe(before + 2);
  });

  it('M2-AC03/2 two tabs racing to accept one link: one joins, the other sees invitation.used under the row lock, and nothing answers 500', async () => {
    const orgId = await createOrgAs(api, carol, 'Two Tabs');
    const { token } = await inviteAs(api, carol, orgId, ERIN.email);
    const responses = await Promise.all([accept(erin, token), accept(erin, token)]);
    const statuses = responses.map((response) => response.statusCode).sort();
    expect(statuses).toEqual([200, 403]);
    const refused = responses.find((response) => response.statusCode === 403)!;
    expect(refused.json()).toEqual(errorBody('invitation.used'));
    expect(await memberRow(orgId, ERIN.userId)).toMatchObject({ status: 'active', role: 'member' });
  });
});
