/**
 * `POST /internal/orgs/<orgId>/members/<userId>/remove`: a member row's remove
 * button (admins) → API `POST /orgs/:orgId/members/:userId/remove` (M2-03;
 * m2-03-code-review.md R5, R9 rev 2).
 *
 * The membership row stays, marked `removed` with who removed it; nothing is
 * deleted. The API refuses a non-admin (`admin_required`), the last active admin
 * (`last_admin`) and a member who is not in this org (`not_found`). No body.
 */

import type { NextResponse } from 'next/server';

import { orgMemberParamsSchema, removeMemberResponseSchema } from '@wringy/contracts';

import { apiFetch } from '@/lib/auth/api-client';

import { answerRefusal, answerWith, parseSegments, prepareCommand } from '../../../../../org-command';
import { orgPath } from '../../../../../org-paths';

export async function POST(
  request: Request,
  { params }: RouteContext<'/internal/orgs/[orgId]/members/[userId]/remove'>,
): Promise<NextResponse> {
  const prepared = await prepareCommand(request, () => parseSegments(params, orgMemberParamsSchema));
  if (!prepared.ok) return prepared.response;
  const { env, token, segments } = prepared;
  const orgPage = orgPath(segments.orgId);

  if (token === null) return answerWith('session_ended', orgPage, env);

  const result = await apiFetch(`/orgs/${segments.orgId}/members/${segments.userId}/remove`, {
    baseUrl: env.apiInternalUrl,
    token,
    method: 'POST',
    schema: removeMemberResponseSchema,
  });

  if (result.kind === 'ok') return answerWith('member_removed', orgPage, env);
  return answerRefusal(result, 'remove', orgPage, env);
}
