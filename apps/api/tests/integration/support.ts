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
 */
import {
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
import { createApiPool, withDatabase } from '../../src/database';
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
