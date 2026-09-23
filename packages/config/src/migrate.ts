import { z } from 'zod';

import { parseEnv, type EnvSource } from './parse';
import { postgresUrlSchema, wringyEnvSchema } from './shared';

/** `pnpm db:migrate`: the only process that runs DDL, as the migration owner. */
export const migrateEnvSchema = z.object({
  WRINGY_ENV: wringyEnvSchema,
  DATABASE_URL_MIGRATOR: postgresUrlSchema,
});

export type MigrateEnv = z.output<typeof migrateEnvSchema>;

export function loadMigrateEnv(source: EnvSource = process.env): MigrateEnv {
  return parseEnv('migrate', migrateEnvSchema, source);
}
