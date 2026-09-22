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
 * isDatabaseUnavailable() classifies as 503 `database_unavailable`. Not a
 * business rule.
 */
export const API_QUERY_TIMEOUT_MS = 5_000;

export function createApiPool(connectionString: string, onIdleError: (error: Error) => void): Pool {
  return createPool(
    { connectionString, applicationName: API_APPLICATION_NAME, queryTimeoutMillis: API_QUERY_TIMEOUT_MS },
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
 * the login was refused.
 */
const UNAVAILABLE_SQLSTATES = new Set(['53300', '57P01', '57P02', '57P03', '3D000', '28000', '28P01']);

/** pg's own messages for a lost or unobtainable connection (they carry no code). */
const UNAVAILABLE_MESSAGES =
  /timeout exceeded when trying to connect|connection terminated|cannot use a pool after calling end|connection error|query read timeout/i;

export function sqlStateOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
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
      broken = error instanceof Error ? error : new Error(String(error));
      throw new DatabaseUnavailableError(error);
    }
    throw error;
  } finally {
    // A client whose connection failed is discarded, not returned to the pool.
    client.release(broken);
  }
}
