/**
 * `POST /internal/invitations/accept/confirm`: the accept page's Accept form →
 * API `POST /invitations/accept { token }` (M2-03; m2-03-code-review.md R7,
 * R9 rev 2; M2-AC03/1).
 *
 * It lives one segment below the page because a `route.ts` cannot share a
 * `page.tsx`'s segment. The token comes from the form's hidden field — a POST
 * body, never a path — and a value that is not a token shape answers
 * `invitation_invalid` without calling the API.
 *
 * The API holds the whole decision: the verified address must match, the link
 * must be pending and unexpired, and the membership is written with its grant
 * record and audit row in one transaction. Joining lands on the org's page with
 * `joined`. A refusal lands on `/internal` with its outcome and **never** back on
 * the accept page: that would mean building a URL with the token in it, which
 * nothing in the web does (R7).
 */

import type { NextResponse } from 'next/server';

import { acceptInvitationResponseSchema, invitationTokenSchema } from '@wringy/contracts';

import { apiFetch } from '@/lib/auth/api-client';

import { answerRefusal, answerWith, formText, noSegments, prepareCommand } from '../../../org-command';
import { INTERNAL_PATH, orgPath } from '../../../org-paths';

export async function POST(request: Request): Promise<NextResponse> {
  const prepared = await prepareCommand(request, noSegments);
  if (!prepared.ok) return prepared.response;
  const { env, token, form } = prepared;

  if (token === null) return answerWith('session_ended', INTERNAL_PATH, env);

  const invitationToken = invitationTokenSchema.safeParse(formText(form, 'token'));
  if (!invitationToken.success) return answerWith('invitation_invalid', INTERNAL_PATH, env);

  const result = await apiFetch('/invitations/accept', {
    baseUrl: env.apiInternalUrl,
    token,
    method: 'POST',
    body: { token: invitationToken.data },
    schema: acceptInvitationResponseSchema,
  });

  if (result.kind === 'ok') return answerWith('joined', orgPath(result.data.org.id), env);
  return answerRefusal(result, 'accept', INTERNAL_PATH, env);
}
