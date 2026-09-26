/**
 * `POST /internal/orgs/<orgId>/invitations/create`: the org page's invite form
 * (admins) → API `POST /orgs/:orgId/invitations { email, role }` (M2-03;
 * m2-03-code-review.md R7, R9 rev 2).
 *
 * The API answers 201 with the invitation and its token, once; only the token's
 * sha256 is stored. The token must reach the admin's invitation page without
 * ever being in a URL — not the admin's history, not a Referer, not a crafted
 * link that would make an admin's page show someone else's invitation — so it
 * rides a short-lived cookie scoped to exactly that page (`wringy-invite-<id>`:
 * httpOnly, `sameSite: lax`, Secure off loopback only, 10 minutes) set on this
 * 303. The response is no-store, like every response that sets a cookie.
 *
 * A 400 is the API refusing the address (`invalid_email`). The role is checked
 * against the contracts' enum first, so a crafted role is never reported as an
 * address problem: it answers `unexpected` without calling the API.
 */

import type { NextResponse } from 'next/server';

import { createInvitationResponseSchema, orgParamsSchema, orgRoleSchema } from '@wringy/contracts';

import { apiFetch } from '@/lib/auth/api-client';
import { seeOther } from '@/lib/auth/route-support';
import { isSecureOrigin } from '@/lib/auth/supabase-server';

import { answerRefusal, answerWith, formText, parseSegments, prepareCommand } from '../../../../org-command';
import { invitationPath, inviteCookieName, inviteCookieOptions, orgPath, withOutcome } from '../../../../org-paths';

export async function POST(
  request: Request,
  { params }: RouteContext<'/internal/orgs/[orgId]/invitations/create'>,
): Promise<NextResponse> {
  const prepared = await prepareCommand(request, () => parseSegments(params, orgParamsSchema));
  if (!prepared.ok) return prepared.response;
  const { env, jar, token, form, segments } = prepared;
  const { orgId } = segments;
  const orgPage = orgPath(orgId);

  if (token === null) return answerWith('session_ended', orgPage, env);

  const role = orgRoleSchema.safeParse(formText(form, 'role'));
  if (!role.success) return answerWith('unexpected', orgPage, env);

  const result = await apiFetch(`/orgs/${orgId}/invitations`, {
    baseUrl: env.apiInternalUrl,
    token,
    method: 'POST',
    body: { email: formText(form, 'email'), role: role.data },
    schema: createInvitationResponseSchema,
  });

  if (result.kind !== 'ok') return answerRefusal(result, 'invite', orgPage, env);

  const invitationId = result.data.invitation.id;
  jar.set(
    inviteCookieName(invitationId),
    result.data.token,
    inviteCookieOptions(orgId, invitationId, isSecureOrigin(env.appOrigin)),
  );
  return jar.applyTo(seeOther(withOutcome(invitationPath(orgId, invitationId), 'invited'), env.appOrigin));
}
