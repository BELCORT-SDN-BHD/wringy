import { describe, expect, it } from 'vitest';

import {
  EnvError,
  loadApiEnv,
  loadBootstrapEnv,
  loadMigrateEnv,
  loadWebEnv,
  loadWorkerEnv,
  tryLoadEnv,
  type EnvSource,
} from './index';

const PG_URL = 'postgres://wringy_api_login:placeholder@127.0.0.1:54329/wringy';

function problemsOf(load: () => unknown): Array<{ name: string; problem: string }> {
  try {
    load();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return [...(error as EnvError).problems];
  }
  throw new Error('expected the environment to be rejected');
}

describe('api env', () => {
  it('applies the non-secret defaults', () => {
    expect(loadApiEnv({ WRINGY_ENV: 'local', DATABASE_URL: PG_URL })).toEqual({
      WRINGY_ENV: 'local',
      DATABASE_URL: PG_URL,
      PORT: 3200,
      HOST: '127.0.0.1',
      LOG_LEVEL: 'info',
    });
  });

  it('coerces PORT and keeps explicit settings', () => {
    const env = loadApiEnv({
      WRINGY_ENV: 'ci',
      DATABASE_URL: PG_URL,
      PORT: '3300',
      HOST: '0.0.0.0',
      LOG_LEVEL: 'warn',
    });
    expect(env.PORT).toBe(3300);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.LOG_LEVEL).toBe('warn');
  });

  it('has no default for the database URL', () => {
    expect(problemsOf(() => loadApiEnv({ WRINGY_ENV: 'local' }))).toEqual([
      { name: 'DATABASE_URL', problem: 'missing' },
    ]);
  });

  it('treats an empty variable as missing, so a blank .env line never passes', () => {
    expect(problemsOf(() => loadApiEnv({ WRINGY_ENV: 'local', DATABASE_URL: '  ' }))).toEqual([
      { name: 'DATABASE_URL', problem: 'missing' },
    ]);
    expect(loadApiEnv({ WRINGY_ENV: 'local', DATABASE_URL: PG_URL, PORT: '' }).PORT).toBe(3200);
  });

  it('names every bad variable in one error, sorted', () => {
    expect(
      problemsOf(() => loadApiEnv({ WRINGY_ENV: 'prod', DATABASE_URL: 'https://x.test', PORT: '0' })),
    ).toEqual([
      { name: 'DATABASE_URL', problem: 'invalid' },
      { name: 'PORT', problem: 'invalid' },
      { name: 'WRINGY_ENV', problem: 'invalid' },
    ]);
  });
});

describe('an env error never echoes a value', () => {
  const secret = 'hunter2-DO-NOT-LEAK';
  const source: EnvSource = {
    WRINGY_ENV: `staging-${secret}`,
    DATABASE_URL: `mysql://wringy:${secret}@db.internal:5432/wringy`,
    PORT: `port-${secret}`,
    LOG_LEVEL: `loud-${secret}`,
  };

  it('keeps the value out of the message, the stack, the problems and the JSON form', () => {
    let caught: unknown;
    try {
      loadApiEnv(source);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EnvError);
    const error = caught as EnvError;

    for (const text of [
      error.message,
      String(error.stack),
      String(error),
      JSON.stringify(error),
      JSON.stringify(error.problems),
    ]) {
      expect(text).not.toContain(secret);
      expect(text).not.toContain('db.internal');
    }
    expect(error.message).toContain('DATABASE_URL is invalid');
    expect(error.cause).toBeUndefined();
  });

  it('holds for every process schema', () => {
    const loaders = [loadWebEnv, loadApiEnv, loadWorkerEnv, loadMigrateEnv, loadBootstrapEnv];
    const everything: EnvSource = {
      ...source,
      API_INTERNAL_URL: `ftp://${secret}`,
      DATABASE_URL_MIGRATOR: `mysql://${secret}`,
      WORKER_ID: `bad id ${secret}`,
      IMAGE_REF: `bad ref ${secret}`,
      PG_BOOTSTRAP_ADMIN_URL: `mysql://${secret}`,
      PG_BOOTSTRAP_API_PASSWORD: secret.slice(0, 4),
    };
    for (const load of loaders) {
      const result = tryLoadEnv(() => load(everything));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).not.toContain(secret);
        expect(JSON.stringify(result.error)).not.toContain(secret);
      }
    }
  });
});

describe('each process reads only its own variables', () => {
  const all: EnvSource = {
    WRINGY_ENV: 'local',
    API_INTERNAL_URL: 'http://127.0.0.1:3200',
    DATABASE_URL: PG_URL,
    DATABASE_URL_MIGRATOR: 'postgres://wringy_migrator:placeholder@127.0.0.1:54329/wringy',
    WORKER_ID: 'worker-local-1',
    IMAGE_REF: 'ghcr.io/belcort-sdn-bhd/wringy-worker:0123abc',
  };

  it('gives the web server the API URL and never a database URL', () => {
    const env = loadWebEnv(all);
    expect(env).toEqual({ WRINGY_ENV: 'local', API_INTERNAL_URL: 'http://127.0.0.1:3200' });
    expect(Object.keys(env)).not.toContain('DATABASE_URL');
    expect(Object.keys(env)).not.toContain('DATABASE_URL_MIGRATOR');
  });

  it('rejects a non-http API URL for the web server', () => {
    expect(
      problemsOf(() => loadWebEnv({ WRINGY_ENV: 'local', API_INTERNAL_URL: PG_URL })),
    ).toEqual([{ name: 'API_INTERNAL_URL', problem: 'invalid' }]);
  });

  it('gives the worker its id and image ref, and requires both', () => {
    expect(loadWorkerEnv(all)).toEqual({
      WRINGY_ENV: 'local',
      DATABASE_URL: PG_URL,
      WORKER_ID: 'worker-local-1',
      IMAGE_REF: 'ghcr.io/belcort-sdn-bhd/wringy-worker:0123abc',
    });
    expect(problemsOf(() => loadWorkerEnv({ WRINGY_ENV: 'local', DATABASE_URL: PG_URL }))).toEqual([
      { name: 'IMAGE_REF', problem: 'missing' },
      { name: 'WORKER_ID', problem: 'missing' },
    ]);
  });

  it('gives migrations the migrator URL only', () => {
    expect(loadMigrateEnv(all)).toEqual({
      WRINGY_ENV: 'local',
      DATABASE_URL_MIGRATOR: 'postgres://wringy_migrator:placeholder@127.0.0.1:54329/wringy',
    });
    expect(problemsOf(() => loadMigrateEnv({ WRINGY_ENV: 'local', DATABASE_URL: PG_URL }))).toEqual([
      { name: 'DATABASE_URL_MIGRATOR', problem: 'missing' },
    ]);
  });
});

describe('bootstrap env', () => {
  it('lets a local bootstrap fall back to development values', () => {
    expect(loadBootstrapEnv({ WRINGY_ENV: 'local' })).toEqual({
      WRINGY_ENV: 'local',
      PG_BOOTSTRAP_DATABASE: 'wringy',
    });
  });

  it('refuses a non-local bootstrap without an admin URL and all three passwords', () => {
    expect(problemsOf(() => loadBootstrapEnv({ WRINGY_ENV: 'staging' }))).toEqual([
      { name: 'PG_BOOTSTRAP_ADMIN_URL', problem: 'missing' },
      { name: 'PG_BOOTSTRAP_API_PASSWORD', problem: 'missing' },
      { name: 'PG_BOOTSTRAP_MIGRATOR_PASSWORD', problem: 'missing' },
      { name: 'PG_BOOTSTRAP_WORKER_PASSWORD', problem: 'missing' },
    ]);
  });

  it('rejects a short password and a database name that is not a plain identifier', () => {
    expect(
      problemsOf(() =>
        loadBootstrapEnv({
          WRINGY_ENV: 'local',
          PG_BOOTSTRAP_API_PASSWORD: 'short',
          PG_BOOTSTRAP_DATABASE: 'Wringy; DROP',
        }),
      ),
    ).toEqual([
      { name: 'PG_BOOTSTRAP_API_PASSWORD', problem: 'invalid' },
      { name: 'PG_BOOTSTRAP_DATABASE', problem: 'invalid' },
    ]);
  });
});

describe('tryLoadEnv', () => {
  it('turns an env error into a result and rethrows anything else', () => {
    const result = tryLoadEnv(() => loadWebEnv({}));
    expect(result.ok).toBe(false);
    expect(() =>
      tryLoadEnv(() => {
        throw new TypeError('not an env problem');
      }),
    ).toThrow(TypeError);
  });
});
