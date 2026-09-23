/**
 * API integration-test support on the @wringy/db harness, imported as
 * `@wringy/db/testing` (packages/db/test/harness.ts); vitest.int.config.ts runs
 * the same harness's global setup (`@wringy/db/testing/global-setup`). The
 * harness module also carries the `ProvidedContext` augmentation its `inject()`
 * relies on.
 */
import {
  createTestDatabase,
  seedFixtures,
  sqlState,
  TEST_WRINGY_ENV,
  withClientAt,
  type TestDatabase,
} from '@wringy/db/testing';

import { buildApp, type ApiApp, type BuildAppOptions } from '../../src/app';
import { createApiPool } from '../../src/database';

export { createTestDatabase, seedFixtures, sqlState, TEST_WRINGY_ENV, withClientAt, type TestDatabase };

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

export interface TestApi {
  app: ApiApp;
  logs: LogCapture;
  close(): Promise<void>;
}

/**
 * The app as src/server.ts builds it (pool as wringy_api_login, application
 * name wringy-api), without listening; drive it with app.inject().
 */
export async function buildTestApi(
  databaseUrl: string,
  options: Omit<BuildAppOptions, 'pool' | 'logStream'> = {},
): Promise<TestApi> {
  const logs = new LogCapture();
  const pool = createApiPool(databaseUrl, () => {});
  const app = buildApp({ pool, logLevel: 'info', logStream: logs, ...options });
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
