/**
 * The audit contract end to end (M2-03 code review R3, R4, R12, R13 *api int*;
 * ruling D9). Identities are simulated (a local key pair, the real hook); the
 * database is a real PostgreSQL 17, written by the app as `wringy_api_login` and
 * read back here as the migrator, because the runtime role cannot read
 * `app.audit_log`.
 *
 * - The R12 table: every error code driven once, with its status, its code and
 *   the exact number of audit rows it wrote — one for a refusal of the
 *   authorisation logic, none for a refusal decided before an actor is admitted.
 * - Atomicity: with a trigger planted on `app.audit_log` that refuses every
 *   insert, a command writes nothing at all, and a denial is still answered as
 *   the refusal it is, with a `warn` line.
 * - Leaks: after every row above, no audit row and no log line contains an
 *   invitation token (malformed and unknown ones included), a bearer token, a
 *   session id or an address.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CreateInvitationResponse } from '@wringy/contracts';

import { requireOrgCapability } from '../../src/authorize';
import { createApiPool } from '../../src/database';
import { errorBody, ERROR_MESSAGES, type ErrorCode } from '../../src/errors';
import { databaseLiveness } from '../../src/session-liveness';
import { bearer, createTestIdentity, type TestIdentity } from './jwt-support';
import {
  apiAuditCount,
  asMigrator,
  asOrgMember,
  buildTestApi,
  createOrgAs,
  createTestDatabase,
  endSession,
  logsOfRequest,
  person,
  signedIn,
  stubLiveness,
  type AuditRow,
  type PersonSpec,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

const spec = (n: number, name: string): PersonSpec => ({
  userId: `0a0d1700-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
  sessionId: `5e550000-0000-4000-8000-0000000003${String(n).padStart(2, '0')}`,
  email: `${name.toLowerCase()}@example.test`,
  name,
});
const CAROL = spec(1, 'Carol');
const DAVE = spec(2, 'Dave');
const ERIN = spec(3, 'Erin');
const FRANK = spec(4, 'Frank');
const IVY = spec(5, 'Ivy');
const JACK = spec(6, 'Jack');
/** Signed in with a verified token, but never through POST /identity/sign-in: no profile row. */
const HENRY = spec(7, 'Henry');

type Response = Awaited<ReturnType<TestApi['app']['inject']>>;

describe('M2-AC03 the audit log: one row per authorisation refusal, none before admission, nothing secret (simulated identities)', () => {
  let db: TestDatabase;
  let identity: TestIdentity;
  let api: TestApi;
  /** An app whose commands ask the real `platform.session_is_live`. */
  let liveApi: TestApi;
  /** An app whose liveness check can never answer. */
  let blindApi: TestApi;
  /** An app with a route of a later ticket behind `requireOrgCapability(…, 'review')`. */
  let guardedApi: TestApi;
  let guardPool: ReturnType<typeof createApiPool>;
  let livePool: ReturnType<typeof createApiPool>;
  let carol: SignedIn;
  let dave: SignedIn;
  let erin: SignedIn;
  let frank: SignedIn;
  let ivy: SignedIn;
  let jack: SignedIn;
  let henry: SignedIn;
  /** Carol's org; Dave is a member. */
  let orgT = '';
  /** Carol's second org, for the invitation rows. */
  let orgI = '';
  /** Every invitation token this file has seen, for the leak scan. */
  const tokens: string[] = [];

  beforeAll(async () => {
    db = await createTestDatabase();
    identity = await createTestIdentity();
    carol = await person(db, identity, CAROL);
    dave = await person(db, identity, DAVE);
    erin = await person(db, identity, ERIN);
    frank = await person(db, identity, FRANK);
    ivy = await person(db, identity, IVY);
    jack = await person(db, identity, JACK);
    henry = await signedIn(db, identity, {
      userId: HENRY.userId,
      sessionId: HENRY.sessionId,
      contactEmail: HENRY.email,
      displayName: HENRY.name,
      withProfile: false,
    });
    api = await buildTestApi(db.urls.api, { identity });
    livePool = createApiPool(db.urls.api, () => {});
    liveApi = await buildTestApi(db.urls.api, { identity, liveness: databaseLiveness(livePool) });
    blindApi = await buildTestApi(db.urls.api, { identity, liveness: stubLiveness('unavailable') });
    guardPool = createApiPool(db.urls.api, () => {});
    guardedApi = await buildTestApi(db.urls.api, { identity });
    guardedApi.app.register(async (scope) => {
      scope.addHook('onRequest', scope.authenticate);
      scope.addHook('preHandler', requireOrgCapability(guardPool, 'review'));
      scope.get('/probe/review/:orgId', async () => ({ ok: true }));
    });

    orgT = await createOrgAs(api, carol, 'Audit Table');
    await asOrgMember(api, carol, orgT, dave);
    orgI = await createOrgAs(api, carol, 'Audit Invitations');
  });

  afterAll(async () => {
    await Promise.all([api?.close(), liveApi?.close(), blindApi?.close(), guardedApi?.close()]);
    await Promise.all([livePool?.end().catch(() => {}), guardPool?.end().catch(() => {})]);
    await db?.drop();
  });

  const inject = (app: TestApi, method: 'GET' | 'POST', url: string, headers?: { authorization: string }, payload?: object) =>
    app.app.inject({ method, url, ...(headers === undefined ? {} : { headers }), ...(payload === undefined ? {} : { payload }) });
  const post = (who: SignedIn, url: string, payload?: object) => inject(api, 'POST', url, who.headers, payload);
  const invite = async (orgId: string, email: string): Promise<{ id: string; token: string }> => {
    const response = await post(carol, `/orgs/${orgId}/invitations`, { email, role: 'member' });
    expect(response.statusCode).toBe(201);
    const body = response.json() as CreateInvitationResponse;
    tokens.push(body.token);
    return { id: body.invitation.id, token: body.token };
  };
  const latestApiRow = async () =>
    (
      await asMigrator<AuditRow>(
        db,
        `SELECT recorded_by, actor_kind, actor_user_id, context_org_id, action, target_type, target_id, outcome,
                denial_code, reason, summary, request_id, session_ref
           FROM app.audit_log WHERE recorded_by = 'wringy_api_login' ORDER BY id DESC LIMIT 1`,
      )
    )[0];

  interface Row {
    code: ErrorCode;
    status: number;
    /** 1 for a refusal of the authorisation logic, 0 for one decided before (R4's scope). */
    rows: 0 | 1;
    /** Arranges what the row needs and returns the one request that is measured. */
    arrange: () => Promise<() => Promise<Response>>;
  }

  const TABLE: Row[] = [
    { code: 'org.forbidden', status: 403, rows: 1, arrange: async () => () => inject(api, 'GET', `/orgs/${orgT}`, erin.headers) },
    {
      code: 'org.admin_required',
      status: 403,
      rows: 1,
      arrange: async () => () => post(dave, `/orgs/${orgT}/rename`, { name: 'Dave Rules' }),
    },
    {
      code: 'org.last_admin',
      status: 409,
      rows: 1,
      arrange: async () => {
        const alone = await createOrgAs(api, carol, 'Audit Alone');
        return () => post(carol, `/orgs/${alone}/leave`);
      },
    },
    {
      code: 'member.not_found',
      status: 404,
      rows: 1,
      arrange: async () => () => post(carol, `/orgs/${orgT}/members/${ERIN.userId}/role`, { role: 'admin' }),
    },
    {
      code: 'member.self',
      status: 409,
      rows: 1,
      arrange: async () => () => post(carol, `/orgs/${orgT}/members/${CAROL.userId}/remove`),
    },
    {
      code: 'invitation.invalid',
      status: 403,
      rows: 1,
      arrange: async () => {
        const unknown = `unknown-${'q'.repeat(35)}`;
        tokens.push(unknown);
        return () => post(dave, '/invitations/accept', { token: unknown });
      },
    },
    {
      code: 'invitation.used',
      status: 403,
      rows: 1,
      arrange: async () => {
        const { token } = await invite(orgI, FRANK.email);
        expect((await post(frank, '/invitations/accept', { token })).statusCode).toBe(200);
        return () => post(frank, '/invitations/accept', { token });
      },
    },
    {
      code: 'invitation.expired',
      status: 403,
      rows: 1,
      arrange: async () => {
        const { id, token } = await invite(orgI, IVY.email);
        await asMigrator(db, `UPDATE app.org_invitations SET expires_at = now() - interval '1 second' WHERE id = $1`, [id]);
        return () => post(ivy, '/invitations/accept', { token });
      },
    },
    {
      code: 'invitation.email_mismatch',
      status: 403,
      rows: 1,
      arrange: async () => {
        const { token } = await invite(orgI, 'somebody.else@example.test');
        return () => post(dave, '/invitations/accept', { token });
      },
    },
    {
      code: 'invitation.already_member',
      status: 409,
      rows: 1,
      arrange: async () => {
        const { token } = await invite(orgT, DAVE.email);
        return () => post(dave, '/invitations/accept', { token });
      },
    },
    {
      code: 'invitation.pending',
      status: 409,
      rows: 1,
      arrange: async () => {
        await invite(orgT, 'pending.table@example.test');
        return () => post(carol, `/orgs/${orgT}/invitations`, { email: 'pending.table@example.test', role: 'member' });
      },
    },
    {
      code: 'invitation.not_found',
      status: 404,
      rows: 1,
      arrange: async () => () => post(carol, `/orgs/${orgT}/invitations/${randomUUID()}/revoke`),
    },
    {
      code: 'invitation.not_pending',
      status: 409,
      rows: 1,
      arrange: async () => {
        const { id } = await invite(orgT, 'revoked.table@example.test');
        expect((await post(carol, `/orgs/${orgT}/invitations/${id}/revoke`)).statusCode).toBe(200);
        return () => post(carol, `/orgs/${orgT}/invitations/${id}/revoke`);
      },
    },
    {
      code: 'capability.script_only',
      status: 403,
      rows: 1,
      arrange: async () => () => post(dave, `/orgs/${orgT}/capabilities`, { capability: 'review' }),
    },
    {
      code: 'capability.required',
      status: 403,
      rows: 1,
      arrange: async () => () => inject(guardedApi, 'GET', `/probe/review/${orgT}`, carol.headers),
    },
    // Decided before an actor is admitted: logged as a reason word, never audited.
    { code: 'unauthenticated', status: 401, rows: 0, arrange: async () => () => inject(api, 'GET', `/orgs/${orgT}`) },
    {
      code: 'auth.expired',
      status: 401,
      rows: 0,
      arrange: async () => {
        const expired = await identity.signToken({ sub: CAROL.userId, sessionId: CAROL.sessionId, email: CAROL.email, expiresIn: -60 });
        return () => inject(api, 'POST', `/orgs/${orgT}/rename`, bearer(expired), { name: 'Expired' });
      },
    },
    {
      code: 'profile.missing',
      status: 403,
      rows: 0,
      arrange: async () => () => inject(api, 'GET', `/orgs/${orgT}`, henry.headers),
    },
    {
      code: 'account.disabled',
      status: 403,
      rows: 0,
      arrange: async () => {
        await asMigrator(db, `UPDATE app.profiles SET status = 'disabled' WHERE id = $1`, [IVY.userId]);
        return () => inject(api, 'GET', `/orgs/${orgT}`, ivy.headers);
      },
    },
    {
      code: 'session.revoked',
      status: 401,
      rows: 0,
      arrange: async () => {
        await endSession(db, JACK.sessionId);
        return () => inject(liveApi, 'POST', `/orgs/${orgT}/capabilities`, jack.headers);
      },
    },
    {
      code: 'session_check_unavailable',
      status: 503,
      rows: 0,
      arrange: async () => () => inject(blindApi, 'POST', `/orgs/${orgT}/rename`, carol.headers, { name: 'Blind' }),
    },
    {
      code: 'bad_request',
      status: 400,
      rows: 0,
      arrange: async () => () => post(carol, `/orgs/${orgT}/rename`, { name: '' }),
    },
  ];

  it('M2-AC03/3 the R12 table: every code answers its status and writes exactly the audit rows it should — one per authorisation refusal, none before admission', async () => {
    // Every organisation code in errors.ts is in the table: a new one cannot skip this row.
    const domainCodes = Object.keys(ERROR_MESSAGES).filter((code) => /^(org|member|invitation|capability)\./.test(code));
    expect(TABLE.map((row) => row.code)).toEqual(expect.arrayContaining(domainCodes));
    for (const code of domainCodes) expect(TABLE.find((row) => row.code === code)?.rows, code).toBe(1);

    for (const row of TABLE) {
      const request = await row.arrange();
      const before = await apiAuditCount(db);
      const response = await request();
      expect(response.statusCode, row.code).toBe(row.status);
      expect(response.json(), row.code).toEqual(errorBody(row.code));
      expect((await apiAuditCount(db)) - before, row.code).toBe(row.rows);
      if (row.rows === 1) {
        expect(await latestApiRow(), row.code).toMatchObject({ outcome: 'denied', denial_code: row.code, actor_kind: 'user' });
      }
    }
  });

  it('M2-AC03/3 a command and its audit row are one transaction: with the audit insert refused, a command writes nothing (500), and a denial is still answered with a warn line', async () => {
    const orgId = await createOrgAs(api, carol, 'Planted Trigger');
    const { token } = await invite(orgId, ERIN.email);
    await asMigrator(
      db,
      `CREATE FUNCTION ops.wringy_test_refuse_api_audit() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         RAISE EXCEPTION 'audit insert refused by a test trigger';
       END
       $$`,
    );
    await asMigrator(
      db,
      `CREATE TRIGGER wringy_test_refuse_api_audit BEFORE INSERT ON app.audit_log
       FOR EACH ROW EXECUTE FUNCTION ops.wringy_test_refuse_api_audit()`,
    );
    try {
      const commands = [
        post(carol, '/orgs', { name: 'Never Audited' }),
        post(carol, `/orgs/${orgId}/rename`, { name: 'Never Renamed' }),
        post(carol, `/orgs/${orgId}/invitations`, { email: 'never.invited@example.test', role: 'member' }),
        post(erin, '/invitations/accept', { token }),
      ];
      for (const command of commands) {
        const response = await command;
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual(errorBody('internal_error'));
      }
      expect(await asMigrator(db, `SELECT 1 FROM app.orgs WHERE name IN ('Never Audited', 'Never Renamed')`)).toEqual([]);
      expect(await asMigrator<{ name: string }>(db, 'SELECT name FROM app.orgs WHERE id = $1', [orgId])).toEqual([
        { name: 'Planted Trigger' },
      ]);
      expect(
        await asMigrator(db, `SELECT 1 FROM app.org_invitations WHERE invitee_email_norm = 'never.invited@example.test'`),
      ).toEqual([]);
      expect(await asMigrator(db, 'SELECT 1 FROM app.org_members WHERE org_id = $1 AND user_id = $2', [orgId, ERIN.userId])).toEqual([]);
      expect(
        await asMigrator<{ status: string }>(db, `SELECT status FROM app.org_invitations WHERE org_id = $1`, [orgId]),
      ).toEqual([{ status: 'pending' }]);

      // A refusal is still the refusal, read or command; its row could not be written, which is logged.
      for (const [refused, code] of [
        [await inject(api, 'GET', `/orgs/${orgId}`, dave.headers), 'org.forbidden'],
        [await post(dave, `/orgs/${orgId}/rename`, { name: 'Dave' }), 'org.forbidden'],
      ] as const) {
        expect(refused.statusCode).toBe(403);
        expect(refused.json()).toEqual(errorBody(code));
      }
      const warnings = api.logs.records.filter((line) => line.level === 40 && line.reason === 'audit_write_failed');
      expect(warnings).toHaveLength(2);
      for (const warning of warnings) {
        expect(warning.msg).toBe('denial audit row not written');
        expect(logsOfRequest(api.logs, String(warning.reqId)).some((line) => line.msg === 'request refused')).toBe(true);
      }
    } finally {
      await asMigrator(db, 'DROP TRIGGER wringy_test_refuse_api_audit ON app.audit_log');
      await asMigrator(db, 'DROP FUNCTION ops.wringy_test_refuse_api_audit()');
    }
    // With the trigger gone the same command writes its change and its row.
    expect((await post(carol, `/orgs/${orgId}/rename`, { name: 'Renamed At Last' })).statusCode).toBe(200);
  });

  it('M2-AC03/3 nothing secret is stored or logged: no audit row and no log line holds an invitation token (malformed and unknown included), a bearer token, a session id or an address', async () => {
    // Tokens the API never accepted still must not reach a log line.
    const malformed = 'malformed-canary-token-value';
    const unknown = `unknown-canary-${'z'.repeat(28)}`;
    tokens.push(malformed, unknown);
    expect((await post(dave, '/invitations/preview', { token: malformed })).statusCode).toBe(400);
    expect((await post(dave, '/invitations/accept', { token: malformed })).statusCode).toBe(400);
    expect((await post(dave, '/invitations/preview', { token: unknown })).statusCode).toBe(403);
    expect((await post(dave, '/invitations/accept', { token: unknown })).statusCode).toBe(403);
    // And a fresh lifecycle, so the scan covers an issued, previewed and accepted token too.
    const orgId = await createOrgAs(api, carol, 'Leak Scan');
    const { token } = await invite(orgId, JACK.email);
    // `api` answers liveness with a stub, so Jack's ended session (the session.revoked row) does not matter here.
    expect((await post(jack, '/invitations/preview', { token })).statusCode).toBe(200);
    expect((await post(jack, '/invitations/accept', { token })).statusCode).toBe(200);

    const people = [carol, dave, erin, frank, ivy, jack, henry];
    const secrets = [
      ...tokens,
      ...people.map((who) => who.token),
      ...people.map((who) => who.sessionId),
      ...people.map((who) => who.contactEmail),
      'somebody.else@example.test',
      'pending.table@example.test',
      'revoked.table@example.test',
      'never.invited@example.test',
    ];
    expect(tokens.length).toBeGreaterThanOrEqual(10);

    const rows = await asMigrator<{ row: string }>(db, 'SELECT row_to_json(a)::text AS row FROM app.audit_log a');
    expect(rows.length).toBeGreaterThan(20);
    const logText = [api, liveApi, blindApi, guardedApi].map((app) => app.logs.text).join('\n');
    expect(logText.length).toBeGreaterThan(0);
    for (const secret of secrets) {
      for (const { row } of rows) expect(row.includes(secret), 'an audit row holds a secret').toBe(false);
      expect(logText.includes(secret), 'a log line holds a secret').toBe(false);
    }
    // No address of any kind in the log or the rows, however it is spelled.
    for (const { row } of rows) expect(row).not.toContain('@');
  });
});
