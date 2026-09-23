import pg from 'pg';

export type Pool = pg.Pool;
export type PoolClient = pg.PoolClient;

/**
 * OPERATIONAL: how long an idle connection stays in a pool before it is closed
 * (pg-pool's `idleTimeoutMillis`; this is pg-pool's own default, stated here so
 * code and tests that depend on it, such as the internal suite's database
 * outage test, read it from one place). Not a business rule.
 */
export const POOL_IDLE_TIMEOUT_MS = 10_000;

export interface CreatePoolOptions {
  /** The role's own connection string; each process role gets its own pool. */
  connectionString: string;
  /** Shown in `pg_stat_activity.application_name`, e.g. `wringy-api`. */
  applicationName: string;
  /** Upper bound on open connections (the M2-09 connection budget sizes it). */
  max?: number;
  /** Milliseconds to wait for a connection before failing the request. */
  connectionTimeoutMillis?: number;
  /** Milliseconds an idle connection stays open (default POOL_IDLE_TIMEOUT_MS). */
  idleTimeoutMillis?: number;
  /**
   * Client-side limit, in milliseconds, on each query (pg's `query_timeout`):
   * the query's promise rejects with "Query read timeout" when the server has
   * not answered in time. The server keeps running the statement, so the
   * client must then be discarded. Unset means no limit (pg's default).
   */
  queryTimeoutMillis?: number;
  /**
   * Server-side limit, in milliseconds, on each statement (PostgreSQL's
   * `statement_timeout`, sent by pg as a startup parameter): the server
   * cancels the statement, lock waits included, with SQLSTATE 57014 and the
   * session stays usable, so no backend is left waiting behind a timed-out
   * read. Set it below queryTimeoutMillis so the server gives up first.
   * Unset means the server's default (no limit).
   */
  statementTimeoutMillis?: number;
}

/**
 * One `pg.Pool` per role and process. No ORM: SQL lives next to the module that
 * owns it. Idle-client errors (for example the server restarting) are reported
 * to `onError` instead of crashing the process; the next checkout reconnects.
 */
export function createPool(
  {
    connectionString,
    applicationName,
    max = 10,
    connectionTimeoutMillis = 5_000,
    idleTimeoutMillis = POOL_IDLE_TIMEOUT_MS,
    queryTimeoutMillis,
    statementTimeoutMillis,
  }: CreatePoolOptions,
  onError: (error: Error) => void = () => {},
): Pool {
  const pool = new pg.Pool({
    connectionString,
    application_name: applicationName,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    ...(queryTimeoutMillis === undefined ? {} : { query_timeout: queryTimeoutMillis }),
    ...(statementTimeoutMillis === undefined ? {} : { statement_timeout: statementTimeoutMillis }),
  });
  pool.on('error', onError);
  return pool;
}

/** Checks a client out for `fn` and always returns it to the pool. */
export async function withClient<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` inside BEGIN/COMMIT on one client, rolling back if it throws. A
 * client whose ROLLBACK itself failed is discarded rather than reused.
 */
export async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      broken = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
    }
    throw error;
  } finally {
    client.release(broken);
  }
}
