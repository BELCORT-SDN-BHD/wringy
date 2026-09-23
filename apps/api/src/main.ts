/**
 * Entry point: `pnpm dev` (node --watch --import tsx) and `node dist/main.js`.
 *
 * Loads the API's own variables (fail fast, names only), starts the server and
 * closes it gracefully on SIGTERM or SIGINT. Exit code 1 on any startup failure.
 */
import { EnvError, loadApiEnv, type ApiEnv } from '@wringy/config';

import { startServer, type RunningServer } from './server';

async function main(): Promise<void> {
  let env: ApiEnv;
  try {
    env = loadApiEnv();
  } catch (error) {
    // EnvError's message names variables only, never a value.
    process.stderr.write(`${error instanceof EnvError ? error.message : 'Invalid environment for api.'}\n`);
    process.exitCode = 1;
    return;
  }

  let server: RunningServer;
  try {
    server = await startServer(env);
  } catch {
    // startServer has logged the reason and released the pool.
    process.exitCode = 1;
    return;
  }

  let closing = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    server.app.log.info({ signal }, 'shutting down');
    server.close().then(
      () => {
        process.exitCode = 0;
      },
      (error: unknown) => {
        server.app.log.error({ err: error }, 'shutdown failed');
        process.exitCode = 1;
      },
    );
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

await main();
