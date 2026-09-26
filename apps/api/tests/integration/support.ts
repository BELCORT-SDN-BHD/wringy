/**
 * API integration-test support on the @wringy/db harness, imported as
 * `@wringy/db/testing` (packages/db/test/harness.ts); vitest.int.config.ts runs
 * the same harness's global setup (`@wringy/db/testing/global-setup`). The
 * harness module also carries the `ProvidedContext` augmentation its `inject()`
 * relies on.
 *
 * Since M2-02 the app under test is always built with the **real** authentication
 * hook (there is no no-op left to build it with): `buildTestApi(url, { identity })`
 * verifies tokens against that identity's local key set, so every test that reaches
 * an authenticated route signs one. `signedIn()` arranges the whole shape a route
 * needs — a profile row, a live session row, and a token for both.
 *
 * M2-03 adds the organisation helpers (`createOrgAs`, `inviteAs`, `asOrgMember`)
 * — which arrange through the API's own routes, so an arranged membership is one
 * the product could have written — the operator's grant functions run as the
 * migrator (`grantCapability`, `revokeCapability`, `grantPlatform`), and the
 * audit readers (`auditRows`, `apiAuditCount`), which read `app.audit_log` as the
 * migrator because the runtime role has no SELECT on it. `underBarrier` runs
 * requests that must contend for one org's lock at the same moment (the R13
 * barrier rows of authorize.int.test.ts and invitations.int.test.ts).
 */
import pg from 'pg';
import { expect } from 'vitest';

import type { CreateInvitationResponse, CreateOrgResponse, OrgRole } from '@wringy/contracts';
import {
  grantOrgCapability,
  grantPlatformCapability,
  revokeOrgCapability,
  type OrgGrantCapability,
  type PlatformGrantCapability,
} from '@wringy/db';
import {
  cluster,
  createTestDatabase,
  endSession,
  insertLiveSession,
  seedFixtures,
  sqlState,
  TEST_WRINGY_ENV,
  withClientAt,
  type TestDatabase,
} from '@wringy/db/testing';

import { buildApp, type ApiApp, type BuildAppOptions } from '../../src/app';
import { createSupabaseAuthenticate, type AuthenticateHook, type ReadProfile } from '../../src/authenticate';
import { API_APPLICATION_NAME, API_STATEMENT_TIMEOUT_MS, createApiPool, withDatabase } from '../../src/database';
import { readProfileById } from '../../src/profiles';
import type { LivenessResult, SessionLiveness } from '../../src/session-liveness';
import { bearer, type TestIdentity } from './jwt-support';

export {
  bearer,
  createTestDatabase,
  endSession,
  insertLiveSession,
  seedFixtures,
  sqlState,
  TEST_WRINGY_ENV,
  withClientAt,
  type TestDatabase,
};

/** Collects the app's pino output, one parsed JSON object per line, plus the raw text. */
export class LogCapture {
  readonly lines: string[] = [];

  write(line: string): void {
    this.lines.push(line);
  }

  get text(): string {
    return this.lines.join('');
  }

  get records(): Array<Record<string, unknown>> {
    return this.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}

/** A liveness port that always gives the same answer, for tests about something else. */
export function stubLiveness(state: LivenessResult = 'live'): SessionLiveness {
  return { check: async () => state };
}

export interface TestApi {
  app: ApiApp;
  logs: LogCapture;
  close(): Promise<void>;
}

export interface BuildTestApiOptions extends Omit<BuildAppOptions, 'pool' | 'logStream' | 'authenticate' | 'liveness'> {
  /**
   * The signing identity whose tokens this app accepts. The hook is the real
   * `createSupabaseAuthenticate` over that identity's local key set and a profile
   * read on the app's own pool, so nothing about verification is stubbed.
   */
  identity?: TestIdentity;
  /** How commands answer "is this session live?"; a permanent `live` when omitted. */
  liveness?: SessionLiveness;
  /** Replaces the hook wholesale, for a test about the hook point itself. */
  authenticate?: AuthenticateHook;
  /**
   * The hook's profile read; the app's own pool when omitted.
   *
   * The seam exists for one kind of row: the commands re-read the account inside
   * their own transaction (M2-02 R6), and the only way to prove that guard is to
   * make the hook disagree with the database — a hook that saw `active` while the
   * row says `disabled`, which is exactly the race an operator disabling an
   * account mid-request creates. Nothing about verification is stubbed by it.
   */
  readProfile?: ReadProfile;
}

/**
 * The app as src/server.ts builds it (pool as wringy_api_login, application
 * name wringy-api), without listening; drive it with app.inject().
 */
export async function buildTestApi(databaseUrl: string, options: BuildTestApiOptions = {}): Promise<TestApi> {
  const { identity, liveness = stubLiveness('live'), authenticate, readProfile, ...rest } = options;
  const logs = new LogCapture();
  const pool = createApiPool(databaseUrl, () => {});
  const hook =
    authenticate ??
    (identity === undefined
      ? // No identity and no replacement: the app accepts nothing, which is the
        // honest default for a test that never means to be authenticated.
        (async (_request, reply) => reply.code(401).send({ error: { code: 'unauthenticated', message: 'No identity is configured for this test app.' } })) satisfies AuthenticateHook
      : createSupabaseAuthenticate({
          issuer: identity.issuer,
          jwks: identity.jwks,
          readProfile: readProfile ?? ((userId) => withDatabase(pool, (client) => readProfileById(client, userId))),
        }));
  const app = buildApp({ pool, logLevel: 'info', logStream: logs, authenticate: hook, liveness, ...rest });
  return {
    app,
    logs,
    close: async () => {
      await app.close();
      await pool.end().catch(() => {});
    },
  };
}

/** Runs one statement as the migrator of `db` (owner of app and ops). */
export function asMigrator<T>(db: TestDatabase, sql: string, params: unknown[] = []): Promise<T[]> {
  return withClientAt(db.urls.migrator, async (client) => (await client.query(sql, params)).rows as T[]);
}

/** Runs one statement as the worker login of `db` (it may write ops.worker_heartbeat). */
export function asWorker<T>(db: TestDatabase, sql: string, params: unknown[] = []): Promise<T[]> {
  return withClientAt(db.urls.worker, async (client) => (await client.query(sql, params)).rows as T[]);
}

export interface SeedProfileOptions {
  id: string;
  contactEmail: string;
  displayName?: string | null;
  status?: 'active' | 'disabled';
}

/**
 * An `app.profiles` row written as the migrator: test *arrangement*, never the
 * route under test. `POST /identity/sign-in` is what the tests use when the
 * writing itself is the subject.
 */
export async function seedProfile(db: TestDatabase, options: SeedProfileOptions): Promise<void> {
  await asMigrator(
    db,
    `INSERT INTO app.profiles (id, contact_email, display_name, status, last_sign_in_at)
          VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE
            SET contact_email = excluded.contact_email,
                display_name = excluded.display_name,
                status = excluded.status`,
    [options.id, options.contactEmail, options.displayName ?? null, options.status ?? 'active'],
  );
}

/** Everything a test needs to act as one signed-in person. */
export interface SignedIn {
  userId: string;
  sessionId: string;
  contactEmail: string;
  displayName: string | null;
  token: string;
  /** `{ authorization: 'Bearer <token>' }` for app.inject(). */
  headers: { authorization: string };
}

export interface SignedInOptions {
  userId?: string;
  sessionId?: string;
  contactEmail?: string;
  displayName?: string | null;
  status?: 'active' | 'disabled';
  /** Write the `app.profiles` row (default true). False leaves the subject profile-less. */
  withProfile?: boolean;
  /** Write the stub `auth.sessions` row (default true), for the `database` liveness adapter. */
  withSession?: boolean;
  /** `not_after` for that row; a past instant makes an expired session. */
  notAfter?: Date | null;
  /** Seconds of token life; negative makes an expired token. */
  expiresIn?: number;
}

/**
 * Arranges one signed-in person: a profile row, a live session row in the stub
 * `auth.sessions`, and a token this identity's key set accepts.
 */
export async function signedIn(
  db: TestDatabase,
  identity: TestIdentity,
  options: SignedInOptions = {},
): Promise<SignedIn> {
  const {
    userId = '33333333-3333-4333-8333-333333333333',
    sessionId = '44444444-4444-4444-8444-444444444444',
    contactEmail = 'signed-in@example.test',
    displayName = 'Signed In',
    status = 'active',
    withProfile = true,
    withSession = true,
    notAfter = null,
    expiresIn = 3_600,
  } = options;

  if (withProfile) await seedProfile(db, { id: userId, contactEmail, displayName, status });
  if (withSession) await insertLiveSession(db, { sessionId, userId, notAfter });
  const token = await identity.signToken({ sub: userId, sessionId, email: contactEmail, displayName, expiresIn });
  return { userId, sessionId, contactEmail, displayName, token, headers: bearer(token) };
}

// --- Organisations (M2-03) ---------------------------------------------------

/** One person of an M2-03 test: ids, address and name, all fixed per file. */
export interface PersonSpec {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
}

/** Signs `spec` in: a profile, a live session, and a token whose `email` claim is the address. */
export function person(db: TestDatabase, identity: TestIdentity, spec: PersonSpec): Promise<SignedIn> {
  return signedIn(db, identity, {
    userId: spec.userId,
    sessionId: spec.sessionId,
    contactEmail: spec.email,
    displayName: spec.name,
  });
}

/** Fails the arranging step loudly, with the status and the error code only. */
function arranged(what: string, response: { statusCode: number; body: string }, expected: number): void {
  if (response.statusCode === expected) return;
  let code = '';
  try {
    code = (JSON.parse(response.body) as { error?: { code?: string } }).error?.code ?? '';
  } catch {
    // Not JSON: the status is enough.
  }
  throw new Error(`${what} answered ${response.statusCode} ${code}`.trim());
}

/** `POST /orgs` as `who`; the new org's id. */
export async function createOrgAs(api: TestApi, who: SignedIn, name: string): Promise<string> {
  const response = await api.app.inject({ method: 'POST', url: '/orgs', headers: who.headers, payload: { name } });
  arranged('POST /orgs', response, 201);
  return (response.json() as CreateOrgResponse).org.id;
}

/** `POST /orgs/:orgId/invitations` as `admin`; the invitation id and the one-time token. */
export async function inviteAs(
  api: TestApi,
  admin: SignedIn,
  orgId: string,
  email: string,
  role: OrgRole = 'member',
): Promise<{ invitationId: string; token: string }> {
  const response = await api.app.inject({
    method: 'POST',
    url: `/orgs/${orgId}/invitations`,
    headers: admin.headers,
    payload: { email, role },
  });
  arranged('POST /orgs/:orgId/invitations', response, 201);
  const body = response.json() as CreateInvitationResponse;
  return { invitationId: body.invitation.id, token: body.token };
}

/** Makes `member` an active member of `orgId` the product's way: `admin` invites, `member` accepts. */
export async function asOrgMember(
  api: TestApi,
  admin: SignedIn,
  orgId: string,
  member: SignedIn,
  role: OrgRole = 'member',
): Promise<void> {
  const { token } = await inviteAs(api, admin, orgId, member.contactEmail, role);
  const response = await api.app.inject({
    method: 'POST',
    url: '/invitations/accept',
    headers: member.headers,
    payload: { token },
  });
  arranged('POST /invitations/accept', response, 200);
}

const GRANT_AUTHOR = { reason: 'integration test', by: 'wringy-test' } as const;

/** `pnpm db:grant grant org …`'s function, as the migrator (the runtime role cannot write grants). */
export function grantCapability(
  db: TestDatabase,
  grant: { userId: string; orgId: string; capability: OrgGrantCapability },
): Promise<unknown> {
  return withClientAt(db.urls.migrator, (client) => grantOrgCapability(client, { ...grant, ...GRANT_AUTHOR }));
}

/** `pnpm db:grant revoke org …`'s function, as the migrator. */
export function revokeCapability(
  db: TestDatabase,
  grant: { userId: string; orgId: string; capability: OrgGrantCapability },
): Promise<unknown> {
  return withClientAt(db.urls.migrator, (client) => revokeOrgCapability(client, { ...grant, ...GRANT_AUTHOR }));
}

/** `pnpm db:grant grant platform …`'s function, as the migrator. */
export function grantPlatform(
  db: TestDatabase,
  grant: { userId: string; capability: PlatformGrantCapability },
): Promise<unknown> {
  return withClientAt(db.urls.migrator, (client) => grantPlatformCapability(client, { ...grant, ...GRANT_AUTHOR }));
}

/** One `app.audit_log` row, as the migrator reads it. */
export interface AuditRow {
  recorded_by: string;
  actor_kind: string;
  actor_user_id: string | null;
  context_org_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  outcome: 'allowed' | 'denied';
  denial_code: string | null;
  reason: string | null;
  summary: Record<string, Record<string, string>> | null;
  request_id: string | null;
  session_ref: string | null;
}

export interface AuditFilter {
  action?: string;
  contextOrgId?: string;
  actorUserId?: string;
  outcome?: 'allowed' | 'denied';
  denialCode?: string;
}

/**
 * The audit rows matching `filter`, oldest first, read as the migrator. Tests
 * always filter: the database starts with the allow-list's own rows (R6), so a
 * total count says nothing.
 */
export function auditRows(db: TestDatabase, filter: AuditFilter = {}): Promise<AuditRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: string | undefined) => {
    if (value === undefined) return;
    params.push(value);
    clauses.push(`${column} = $${params.length}`);
  };
  add('action', filter.action);
  add('context_org_id::text', filter.contextOrgId);
  add('actor_user_id::text', filter.actorUserId);
  add('outcome', filter.outcome);
  add('denial_code', filter.denialCode);
  return asMigrator<AuditRow>(
    db,
    `SELECT recorded_by, actor_kind, actor_user_id, context_org_id, action, target_type, target_id, outcome,
            denial_code, reason, summary, request_id, session_ref
       FROM app.audit_log
      ${clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`}
      ORDER BY id`,
    params,
  );
}

/** How many rows the API's runtime login has written so far; tests compare it before and after a request. */
export async function apiAuditCount(db: TestDatabase): Promise<number> {
  const rows = await asMigrator<{ n: number }>(
    db,
    `SELECT count(*)::int AS n FROM app.audit_log WHERE recorded_by = 'wringy_api_login'`,
  );
  return rows[0]?.n ?? 0;
}

/** The log records of one request, by its id (R11: the audit row's `request_id`). */
export function logsOfRequest(logs: LogCapture, requestId: string): Array<Record<string, unknown>> {
  return logs.records.filter((record) => record.reqId === requestId);
}

/**
 * A barrier for the R13 concurrency rows. Holds `orgId`'s row `FOR UPDATE` as
 * the migrator in an open transaction, starts `requests`, waits until
 * `requests.length` API backends wait on a lock, commits, and returns the
 * responses — all inside the API's statement timeout. Both requests therefore
 * contend for the org lock at the same moment, every time. The wait is read from
 * `pg_stat_activity` every 25 ms as the cluster admin: PostgreSQL shows another
 * role's `wait_event_type` only to a superuser or a `pg_read_all_stats` member.
 *
 * With `inOrder`, each request is started only once every one before it waits on
 * the lock, so they are granted it in the order given: PostgreSQL hands a row
 * lock to its waiters in the order they queued (the first waiter holds the tuple
 * lock, the others queue behind it).
 */
export async function underBarrier<T>(
  db: TestDatabase,
  orgId: string,
  requests: Array<() => Promise<T>>,
  { inOrder = false } = {},
): Promise<T[]> {
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
