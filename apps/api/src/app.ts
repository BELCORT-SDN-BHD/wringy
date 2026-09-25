/**
 * buildApp(): the Fastify business API for the M2 internal build
 * (kickoff-package.md §8.3). It owns no process concerns (env, signals,
 * listening); src/server.ts and src/main.ts add those. Tests build it with a
 * pool on a harness database and drive it with app.inject().
 *
 * Every response is `private, no-store`, including /health. `Vary: Authorization`
 * is added by the authenticated plugin scopes only (M2-02 R18): /health and
 * /health/live do not depend on the Authorization header, and saying they do
 * would be a false statement to a shared cache.
 */
import Fastify, { type FastifyError } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import type { ApiEnv } from '@wringy/config';
import { EXPECTED_MIGRATION_HEAD, EXPECTED_PGBOSS_VERSION, type Pool } from '@wringy/db';

import type { AuthenticateHook } from './authenticate';
import { DatabaseUnavailableError } from './database';
import { errorBody } from './errors';
import { loggerOptions, type LogDestination } from './logger';
import type { ExpectedHeads } from './read-models';
import { healthRoutes } from './routes/health';
import { identityRoutes } from './routes/identity';
import { internalRoutes } from './routes/internal';
import { meRoutes } from './routes/me';
import type { SessionLiveness } from './session-liveness';

/** Every response: private, never stored by a browser or a shared cache. */
export const CACHE_CONTROL = 'private, no-store';

/** One method/path pair of the built app's route table (`app.routeTable`). */
export interface RouteEntry {
  readonly method: string;
  readonly url: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Every route registered on this app, in registration order (M2-02 R8, R18). */
    routeTable: readonly RouteEntry[];
  }
}

export interface BuildAppOptions {
  /** The runtime-role pool (wringy_api_login). The caller owns it and ends it after app.close(). */
  pool: Pool;
  logLevel?: ApiEnv['LOG_LEVEL'];
  /** Where log lines go; stdout when omitted. Tests pass a collector. */
  logStream?: LogDestination;
  /** What GET /health compares the database with; this build's heads when omitted. */
  expected?: ExpectedHeads;
  /**
   * Verifies the bearer token and resolves the actor on every authenticated
   * route. **Required** (M2-02 R8): there is no default, so a forgotten wiring
   * fails to compile instead of serving the internal build to anybody.
   */
  authenticate: AuthenticateHook;
  /**
   * How a command answers "is this session still live?" (R2). Required for the
   * same reason: the wrong answer here is a silent one.
   */
  liveness: SessionLiveness;
}

export function buildApp({
  pool,
  logLevel = 'info',
  logStream,
  expected = { migrationHead: EXPECTED_MIGRATION_HEAD, pgbossVersion: EXPECTED_PGBOSS_VERSION },
  authenticate,
  liveness,
}: BuildAppOptions) {
  const app = Fastify({ logger: loggerOptions(logLevel, logStream) }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('authenticate', authenticate);

  // Every route this app registers, collected as it is registered. `onRoute` is
  // encapsulated, so a hook added here — before any plugin — also sees the routes
  // the plugins add. It exists so the README's invariant ("every route but /health
  // and /health/live runs app.authenticate") is a property a test can check over
  // the whole route table, instead of a hard-coded list a later ticket can forget
  // to extend (M2-02 R8, R18).
  const routeTable: RouteEntry[] = [];
  app.addHook('onRoute', ({ method, url }) => {
    for (const one of Array.isArray(method) ? method : [method]) routeTable.push({ method: one, url });
  });
  app.decorate('routeTable', routeTable as readonly RouteEntry[]);

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
  app.register(identityRoutes, { pool, liveness });
  app.register(meRoutes, { pool, liveness });

  return app;
}

export type ApiApp = ReturnType<typeof buildApp>;
