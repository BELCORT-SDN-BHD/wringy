import { z } from 'zod';

import { parseEnv, type EnvSource } from './parse';
import { postgresUrlSchema, wringyEnvSchema } from './shared';

/** pino's levels. */
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/**
 * The Fastify API. `DATABASE_URL` is the API runtime login (`wringy_api_login`).
 * Only non-secret settings have defaults.
 */
export const apiEnvSchema = z.object({
  WRINGY_ENV: wringyEnvSchema,
  DATABASE_URL: postgresUrlSchema,
  PORT: z.coerce.number().int().min(1).max(65_535).default(3200),
  HOST: z.string().min(1).default('127.0.0.1'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type ApiEnv = z.output<typeof apiEnvSchema>;

export function loadApiEnv(source: EnvSource = process.env): ApiEnv {
  return parseEnv('api', apiEnvSchema, source);
}
