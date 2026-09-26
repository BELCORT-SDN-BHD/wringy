/**
 * `POST /internal/orgs/create`: the Workspaces section's create form → API
 * `POST /orgs { name }` (M2-03; m2-03-code-review.md R9 rev 2; M2-AC03/1).
 *
 * The API makes the org `live`, writes the creator's admin membership with
 * `grant_basis = org_created` and the audit row, in one transaction. This
 * handler forwards the name and says what happened: the new org's page with
 * `created`, or `/internal` with the refusal. The name is the contracts'
 * `orgNameSchema` on the API side; the web does not restate it.
 */

import type { NextResponse } from 'next/server';

import { createOrgResponseSchema } from '@wringy/contracts';

import { apiFetch } from '@/lib/auth/api-client';

import { answerRefusal, answerWith, formText, noSegments, prepareCommand } from '../../org-command';
import { INTERNAL_PATH, orgPath } from '../../org-paths';

export async function POST(request: Request): Promise<NextResponse> {
  const prepared = await prepareCommand(request, noSegments);
  if (!prepared.ok) return prepared.response;
  const { env, token, form } = prepared;

  if (token === null) return answerWith('session_ended', INTERNAL_PATH, env);

  const result = await apiFetch('/orgs', {
    baseUrl: env.apiInternalUrl,
    token,
    method: 'POST',
    body: { name: formText(form, 'name') },
    schema: createOrgResponseSchema,
  });

  if (result.kind === 'ok') return answerWith('created', orgPath(result.data.org.id), env);
  return answerRefusal(result, 'create', INTERNAL_PATH, env);
}
