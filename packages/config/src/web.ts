import { z } from 'zod';

import { parseEnv, type EnvSource } from './parse';
import { httpUrlSchema, wringyEnvSchema } from './shared';

// The web subset is self-contained: the page that renders "not configured"
// needs the non-throwing loader too.
export { EnvError, tryLoadEnv } from './parse';
export type { EnvProblem, EnvResult } from './parse';

/**
 * The web (Next.js) server. It reaches data only through the API, so it gets
 * the API's internal URL and nothing else: no database URL, no secret, and no
 * `NEXT_PUBLIC_*` variable (kickoff-package.md §8.5).
 */
export const webEnvSchema = z.object({
  WRINGY_ENV: wringyEnvSchema,
  API_INTERNAL_URL: httpUrlSchema,
});

export type WebEnv = z.output<typeof webEnvSchema>;

export function loadWebEnv(source: EnvSource = process.env): WebEnv {
  return parseEnv('web', webEnvSchema, source);
}
