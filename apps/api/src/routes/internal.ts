import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { apiErrorSchema, internalCampaignsResponseSchema, workerHealthResponseSchema } from '@wringy/contracts';
import type { Pool } from '@wringy/db';

import { withDatabase } from '../database';
import { readFixtureCampaigns, readWorkerHealth } from '../read-models';

export interface InternalRoutesOptions {
  pool: Pool;
}

/**
 * The internal build's read routes, registered under the /internal prefix. Every
 * route here runs `app.authenticate` first (a no-op until M2-02). The response
 * schema is the allow-list: @fastify/type-provider-zod serialises the schema's
 * encoded output, and z.object drops any key the contract does not name.
 */
export const internalRoutes: FastifyPluginAsyncZod<InternalRoutesOptions> = async (app, { pool }) => {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/campaigns',
    {
      schema: {
        response: { 200: internalCampaignsResponseSchema, 500: apiErrorSchema, 503: apiErrorSchema },
      },
    },
    async () => withDatabase(pool, readFixtureCampaigns),
  );

  app.get(
    '/worker-health',
    {
      schema: {
        response: { 200: workerHealthResponseSchema, 500: apiErrorSchema, 503: apiErrorSchema },
      },
    },
    async () => withDatabase(pool, readWorkerHealth),
  );
};
