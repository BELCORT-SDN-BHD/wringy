/**
 * The real worker process, spawned from src/main.ts (kickoff-package.md §6.1:
 * worker integration tests spawn the real worker). Covers the exit codes and
 * M2-AC01/2 part 4 for the worker: nothing it prints carries a secret.
 *
 * Shutdown: on Linux (CI) the test sends SIGTERM. Windows has no POSIX signals
 * (Node's subprocess.kill() there terminates abruptly), so on Windows the test
 * sends the IPC message `shutdown`, which main.ts routes to the same graceful
 * stop as SIGTERM (src/shutdown.ts).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Pool } from '@wringy/db';

import { TEST_WRINGY_ENV, createTestDatabase, heartbeatRow, migratorPool, waitFor, type TestDatabase } from './support';

const APP_DIR = fileURLToPath(new URL('..', import.meta.url));
const WRONG_PASSWORD = 'Wr0ng-pa55word-for-test';

interface Run {
  code: number | null;
  output: string;
}

/** Environment for the child: the parent's minus every database URL, plus `vars`. */
function childEnv(vars: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!/DATABASE_URL|^PG|^WRINGY_|^WORKER_ID$|^IMAGE_REF$|^LOG_LEVEL$/i.test(name)) env[name] = value;
  }
  return { ...env, ...vars };
}

/**
 * Runs `node --import tsx src/main.ts` in apps/worker. When `whenStarted` is
 * given, it is awaited once the worker logs "worker started" and the process is
 * then asked to shut down.
 */
function runWorker(vars: Record<string, string>, whenStarted?: () => Promise<void>): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', path.join('src', 'main.ts')], {
      cwd: APP_DIR,
      env: childEnv(vars),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true,
    });
    let output = '';
    let asked = false;
    const killer = setTimeout(() => child.kill('SIGKILL'), 60_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (whenStarted && !asked && output.includes('"msg":"worker started"')) {
        asked = true;
        whenStarted()
          .then(() => {
            if (process.platform === 'win32') child.send('shutdown');
            else child.kill('SIGTERM');
          })
          .catch(reject);
      }
    };
    child.stdout!.on('data', onData);
    child.stderr!.on('data', onData);
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(killer);
      resolve({ code, output });
    });
  });
}

describe('the worker process (src/main.ts)', () => {
  let db: TestDatabase;
  let migrator: Pool;
  const outputs: string[] = [];

  beforeAll(async () => {
    db = await createTestDatabase();
    migrator = migratorPool(db);
  });

  afterAll(async () => {
    await migrator?.end();
    await db?.drop();
  });

  const base = () => ({
    WRINGY_ENV: TEST_WRINGY_ENV,
    DATABASE_URL: db.urls.worker,
    WORKER_ID: 'proc-1',
    IMAGE_REF: 'ghcr.io/belcort-sdn-bhd/wringy-worker:proc',
    LOG_LEVEL: 'debug',
  });

  it('starts, beats, drains on shutdown and exits 0 with stopped_at set', async () => {
    const run = await runWorker(base(), async () => {
      const row = await waitFor(
        () => heartbeatRow(migrator, 'proc-1'),
        (r) => r !== undefined,
      );
      expect(row?.stopped_at).toBeNull();
    });
    outputs.push(run.output);
    expect(run.code, run.output).toBe(0);
    expect(run.output).toContain('"msg":"shutdown requested"');
    expect(run.output).toContain('"msg":"worker stopped"');
    const row = await heartbeatRow(migrator, 'proc-1');
    expect(row!.stopped_at).not.toBeNull();
    expect(row!.stopped_at!.getTime()).toBeGreaterThanOrEqual(row!.last_beat_at.getTime());
  });

  it('exits 1 on an environment mismatch, naming environments and nothing secret', async () => {
    const run = await runWorker({ ...base(), WORKER_ID: 'proc-2', WRINGY_ENV: 'staging' });
    outputs.push(run.output);
    expect(run.code, run.output).toBe(1);
    expect(run.output).toContain('This database is marked as environment \\"ci\\", but WRINGY_ENV is \\"staging\\"');
    expect(await heartbeatRow(migrator, 'proc-2')).toBeUndefined();
  });

  it('exits 1 on a refused login without retrying, and on a missing variable, naming it only', async () => {
    const wrong = new URL(db.urls.worker);
    wrong.password = WRONG_PASSWORD;
    const refused = await runWorker({ ...base(), WORKER_ID: 'proc-3', DATABASE_URL: wrong.toString() });
    outputs.push(refused.output);
    expect(refused.code, refused.output).toBe(1);
    expect(refused.output).toContain('password authentication failed');
    expect(refused.output).not.toContain('retrying');

    const withoutId: Record<string, string> = { ...base() };
    delete withoutId.WORKER_ID;
    const missing = await runWorker(withoutId);
    outputs.push(missing.output);
    expect(missing.code, missing.output).toBe(1);
    expect(missing.output).toContain('WORKER_ID is missing');
  });

  it('no secret in logs', () => {
    expect(outputs).toHaveLength(4);
    const all = outputs.join('\n');
    expect(all.length).toBeGreaterThan(0);
    // Every line is structured JSON from pino.
    for (const line of all.split(/\r?\n/).filter((l) => l.trim() !== '')) {
      expect(() => JSON.parse(line), line).not.toThrow();
    }
    const workerPassword = decodeURIComponent(new URL(db.urls.worker).password);
    expect(workerPassword.length).toBeGreaterThan(0);
    for (const secret of [workerPassword, WRONG_PASSWORD, db.urls.worker, 'wringy_worker_login:']) {
      expect(all).not.toContain(secret);
    }
    expect(all).not.toMatch(/postgres(ql)?:\/\/(?!\[redacted\])/);
  });
});
