import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import {
  apiErrorSchema,
  meResponseSchema,
  sessionProbeResponseSchema,
  setLocaleBodySchema,
  setLocaleResponseSchema,
  workspacesResponseSchema,
  type Profile,
} from '@wringy/contracts';
import type { Pool } from '@wringy/db';

import { actorOf, profileOf, VARY_AUTHORIZATION } from '../authenticate';
import { withDatabase, withTransaction } from '../database';
import { errorBody, type ErrorCode } from '../errors';
import { listWorkspaces } from '../orgs';
import { lockProfileStatusForShare, lockProfileStatusForWrite, setProfileLocale } from '../profiles';
import { NOT_LIVE_REFUSAL, requireLiveSession, type SessionLiveness } from '../session-liveness';

export interface MeRoutesOptions {
  pool: Pool;
  liveness: SessionLiveness;
}

/**
 * A refusal decided inside a self-service command's transaction (liveness, then
 * the caller's own locked row). Throwing it rolls the transaction back, so a
 * refused command leaves no row written; the handler answers it outside.
 */
class SelfCommandRefused extends Error {
  override readonly name = 'SelfCommandRefused';
  constructor(
    readonly status: 401 | 403 | 503,
    readonly code: ErrorCode,
    readonly reason: string,
  ) {
    super(`command refused: ${reason}`);
  }
}

/**
 * The signed-in person's own routes.
 *
 * - `GET /me` is a read: the profile the authentication hook already loaded, plus
 *   the access token's own expiry so the page can say how long this tab stays
 *   signed in without ever holding the token. Reads rely on the token alone, so
 *   they stay valid for at most its lifetime (§4.6) — that is the accepted
 *   trade-off, and it is why commands ask more.
 * - `POST /me/session/probe` is the **reserved fund-sensitive stub** (M2-AC02/2).
 *   It changes nothing. It exists to prove that `requireLiveSession` really runs
 *   inside a command's transaction: it opens one, asks the liveness question on
 *   that same connection, re-reads the account's own `status` there with
 *   `FOR SHARE`, and answers the database clock at the moment of the check. A
 *   session that has been signed out gets 401 `session.revoked` instead, an
 *   account disabled since the hook's read gets 403 `account.disabled`, and M3's
 *   real fund-sensitive commands reuse exactly this shape.
 * - `GET /me/workspaces` (M2-03 R10) is the one read behind the workspace
 *   switcher: the personal context, one row per **active** membership (org name,
 *   role, label) ordered by name, and the capability grants the caller holds —
 *   three SELECTs on one pooled client, re-read on every request, so a removal or
 *   a revoked grant shows on the next one. A grant is not a membership. `GET /me`
 *   is unchanged.
 * - `POST /me/locale { locale }` (M2-04 R2) saves the caller's explicit language
 *   choice to their own profile and answers the profile as it now stands. It is a
 *   command, so it opens a transaction, asks liveness on it first and rolls back
 *   on every refusal (a revoked session is 401 `session.revoked`); then it
 *   **locks the caller's row before deciding anything** (`FOR NO KEY UPDATE`,
 *   `lockProfileStatusForWrite`) and lets the locked row decide, as the sign-in
 *   does — a gone row is 403 `profile.missing`, a disabled one 403
 *   `account.disabled`, and only then the UPDATE, which cannot miss while the lock
 *   is held. Not the probe's `FOR SHARE`: share-then-write deadlocks two calls of
 *   one person (40P01), and an unlocked read-then-write has a third answer under
 *   READ COMMITTED. `locale_pref_set_at` is the command's transaction start
 *   (`now()`), the record of when the choice was made; it does not follow commit
 *   order. **Not audited**: no authority is exercised and nobody else is
 *   affected, which is also why the sign-in's own profile refresh writes no row
 *   (M2-04 §5, §6.4). The body is a plain `z.object`, so a `userId` in it is
 *   stripped and the token alone names the row; a locale outside the three is
 *   Fastify's 400 `bad_request` before the handler.
 */
export const meRoutes: FastifyPluginAsyncZod<MeRoutesOptions> = async (app, { pool, liveness }) => {
  const liveSession = requireLiveSession(liveness);

  app.addHook('onRequest', app.authenticate);
  // R18: only routes behind the hook vary by Authorization; /health must not.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('vary', VARY_AUTHORIZATION);
    return payload;
  });

  app.get(
    '/me',
    {
      schema: {
        response: { 200: meResponseSchema, 401: apiErrorSchema, 403: apiErrorSchema, 503: apiErrorSchema },
      },
    },
    async (request) => ({
      profile: profileOf(request),
      session: { expiresAt: actorOf(request).expiresAt.toISOString() },
    }),
  );

  app.get(
    '/me/workspaces',
    {
      schema: {
        response: {
          200: workspacesResponseSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request) => withDatabase(pool, (client) => listWorkspaces(client, actorOf(request).userId)),
  );

  app.post(
    '/me/session/probe',
    {
      schema: {
        response: {
          200: sessionProbeResponseSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const outcome = await withTransaction(pool, async (client) => {
        // The guard asks on this client, inside this transaction, before anything
        // else runs: a session revoked before this point is refused here. It locks
        // nothing, so one revoked after it is refused on the next command, not this
        // one (session-liveness.ts).
        // `true` means the 401 or 503 is already sent: stop here, so nothing
        // after the verdict runs (no lock, no clock read, no second send).
        if (await liveSession(request, reply, client)) return { refused: reply };
        // And the account itself is re-read on the same client, with FOR SHARE:
        // the hook read the profile on another connection before this transaction
        // opened, so an operator disabling the account in between would otherwise
        // be invisible to the command the read allowed (R6, ruling D12). A row
        // that has gone is `profile.missing`, the same answer the hook gives.
        const status = await lockProfileStatusForShare(client, actorOf(request).userId);
        if (status === 'disabled') {
          request.log.info({ reason: 'account_disabled' }, 'request refused');
          return { refused: reply.code(403).send(errorBody('account.disabled')) };
        }
        if (status === null) {
          request.log.info({ reason: 'profile_missing' }, 'request refused');
          return { refused: reply.code(403).send(errorBody('profile.missing')) };
        }
        // The instant is the database's, read in the same transaction as the check.
        const { rows } = await client.query<{ checked_at: Date }>('SELECT now() AS checked_at');
        if (rows[0] === undefined) throw new Error('the clock row is missing');
        return { checkedAt: rows[0].checked_at };
      });

      if ('refused' in outcome) return outcome.refused;
      return reply.code(200).send({ ok: true as const, checkedAt: outcome.checkedAt.toISOString() });
    },
  );

  app.post(
    '/me/locale',
    {
      schema: {
        body: setLocaleBodySchema,
        response: {
          200: setLocaleResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = actorOf(request);
      let profile: Profile;
      try {
        profile = await withTransaction(pool, async (client) => {
          // Liveness on this client first, as every command asks it. The command
          // maps the verdict itself and throws, as runCommand and the sign-in do,
          // rather than using the probe's guard: a refusal here has to stop the
          // work and roll the transaction back, but the guard sends its own reply
          // and a `FastifyReply` is a thenable, so awaiting it would resolve to
          // undefined on a refusal the same as on a pass — this command could not
          // tell the two apart, let alone stop on the refusal and roll back.
          const state = await liveness.check(actor, client);
          if (state !== 'live') {
            const { status, code } = NOT_LIVE_REFUSAL[state];
            throw new SelfCommandRefused(status, code, `session_${state}`);
          }
          // The caller's own row, locked before anything is decided (R2 rev 2):
          // the locked row's status is the one the write is judged on, and a
          // second call by the same person waits here instead of deadlocking.
          const status = await lockProfileStatusForWrite(client, actor.userId);
          if (status === null) throw new SelfCommandRefused(403, 'profile.missing', 'profile_missing');
          if (status === 'disabled') throw new SelfCommandRefused(403, 'account.disabled', 'account_disabled');
          return setProfileLocale(client, actor.userId, request.body.locale);
        });
      } catch (error) {
        if (!(error instanceof SelfCommandRefused)) throw error;
        // The reason word only, like the probe: never the token, the session id
        // or an address. Not audited (M2-04 §5).
        request.log.info({ reason: error.reason }, 'request refused');
        return reply.code(error.status).send(errorBody(error.code));
      }
      return reply.code(200).send({ profile });
    },
  );
};
