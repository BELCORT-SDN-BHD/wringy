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
 *    cannot both conclude "no profile yet" — and, because the locked row is the
 *    one this transaction will write, the row's own `status` decides: a profile
 *    disabled between the hook's read and this lock is refused 403
 *    `account.disabled` here, before the upsert (R6, ruling D12);
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
      // Held in a local, so the narrowing below survives into the transaction
      // callback: this is the verified address exactly as the provider spells it.
      const verifiedEmail = actor.email;
      if (verifiedEmail === null) {
        request.log.info({ reason: 'no_email_claim' }, 'sign-in refused');
        return reply.code(401).send(errorBody('unauthenticated'));
      }
      // The gate asks about the normal form, because the list is written in it
      // (R5): one function in packages/db, used by the CLI and here. A claim that
      // is not an address at all is no more usable than a missing one.
      let emailNorm: string;
      try {
        emailNorm = normalizeEmail(verifiedEmail);
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
          // The hook already refused a disabled profile — but it read the row on
          // another connection, before this transaction opened. An operator
          // disabling the account in between would otherwise be overwritten by the
          // upsert below and stamped as a fresh sign-in. The locked row decides
          // (R6, D12), and the refusal rolls the transaction back.
          if (existing !== null && existing.status === 'disabled') {
            throw new SignInRefused(403, 'account.disabled', 'profile disabled between the hook read and the commit');
          }
          if (existing === null && !(await isAllowlisted(client, emailNorm))) {
            throw new SignInRefused(403, 'sign_in.not_allowed', 'address not on the sign-in allow-list');
          }
          // The verified address as the provider spells it, not the comparison
          // key: `contact_email` is copied from the verified token and is the
          // notification address (§3.2, D7, §4.4), while normalisation is NFKC,
          // which rewrites — a ligature becomes its letters, U+2024 ONE DOT LEADER
          // becomes `.`, so the normal form can name a different mailbox.
          // `emailNorm` answers the allow-list question and nothing else (R5).
          return writeProfileOnSignIn(client, {
            id: actor.userId,
            contactEmail: verifiedEmail.trim(),
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
