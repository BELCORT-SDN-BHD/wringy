/**
 * Development-only values for the embedded PostgreSQL cluster that
 * `pnpm db:start` runs on this machine (ruling D29), and for the test harness.
 *
 * They are fixed on purpose so a local `.env` keeps working across restarts. The
 * bootstrap uses them only when `WRINGY_ENV=local` and refuses to fall back to
 * them anywhere else; no staging or production credential ever lives in code.
 */
import { ROLES } from './roles';

export const LOCAL_PG_HOST = '127.0.0.1';
export const LOCAL_PG_PORT = 54329;
export const LOCAL_SUPERUSER = 'postgres';
export const LOCAL_SUPERUSER_PASSWORD = 'wringy-local-superuser';
export const LOCAL_DATABASE = 'wringy';

export const LOCAL_PASSWORDS = {
  migrator: 'wringy-local-migrator',
  api: 'wringy-local-api-login',
  worker: 'wringy-local-worker-login',
} as const;

export interface PostgresUrlParts {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
}

export function postgresUrl({ user, password, host, port, database }: PostgresUrlParts): string {
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${auth}@${host}:${port}/${encodeURIComponent(database)}`;
}

/** The URLs a local `.env` needs, for the cluster on `host:port`. */
export function localUrls(
  host: string = LOCAL_PG_HOST,
  port: number = LOCAL_PG_PORT,
  database: string = LOCAL_DATABASE,
) {
  const at = (user: string, password: string, db = database) =>
    postgresUrl({ user, password, host, port, database: db });
  return {
    superuser: at(LOCAL_SUPERUSER, LOCAL_SUPERUSER_PASSWORD, 'postgres'),
    migrator: at(ROLES.migrator, LOCAL_PASSWORDS.migrator),
    api: at(ROLES.apiLogin, LOCAL_PASSWORDS.api),
    worker: at(ROLES.workerLogin, LOCAL_PASSWORDS.worker),
  };
}
