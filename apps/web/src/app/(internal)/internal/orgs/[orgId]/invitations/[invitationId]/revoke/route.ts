/**
 * `POST /internal/orgs/<orgId>/invitations/<invitationId>/revoke`: a pending
 * invitation's revoke button (admins) → API
 * `POST /orgs/:orgId/invitations/:invitationId/revoke` (M2-03;
 * m2-03-code-review.md R7, R9 rev 2).
 *
 * Both segments are parsed as uuids before any API path is built. An invitation
 * of another org named through this org's path is the API's 404 (`not_found`,
 * audited `not_in_org`), and one that is no longer pending its 409
 * (`not_pending`). No body is sent.
 */

import type { NextResponse } from 'next/server';

import { orgInvitationParamsSchema, revokeInvitationResponseSchema } from '@wringy/contracts';

import { apiFetch } from '@/lib/auth/api-client';

import { answerRefusal, answerWith, parseSegments, prepareCommand } from '../../../../../org-command';
import { orgPath } from '../../../../../org-paths';

export async function POST(
  request: Request,
  { params }: RouteContext<'/internal/orgs/[orgId]/invitations/[invitationId]/revoke'>,
): Promise<NextResponse> {
  const prepared = await prepareCommand(request, () => parseSegments(params, orgInvitationParamsSchema));
  if (!prepared.ok) return prepared.response;
  const { env, token, segments } = prepared;
  const orgPage = orgPath(segments.orgId);

  if (token === null) return answerWith('session_ended', orgPage, env);

  const result = await apiFetch(`/orgs/${segments.orgId}/invitations/${segments.invitationId}/revoke`, {
    baseUrl: env.apiInternalUrl,
    token,
    method: 'POST',
    schema: revokeInvitationResponseSchema,
  });

  if (result.kind === 'ok') return answerWith('revoked', orgPage, env);
  return answerRefusal(result, 'revoke', orgPage, env);
}
