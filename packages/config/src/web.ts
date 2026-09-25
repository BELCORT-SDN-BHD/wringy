import { z } from 'zod';

import { parseEnv, type EnvSource } from './parse';
import {
  appModeSchema,
  httpUrlSchema,
  originSchema,
  publishableKeySchema,
  tokenBearingOriginSchema,
  wringyEnvSchema,
} from './shared';

// The web subset is self-contained: the page that renders "not configured"
// needs the non-throwing loader too.
export { EnvError, tryLoadEnv } from './parse';
export type { EnvProblem, EnvResult } from './parse';

/**
 * The three variables the internal build needs and the demo build does not.
 * They are optional fields plus this rule, rather than required fields, so the
 * demo origin, the M1 Playwright suite and the env-less image smoke keep
 * working (M2-02 R14).
 */
export const INTERNAL_MODE_VARIABLES = ['APP_ORIGIN', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_URL'] as const;

/**
 * The web (Next.js) server. It reaches data only through the API, so it gets the
 * API's internal URL and nothing else: no database URL, no secret key and no
 * `NEXT_PUBLIC_*` variable (kickoff-package.md §8.5). `SUPABASE_PUBLISHABLE_KEY`
 * is publishable by design and is still read on the server only; a
 * `sb_secret_…` key never appears here, and the schema refuses one rather than
 * trusting the comment. `SUPABASE_URL` must be `https:` unless it is loopback,
 * for the same reason the api insists on it (`tokenBearingOriginSchema`).
 *
 * `WRINGY_APP_MODE` selects the implementation (kickoff-package.md §8.6, ruling
 * D32): `demo` is M1 unchanged and needs nothing more; `internal` requires
 * `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `APP_ORIGIN`, each reported by
 * name when it is absent.
 */
export const webEnvSchema = z
  .object({
    WRINGY_ENV: wringyEnvSchema,
    API_INTERNAL_URL: httpUrlSchema,
    WRINGY_APP_MODE: appModeSchema.default('demo'),
    SUPABASE_URL: tokenBearingOriginSchema.optional(),
    SUPABASE_PUBLISHABLE_KEY: publishableKeySchema.optional(),
    APP_ORIGIN: originSchema.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.WRINGY_APP_MODE !== 'internal') return;
    for (const name of INTERNAL_MODE_VARIABLES) {
      if (env[name] !== undefined) continue;
      // The path is the variable name, so parseEnv reports it as missing and the
      // error still names variables only.
      ctx.addIssue({
        code: 'custom',
        path: [name],
        message: `${name} is required when WRINGY_APP_MODE is internal`,
      });
    }
  });

export type WebEnv = z.output<typeof webEnvSchema>;

export function loadWebEnv(source: EnvSource = process.env): WebEnv {
  return parseEnv('web', webEnvSchema, source);
}
