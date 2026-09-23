import { z } from 'zod';

import { EnvError, parseEnv, sortProblems, type EnvProblemKind, type EnvSource } from './parse';
import { isLoopbackUrl, postgresUrlSchema, wringyEnvSchema } from './shared';

// Printable ASCII: the bootstrap sends SCRAM verifiers, and SASLprep must not rewrite the password.
const password = z
  .string()
  .min(12)
  .max(256)
  .regex(/^[!-~]+$/);

/**
 * `pnpm db:bootstrap`: creates the login roles and the application database once
 * per environment. The admin URL and the three passwords may be left unset only
 * when `WRINGY_ENV=local` AND the admin URL is unset or points at this machine
 * (a loopback host): then the bootstrap script substitutes fixed development
 * values for the embedded cluster. The WRINGY_ENV label alone is not enough,
 * because a developer's `.env` says local while an operator may point the
 * admin URL at a shared cluster. Everywhere else they are required; no default
 * for a secret or a URL lives in this package.
 */
export const bootstrapEnvSchema = z.object({
  WRINGY_ENV: wringyEnvSchema,
  PG_BOOTSTRAP_ADMIN_URL: postgresUrlSchema.optional(),
  PG_BOOTSTRAP_DATABASE: z
    .string()
    .regex(/^[a-z_][a-z0-9_]{0,62}$/)
    .default('wringy'),
  PG_BOOTSTRAP_MIGRATOR_PASSWORD: password.optional(),
  PG_BOOTSTRAP_API_PASSWORD: password.optional(),
  PG_BOOTSTRAP_WORKER_PASSWORD: password.optional(),
});

export type BootstrapEnv = z.output<typeof bootstrapEnvSchema>;

const REQUIRED_OUTSIDE_LOCAL = [
  'PG_BOOTSTRAP_ADMIN_URL',
  'PG_BOOTSTRAP_MIGRATOR_PASSWORD',
  'PG_BOOTSTRAP_API_PASSWORD',
  'PG_BOOTSTRAP_WORKER_PASSWORD',
] as const;

/** True when the bootstrap may fill unset values with the local development ones (see bootstrapEnvSchema). */
export function developmentDefaultsAllowed(env: Pick<BootstrapEnv, 'WRINGY_ENV' | 'PG_BOOTSTRAP_ADMIN_URL'>): boolean {
  return (
    env.WRINGY_ENV === 'local' && (env.PG_BOOTSTRAP_ADMIN_URL === undefined || isLoopbackUrl(env.PG_BOOTSTRAP_ADMIN_URL))
  );
}

export function loadBootstrapEnv(source: EnvSource = process.env): BootstrapEnv {
  const env = parseEnv('bootstrap', bootstrapEnvSchema, source);
  if (developmentDefaultsAllowed(env)) return env;

  const missing = new Map<string, EnvProblemKind>();
  for (const name of REQUIRED_OUTSIDE_LOCAL) {
    if (env[name] === undefined) missing.set(name, 'missing');
  }
  if (missing.size > 0) throw new EnvError('bootstrap', sortProblems(missing));
  return env;
}
