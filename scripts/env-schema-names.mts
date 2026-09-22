/**
 * Prints the variable names each @wringy/config process schema reads, as JSON:
 * {"web":[…],"api":[…],"worker":[…],"migrate":[…],"bootstrap":[…]}.
 * Used by scripts/check-secret-canary.mjs (run with tsx, which loads the
 * TypeScript source) so the canary list can never fall behind the schemas.
 */
import {
  apiEnvSchema,
  bootstrapEnvSchema,
  migrateEnvSchema,
  webEnvSchema,
  workerEnvSchema,
} from '../packages/config/src/index.ts';

const schemas = {
  web: webEnvSchema,
  api: apiEnvSchema,
  worker: workerEnvSchema,
  migrate: migrateEnvSchema,
  bootstrap: bootstrapEnvSchema,
};

console.log(JSON.stringify(Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, Object.keys(schema.shape)]))));
