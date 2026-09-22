import { z } from 'zod';

/** Where a process runs. The api and worker also compare it with `ops.environment` (W2). */
export const WRINGY_ENVS = ['local', 'ci', 'staging', 'production'] as const;
export const wringyEnvSchema = z.enum(WRINGY_ENVS);
export type WringyEnv = z.output<typeof wringyEnvSchema>;

/** A PostgreSQL connection string. No default anywhere: it carries a password. */
export const postgresUrlSchema = z.url({ protocol: /^postgres(ql)?$/ });

/** An http(s) base URL for server-to-server calls. */
export const httpUrlSchema = z.url({ protocol: /^https?$/ });
