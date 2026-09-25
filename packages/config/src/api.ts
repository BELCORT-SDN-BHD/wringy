import { z } from 'zod';

import { parseEnv, type EnvSource } from './parse';
import {
  originSchema,
  postgresUrlSchema,
  publishableKeySchema,
  sessionLivenessSchema,
  wringyEnvSchema,
} from './shared';

/** pino's levels. */
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/**
 * The Fastify API. `DATABASE_URL` is the API runtime login (`wringy_api_login`).
 * Only non-secret settings have defaults.
 *
 * The identity variables are required, because the API verifies every token
 * against one Supabase project (M2-02 §4.4) and answers "is this session live?"
 * through one named mechanism (R2): `SESSION_LIVENESS=database` calls
 * `platform.session_is_live`, `auth_server` calls `GET <SUPABASE_URL>/auth/v1/user`
 * with the caller's token and `SUPABASE_PUBLISHABLE_KEY`. There is no default,
 * so a deployment cannot silently pick the wrong one. `SUPABASE_PUBLISHABLE_KEY`
 * is publishable by design; no `sb_secret_…` key is read anywhere.
 */
export const apiEnvSchema = z.object({
  WRINGY_ENV: wringyEnvSchema,
  DATABASE_URL: postgresUrlSchema,
  SUPABASE_URL: originSchema,
  SUPABASE_PUBLISHABLE_KEY: publishableKeySchema,
  SESSION_LIVENESS: sessionLivenessSchema,
  PORT: z.coerce.number().int().min(1).max(65_535).default(3200),
  HOST: z.string().min(1).default('127.0.0.1'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type ApiEnv = z.output<typeof apiEnvSchema>;

export function loadApiEnv(source: EnvSource = process.env): ApiEnv {
  return parseEnv('api', apiEnvSchema, source);
}
