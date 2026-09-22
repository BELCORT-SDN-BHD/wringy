import pg from 'pg';

export type Pool = pg.Pool;
export type PoolClient = pg.PoolClient;

export interface CreatePoolOptions {
  /** The role's own connection string; each process role gets its own pool. */
  connectionString: string;
  /** Shown in `pg_stat_activity.application_name`, e.g. `wringy-api`. */
  applicationName: string;
  /** Upper bound on open connections (the M2-09 connection budget sizes it). */
  max?: number;
  /** Milliseconds to wait for a connection before failing the request. */
  connectionTimeoutMillis?: number;
}

/**
 * One `pg.Pool` per role and process. No ORM: SQL lives next to the module that
 * owns it. Idle-client errors (for example the server restarting) are reported
 * to `onError` instead of crashing the process; the next checkout reconnects.
 */
export function createPool(
  { connectionString, applicationName, max = 10, connectionTimeoutMillis = 5_000 }: CreatePoolOptions,
  onError: (error: Error) => void = () => {},
): Pool {
  const pool = new pg.Pool({
    connectionString,
    application_name: applicationName,
    max,
    connectionTimeoutMillis,
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
