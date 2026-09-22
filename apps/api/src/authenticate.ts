/**
 * The authentication hook point. M2-01 has no sign-in: every /internal/* route
 * already runs `app.authenticate` as an onRequest hook, and today that hook does
 * nothing. M2-02 replaces the default with Supabase access-token verification
 * (kickoff-package.md §4.4), and M2-03 adds the ops capability check behind it.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * An async onRequest hook. To refuse a request it sends the reply and returns
 * it (`return reply.code(401).send(...)`), which stops the route there.
 */
export type AuthenticateHook = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

declare module 'fastify' {
  interface FastifyInstance {
    /** Runs before every /internal/* handler. A no-op until M2-02. */
    authenticate: AuthenticateHook;
  }
}

/** TODO(M2-02): verify the bearer token (issuer, audience, expiry, signature) and attach the subject. */
export const authenticateNoop: AuthenticateHook = async () => {};
