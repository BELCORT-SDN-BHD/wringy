import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { apiErrorSchema, internalCampaignsResponseSchema, workerHealthResponseSchema } from '@wringy/contracts';
import type { Pool } from '@wringy/db';

import { VARY_AUTHORIZATION } from '../authenticate';
import { withDatabase } from '../database';
import { readFixtureCampaigns, readWorkerHealth } from '../read-models';

export interface InternalRoutesOptions {
  pool: Pool;
}

/**
 * The internal build's read routes, registered under the /internal prefix. Every
 * route here runs `app.authenticate` first, so a read needs a verified token and
 * an active profile (M2-02 R8). The response schema is the allow-list:
 * @fastify/type-provider-zod serialises the schema's encoded output, and z.object
 * drops any key the contract does not name.
 *
 * These are reads, so they rely on the token alone and no liveness check runs
 * (kickoff-package.md §4.6): they stay valid for at most the access token's own
 * lifetime. Commands ask more.
 */
export const internalRoutes: FastifyPluginAsyncZod<InternalRoutesOptions> = async (app, { pool }) => {
  app.addHook('onRequest', app.authenticate);
  // R18: only routes behind the hook vary by Authorization; /health must not.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('vary', VARY_AUTHORIZATION);
    return payload;
  });

  app.get(
    '/campaigns',
    {
      schema: {
        response: {
          200: internalCampaignsResponseSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async () => withDatabase(pool, readFixtureCampaigns),
  );

  app.get(
    '/worker-health',
    {
      schema: {
        response: {
          200: workerHealthResponseSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async () => withDatabase(pool, readWorkerHealth),
  );
};
