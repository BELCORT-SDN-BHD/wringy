import { describe, expect, it } from 'vitest';

import {
  EnvError,
  INTERNAL_MODE_VARIABLES,
  isHttpOrigin,
  loadApiEnv,
  loadBootstrapEnv,
  loadMigrateEnv,
  loadPlatformBootstrapEnv,
  loadWebEnv,
  loadWorkerEnv,
  originSchema,
  publishableKeySchema,
  tokenBearingOriginSchema,
  tryLoadEnv,
  type EnvSource,
} from './index';

const PG_URL = 'postgres://wringy_api_login:placeholder@127.0.0.1:54329/wringy';
/** A Supabase project origin and a publishable key, in the shapes the schemas accept. */
const SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_AbCdEfGhIjKlMnOpQr';
/** The three identity variables the api requires (M2-02 R14). */
const API_IDENTITY = {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
  SESSION_LIVENESS: 'auth_server',
} as const;

function problemsOf(load: () => unknown): Array<{ name: string; problem: string }> {
  try {
    load();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return [...(error as EnvError).problems];
  }
  throw new Error('expected the environment to be rejected');
}

describe('M2-AC01 api env', () => {
  it('applies the non-secret defaults', () => {
    expect(loadApiEnv({ WRINGY_ENV: 'local', DATABASE_URL: PG_URL, ...API_IDENTITY })).toEqual({
      WRINGY_ENV: 'local',
      DATABASE_URL: PG_URL,
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
      SESSION_LIVENESS: 'auth_server',
      PORT: 3200,
      HOST: '127.0.0.1',
      LOG_LEVEL: 'info',
    });
  });

  it('coerces PORT and keeps explicit settings', () => {
    const env = loadApiEnv({
      WRINGY_ENV: 'ci',
      DATABASE_URL: PG_URL,
      ...API_IDENTITY,
      PORT: '3300',
      HOST: '0.0.0.0',
      LOG_LEVEL: 'warn',
    });
    expect(env.PORT).toBe(3300);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.LOG_LEVEL).toBe('warn');
  });

  it('has no default for the database URL', () => {
    expect(problemsOf(() => loadApiEnv({ WRINGY_ENV: 'local', ...API_IDENTITY }))).toEqual([
      { name: 'DATABASE_URL', problem: 'missing' },
    ]);
  });

  it('M2-AC02/2 has no default for the Supabase project, its publishable key or the liveness mechanism', () => {
    expect(problemsOf(() => loadApiEnv({ WRINGY_ENV: 'local', DATABASE_URL: PG_URL }))).toEqual([
      { name: 'SESSION_LIVENESS', problem: 'missing' },
      { name: 'SUPABASE_PUBLISHABLE_KEY', problem: 'missing' },
      { name: 'SUPABASE_URL', problem: 'missing' },
    ]);
  });

  it('M2-AC02/2 accepts either liveness mechanism and refuses any other spelling', () => {
    for (const mechanism of ['database', 'auth_server'] as const) {
      expect(
        loadApiEnv({ WRINGY_ENV: 'ci', DATABASE_URL: PG_URL, ...API_IDENTITY, SESSION_LIVENESS: mechanism })
          .SESSION_LIVENESS,
      ).toBe(mechanism);
    }
    for (const wrong of ['auth-server', 'Auth_Server', 'authserver', 'auth server', 'none']) {
      expect(
        problemsOf(() =>
          loadApiEnv({ WRINGY_ENV: 'ci', DATABASE_URL: PG_URL, ...API_IDENTITY, SESSION_LIVENESS: wrong }),
        ),
        wrong,
      ).toEqual([{ name: 'SESSION_LIVENESS', problem: 'invalid' }]);
    }
  });

  it('M2-AC02/2 refuses a publishable key too short to be one, and a Supabase URL that is not an origin', () => {
    expect(
      problemsOf(() =>
        loadApiEnv({
          WRINGY_ENV: 'ci',
          DATABASE_URL: PG_URL,
          ...API_IDENTITY,
          SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
          SUPABASE_URL: `${SUPABASE_URL}/auth/v1`,
        }),
      ),
    ).toEqual([
      { name: 'SUPABASE_PUBLISHABLE_KEY', problem: 'invalid' },
      { name: 'SUPABASE_URL', problem: 'invalid' },
    ]);
  });

  it('treats an empty variable as missing, so a blank .env line never passes', () => {
    expect(problemsOf(() => loadApiEnv({ WRINGY_ENV: 'local', ...API_IDENTITY, DATABASE_URL: '  ' }))).toEqual([
      { name: 'DATABASE_URL', problem: 'missing' },
    ]);
    expect(loadApiEnv({ WRINGY_ENV: 'local', DATABASE_URL: PG_URL, ...API_IDENTITY, PORT: '' }).PORT).toBe(3200);
  });

  it('names every bad variable in one error, sorted', () => {
    expect(
      problemsOf(() =>
        loadApiEnv({ WRINGY_ENV: 'prod', DATABASE_URL: 'https://x.test', ...API_IDENTITY, PORT: '0' }),
      ),
    ).toEqual([
      { name: 'DATABASE_URL', problem: 'invalid' },
      { name: 'PORT', problem: 'invalid' },
      { name: 'WRINGY_ENV', problem: 'invalid' },
    ]);
  });
});

describe('M2-AC02/2 originSchema accepts an origin and nothing else', () => {
  it('M2-AC02/2 accepts a bare http(s) origin, with or without a port', () => {
    for (const value of [
      'https://abcdefghijklmnopqrst.supabase.co',
      'http://127.0.0.1:3100',
      'http://localhost:3000',
      'https://internal.wringy.com',
    ]) {
      expect(originSchema.safeParse(value).success, value).toBe(true);
      expect(isHttpOrigin(value), value).toBe(true);
    }
  });

  it('M2-AC02/2 refuses a trailing slash, a path, a query, a fragment, credentials and a non-http scheme', () => {
    for (const value of [
      'https://x.supabase.co/',
      'https://x.supabase.co/auth/v1',
      'https://x.supabase.co?ref=1',
      'https://x.supabase.co#frag',
      'https://user:pw@x.supabase.co',
      'postgres://wringy_api_login:placeholder@127.0.0.1:54329/wringy',
      'ftp://x.supabase.co',
      'x.supabase.co',
      'https://x.supabase.co:443',
      '',
    ]) {
      expect(originSchema.safeParse(value).success, value).toBe(false);
      expect(isHttpOrigin(value), value).toBe(false);
    }
  });
});

describe('M2-AC01/2 an env error never echoes a value', () => {
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
      // The M2-02 identity variables, each invalid and each carrying the secret.
      WRINGY_APP_MODE: `internal-${secret}`,
      SUPABASE_URL: `https://${secret}.supabase.co/auth/v1`,
      SUPABASE_PUBLISHABLE_KEY: `sb publishable ${secret}`,
      APP_ORIGIN: `https://${secret}.example/app`,
      SESSION_LIVENESS: `auth-server-${secret}`,
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

describe('M2-AC01 each process reads only its own variables', () => {
  const all: EnvSource = {
    WRINGY_ENV: 'local',
    API_INTERNAL_URL: 'http://127.0.0.1:3200',
    DATABASE_URL: PG_URL,
    DATABASE_URL_MIGRATOR: 'postgres://wringy_migrator:placeholder@127.0.0.1:54329/wringy',
    WORKER_ID: 'worker-local-1',
    IMAGE_REF: 'ghcr.io/belcort-sdn-bhd/wringy-worker:0123abc',
  };

  it('M2-AC01/2 gives the web server the API URL and never a database URL', () => {
    const env = loadWebEnv(all);
    expect(env).toEqual({
      WRINGY_ENV: 'local',
      API_INTERNAL_URL: 'http://127.0.0.1:3200',
      WRINGY_APP_MODE: 'demo',
    });
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
      LOG_LEVEL: 'info',
    });
    expect(loadWorkerEnv({ ...all, LOG_LEVEL: 'debug' }).LOG_LEVEL).toBe('debug');
    expect(problemsOf(() => loadWorkerEnv({ ...all, LOG_LEVEL: 'loud' }))).toEqual([
      { name: 'LOG_LEVEL', problem: 'invalid' },
    ]);
    expect(problemsOf(() => loadWorkerEnv({ WRINGY_ENV: 'local', DATABASE_URL: PG_URL }))).toEqual([
      { name: 'IMAGE_REF', problem: 'missing' },
      { name: 'WORKER_ID', problem: 'missing' },
    ]);
  });

  it('M2-AC01/2 gives migrations the migrator URL only', () => {
    expect(loadMigrateEnv(all)).toEqual({
      WRINGY_ENV: 'local',
      DATABASE_URL_MIGRATOR: 'postgres://wringy_migrator:placeholder@127.0.0.1:54329/wringy',
    });
    expect(problemsOf(() => loadMigrateEnv({ WRINGY_ENV: 'local', DATABASE_URL: PG_URL }))).toEqual([
      { name: 'DATABASE_URL_MIGRATOR', problem: 'missing' },
    ]);
  });
});

describe('M2-AC02/2 the web app mode decides what the internal build needs', () => {
  const web: EnvSource = { WRINGY_ENV: 'local', API_INTERNAL_URL: 'http://127.0.0.1:3200' };

  it('M2-AC02/2 defaults to demo, which needs no Supabase variables at all', () => {
    expect(loadWebEnv(web)).toEqual({ ...web, WRINGY_APP_MODE: 'demo' });
    expect(loadWebEnv({ ...web, WRINGY_APP_MODE: 'demo' })).toEqual({ ...web, WRINGY_APP_MODE: 'demo' });
  });

  it('M2-AC02/2 internal mode reports exactly the three missing names', () => {
    expect(problemsOf(() => loadWebEnv({ ...web, WRINGY_APP_MODE: 'internal' }))).toEqual(
      [...INTERNAL_MODE_VARIABLES].sort().map((name) => ({ name, problem: 'missing' })),
    );
    expect(INTERNAL_MODE_VARIABLES).toEqual(['APP_ORIGIN', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_URL']);
  });

  it('M2-AC02/2 internal mode passes with all three, and keeps them exactly', () => {
    expect(
      loadWebEnv({
        ...web,
        WRINGY_APP_MODE: 'internal',
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
        APP_ORIGIN: 'http://127.0.0.1:3100',
      }),
    ).toEqual({
      ...web,
      WRINGY_APP_MODE: 'internal',
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
      APP_ORIGIN: 'http://127.0.0.1:3100',
    });
  });

  it('M2-AC02/2 refuses an app mode outside the enum, and an APP_ORIGIN with a path', () => {
    expect(problemsOf(() => loadWebEnv({ ...web, WRINGY_APP_MODE: 'production' }))).toEqual([
      { name: 'WRINGY_APP_MODE', problem: 'invalid' },
    ]);
    expect(
      problemsOf(() =>
        loadWebEnv({
          ...web,
          WRINGY_APP_MODE: 'internal',
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
          APP_ORIGIN: 'http://127.0.0.1:3100/internal',
        }),
      ),
    ).toEqual([{ name: 'APP_ORIGIN', problem: 'invalid' }]);
  });
});

describe('M2-AC01 bootstrap env', () => {
  it('lets a local bootstrap fall back to development values', () => {
    expect(loadBootstrapEnv({ WRINGY_ENV: 'local' })).toEqual({
      WRINGY_ENV: 'local',
      PG_BOOTSTRAP_DATABASE: 'wringy',
    });
  });

  it('M2-AC01/2 refuses the development fallback for WRINGY_ENV=local when the admin URL is not this machine', () => {
    for (const host of ['db.staging.example.com', '10.0.0.5', '[2001:db8::1]']) {
      expect(
        problemsOf(() =>
          loadBootstrapEnv({ WRINGY_ENV: 'local', PG_BOOTSTRAP_ADMIN_URL: `postgres://postgres:placeholder@${host}:5432/postgres` }),
        ),
        host,
      ).toEqual([
        { name: 'PG_BOOTSTRAP_API_PASSWORD', problem: 'missing' },
        { name: 'PG_BOOTSTRAP_MIGRATOR_PASSWORD', problem: 'missing' },
        { name: 'PG_BOOTSTRAP_WORKER_PASSWORD', problem: 'missing' },
      ]);
    }
  });

  it('lets a local bootstrap on a loopback admin URL fall back to development values', () => {
    for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
      const url = `postgres://postgres:placeholder@${host}:54329/postgres`;
      expect(loadBootstrapEnv({ WRINGY_ENV: 'local', PG_BOOTSTRAP_ADMIN_URL: url }), host).toEqual({
        WRINGY_ENV: 'local',
        PG_BOOTSTRAP_ADMIN_URL: url,
        PG_BOOTSTRAP_DATABASE: 'wringy',
      });
    }
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

describe('M2-AC01 tryLoadEnv', () => {
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

describe('M2-AC02/2 loadPlatformBootstrapEnv requires only what the platform bootstrap uses', () => {
  const REMOTE = 'postgres://postgres:placeholder@db.staging.example.com:5432/postgres';

  it('M2-AC02/2 no login-role password is required, because none is set', () => {
    expect(
      loadPlatformBootstrapEnv({ WRINGY_ENV: 'staging', PG_BOOTSTRAP_ADMIN_URL: REMOTE, PG_BOOTSTRAP_DATABASE: 'postgres' }),
    ).toEqual({
      WRINGY_ENV: 'staging',
      PG_BOOTSTRAP_ADMIN_URL: REMOTE,
      PG_BOOTSTRAP_DATABASE: 'postgres',
    });
    // The role-creating command still requires all three, by name.
    expect(problemsOf(() => loadBootstrapEnv({ WRINGY_ENV: 'staging', PG_BOOTSTRAP_ADMIN_URL: REMOTE }))).toEqual([
      { name: 'PG_BOOTSTRAP_API_PASSWORD', problem: 'missing' },
      { name: 'PG_BOOTSTRAP_MIGRATOR_PASSWORD', problem: 'missing' },
      { name: 'PG_BOOTSTRAP_WORKER_PASSWORD', problem: 'missing' },
    ]);
  });

  it('M2-AC02/2 the admin URL is required outside local, and optional for the embedded cluster', () => {
    expect(problemsOf(() => loadPlatformBootstrapEnv({ WRINGY_ENV: 'production' }))).toEqual([
      { name: 'PG_BOOTSTRAP_ADMIN_URL', problem: 'missing' },
    ]);
    expect(loadPlatformBootstrapEnv({ WRINGY_ENV: 'local' })).toEqual({
      WRINGY_ENV: 'local',
      PG_BOOTSTRAP_DATABASE: 'wringy',
    });
  });
});

describe('M2-AC02/2 no secret key and no plaintext project origin can be configured', () => {
  /** A legacy service-role JWT: header.payload.signature, payload naming the role. */
  const serviceRoleJwt = (role: string) =>
    [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url'),
      Buffer.from(JSON.stringify({ iss: 'supabase', role, exp: 2_000_000_000 }), 'utf8').toString('base64url'),
      'c2lnbmF0dXJl',
    ].join('.');

  it('M2-AC02/2 a sb_secret_ key is refused wherever a publishable key is asked for', () => {
    // The dashboard shows the two keys side by side, and the loose positive shape
    // accepts both. The api would send this one as the `apikey` header on every
    // Auth call; the documented "no secret key, in any variable" has to be a check.
    for (const secret of ['sb_secret_9aBcDeFgHiJkLmNoPq', 'SB_SECRET_9aBcDeFgHiJkLmNoPq', serviceRoleJwt('service_role')]) {
      expect(publishableKeySchema.safeParse(secret).success, secret.slice(0, 12)).toBe(false);
      expect(problemsOf(() => loadApiEnv({ WRINGY_ENV: 'staging', DATABASE_URL: PG_URL, SUPABASE_URL, SESSION_LIVENESS: 'auth_server', SUPABASE_PUBLISHABLE_KEY: secret }))).toEqual([
        { name: 'SUPABASE_PUBLISHABLE_KEY', problem: 'invalid' },
      ]);
      expect(
        problemsOf(() =>
          loadWebEnv({
            WRINGY_ENV: 'staging',
            API_INTERNAL_URL: 'http://api.internal:3200',
            WRINGY_APP_MODE: 'internal',
            APP_ORIGIN: 'https://app.wringy.test',
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY: secret,
          }),
        ),
      ).toEqual([{ name: 'SUPABASE_PUBLISHABLE_KEY', problem: 'invalid' }]);
    }

    // A publishable key, and a legacy anon JWT, still pass.
    expect(publishableKeySchema.safeParse(PUBLISHABLE_KEY).success).toBe(true);
    expect(publishableKeySchema.safeParse(serviceRoleJwt('anon')).success).toBe(true);
  });

  it('M2-AC02/2 SUPABASE_URL must be https unless it is loopback, because it is the key set', () => {
    // Plaintext to a hosted host means anyone on the path can publish their own
    // signing key and mint tokens the hook accepts.
    for (const plaintext of ['http://my-project.supabase.co', 'http://internal-identity.staging.corp:8000']) {
      expect(tokenBearingOriginSchema.safeParse(plaintext).success, plaintext).toBe(false);
      expect(
        problemsOf(() =>
          loadApiEnv({ WRINGY_ENV: 'staging', DATABASE_URL: PG_URL, SESSION_LIVENESS: 'auth_server', SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY, SUPABASE_URL: plaintext }),
        ),
        plaintext,
      ).toEqual([{ name: 'SUPABASE_URL', problem: 'invalid' }]);
    }

    // The credential-free fakes announce a loopback origin with no TLS: they stay.
    for (const loopback of ['http://127.0.0.1:3100', 'http://localhost:54321', 'http://[::1]:3200']) {
      expect(tokenBearingOriginSchema.safeParse(loopback).success, loopback).toBe(true);
    }
    expect(tokenBearingOriginSchema.safeParse(SUPABASE_URL).success).toBe(true);
    // The shape rules still apply on top of the scheme rule.
    expect(tokenBearingOriginSchema.safeParse(`${SUPABASE_URL}/auth/v1`).success).toBe(false);
    // APP_ORIGIN keeps the plain origin rule: a loopback development origin is http.
    expect(originSchema.safeParse('http://127.0.0.1:3100').success).toBe(true);
  });
});
