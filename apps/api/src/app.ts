/**
 * buildApp(): the Fastify business API for the M2-01 narrow loop
 * (kickoff-package.md §8.3). It owns no process concerns (env, signals,
 * listening); src/server.ts and src/main.ts add those. Tests build it with a
 * pool on a harness database and drive it with app.inject().
 */
import Fastify, { type FastifyError } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import type { ApiEnv } from '@wringy/config';
import { EXPECTED_MIGRATION_HEAD, EXPECTED_PGBOSS_VERSION, type Pool } from '@wringy/db';

import { authenticateNoop, type AuthenticateHook } from './authenticate';
import { DatabaseUnavailableError } from './database';
import { errorBody } from './errors';
import { loggerOptions, type LogDestination } from './logger';
import type { ExpectedHeads } from './read-models';
import { healthRoutes } from './routes/health';
import { internalRoutes } from './routes/internal';

/** Every response: private, never stored by a browser or a shared cache. */
export const CACHE_CONTROL = 'private, no-store';

export interface BuildAppOptions {
  /** The runtime-role pool (wringy_api_login). The caller owns it and ends it after app.close(). */
  pool: Pool;
  logLevel?: ApiEnv['LOG_LEVEL'];
  /** Where log lines go; stdout when omitted. Tests pass a collector. */
  logStream?: LogDestination;
  /** What GET /health compares the database with; this build's heads when omitted. */
  expected?: ExpectedHeads;
  /** The /internal/* authentication hook; a no-op until M2-02. */
  authenticate?: AuthenticateHook;
}

export function buildApp({
  pool,
  logLevel = 'info',
  logStream,
  expected = { migrationHead: EXPECTED_MIGRATION_HEAD, pgbossVersion: EXPECTED_PGBOSS_VERSION },
  authenticate = authenticateNoop,
}: BuildAppOptions) {
  const app = Fastify({ logger: loggerOptions(logLevel, logStream) }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('authenticate', authenticate);

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', CACHE_CONTROL);
    return payload;
  });

  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send(errorBody('not_found')));

  app.setErrorHandler<FastifyError | Error>(async (error, request, reply) => {
    if (error instanceof DatabaseUnavailableError) {
      request.log.warn({ err: error }, 'database unavailable');
      return reply.code(503).send(errorBody('database_unavailable'));
    }
    const status = 'statusCode' in error ? error.statusCode : undefined;
    if (status !== undefined && status >= 400 && status < 500) {
      request.log.info({ err: error }, 'request rejected');
      return reply.code(status).send(errorBody(status === 404 ? 'not_found' : 'bad_request'));
    }
    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send(errorBody('internal_error'));
  });

  app.register(healthRoutes, { pool, expected });
  app.register(internalRoutes, { pool, prefix: '/internal' });

  return app;
}

export type ApiApp = ReturnType<typeof buildApp>;
