/**
 * The light end of the @wringy/db test harness, exported as
 * `@wringy/db/testing/connect`: login URLs for a test database and a
 * short-lived client, importing only `pg` and plain constants.
 *
 * It exists apart from cluster.ts for runners that load test files as CommonJS
 * (Playwright in apps/web, whose package has no "type": "module"): cluster.ts
 * reaches migrate.ts and fixtures.ts, which use `import.meta.url`, and cannot be
 * loaded there. Nothing here may import a module that does; `src/allowlist.ts`
 * qualifies, importing only `pg`'s types.
 */
import pg from 'pg';

import { addAllowlistEntry } from '../src/allowlist';
import { LOCAL_PASSWORDS, postgresUrl } from '../src/local-dev';
import { POOL_IDLE_TIMEOUT_MS } from '../src/pool';
import { ROLES } from '../src/roles';

/** Re-exported for the Playwright internal suite, which cannot load @wringy/db's main entry (see above). */
export { POOL_IDLE_TIMEOUT_MS };

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

/**
 * Lists `email` on `app.sign_in_allowlist` in the database `migratorUrl` names,
 * for the Playwright internal suite's first-sign-in scenarios (M2-02 R5). The
 * normal form is computed by the one function the CLI and the API also use.
 */
export async function allowlistAddAt(
  migratorUrl: string,
  email: string,
  options: { reason?: string; addedBy?: string } = {},
): Promise<string> {
  return withClientAt(migratorUrl, async (client) => {
    const { entry } = await addAllowlistEntry(client, {
      email,
      reason: options.reason ?? 'internal build test',
      addedBy: options.addedBy ?? 'wringy-test',
    });
    return entry.emailNorm;
  });
}

/** A session row for platform.session_is_live: null `notAfter` means "no expiry". */
export interface LiveSession {
  sessionId: string;
  userId: string;
  notAfter?: Date | null;
}

/**
 * Inserts (or refreshes) a row in the stub `auth.sessions` of the database
 * `adminUrl` names. Only a cluster-admin connection may do this: the stub is
 * granted to nobody, exactly as the hosted table is (M2-02 R3).
 */
export async function insertLiveSessionAt(adminUrl: string, session: LiveSession): Promise<void> {
  await withClientAt(adminUrl, async (admin) => {
    await admin.query(
      `INSERT INTO auth.sessions (id, user_id, not_after) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET user_id = excluded.user_id, not_after = excluded.not_after`,
      [session.sessionId, session.userId, session.notAfter ?? null],
    );
  });
}

/** Removes a row from the stub `auth.sessions`, as a sign-out does on the hosted project. */
export async function endSessionAt(adminUrl: string, sessionId: string): Promise<void> {
  await withClientAt(adminUrl, async (admin) => {
    await admin.query('DELETE FROM auth.sessions WHERE id = $1', [sessionId]);
  });
}
