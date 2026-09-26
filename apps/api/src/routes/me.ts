import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import {
  apiErrorSchema,
  meResponseSchema,
  sessionProbeResponseSchema,
  workspacesResponseSchema,
} from '@wringy/contracts';
import type { Pool } from '@wringy/db';

import { actorOf, profileOf, VARY_AUTHORIZATION } from '../authenticate';
import { withDatabase, withTransaction } from '../database';
import { errorBody } from '../errors';
import { listWorkspaces } from '../orgs';
import { lockProfileStatusForShare } from '../profiles';
import { requireLiveSession, type SessionLiveness } from '../session-liveness';

export interface MeRoutesOptions {
  pool: Pool;
  liveness: SessionLiveness;
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
        // The guard asks on this client, inside this transaction: nothing can be
        // signed out between the answer and the work the answer allows.
        const refused = await liveSession(request, reply, client);
        if (refused !== undefined) return { refused };
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
};
