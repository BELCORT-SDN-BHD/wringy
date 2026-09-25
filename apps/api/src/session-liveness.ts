/**
 * "Is this session still live?" — one port, two adapters (M2-02 R2;
 * kickoff-package.md §4.6).
 *
 * A revoked session's access token stays valid until its `exp`, so a token alone
 * cannot answer this. Reads accept that (they are valid for at most the token's
 * lifetime); every state-changing command asks, **inside its own transaction**, so
 * the answer and the write cannot be separated by a sign-out.
 *
 * - `database` (Mechanism A) calls `platform.session_is_live(session_id, user_id)`,
 *   the SECURITY DEFINER function the platform bootstrap installs
 *   (packages/db/src/platform.ts). It only works where the application database
 *   *is* the identity store's database — staging, and M2-09.
 * - `auth_server` (Mechanism B) calls `GET <SUPABASE_URL>/auth/v1/user` with the
 *   caller's own token and the publishable key. This is the only adapter that can
 *   answer locally, where the app database is an embedded PostgreSQL while sign-in
 *   goes to a hosted Supabase project.
 *
 * Both **fail closed towards retry, never towards sign-out**: only a definite
 * "that session is gone" is `revoked` (401 `session.revoked`). A timeout, a 5xx,
 * a rate limit, a transport error or an unreachable database is `unavailable`
 * (503 `session_check_unavailable`), which the web treats as "try again", not as
 * "you are signed out" (R9). Answering 401 on a blip would sign every tester out
 * of the internal build because one network call failed.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ApiEnv } from '@wringy/config';
import type { Pool } from '@wringy/db';

import { actorOf, type Actor } from './authenticate';
import { isDatabaseUnavailable, withDatabase } from './database';
import { errorBody, type ErrorCode } from './errors';

/** `live` and `revoked` are answers; `unavailable` means the question could not be asked. */
export type LivenessResult = 'live' | 'revoked' | 'unavailable';

/**
 * The only thing the database adapter asks of a connection: run this one
 * statement. Narrow on purpose, so a `PoolClient`, a command's transaction client
 * and a test double all satisfy it without the port knowing about `pg`.
 */
export interface LivenessClient {
  query(sql: string, values: unknown[]): Promise<{ rows: Array<{ live: boolean }> }>;
}

export interface SessionLiveness {
  /**
   * @param client The command's transaction client, when it has one open. The
   *   database adapter asks its question on that connection, so the answer belongs
   *   to the same transaction as the write it guards; the auth-server adapter
   *   ignores it, because its question is a network call.
   */
  check(actor: Actor, client?: LivenessClient): Promise<LivenessResult>;
}

/** Mechanism A: `platform.session_is_live` in the application database. */
export function databaseLiveness(pool: Pool): SessionLiveness {
  const ask = async (queryable: LivenessClient, actor: Actor): Promise<LivenessResult> => {
    const { rows } = await queryable.query('SELECT platform.session_is_live($1::uuid, $2::uuid) AS live', [
      actor.sessionId,
      actor.userId,
    ]);
    return rows[0]?.live === true ? 'live' : 'revoked';
  };

  return {
    check: async (actor, client) => {
      try {
        return client === undefined ? await withDatabase(pool, (own) => ask(own, actor)) : await ask(client, actor);
      } catch (error) {
        // The same classification every API query uses: a database we cannot reach
        // or use is `unavailable`, not a revoked session. A real fault (a missing
        // function, a refused EXECUTE) is a bug and stays a 500.
        if (isDatabaseUnavailable(error)) return 'unavailable';
        throw error;
      }
    },
  };
}

/** The version header GoTrue's error shapes are documented against. */
const AUTH_API_VERSION = '2024-01-01';

/**
 * GoTrue error codes that mean the session itself is gone. Anything else with a
 * 401 or 403 (a malformed request, a disabled project, an unknown code) is
 * `unavailable`: we did not get an answer we understand, so we do not sign
 * anybody out on it.
 */
const REVOKED_CODES = new Set(['session_not_found', 'user_not_found', 'user_banned']);

export interface AuthServerLivenessOptions {
  /** The project origin (`SUPABASE_URL`); `/auth/v1/user` is appended. */
  supabaseUrl: string;
  /** The publishable key. Publishable by design; no secret key exists in this process. */
  publishableKey: string;
  /** Below API_QUERY_TIMEOUT_MS, so this check can never be the slowest thing in a request. */
  timeoutMs?: number;
  /** Test seam; the global fetch otherwise. */
  fetchImpl?: typeof fetch;
}

/** GoTrue's error body names the code as `code`, and older shapes as `error_code`. */
async function errorCodeOf(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (body === null || typeof body !== 'object') return undefined;
    const { code, error_code: errorCode } = body as { code?: unknown; error_code?: unknown };
    if (typeof code === 'string') return code;
    return typeof errorCode === 'string' ? errorCode : undefined;
  } catch {
    // A body that is not JSON is not an answer we can act on.
    return undefined;
  }
}

/** Mechanism B: `GET <SUPABASE_URL>/auth/v1/user` with the caller's token. */
export function authServerLiveness({
  supabaseUrl,
  publishableKey,
  timeoutMs = 3_000,
  fetchImpl,
}: AuthServerLivenessOptions): SessionLiveness {
  const url = `${supabaseUrl}/auth/v1/user`;
  return {
    check: async (actor) => {
      const call = fetchImpl ?? fetch;
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeoutMs);
      try {
        const response = await call(url, {
          method: 'GET',
          headers: {
            apikey: publishableKey,
            authorization: `Bearer ${actor.token}`,
            'x-supabase-api-version': AUTH_API_VERSION,
          },
          signal: abort.signal,
        });
        if (response.status === 200) return 'live';
        if (response.status === 401 || response.status === 403) {
          const code = await errorCodeOf(response);
          return code !== undefined && REVOKED_CODES.has(code) ? 'revoked' : 'unavailable';
        }
        return 'unavailable';
      } catch {
        // A timeout (the abort above) or any transport failure. Never a sign-out.
        return 'unavailable';
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * What each non-live verdict answers, in one place, so a command that has to map
 * the verdict itself cannot disagree with the guard below (R9).
 */
export const NOT_LIVE_REFUSAL = {
  revoked: { status: 401, code: 'session.revoked' },
  unavailable: { status: 503, code: 'session_check_unavailable' },
} as const satisfies Record<Exclude<LivenessResult, 'live'>, { status: number; code: ErrorCode }>;

/** Sends the refusal, or returns undefined when the session is live. */
function refuseUnlessLive(reply: FastifyReply, state: LivenessResult): FastifyReply | undefined {
  if (state === 'live') return undefined;
  const { status, code } = NOT_LIVE_REFUSAL[state];
  return reply.code(status).send(errorBody(code));
}

/**
 * Refuses a request whose session is no longer live. Returning the reply from a
 * hook or a handler stops the route there; undefined means carry on.
 */
export type LiveSessionGuard = (
  request: FastifyRequest,
  reply: FastifyReply,
  /** The command's transaction client, when it has one open. */
  client?: LivenessClient,
) => Promise<FastifyReply | undefined>;

/**
 * The guard §4.6 asks for. Given a command's transaction client it asks on that
 * connection, so the answer and the write it guards cannot be separated by a
 * sign-out; called with two arguments it is an ordinary Fastify preHandler, which
 * is how a route with no transaction of its own would use it.
 */
export function requireLiveSession(liveness: SessionLiveness): LiveSessionGuard {
  return async (request, reply, client) => refuseUnlessLive(reply, await liveness.check(actorOf(request), client));
}

/** The adapter `SESSION_LIVENESS` names (required, no default: the wrong answer is a silent one). */
export function selectLiveness(
  env: Pick<ApiEnv, 'SESSION_LIVENESS' | 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'>,
  pool: Pool,
): SessionLiveness {
  return env.SESSION_LIVENESS === 'database'
    ? databaseLiveness(pool)
    : authServerLiveness({ supabaseUrl: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY });
}
