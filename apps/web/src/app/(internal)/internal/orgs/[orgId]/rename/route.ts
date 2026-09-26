/**
 * `POST /internal/orgs/<orgId>/rename`: the org page's rename form (admins) →
 * API `POST /orgs/:orgId/rename { name }` (M2-03; m2-03-code-review.md R9 rev 2).
 *
 * The org is the path's, parsed as a uuid before any API path is built; the
 * API re-reads the caller's membership and role under the org lock (R5), so a
 * form rendered while the caller was an admin and submitted after a demotion is
 * refused `admin_required` (M2-AC03/2).
 */

import type { NextResponse } from 'next/server';

import { orgParamsSchema, renameOrgResponseSchema } from '@wringy/contracts';

import { apiFetch } from '@/lib/auth/api-client';

import { answerRefusal, answerWith, formText, parseSegments, prepareCommand } from '../../../org-command';
import { orgPath } from '../../../org-paths';

export async function POST(request: Request, { params }: RouteContext<'/internal/orgs/[orgId]/rename'>): Promise<NextResponse> {
  const prepared = await prepareCommand(request, () => parseSegments(params, orgParamsSchema));
  if (!prepared.ok) return prepared.response;
  const { env, token, form, segments } = prepared;
  const orgPage = orgPath(segments.orgId);

  if (token === null) return answerWith('session_ended', orgPage, env);

  const result = await apiFetch(`/orgs/${segments.orgId}/rename`, {
    baseUrl: env.apiInternalUrl,
    token,
    method: 'POST',
    body: { name: formText(form, 'name') },
    schema: renameOrgResponseSchema,
  });

  if (result.kind === 'ok') return answerWith('renamed', orgPage, env);
  return answerRefusal(result, 'rename', orgPage, env);
}
