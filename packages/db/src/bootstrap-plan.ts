/**
 * What `pnpm db:bootstrap` connects to and which passwords it sets
 * (scripts/bootstrap.mjs). Kept apart from bootstrap.ts so the rule is
 * unit-tested and no runtime bundle pulls in the development values.
 *
 * The fixed development passwords (LOCAL_PASSWORDS, committed in local-dev.ts)
 * are used only for the embedded cluster `pnpm db:start` runs: WRINGY_ENV=local
 * AND the admin URL unset (the embedded superuser) or on a loopback host at
 * LOCAL_PG_PORT. The WRINGY_ENV label alone is not enough: a developer's `.env`
 * says local, and an operator may add a shared cluster's admin URL to run one
 * command, or reach it through a tunnel on a loopback port. Anywhere else all
 * three passwords are required, and a value equal to a published development
 * password is refused, so those passwords can never land on a shared cluster.
 */
import { EnvError, isLoopbackUrl } from '@wringy/config';
import { developmentDefaultsAllowed, type BootstrapEnv } from '@wringy/config/bootstrap';

import type { LoginPasswords } from './bootstrap';
import { LOCAL_PASSWORDS, LOCAL_PG_PORT, localUrls } from './local-dev';

export interface BootstrapPlan {
  adminUrl: string;
  passwords: LoginPasswords;
  /** True when the development passwords were used for the embedded cluster. */
  developmentPasswords: boolean;
}

const PASSWORD_VARIABLES = {
  migrator: 'PG_BOOTSTRAP_MIGRATOR_PASSWORD',
  api: 'PG_BOOTSTRAP_API_PASSWORD',
  worker: 'PG_BOOTSTRAP_WORKER_PASSWORD',
} as const satisfies Record<keyof LoginPasswords, keyof BootstrapEnv>;

/** A bootstrap password equal to one of the development passwords committed in local-dev.ts. */
export class DevelopmentPasswordRefusedError extends Error {
  override readonly name = 'DevelopmentPasswordRefusedError';
  constructor(readonly variables: readonly string[]) {
    super(
      `${variables.join(', ')} ${variables.length === 1 ? 'equals' : 'equal'} a development password committed in the ` +
        'repository (packages/db/src/local-dev.ts). Those are used only for the embedded local cluster; choose ' +
        'another password. Values are not shown.',
    );
  }
}

/** True when `adminUrl` is the embedded cluster `pnpm db:start` runs: unset, or a loopback host at LOCAL_PG_PORT. */
export function isEmbeddedClusterUrl(adminUrl: string | undefined): boolean {
  if (adminUrl === undefined) return true;
  if (!isLoopbackUrl(adminUrl)) return false;
  const { port } = new URL(adminUrl);
  return Number(port || 5432) === LOCAL_PG_PORT;
}

/**
 * The admin URL `pnpm db:platform-bootstrap` connects with.
 *
 * Deliberately not `resolveBootstrapPlan`: that resolves *passwords* for the
 * login roles, and this command creates no login role. Sharing it would make the
 * three `PG_BOOTSTRAP_*_PASSWORD` values required — and a development password
 * refused — for a command that sets none of them, which is exactly what made the
 * documented hosted-project step impossible to run.
 *
 * The embedded cluster's superuser stands in only where `pnpm db:bootstrap` would
 * use it too: `WRINGY_ENV=local` with no admin URL given.
 */
export function resolvePlatformAdminUrl(env: Pick<BootstrapEnv, 'WRINGY_ENV' | 'PG_BOOTSTRAP_ADMIN_URL'>): string {
  if (env.PG_BOOTSTRAP_ADMIN_URL !== undefined) return env.PG_BOOTSTRAP_ADMIN_URL;
  if (env.WRINGY_ENV === 'local') return localUrls().superuser;
  throw new EnvError('platform-bootstrap', [{ name: 'PG_BOOTSTRAP_ADMIN_URL', problem: 'missing' }]);
}

export function resolveBootstrapPlan(env: BootstrapEnv): BootstrapPlan {
  const development = developmentDefaultsAllowed(env) && isEmbeddedClusterUrl(env.PG_BOOTSTRAP_ADMIN_URL);
  if (development) {
    return {
      adminUrl: env.PG_BOOTSTRAP_ADMIN_URL ?? localUrls().superuser,
      passwords: {
        migrator: env.PG_BOOTSTRAP_MIGRATOR_PASSWORD ?? LOCAL_PASSWORDS.migrator,
        api: env.PG_BOOTSTRAP_API_PASSWORD ?? LOCAL_PASSWORDS.api,
        worker: env.PG_BOOTSTRAP_WORKER_PASSWORD ?? LOCAL_PASSWORDS.worker,
      },
      developmentPasswords: true,
    };
  }

  const missing: string[] = [];
  if (env.PG_BOOTSTRAP_ADMIN_URL === undefined) missing.push('PG_BOOTSTRAP_ADMIN_URL');
  for (const variable of Object.values(PASSWORD_VARIABLES)) {
    if (env[variable] === undefined) missing.push(variable);
  }
  if (missing.length > 0) {
    throw new EnvError(
      'bootstrap',
      missing.sort().map((name) => ({ name, problem: 'missing' as const })),
    );
  }

  const published = new Set<string>(Object.values(LOCAL_PASSWORDS));
  const reused = Object.values(PASSWORD_VARIABLES).filter((variable) => published.has(env[variable] ?? ''));
  if (reused.length > 0) throw new DevelopmentPasswordRefusedError([...reused].sort());

  return {
    adminUrl: env.PG_BOOTSTRAP_ADMIN_URL!,
    passwords: {
      migrator: env.PG_BOOTSTRAP_MIGRATOR_PASSWORD!,
      api: env.PG_BOOTSTRAP_API_PASSWORD!,
      worker: env.PG_BOOTSTRAP_WORKER_PASSWORD!,
    },
    developmentPasswords: false,
  };
}
