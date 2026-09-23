/**
 * Starts apps/api or apps/worker (`tsx src/main.ts`, what `pnpm dev` runs
 * without the watcher) against the internal suite's database, as a Playwright
 * `webServer` entry. Run with tsx: `tsx tests/e2e-internal/run-with-database.mts api|worker`.
 *
 * The database process (database-server.mts) announces where the database is;
 * Playwright stores that in WRINGY_E2E_PG_HOST, WRINGY_E2E_PG_PORT and
 * WRINGY_E2E_PG_DATABASE. Both apps read a variable named DATABASE_URL, each
 * as its own login, so this launcher sets DATABASE_URL to the right role's URL
 * for the one child it starts. Every other variable (WRINGY_ENV, PORT,
 * WORKER_ID, IMAGE_REF, ...) comes from the webServer entry's `env`.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loginUrlsAt } from '@wringy/db/testing/connect';

const role = process.argv[2];
if (role !== 'api' && role !== 'worker') {
  console.error('usage: run-with-database.mts api|worker');
  process.exit(2);
}

const host = process.env.WRINGY_E2E_PG_HOST;
const port = Number(process.env.WRINGY_E2E_PG_PORT);
const database = process.env.WRINGY_E2E_PG_DATABASE;
if (!host || !Number.isInteger(port) || port <= 0 || !database) {
  console.error('run-with-database: WRINGY_E2E_PG_HOST, WRINGY_E2E_PG_PORT and WRINGY_E2E_PG_DATABASE must be set by the database webServer entry');
  process.exit(2);
}

const appDir = fileURLToPath(new URL(`../../../${role}/`, import.meta.url));
const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
  cwd: appDir,
  env: { ...process.env, DATABASE_URL: loginUrlsAt(host, port, database)[role] },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
