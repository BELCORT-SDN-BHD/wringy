/**
 * `POST /internal/orgs/<orgId>/members/<userId>/role`: a member row's role form
 * (admins) → API `POST /orgs/:orgId/members/:userId/role { role }` (M2-03;
 * m2-03-code-review.md R5, R9 rev 2; M2-AC03/2).
 *
 * The API refuses a non-admin (`admin_required`), the last active admin's
 * demotion (`last_admin`) and a member who is not in this org (`not_found`). The
 * role is checked against the contracts' enum first, so a crafted value answers
 * `unexpected` without calling the API.
 */

import type { NextResponse } from 'next/server';

import { changeRoleResponseSchema, orgMemberParamsSchema, orgRoleSchema } from '@wringy/contracts';

import { apiFetch } from '@/lib/auth/api-client';

import { answerRefusal, answerWith, formText, parseSegments, prepareCommand } from '../../../../../org-command';
import { orgPath } from '../../../../../org-paths';

export async function POST(
  request: Request,
  { params }: RouteContext<'/internal/orgs/[orgId]/members/[userId]/role'>,
): Promise<NextResponse> {
  const prepared = await prepareCommand(request, () => parseSegments(params, orgMemberParamsSchema));
  if (!prepared.ok) return prepared.response;
  const { env, token, form, segments } = prepared;
  const orgPage = orgPath(segments.orgId);

  if (token === null) return answerWith('session_ended', orgPage, env);

  const role = orgRoleSchema.safeParse(formText(form, 'role'));
  if (!role.success) return answerWith('unexpected', orgPage, env);

  const result = await apiFetch(`/orgs/${segments.orgId}/members/${segments.userId}/role`, {
    baseUrl: env.apiInternalUrl,
    token,
    method: 'POST',
    body: { role: role.data },
    schema: changeRoleResponseSchema,
  });

  if (result.kind === 'ok') return answerWith('role_changed', orgPage, env);
  return answerRefusal(result, 'role', orgPage, env);
}
