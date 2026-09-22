import { z } from 'zod';

import { EnvError, parseEnv, sortProblems, type EnvProblemKind, type EnvSource } from './parse';
import { postgresUrlSchema, wringyEnvSchema } from './shared';

// Printable ASCII: the bootstrap sends SCRAM verifiers, and SASLprep must not rewrite the password.
const password = z
  .string()
  .min(12)
  .max(256)
  .regex(/^[!-~]+$/);

/**
 * `pnpm db:bootstrap`: creates the login roles and the application database once
 * per environment. The admin URL and the three passwords may be left unset only
 * when `WRINGY_ENV=local`, where the bootstrap script substitutes fixed
 * development values for the embedded cluster. Everywhere else they are required;
 * no default for a secret or a URL lives in this package.
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

export function loadBootstrapEnv(source: EnvSource = process.env): BootstrapEnv {
  const env = parseEnv('bootstrap', bootstrapEnvSchema, source);
  if (env.WRINGY_ENV === 'local') return env;

  const missing = new Map<string, EnvProblemKind>();
  for (const name of REQUIRED_OUTSIDE_LOCAL) {
    if (env[name] === undefined) missing.set(name, 'missing');
  }
  if (missing.size > 0) throw new EnvError('bootstrap', sortProblems(missing));
  return env;
}
