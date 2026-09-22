import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { apiErrorSchema, healthLiveResponseSchema, healthResponseSchema } from '@wringy/contracts';
import type { Pool } from '@wringy/db';

import { checkHealth, type ExpectedHeads } from '../read-models';

export interface HealthRoutesOptions {
  pool: Pool;
  expected: ExpectedHeads;
}

/**
 * - GET /health/live: the process answers; no database.
 * - GET /health: the database as the runtime role, the migration head and the
 *   pg-boss schema version against this build's expected heads; 200 or 503.
 */
export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (app, { pool, expected }) => {
  app.get(
    '/health/live',
    { schema: { response: { 200: healthLiveResponseSchema } } },
    async () => ({ status: 'ok' as const }),
  );

  app.get(
    '/health',
    { schema: { response: { 200: healthResponseSchema, 503: healthResponseSchema, 500: apiErrorSchema } } },
    async (request, reply) => {
      const report = await checkHealth(pool, expected, (check, code) => {
        request.log.warn({ check, code: code ?? 'unknown' }, 'health check failing');
      });
      return reply.code(report.status === 'ok' ? 200 : 503).send(report);
    },
  );
};
