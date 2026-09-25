import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import type { ApiEnv } from '@wringy/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DatabaseUnavailableError } from '../../src/database';
import { EnvironmentRefusedError, startServer } from '../../src/server';
import { asMigrator, createTestDatabase, LogCapture, TEST_WRINGY_ENV, type TestDatabase } from './support';

const API_DIR = fileURLToPath(new URL('../../', import.meta.url));
const NO_RETRY = { attempts: 1, initialDelayMs: 1, maxDelayMs: 1 };

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (address && typeof address === 'object' ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

/**
 * The identity variables @wringy/config/api requires (M2-02 R14). These tests
 * prove startup and shutdown, not auth behaviour, so they carry a Supabase
 * project origin that resolves nowhere and a canary-shaped publishable key: no
 * test here reaches the Auth server.
 */
const IDENTITY_ENV = {
  SUPABASE_URL: 'https://startup-test.invalid',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_startup_test_only',
  SESSION_LIVENESS: 'auth_server',
} as const satisfies Pick<ApiEnv, 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY' | 'SESSION_LIVENESS'>;

const envFor = (databaseUrl: string, wringyEnv: ApiEnv['WRINGY_ENV'], port = 0): ApiEnv => ({
  WRINGY_ENV: wringyEnv,
  DATABASE_URL: databaseUrl,
  ...IDENTITY_ENV,
  HOST: '127.0.0.1',
  PORT: port,
  LOG_LEVEL: 'info',
});

/** Runs src/main.ts in a child process (tsx) with only the API's variables set, as `pnpm dev` would. */
function runMain(env: Record<string, string>): Promise<{ code: number | null; output: string }> {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const name of [
    'WRINGY_ENV',
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SESSION_LIVENESS',
    'PORT',
    'HOST',
    'LOG_LEVEL',
    'TEST_DATABASE_URL',
  ]) {
    delete childEnv[name];
  }
  Object.assign(childEnv, env);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: API_DIR,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    const timer = setTimeout(() => child.kill(), 25_000);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

describe('M2-AC01 API startup', () => {
  let db: TestDatabase;
  let unmarked: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
    unmarked = await createTestDatabase();
    await asMigrator(unmarked, 'DELETE FROM ops.environment');
  });

  afterAll(async () => {
    await db?.drop();
    await unmarked?.drop();
  });

  it('startup refuses an environment mismatch (in process: nothing listens, the pool is released)', async () => {
    expect(TEST_WRINGY_ENV).toBe('ci');
    const logs = new LogCapture();
    const started = startServer(envFor(db.urls.api, 'local'), { logStream: logs, retry: NO_RETRY });

    await expect(started).rejects.toBeInstanceOf(EnvironmentRefusedError);
    await expect(started).rejects.toThrow('WRINGY_ENV is "local" but the database is marked "ci"');

    const fatal = logs.records.find((record) => record.level === 60);
    expect(fatal?.msg).toMatch(/^Refusing to start: WRINGY_ENV is "local" but the database is marked "ci"/);
    expect(logs.text).not.toContain(new URL(db.urls.api).password);
    expect(logs.text).not.toContain('postgres://');
  });

  it('M2-AC01/2 startup refuses an environment mismatch: `node src/main.ts` exits 1 and names the mismatch, not the URL', async () => {
    const { code, output } = await runMain({
      WRINGY_ENV: 'staging',
      DATABASE_URL: db.urls.api,
      ...IDENTITY_ENV,
      PORT: String(await freePort()),
    });
    expect(code).toBe(1);
    expect(output).toContain('Refusing to start: WRINGY_ENV is \\"staging\\" but the database is marked \\"ci\\"');
    expect(output).not.toContain(new URL(db.urls.api).password);
    expect(output).not.toContain('postgres://');
  });

  it('M2-AC01/2 startup exits 1 on a missing variable and names it without any value', async () => {
    const { code, output } = await runMain({
      WRINGY_ENV: 'ci',
      ...IDENTITY_ENV,
      HOST: 'host-canary-DO-NOT-LEAK',
    });
    expect(code).toBe(1);
    expect(output).toContain('Invalid environment for api: DATABASE_URL is missing');
    expect(output).not.toContain('host-canary-DO-NOT-LEAK');
  });

  it('startup refuses a database with no environment marker', async () => {
    const logs = new LogCapture();
    await expect(
      startServer(envFor(unmarked.urls.api, TEST_WRINGY_ENV), { logStream: logs, retry: NO_RETRY }),
    ).rejects.toThrow(/no ops\.environment marker/);
  });

  it('startup retries an unreachable database with backoff, then gives up', async () => {
    const logs = new LogCapture();
    const url = `postgres://wringy_api_login:canary-pw-DO-NOT-LEAK@127.0.0.1:${await freePort()}/wringy`;
    await expect(
      startServer(envFor(url, TEST_WRINGY_ENV), {
        logStream: logs,
        retry: { attempts: 3, initialDelayMs: 10, maxDelayMs: 20 },
      }),
    ).rejects.toBeInstanceOf(DatabaseUnavailableError);
    const retries = logs.records.filter((record) => record.msg === 'database not reachable yet; retrying');
    expect(retries.map((record) => [record.attempt, record.retryInMs, record.code])).toEqual([
      [1, 10, 'ECONNREFUSED'],
      [2, 20, 'ECONNREFUSED'],
    ]);
    expect(logs.text).not.toContain('canary-pw-DO-NOT-LEAK');
  });

  // Windows has no POSIX signals: child.kill('SIGTERM') there is a forced kill, so
  // this runs on Linux and macOS (CI) only.
  it.skipIf(process.platform === 'win32')('SIGTERM closes the server and the pool, and the process exits 0', async () => {
    const port = await freePort();
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      WRINGY_ENV: TEST_WRINGY_ENV,
      DATABASE_URL: db.urls.api,
      ...IDENTITY_ENV,
      PORT: String(port),
    };
    delete childEnv.TEST_DATABASE_URL;
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: API_DIR,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const exited = new Promise<number | null>((resolve) => child.on('close', resolve));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`the API did not start: ${output}`)), 20_000);
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8');
        if (output.includes('Server listening at')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    expect((await fetch(`http://127.0.0.1:${port}/health/live`)).status).toBe(200);

    child.kill('SIGTERM');
    expect(await exited).toBe(0);
    expect(output).toContain('"msg":"shutting down"');
  });

  it('startup succeeds when WRINGY_ENV matches the marker, serves HTTP, and closes cleanly', async () => {
    const logs = new LogCapture();
    const server = await startServer(envFor(db.urls.api, TEST_WRINGY_ENV), { logStream: logs, retry: NO_RETRY });
    try {
      const address = server.app.server.address();
      if (address === null || typeof address !== 'object') throw new Error('not listening');
      expect(address.address).toBe('127.0.0.1');
      const live = await fetch(`http://127.0.0.1:${address.port}/health/live`);
      expect(live.status).toBe(200);
      expect(live.headers.get('cache-control')).toBe('private, no-store');
      // Since M2-02 startServer builds the real hook from SUPABASE_URL, so the
      // route is reachable but refuses a request with no bearer token. The 401
      // proves both: the server serves HTTP, and nothing behind the hook is open.
      const campaigns = await fetch(`http://127.0.0.1:${address.port}/internal/campaigns`);
      expect(campaigns.status).toBe(401);
      expect(campaigns.headers.get('vary')).toBe('Authorization');
    } finally {
      await server.close();
    }
    expect(server.pool.ended).toBe(true);
    expect(logs.records.some((record) => record.msg === 'environment marker matches')).toBe(true);
  });
});
