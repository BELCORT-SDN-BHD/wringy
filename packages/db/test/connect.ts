/**
 * The light end of the @wringy/db test harness, exported as
 * `@wringy/db/testing/connect`: login URLs for a test database and a
 * short-lived client, importing only `pg` and plain constants.
 *
 * It exists apart from cluster.ts for runners that load test files as CommonJS
 * (Playwright in apps/web, whose package has no "type": "module"): cluster.ts
 * reaches migrate.ts and fixtures.ts, which use `import.meta.url`, and cannot be
 * loaded there. Nothing here may import a module that does.
 */
import pg from 'pg';

import { LOCAL_PASSWORDS, postgresUrl } from '../src/local-dev';
import { ROLES } from '../src/roles';

/** One URL per login role, all pointing at the same test database. */
export interface LoginUrls {
  migrator: string;
  api: string;
  worker: string;
}

/**
 * The three login URLs of `database` on a test cluster at `host:port`. Every
 * test cluster bootstraps its login roles with the fixed development passwords
 * (LOCAL_PASSWORDS, src/local-dev.ts), so a process that knows only where the
 * database is can connect as each role without a password being printed or
 * passed between processes.
 */
export function loginUrlsAt(host: string, port: number, database: string): LoginUrls {
  const at = (user: string, password: string) => postgresUrl({ user, password, host, port, database });
  return {
    migrator: at(ROLES.migrator, LOCAL_PASSWORDS.migrator),
    api: at(ROLES.apiLogin, LOCAL_PASSWORDS.api),
    worker: at(ROLES.workerLogin, LOCAL_PASSWORDS.worker),
  };
}

/** Runs `fn` with one short-lived client connected as `url`'s login. */
export async function withClientAt<T>(url: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url, application_name: 'wringy-test' });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
