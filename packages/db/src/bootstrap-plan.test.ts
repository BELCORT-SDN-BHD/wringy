import { describe, expect, it } from 'vitest';

import { EnvError } from '@wringy/config';
import { loadBootstrapEnv } from '@wringy/config/bootstrap';

import { loadPlatformBootstrapEnv } from '@wringy/config/bootstrap';

import {
  DevelopmentPasswordRefusedError,
  isEmbeddedClusterUrl,
  resolveBootstrapPlan,
  resolvePlatformAdminUrl,
} from './bootstrap-plan';
import { LOCAL_PASSWORDS, localUrls } from './local-dev';

const plan = (source: Record<string, string>) => resolveBootstrapPlan(loadBootstrapEnv(source));

function refusal(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected the bootstrap to be refused');
}

const REMOTE = 'postgres://postgres:placeholder@db.staging.example.com:5432/postgres';

const OWN = {
  PG_BOOTSTRAP_MIGRATOR_PASSWORD: 'own-migrator-secret-1',
  PG_BOOTSTRAP_API_PASSWORD: 'own-api-secret-12',
  PG_BOOTSTRAP_WORKER_PASSWORD: 'own-worker-secret-1',
};

describe('M2-AC01/2 pnpm db:bootstrap uses the development passwords only on the embedded local cluster', () => {
  it('M2-AC01/2 WRINGY_ENV=local with no admin URL: the embedded superuser and the development passwords', () => {
    expect(plan({ WRINGY_ENV: 'local' })).toEqual({
      adminUrl: localUrls().superuser,
      passwords: { ...LOCAL_PASSWORDS },
      developmentPasswords: true,
    });
  });

  it('M2-AC01/2 WRINGY_ENV=local with a remote admin URL is refused without the three passwords', () => {
    const error = refusal(() => plan({ WRINGY_ENV: 'local', PG_BOOTSTRAP_ADMIN_URL: REMOTE }));
    expect(error).toBeInstanceOf(EnvError);
    expect((error as EnvError).problems.map((problem) => problem.name)).toEqual([
      'PG_BOOTSTRAP_API_PASSWORD',
      'PG_BOOTSTRAP_MIGRATOR_PASSWORD',
      'PG_BOOTSTRAP_WORKER_PASSWORD',
    ]);
  });

  it('M2-AC01/2 a loopback admin URL on another port (a tunnel, another server) gets no development passwords', () => {
    const tunnel = 'postgres://postgres:placeholder@127.0.0.1:5432/postgres';
    const error = refusal(() => plan({ WRINGY_ENV: 'local', PG_BOOTSTRAP_ADMIN_URL: tunnel }));
    expect(error).toBeInstanceOf(EnvError);
    expect(isEmbeddedClusterUrl(tunnel)).toBe(false);
    expect(isEmbeddedClusterUrl(localUrls().superuser)).toBe(true);
    expect(isEmbeddedClusterUrl(undefined)).toBe(true);
  });

  it('M2-AC01/2 a development password is refused anywhere but the embedded cluster, naming the variable only', () => {
    for (const WRINGY_ENV of ['local', 'staging']) {
      const error = refusal(() =>
        plan({ WRINGY_ENV, PG_BOOTSTRAP_ADMIN_URL: REMOTE, ...OWN, PG_BOOTSTRAP_API_PASSWORD: LOCAL_PASSWORDS.api }),
      );
      expect(error, WRINGY_ENV).toBeInstanceOf(DevelopmentPasswordRefusedError);
      expect((error as DevelopmentPasswordRefusedError).variables).toEqual(['PG_BOOTSTRAP_API_PASSWORD']);
      expect(error.message).not.toContain(LOCAL_PASSWORDS.api);
    }
  });

  it('M2-AC01/2 uses the given admin URL and passwords everywhere else', () => {
    expect(plan({ WRINGY_ENV: 'staging', PG_BOOTSTRAP_ADMIN_URL: REMOTE, ...OWN })).toEqual({
      adminUrl: REMOTE,
      passwords: {
        migrator: OWN.PG_BOOTSTRAP_MIGRATOR_PASSWORD,
        api: OWN.PG_BOOTSTRAP_API_PASSWORD,
        worker: OWN.PG_BOOTSTRAP_WORKER_PASSWORD,
      },
      developmentPasswords: false,
    });
  });
});

describe('M2-AC02/2 pnpm db:platform-bootstrap asks only for what it uses', () => {
  it('M2-AC02/2 a hosted install needs the admin URL and none of the three login passwords', () => {
    // It creates no login role and sets no password. Requiring them made the step
    // packages/db/README.md documents impossible to run: it exited before opening
    // a connection, naming three secrets it would never have used.
    const env = loadPlatformBootstrapEnv({
      WRINGY_ENV: 'staging',
      PG_BOOTSTRAP_ADMIN_URL: REMOTE,
      PG_BOOTSTRAP_DATABASE: 'postgres',
    });

    expect(resolvePlatformAdminUrl(env)).toBe(REMOTE);
    expect(env.PG_BOOTSTRAP_DATABASE).toBe('postgres');
    // The password-setting command still requires them, so nothing was loosened.
    expect(refusal(() => plan({ WRINGY_ENV: 'staging', PG_BOOTSTRAP_ADMIN_URL: REMOTE }))).toBeInstanceOf(EnvError);
  });

  it('M2-AC02/2 the embedded local cluster still needs no admin URL at all', () => {
    expect(resolvePlatformAdminUrl(loadPlatformBootstrapEnv({ WRINGY_ENV: 'local' }))).toBe(localUrls().superuser);
  });

  it('M2-AC02/2 outside local the admin URL is required, by name', () => {
    const error = refusal(() => loadPlatformBootstrapEnv({ WRINGY_ENV: 'staging' }));
    expect(error).toBeInstanceOf(EnvError);
    expect((error as EnvError).problems.map((problem) => problem.name)).toEqual(['PG_BOOTSTRAP_ADMIN_URL']);
    // And the same refusal comes from the resolver, so neither half can drift.
    expect(refusal(() => resolvePlatformAdminUrl({ WRINGY_ENV: 'staging' }))).toBeInstanceOf(EnvError);
  });

  it('M2-AC02/2 a development password is never even looked at here', () => {
    // resolveBootstrapPlan refuses one (it would land on a shared cluster); this
    // command sets no password, so the value is irrelevant rather than refused.
    const source = {
      WRINGY_ENV: 'staging',
      PG_BOOTSTRAP_ADMIN_URL: REMOTE,
      PG_BOOTSTRAP_MIGRATOR_PASSWORD: LOCAL_PASSWORDS.migrator,
      PG_BOOTSTRAP_API_PASSWORD: LOCAL_PASSWORDS.api,
      PG_BOOTSTRAP_WORKER_PASSWORD: LOCAL_PASSWORDS.worker,
    };

    expect(resolvePlatformAdminUrl(loadPlatformBootstrapEnv(source))).toBe(REMOTE);
    expect(refusal(() => plan(source))).toBeInstanceOf(DevelopmentPasswordRefusedError);
  });
});
