import { z } from 'zod';

import { instantSchema } from './common';

/** `GET /health/live`: the process answers. It never touches the database. */
export const healthLiveResponseSchema = z.object({
  status: z.literal('ok'),
});
export type HealthLiveResponse = z.output<typeof healthLiveResponseSchema>;

export const HEALTH_CHECK_STATES = ['ok', 'failing'] as const;
export const healthCheckStateSchema = z.enum(HEALTH_CHECK_STATES);

/**
 * `GET /health`: 200 with `status: 'ok'` when every check passes, otherwise 503
 * with `status: 'unavailable'` and the same body shape (kickoff-package.md §8.3).
 *
 * - `database`: a query as the API runtime role succeeded.
 * - `migrations`: the applied migration head equals the one this build expects.
 * - `queueSchema`: the pg-boss schema version equals the one this build expects.
 */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  checks: z.object({
    database: healthCheckStateSchema,
    migrations: healthCheckStateSchema,
    queueSchema: healthCheckStateSchema,
  }),
  /** The newest applied migration id, or null when it could not be read. */
  migrationHead: z.string().min(1).nullable(),
  /** The pg-boss schema version, or null when it could not be read. */
  queueSchemaVersion: z.number().int().nonnegative().nullable(),
  /** The database clock, or null when the database did not answer. */
  dbNow: instantSchema.nullable(),
});
export type HealthResponse = z.output<typeof healthResponseSchema>;
