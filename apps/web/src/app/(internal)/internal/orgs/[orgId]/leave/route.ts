/**
 * `POST /internal/orgs/<orgId>/leave`: the org page's leave button (everyone) →
 * API `POST /orgs/:orgId/leave` (M2-03; m2-03-code-review.md R5, R9 rev 2).
 *
 * Leaving lands on `/internal` with `left`, since the org page is no longer
 * readable; a refusal — the last active admin (`last_admin`), or no longer a
 * member (`forbidden`) — goes back to the org page. No body.
 */

import type { NextResponse } from 'next/server';

import { leaveOrgResponseSchema, orgParamsSchema } from '@wringy/contracts';

import { apiFetch } from '@/lib/auth/api-client';

import { answerRefusal, answerWith, parseSegments, prepareCommand } from '../../../org-command';
import { INTERNAL_PATH, orgPath } from '../../../org-paths';

export async function POST(request: Request, { params }: RouteContext<'/internal/orgs/[orgId]/leave'>): Promise<NextResponse> {
  const prepared = await prepareCommand(request, () => parseSegments(params, orgParamsSchema));
  if (!prepared.ok) return prepared.response;
  const { env, token, segments } = prepared;
  const orgPage = orgPath(segments.orgId);

  if (token === null) return answerWith('session_ended', orgPage, env);

  const result = await apiFetch(`/orgs/${segments.orgId}/leave`, {
    baseUrl: env.apiInternalUrl,
    token,
    method: 'POST',
    schema: leaveOrgResponseSchema,
  });

  if (result.kind === 'ok') return answerWith('left', INTERNAL_PATH, env);
  return answerRefusal(result, 'leave', orgPage, env);
}
