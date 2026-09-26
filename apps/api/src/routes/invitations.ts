import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import {
  acceptInvitationResponseSchema,
  apiErrorSchema,
  createInvitationBodySchema,
  createInvitationResponseSchema,
  invitationPreviewResponseSchema,
  invitationTokenBodySchema,
  orgInvitationParamsSchema,
  orgParamsSchema,
  revokeInvitationResponseSchema,
  type AcceptInvitationResponse,
  type InvitationPreviewResponse,
} from '@wringy/contracts';
import { InvalidEmailError, normalizeEmail, type Pool } from '@wringy/db';

import { actorOf, VARY_AUTHORIZATION, type Actor } from '../authenticate';
import {
  isActiveAdmin,
  lockOrgRow,
  readMembershipUnderLock,
  Refused,
  runCommand,
  runOrgCommand,
  runRead,
  type AuditDetail,
  type CommandDeps,
} from '../authorize';
import { errorBody } from '../errors';
import {
  createInvitation,
  hashToken,
  lockInvitationById,
  lockInvitationByTokenHash,
  lockPendingForAddress,
  markAccepted,
  markRevoked,
  mintToken,
  readByTokenHashUnlocked,
  readForPreview,
} from '../invitations';
import { upsertInvitedMembership } from '../memberships';
import { readOrg } from '../orgs';
import type { SessionLiveness } from '../session-liveness';

export interface InvitationRoutesOptions {
  pool: Pool;
  liveness: SessionLiveness;
}

/**
 * The verified address of the caller in the allow-list's normal form, or null
 * when the token carries no `email` claim or one that is not an address (R8).
 * The top-level claim only — the one GoTrue sets from the identity store, never
 * `user_metadata` — and never `profiles.contact_email`.
 */
function verifiedEmailNorm(actor: Actor): string | null {
  if (actor.email === null) return null;
  try {
    return normalizeEmail(actor.email);
  } catch (error) {
    if (error instanceof InvalidEmailError) return null;
    throw error;
  }
}

/**
 * The invitation routes (kickoff-package.md §3.3; ruling D2; M2-03 code review
 * R7, R8, R12). Serves M2-AC03/1: joining an existing org needs an accepted
 * invitation, and the membership records it.
 *
 * The token is only ever in a POST body (`/invitations/preview`,
 * `/invitations/accept`) or in the one create response: never in an API path,
 * which the request log writes, never in a log field and never in an audit row.
 * The database keeps its sha256. The control that makes a leaked or mis-delivered
 * link grant nothing is the verified address: preview shows the invitation only
 * to the addressed person, and accept refuses anybody else.
 *
 * An invitation acts on the authority of the admin who sent it, so that
 * authority is re-checked when the link is used (M2-AC03/2 "每次读写重核实际成员、
 * 组织和能力"; R7 rev 3): once the inviter is no longer an active admin whose
 * profile is active — removed, left, demoted or disabled — a pending invitation of
 * theirs is 403 `invitation.invalid` (reason `inviter_not_admin`) at preview and
 * at accept, and admits nobody.
 */
export const invitationRoutes: FastifyPluginAsyncZod<InvitationRoutesOptions> = async (app, { pool, liveness }) => {
  const deps: CommandDeps = { pool, liveness };

  app.addHook('onRequest', app.authenticate);
  // R18: only routes behind the hook vary by Authorization; /health must not.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('vary', VARY_AUTHORIZATION);
    return payload;
  });

  /**
   * `POST /orgs/:orgId/invitations` (admin). The address is put in the
   * allow-list's normal form (an address it refuses is 400, before any
   * authorisation); a pending, unexpired invitation for it is 409
   * `invitation.pending`; a pending expired one is revoked (by the inviter) in
   * the same transaction. The answer carries the token once.
   */
  app.post(
    '/orgs/:orgId/invitations',
    {
      schema: {
        params: orgParamsSchema,
        body: createInvitationBodySchema,
        response: {
          201: createInvitationResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          409: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const { role } = request.body;
      let emailNorm: string;
      try {
        emailNorm = normalizeEmail(request.body.email);
      } catch (error) {
        if (!(error instanceof InvalidEmailError)) throw error;
        // Like a schema failure: no intent can be read from it, so it is not audited (R4).
        request.log.info({ reason: 'invalid_email' }, 'request rejected');
        return reply.code(400).send(errorBody('bad_request'));
      }

      const outcome = await runOrgCommand(
        deps,
        request,
        reply,
        orgId,
        { action: 'invitation.create', role: 'admin' },
        async (client, context) => {
          const existing = await lockPendingForAddress(client, orgId, emailNorm);
          if (existing !== null && !existing.expired) {
            throw new Refused(409, 'invitation.pending', 'pending_exists', {
              targetType: 'org_invitation',
              targetId: existing.id,
            });
          }
          if (existing !== null) {
            // The expired one is superseded: nothing stays pending for this address but the new link.
            await markRevoked(client, existing.id, context.actor.userId);
            await context.audit({
              action: 'invitation.revoke',
              targetType: 'org_invitation',
              targetId: existing.id,
              summary: { before: { status: 'pending' }, after: { status: 'revoked' } },
            });
          }
          const token = mintToken();
          const invitation = await createInvitation(client, {
            orgId,
            invitedBy: context.actor.userId,
            emailNorm,
            role,
            tokenHash: hashToken(token),
          });
          await context.audit({
            targetType: 'org_invitation',
            targetId: invitation.id,
            summary: { after: { role: invitation.role, status: 'pending' } },
          });
          return { invitation, token };
        },
      );
      if ('refused' in outcome) return outcome.refused;
      return reply.code(201).send(outcome.value);
    },
  );

  /**
   * `POST /orgs/:orgId/invitations/:invitationId/revoke` (admin). An invitation
   * of another org, or none, is 404 `invitation.not_found`; one that is no longer
   * pending is 409 `invitation.not_pending`.
   */
  app.post(
    '/orgs/:orgId/invitations/:invitationId/revoke',
    {
      schema: {
        params: orgInvitationParamsSchema,
        response: {
          200: revokeInvitationResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          404: apiErrorSchema,
          409: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { orgId, invitationId } = request.params;
      const outcome = await runOrgCommand(
        deps,
        request,
        reply,
        orgId,
        { action: 'invitation.revoke', role: 'admin', targetType: 'org_invitation', targetId: invitationId },
        async (client, context) => {
          const invitation = await lockInvitationById(client, orgId, invitationId);
          if (invitation === null) throw new Refused(404, 'invitation.not_found', 'not_in_org');
          if (invitation.status !== 'pending') {
            throw new Refused(409, 'invitation.not_pending', 'not_pending', {
              summary: { before: { status: invitation.status } },
            });
          }
          await markRevoked(client, invitation.id, context.actor.userId);
          await context.audit({ summary: { before: { status: 'pending' }, after: { status: 'revoked' } } });
          return { invitation: { id: invitation.id, status: 'revoked' as const } };
        },
      );
      if ('refused' in outcome) return outcome.refused;
      return reply.code(200).send(outcome.value);
    },
  );

  /**
   * `POST /invitations/preview` (any signed-in person; a read). The address is
   * checked **first**: to anybody but the addressed person the answer is
   * `{ state: 'email_mismatch' }` and nothing else. An unknown or revoked token,
   * and a pending one whose inviter is no longer an active admin, is 403
   * `invitation.invalid`, the answer accept gives, and audited.
   */
  app.post(
    '/invitations/preview',
    {
      schema: {
        body: invitationTokenBodySchema,
        response: {
          200: invitationPreviewResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const emailNorm = verifiedEmailNorm(actorOf(request));
      if (emailNorm === null) {
        request.log.info({ reason: 'no_usable_email_claim' }, 'request refused');
        return reply.code(401).send(errorBody('unauthenticated'));
      }
      const tokenHash = hashToken(request.body.token);

      const outcome = await runRead(
        pool,
        request,
        reply,
        { action: 'invitation.preview' },
        async (client): Promise<InvitationPreviewResponse> => {
          const invitation = await readForPreview(client, tokenHash);
          if (invitation === null) throw new Refused(403, 'invitation.invalid', 'unknown_token');
          if (invitation.inviteeEmailNorm !== emailNorm) return { state: 'email_mismatch' };
          const about: AuditDetail = { contextOrgId: invitation.orgId, targetType: 'org_invitation', targetId: invitation.id };
          if (invitation.status === 'revoked') throw new Refused(403, 'invitation.invalid', 'revoked', about);
          // A link that could still be accepted is judged as accept will judge it: on its inviter's standing now.
          if (
            invitation.status === 'pending' &&
            !invitation.expired &&
            !(await isActiveAdmin(client, invitation.orgId, invitation.invitedBy))
          ) {
            throw new Refused(403, 'invitation.invalid', 'inviter_not_admin', about);
          }
          return {
            state: invitation.status === 'accepted' ? 'accepted' : invitation.expired ? 'expired' : 'pending',
            org: { id: invitation.orgId, name: invitation.orgName },
            role: invitation.role,
            expiresAt: invitation.expiresAt.toISOString(),
          };
        },
      );
      if ('refused' in outcome) return outcome.refused;
      return reply.code(200).send(outcome.value);
    },
  );

  /**
   * `POST /invitations/accept` (a command). R5 steps 1–2, an unlocked read of the
   * invitation for its org, the org lock, then the invitation `FOR UPDATE` and
   * its state, in the order R7 fixes: unknown or revoked → `invitation.invalid`;
   * accepted → `invitation.used`; expired → `invitation.expired`; another address
   * → `invitation.email_mismatch`; an inviter who is no longer an active admin →
   * `invitation.invalid` (rev 3); the caller already an active member → the
   * invitation is closed (revoked by the caller, so nothing stays pending that
   * could re-admit them after a later removal) and 409
   * `invitation.already_member`; otherwise the membership is written (or a
   * removed one made active again), the invitation marked accepted, and the
   * change audited, all in one transaction.
   */
  app.post(
    '/invitations/accept',
    {
      schema: {
        body: invitationTokenBodySchema,
        response: {
          200: acceptInvitationResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          409: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const emailNorm = verifiedEmailNorm(actorOf(request));
      if (emailNorm === null) {
        request.log.info({ reason: 'no_usable_email_claim' }, 'request refused');
        return reply.code(401).send(errorBody('unauthenticated'));
      }
      const tokenHash = hashToken(request.body.token);

      type Accepted = { kind: 'accepted'; body: AcceptInvitationResponse } | { kind: 'already_member' };
      const outcome = await runCommand(
        deps,
        request,
        reply,
        { action: 'invitation.accept' },
        async (client, context): Promise<Accepted> => {
          const userId = context.actor.userId;
          const found = await readByTokenHashUnlocked(client, tokenHash);
          if (found === null) throw new Refused(403, 'invitation.invalid', 'unknown_token');
          const about: AuditDetail = { contextOrgId: found.orgId, targetType: 'org_invitation', targetId: found.id };

          // R5 step 4 for the invitation's org, then the invitation itself.
          if (!(await lockOrgRow(client, found.orgId))) throw new Refused(403, 'invitation.invalid', 'unknown_token', about);
          const invitation = await lockInvitationByTokenHash(client, found.orgId, tokenHash);
          if (invitation === null || invitation.status === 'revoked') {
            throw new Refused(403, 'invitation.invalid', 'revoked', about);
          }
          if (invitation.status === 'accepted') throw new Refused(403, 'invitation.used', 'used', about);
          if (invitation.expired) throw new Refused(403, 'invitation.expired', 'expired', about);
          if (invitation.inviteeEmailNorm !== emailNorm) {
            throw new Refused(403, 'invitation.email_mismatch', 'email_mismatch', about);
          }
          // The invitation acts on its inviter's authority, re-checked now, under the org lock (R7 rev 3).
          if (!(await isActiveAdmin(client, invitation.orgId, invitation.invitedBy))) {
            throw new Refused(403, 'invitation.invalid', 'inviter_not_admin', about);
          }

          const closeAsMember = async (): Promise<Accepted> => {
            await markRevoked(client, invitation.id, userId);
            await context.auditDenied('invitation.already_member', 'already_member', {
              ...about,
              summary: { before: { status: 'pending' }, after: { status: 'revoked' } },
            });
            return { kind: 'already_member' };
          };
          if ((await readMembershipUnderLock(client, invitation.orgId, userId)) !== null) return closeAsMember();

          const membership = await upsertInvitedMembership(client, {
            orgId: invitation.orgId,
            userId,
            role: invitation.role,
            invitationId: invitation.id,
            grantedBy: invitation.invitedBy,
          });
          // The upsert's WHERE never rewrites an active row; no row back is the same answer.
          if (membership === null) return closeAsMember();
          await markAccepted(client, invitation.id, userId);
          const org = await readOrg(client, invitation.orgId);
          if (org === null) throw new Error('the locked org is missing');
          await context.audit({
            ...about,
            summary: { before: { status: 'pending' }, after: { status: 'accepted', role: membership.role } },
          });
          return { kind: 'accepted', body: { org, membership } };
        },
      );
      if ('refused' in outcome) return outcome.refused;
      if (outcome.value.kind === 'already_member') {
        request.log.info({ reason: 'already_member', code: 'invitation.already_member' }, 'request refused');
        return reply.code(409).send(errorBody('invitation.already_member'));
      }
      return reply.code(200).send(outcome.value.body);
    },
  );
};
