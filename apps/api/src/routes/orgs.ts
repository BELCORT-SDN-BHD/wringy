import type { FastifyPluginAsyncZod, ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  apiErrorSchema,
  changeRoleBodySchema,
  changeRoleResponseSchema,
  createOrgBodySchema,
  createOrgResponseSchema,
  leaveOrgResponseSchema,
  orgDetailResponseSchema,
  orgMemberParamsSchema,
  orgParamsSchema,
  removeMemberResponseSchema,
  renameOrgBodySchema,
  renameOrgResponseSchema,
  type OrgDetailResponse,
} from '@wringy/contracts';
import type { Pool } from '@wringy/db';

import { actorOf, VARY_AUTHORIZATION } from '../authenticate';
import {
  countActiveAdmins,
  readActiveMembership,
  Refused,
  runCommand,
  runOrgCommand,
  runOrgRead,
  type CommandDeps,
} from '../authorize';
import { listPending } from '../invitations';
import { changeRole, insertCreatorMembership, leave, lockMember, readMembers, removeMember } from '../memberships';
import { insertOrg, readOrg, renameOrg } from '../orgs';
import type { SessionLiveness } from '../session-liveness';

export interface OrgRoutesOptions {
  pool: Pool;
  liveness: SessionLiveness;
}

/**
 * The organisation routes (kickoff-package.md §3.3, §3.4; M2-03 code review R5,
 * R12, R18). Serves M2-AC03/1 (the creator becomes the org's admin; there is no
 * self-service capability grant), M2-AC03/2 (every read and command re-reads the
 * caller's membership, scoped by the path) and M2-AC03/3 (refusals are audited;
 * no member shape carries an address).
 *
 * Every route runs `app.authenticate` first. The org is always the path's
 * `:orgId` (a uuid, or 400 before any code runs); a body `orgId` is stripped by
 * the plain `z.object` bodies and never read. Commands follow R5's lock order
 * (authorize.ts): session and profile re-checked on the transaction client, an
 * outsider refused before any lock, the org row `FOR NO KEY UPDATE`, the
 * caller's role re-read under it, then the target rows, the last-admin count,
 * the write and its audit row in the same transaction.
 */
export const orgRoutes: FastifyPluginAsyncZod<OrgRoutesOptions> = async (app, { pool, liveness }) => {
  const deps: CommandDeps = { pool, liveness };

  app.addHook('onRequest', app.authenticate);
  // R18: only routes behind the hook vary by Authorization; /health must not.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('vary', VARY_AUTHORIZATION);
    return payload;
  });

  /** `POST /orgs`: any signed-in person creates an org and becomes its first admin (D1). */
  app.post(
    '/orgs',
    {
      schema: {
        body: createOrgBodySchema,
        response: {
          201: createOrgResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { name } = request.body;
      const outcome = await runCommand(deps, request, reply, { action: 'org.create', targetType: 'org' }, async (client, context) => {
        const org = await insertOrg(client, { name, createdBy: context.actor.userId });
        const membership = await insertCreatorMembership(client, org.id, context.actor.userId);
        await context.audit({ contextOrgId: org.id, targetId: org.id, summary: { after: { name: org.name, role: 'admin' } } });
        return { org, membership };
      });
      if ('refused' in outcome) return outcome.refused;
      return reply.code(201).send(outcome.value);
    },
  );

  /**
   * `GET /orgs/:orgId`: the org, the caller's own role and the active members
   * (display name, role, since — never an address). Admins also get the pending
   * invitations; a member's answer has no `invitations` key at all.
   */
  app.get(
    '/orgs/:orgId',
    {
      schema: {
        params: orgParamsSchema,
        response: {
          200: orgDetailResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const outcome = await runOrgRead(pool, request, reply, orgId, async (client, role) => {
        const org = await readOrg(client, orgId);
        if (org === null) throw new Error('the org of an active membership is missing');
        const detail: OrgDetailResponse = { org, self: { role }, members: await readMembers(client, orgId) };
        if (role === 'admin') detail.invitations = await listPending(client, orgId);
        return detail;
      });
      if ('refused' in outcome) return outcome.refused;
      return reply.code(200).send(outcome.value);
    },
  );

  /** `POST /orgs/:orgId/rename` (admin). */
  app.post(
    '/orgs/:orgId/rename',
    {
      schema: {
        params: orgParamsSchema,
        body: renameOrgBodySchema,
        response: {
          200: renameOrgResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const { name } = request.body;
      const outcome = await runOrgCommand(deps, request, reply, orgId, { action: 'org.rename', role: 'admin' }, async (client, context) => {
        const before = await readOrg(client, orgId);
        const org = await renameOrg(client, orgId, name);
        if (before === null || org === null) throw new Error('the locked org is missing');
        await context.audit({ summary: { before: { name: before.name }, after: { name: org.name } } });
        return { org };
      });
      if ('refused' in outcome) return outcome.refused;
      return reply.code(200).send(outcome.value);
    },
  );

  /**
   * `POST /orgs/:orgId/members/:userId/role` (admin). A member of another org, or
   * nobody, is 404 `member.not_found` (no existence oracle); demoting the last
   * active admin is 409 `org.last_admin`.
   */
  app.post(
    '/orgs/:orgId/members/:userId/role',
    {
      schema: {
        params: orgMemberParamsSchema,
        body: changeRoleBodySchema,
        response: {
          200: changeRoleResponseSchema,
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
      const { orgId, userId } = request.params;
      const { role } = request.body;
      const outcome = await runOrgCommand(
        deps,
        request,
        reply,
        orgId,
        { action: 'member.role_change', role: 'admin', targetType: 'org_member', targetId: userId },
        async (client, context) => {
          const target = await lockMember(client, orgId, userId);
          if (target === null) throw new Refused(404, 'member.not_found', 'not_in_org');
          if (target.role === 'admin' && role !== 'admin' && (await countActiveAdmins(client, orgId, userId)) === 0) {
            throw new Refused(409, 'org.last_admin', 'last_admin', { summary: { before: { role: target.role } } });
          }
          const membership = await changeRole(client, orgId, userId, role);
          await context.audit({ summary: { before: { role: target.role }, after: { role: membership.role } } });
          return { membership };
        },
      );
      if ('refused' in outcome) return outcome.refused;
      return reply.code(200).send(outcome.value);
    },
  );

  /**
   * `POST /orgs/:orgId/members/:userId/remove` (admin, not self: leaving is its
   * own command). The row stays, `removed`, with who removed it.
   */
  app.post(
    '/orgs/:orgId/members/:userId/remove',
    {
      schema: {
        params: orgMemberParamsSchema,
        response: {
          200: removeMemberResponseSchema,
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
      const { orgId, userId } = request.params;
      const outcome = await runOrgCommand(
        deps,
        request,
        reply,
        orgId,
        { action: 'member.remove', role: 'admin', targetType: 'org_member', targetId: userId },
        async (client, context) => {
          if (userId === context.actor.userId) throw new Refused(409, 'member.self', 'self');
          const target = await lockMember(client, orgId, userId);
          if (target === null) throw new Refused(404, 'member.not_found', 'not_in_org');
          if (target.role === 'admin' && (await countActiveAdmins(client, orgId, userId)) === 0) {
            throw new Refused(409, 'org.last_admin', 'last_admin', { summary: { before: { role: target.role } } });
          }
          const membership = await removeMember(client, orgId, userId, context.actor.userId);
          await context.audit({
            summary: { before: { role: target.role, status: 'active' }, after: { status: membership.status } },
          });
          return { membership };
        },
      );
      if ('refused' in outcome) return outcome.refused;
      return reply.code(200).send(outcome.value);
    },
  );

  /** `POST /orgs/:orgId/leave` (any active member); the last active admin cannot leave (409). */
  app.post(
    '/orgs/:orgId/leave',
    {
      schema: {
        params: orgParamsSchema,
        response: {
          200: leaveOrgResponseSchema,
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
      const self = actorOf(request).userId;
      const outcome = await runOrgCommand(
        deps,
        request,
        reply,
        orgId,
        { action: 'member.leave', role: 'member', targetType: 'org_member', targetId: self },
        async (client, context) => {
          // The caller's own row, locked like any target row (after the org lock).
          const own = await lockMember(client, orgId, self);
          if (own === null) throw new Refused(403, 'org.forbidden', 'not_a_member', { targetType: 'org', targetId: orgId });
          if (own.role === 'admin' && (await countActiveAdmins(client, orgId, self)) === 0) {
            throw new Refused(409, 'org.last_admin', 'last_admin', { summary: { before: { role: own.role } } });
          }
          const membership = await leave(client, orgId, self);
          await context.audit({ summary: { before: { role: own.role, status: 'active' }, after: { status: membership.status } } });
          return { membership };
        },
      );
      if ('refused' in outcome) return outcome.refused;
      return reply.code(200).send(outcome.value);
    },
  );

  /**
   * `POST /orgs/:orgId/capabilities` exists only to refuse and audit (R18):
   * capabilities are granted by `pnpm db:grant` alone (ruling D4). It declares
   * `params` and no body schema and never reads a body, so a crafted request
   * reaches the refusal and its audit row instead of an unaudited 400. A
   * non-member gets `org.forbidden`; a member or admin gets
   * `capability.script_only`; both rows say `capability.grant`.
   *
   * It lives in a scope of its own whose only content-type parser takes any body
   * and discards it (R18 rev 3). Fastify parses a body before the handler runs,
   * so with the default parsers a form or XML body was a 415 and a malformed JSON
   * body a 400, both refused before the refusal and its audit row. The body is
   * still read into memory under Fastify's `bodyLimit`; nothing reads it after.
   */
  app.register(async (plain) => {
    const scope = plain.withTypeProvider<ZodTypeProvider>();
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, _body, done) => done(null, undefined));

    scope.post(
      '/orgs/:orgId/capabilities',
      {
        schema: {
          params: orgParamsSchema,
          response: {
            400: apiErrorSchema,
            401: apiErrorSchema,
            403: apiErrorSchema,
            500: apiErrorSchema,
            503: apiErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const { orgId } = request.params;
        const outcome = await runCommand(
          deps,
          request,
          reply,
          { action: 'capability.grant', contextOrgId: orgId, targetType: 'org', targetId: orgId },
          async (client, context) => {
            const access = await readActiveMembership(client, orgId, context.actor.userId);
            if (access.role === null) {
              throw new Refused(403, 'org.forbidden', access.orgExists ? 'not_a_member' : 'org_unknown');
            }
            throw new Refused(403, 'capability.script_only', 'script_only');
          },
        );
        if ('refused' in outcome) return outcome.refused;
        throw new Error('the capability route answered without refusing');
      },
    );
  });
};
