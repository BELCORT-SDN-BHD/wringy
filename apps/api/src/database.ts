/**
 * The API's database access: one pool as the runtime login (wringy_api_login,
 * group wringy_api), and the rule for telling "the database is unavailable"
 * (503) apart from a bug (500).
 */
import { createPool, type Pool, type PoolClient } from '@wringy/db';

/** Shown in pg_stat_activity.application_name. */
export const API_APPLICATION_NAME = 'wringy-api';

/**
 * OPERATIONAL limit on every API query (pg's client-side `query_timeout`), so a
 * database that accepts the connection but never answers cannot stall
 * `/health` or a read: the query rejects with "Query read timeout", which
 * isDatabaseUnavailable() classifies as 503 `database_unavailable`, and the
 * client is discarded. Not a business rule.
 */
export const API_QUERY_TIMEOUT_MS = 5_000;

/**
 * OPERATIONAL server-side limit on every API statement (PostgreSQL's
 * `statement_timeout`), a little below API_QUERY_TIMEOUT_MS so the server
 * cancels a read that waits on a lock or runs too long (57014) before the
 * client gives up: the backend is freed at once instead of waiting on after the
 * request has failed, so timed-out reads cannot pile up connections past the
 * pool's max (kickoff-package.md §4.12 connection budget). Not a business rule.
 * It travels as a startup parameter; whether Supavisor session mode passes it
 * through is unverified (M2-09 checks the pooler; the fallback is
 * `ALTER ROLE wringy_api_login SET statement_timeout`).
 */
export const API_STATEMENT_TIMEOUT_MS = 4_500;

export function createApiPool(connectionString: string, onIdleError: (error: Error) => void): Pool {
  return createPool(
    {
      connectionString,
      applicationName: API_APPLICATION_NAME,
      queryTimeoutMillis: API_QUERY_TIMEOUT_MS,
      statementTimeoutMillis: API_STATEMENT_TIMEOUT_MS,
    },
    onIdleError,
  );
}

/**
 * The database could not be reached or used as this process's role. The route
 * answers 503 `database_unavailable`; the cause is logged (scrubbed), never sent.
 */
export class DatabaseUnavailableError extends Error {
  override readonly name = 'DatabaseUnavailableError';
  constructor(cause: unknown) {
    super('The database is unavailable', { cause });
  }
}

/** Node socket errors that mean the server is unreachable. */
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
]);

/**
 * SQLSTATEs that mean this role cannot use the database right now: class 08
 * (connection exception), 53300 too_many_connections, 57P01–57P03 shutdown or
 * not yet accepting connections, 3D000 database does not exist, 28000/28P01
 * the login was refused, 57014 query_canceled (the server-side
 * statement_timeout, e.g. a read waiting on a migration's lock).
 */
const UNAVAILABLE_SQLSTATES = new Set(['53300', '57P01', '57P02', '57P03', '3D000', '28000', '28P01', '57014']);

/**
 * Of those, the ones after which the session itself is still usable: the
 * server cancelled only the statement. Any other unavailable error (a lost
 * connection, a client-side "Query read timeout" whose statement may still be
 * running on the server) leaves the client unusable.
 */
const STATEMENT_ONLY_SQLSTATES = new Set(['57014']);

/** pg's own messages for a lost or unobtainable connection (they carry no code). */
const UNAVAILABLE_MESSAGES =
  /timeout exceeded when trying to connect|connection terminated|cannot use a pool after calling end|connection error|query read timeout/i;

export function sqlStateOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/** True when `error` leaves the client unusable, so it must be discarded rather than returned to the pool. */
export function isConnectionUnusable(error: unknown): boolean {
  const code = sqlStateOf(error);
  return isDatabaseUnavailable(error) && !(code !== undefined && STATEMENT_ONLY_SQLSTATES.has(code));
}

export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) return true;
  const code = sqlStateOf(error);
  if (code !== undefined && (NETWORK_CODES.has(code) || UNAVAILABLE_SQLSTATES.has(code) || code.startsWith('08'))) {
    return true;
  }
  if (error instanceof AggregateError && error.errors.some(isDatabaseUnavailable)) return true;
  return error instanceof Error && UNAVAILABLE_MESSAGES.test(error.message);
}

/**
 * Checks a client out for `fn`. Failing to get a connection, or losing it
 * mid-query, becomes DatabaseUnavailableError; any other failure (a permission
 * error, a bad statement) is rethrown unchanged and ends as a 500.
 */
export async function withDatabase<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return runOnClient(pool, fn);
}

/**
 * `withDatabase` plus BEGIN/COMMIT on the same client, so a command's guards and
 * its writes are one transaction (kickoff-package.md §4.6: `requireLiveSession`
 * runs *inside* the command's transaction, not before it). `fn` throwing rolls
 * back and rethrows, so a refusal that must leave no row written only has to
 * throw. The 503-versus-500 rule is unchanged: a lost connection becomes
 * DatabaseUnavailableError, anything else is rethrown as it is.
 *
 * The isolation level is stated, never inherited (M2-03 R5 rev 3): READ
 * COMMITTED, whatever `default_transaction_isolation` the server, the database
 * or the role sets. R5's lock order depends on it — step 5 re-reads the caller's
 * role, and the last-admin count reads the other admins, with plain SELECTs once
 * the org lock is held, and each needs a snapshot taken after the lock was
 * granted. Under REPEATABLE READ the snapshot is fixed at the first statement,
 * so two admins leaving at once both see the other still there and both leave.
 * `@wringy/db`'s `setEnvironment` pins the same level for the same reason.
 *
 * @wringy/db exports a `withTransaction` of its own for direct database code;
 * this one is the API's, because it must classify failures the way every other
 * API query does.
 */
export async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return runOnClient(pool, async (client) => {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      // A rollback that cannot be sent means the connection is already gone; the
      // original failure is the one worth reporting, and runOnClient discards the
      // client when that failure says the connection is unusable.
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }
  });
}

async function runOnClient<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (error) {
    throw new DatabaseUnavailableError(error);
  }

  let broken: Error | undefined;
  try {
    return await fn(client);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      if (isConnectionUnusable(error)) broken = error instanceof Error ? error : new Error(String(error));
      throw new DatabaseUnavailableError(error);
    }
    throw error;
  } finally {
    // A client whose connection failed or is still busy is discarded, not returned to the pool.
    client.release(broken);
  }
}
