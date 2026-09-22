import { z } from 'zod';

import { parseEnv, type EnvSource } from './parse';
import { postgresUrlSchema, wringyEnvSchema } from './shared';

/**
 * The pg-boss worker. `DATABASE_URL` is the worker runtime login
 * (`wringy_worker_login`), never the API's. `WORKER_ID` and `IMAGE_REF` are
 * shown on the internal health card.
 */
export const workerEnvSchema = z.object({
  WRINGY_ENV: wringyEnvSchema,
  DATABASE_URL: postgresUrlSchema,
  WORKER_ID: z
    .string()
    .max(128)
    .regex(/^[\w.:@-]+$/),
  IMAGE_REF: z
    .string()
    .max(512)
    .regex(/^[\w./:@+-]+$/),
});

export type WorkerEnv = z.output<typeof workerEnvSchema>;

export function loadWorkerEnv(source: EnvSource = process.env): WorkerEnv {
  return parseEnv('worker', workerEnvSchema, source);
}
