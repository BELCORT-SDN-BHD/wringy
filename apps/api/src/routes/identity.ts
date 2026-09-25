import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { apiErrorSchema, signInResponseSchema, type Profile } from '@wringy/contracts';
import { InvalidEmailError, normalizeEmail, type Pool } from '@wringy/db';

import { actorOf, VARY_AUTHORIZATION } from '../authenticate';
import { withTransaction } from '../database';
import { errorBody, type ErrorCode } from '../errors';
import { isAllowlisted, lockProfileById, writeProfileOnSignIn } from '../profiles';
import { NOT_LIVE_REFUSAL, type SessionLiveness } from '../session-liveness';

export interface IdentityRoutesOptions {
  pool: Pool;
  liveness: SessionLiveness;
}

/** A refusal that must leave no row written: throwing it rolls the transaction back. */
class SignInRefused extends Error {
  override readonly name = 'SignInRefused';
  constructor(
    readonly status: 401 | 403 | 503,
    readonly code: ErrorCode,
    readonly reason: string,
  ) {
    super(`sign-in refused: ${reason}`);
  }
}

/**
 * `POST /identity/sign-in` — the first-sign-in gate and the profile upsert
 * (M2-02 R5, R6; kickoff-package.md §3.2, ruling D13).
 *
 * This is the only route a verified subject with no profile may reach
 * (`allowMissingProfile`), because it is the route that creates the row. Everything
 * happens in **one transaction**, in this order:
 *
 * 1. the session-liveness check, so a token whose session has already been signed
 *    out writes nothing at all;
 * 2. `SELECT … FOR UPDATE` on the profile, so two callbacks arriving together
 *    cannot both conclude "no profile yet";
 * 3. no profile → the allow-list, read by the address's normal form. Not listed is
 *    a rollback and 403 `sign_in.not_allowed`: no profile row, nothing to clean up;
 * 4. the upsert, which writes the verified address, the display name and
 *    `last_sign_in_at` (ruling D7). For an existing profile the list is **not**
 *    re-read: removing an address signs nobody out; disabling the profile does, and
 *    the hook has already refused a disabled one.
 *
 * The address is the top-level `email` claim only — the one GoTrue sets from the
 * identity store. A `user_metadata.email` an OAuth provider could set never
 * reaches the gate, and a token without the claim is refused 401, because there is
 * no verified address to judge.
 */
export const identityRoutes: FastifyPluginAsyncZod<IdentityRoutesOptions> = async (app, { pool, liveness }) => {
  app.addHook('onRequest', app.authenticate);
  // R18: only routes behind the hook vary by Authorization; /health must not.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('vary', VARY_AUTHORIZATION);
    return payload;
  });

  app.post(
    '/identity/sign-in',
    {
      config: { allowMissingProfile: true },
      schema: {
        response: {
          200: signInResponseSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = actorOf(request);
      if (actor.email === null) {
        request.log.info({ reason: 'no_email_claim' }, 'sign-in refused');
        return reply.code(401).send(errorBody('unauthenticated'));
      }
      // The gate and the row agree on what an address is, because both normalise
      // it with the one function packages/db exports (R5). A claim that is not an
      // address at all is no more usable than a missing one.
      let emailNorm: string;
      try {
        emailNorm = normalizeEmail(actor.email);
      } catch (error) {
        if (!(error instanceof InvalidEmailError)) throw error;
        request.log.info({ reason: 'email_claim_not_an_address' }, 'sign-in refused');
        return reply.code(401).send(errorBody('unauthenticated'));
      }

      let profile: Profile;
      try {
        profile = await withTransaction(pool, async (client) => {
          // First, so a token whose session has already been signed out writes
          // nothing at all. The command maps the verdict itself, rather than
          // sending a reply, because a refusal here has to roll the transaction
          // back; the codes still come from the one table that owns them.
          const state = await liveness.check(actor, client);
          if (state !== 'live') {
            const { status, code } = NOT_LIVE_REFUSAL[state];
            throw new SignInRefused(status, code, `session ${state}`);
          }

          // The lock serialises two sign-ins of the same subject; a subject with no
          // row yet is the only one the allow-list is asked about.
          const existing = await lockProfileById(client, actor.userId);
          if (existing === null && !(await isAllowlisted(client, emailNorm))) {
            throw new SignInRefused(403, 'sign_in.not_allowed', 'address not on the sign-in allow-list');
          }
          return writeProfileOnSignIn(client, {
            id: actor.userId,
            contactEmail: emailNorm,
            displayName: actor.displayName,
          });
        });
      } catch (error) {
        if (!(error instanceof SignInRefused)) throw error;
        // The reason word only: never the address, the token or the session id.
        request.log.info({ reason: error.reason }, 'sign-in refused');
        return reply.code(error.status).send(errorBody(error.code));
      }

      return reply.code(200).send({ profile });
    },
  );
};
