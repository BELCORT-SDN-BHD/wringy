/**
 * What an organisation command or an invitation sends the person back with
 * (`?outcome=<code>`), and how the accept page reads a preview (M2-03;
 * docs/m2-internal/m2-03-code-review.md R9 rev 2, R12).
 *
 * The web decides nothing here: the API has already allowed or refused, and
 * this module only names its answer so the page can say what happened and what
 * to do next. Every code has one sentence in all three locales under
 * `internal.outcomes.<code>` (outcomes.test.ts pins the parity), rendered by
 * `OutcomeAlert` on `/internal` and on the org page.
 *
 * Pure: no Next.js, no fetch, so the mapping is unit-tested directly.
 */

import type { InvitationPreviewResponse } from '@wringy/contracts';

import type { ApiFailure, ApiResult } from '@/lib/auth/api-client';

/**
 * Every outcome code, in the order the copy lists them. The first nineteen are
 * R9's list. The four `invitation_*` codes are the accept refusals R7 names
 * (`invitation.invalid`, `.expired`, `.used`, `.email_mismatch`), which R9's
 * list does not carry: the confirm handler never puts the token back into a URL
 * it builds, so it cannot re-render the accept page and says why on `/internal`
 * instead. `invalid_name` (R9 rev 3) is the API refusing an org name on create
 * or rename: a name the form lets through — only spaces, or a pasted
 * text-direction mark — that `orgNameSchema` refuses, where "try again" could
 * never succeed.
 */
export const ORG_OUTCOMES = [
  'created',
  'renamed',
  'invited',
  'revoked',
  'joined',
  'role_changed',
  'member_removed',
  'left',
  'forbidden',
  'admin_required',
  'last_admin',
  'already_member',
  'pending_exists',
  'invalid_email',
  'not_pending',
  'not_found',
  'session_ended',
  'unavailable',
  'unexpected',
  'invitation_invalid',
  'invitation_expired',
  'invitation_used',
  'invitation_mismatch',
  'invalid_name',
] as const;

export type OrgOutcome = (typeof ORG_OUTCOMES)[number];

/** The outcomes that confirm a change; every other one reads as a refusal or a problem. */
export const CONFIRMATION_OUTCOMES: ReadonlySet<OrgOutcome> = new Set<OrgOutcome>([
  'created',
  'renamed',
  'invited',
  'revoked',
  'joined',
  'role_changed',
  'member_removed',
  'left',
]);

export function isOrgOutcome(value: unknown): value is OrgOutcome {
  return typeof value === 'string' && (ORG_OUTCOMES as readonly string[]).includes(value);
}

/** A page's `searchParams`, as Next hands them over. */
export type Query = Record<string, string | string[] | undefined>;

/** A repeated query parameter arrives as an array; only the first value is ever meant. */
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `?outcome=` when it names a known code; anything else is ignored rather than shown. */
export function outcomeFromQuery(query: Query): OrgOutcome | null {
  const value = firstValue(query.outcome);
  return isOrgOutcome(value) ? value : null;
}

/** Not an outcome: the answer that ends the session through `/auth/end-session`, as `/internal` does. */
export const END_SESSION = 'end_session';

/** Which Route Handler is asking; only invite, create and rename read a 400 as the value the person typed. */
export type OrgCommand = 'create' | 'rename' | 'invite' | 'revoke' | 'role' | 'remove' | 'leave' | 'accept';

/** The refusals whose code names the outcome, keyed `<status> <code>`. */
const REFUSALS: Readonly<Record<string, OrgOutcome>> = {
  '403 org.forbidden': 'forbidden',
  '403 org.admin_required': 'admin_required',
  '409 org.last_admin': 'last_admin',
  '409 invitation.already_member': 'already_member',
  '409 invitation.pending': 'pending_exists',
  '409 invitation.not_pending': 'not_pending',
  '403 invitation.invalid': 'invitation_invalid',
  '403 invitation.expired': 'invitation_expired',
  '403 invitation.used': 'invitation_used',
  '403 invitation.email_mismatch': 'invitation_mismatch',
};

/**
 * The outcome of a command the API did not carry out.
 *
 * - A 401 is `session_ended`, whatever its code: the token was not accepted.
 * - 403 `account.disabled` ends the session (`END_SESSION`), as `/internal` does.
 * - The org and invitation refusals map one to one (`REFUSALS`).
 * - A 400 on the invite handler is `invalid_email` (the API's `normalizeEmail`
 *   refused the address), and on create and rename `invalid_name` (the API's
 *   `orgNameSchema` refused the name: the form's `required` lets a name of only
 *   spaces through, and nothing in it stops a text-direction mark). Those are
 *   the only free-text fields; anywhere else a 400 is `unexpected`, since the
 *   other forms send only values the page itself rendered.
 * - A 404 is `not_found`: the member or invitation is not in this org.
 * - A 503 is `unavailable`, retryable; an unreachable API, a 5xx and any code
 *   this list does not know are `unexpected`.
 */
export function refusalOutcome(
  result: Exclude<ApiResult<unknown>, { kind: 'ok' }>,
  command: OrgCommand,
): OrgOutcome | typeof END_SESSION {
  if (result.kind === 'failure') return result.failure === 'api-unavailable' ? 'unavailable' : 'unexpected';

  const { status, code } = result;
  if (status === 401) return 'session_ended';
  if (status === 403 && code === 'account.disabled') return END_SESSION;

  const named = code === null ? undefined : REFUSALS[`${status} ${code}`];
  if (named !== undefined) return named;

  if (status === 400) {
    if (command === 'invite') return 'invalid_email';
    return command === 'create' || command === 'rename' ? 'invalid_name' : 'unexpected';
  }
  if (status === 404) return 'not_found';
  return 'unexpected';
}

// --- The accept page -----------------------------------------------------------

/** What the addressed person is shown about the invitation. */
export type InvitationPreview = Extract<InvitationPreviewResponse, { org: unknown }>;

/**
 * What the accept page renders (R7, R9).
 *
 * - `pending`: the addressed person, before accepting: the org, the role, the
 *   expiry and the Accept form.
 * - `expired`, `used`: the addressed person, after the fact (`used` is the
 *   API's `accepted`).
 * - `email_mismatch`: somebody else holds the link. They are told only that it
 *   was sent to a different address — no org, role or expiry.
 * - `invalid`: no token, a malformed one (never sent to the API), or one the API
 *   does not know or that was revoked (403 `invitation.invalid`).
 * - `session_ended` / `end_session`: redirects, as on `/internal`.
 * - `failure`: the API could not answer; the M2-01 failure states.
 */
export type AcceptPageState =
  | { readonly kind: 'pending' | 'expired' | 'used'; readonly preview: InvitationPreview }
  | { readonly kind: 'email_mismatch' | 'invalid' | 'session_ended' | 'end_session' }
  | { readonly kind: 'failure'; readonly failure: ApiFailure };

/**
 * The preview answer as a page state. `null` means no usable token reached the
 * page, so nothing was asked.
 */
export function acceptPageState(result: ApiResult<InvitationPreviewResponse> | null): AcceptPageState {
  if (result === null) return { kind: 'invalid' };
  if (result.kind === 'failure') return { kind: 'failure', failure: result.failure };

  if (result.kind === 'ok') {
    const preview = result.data;
    if (preview.state === 'email_mismatch') return { kind: 'email_mismatch' };
    return { kind: preview.state === 'accepted' ? 'used' : preview.state, preview };
  }

  if (result.status === 401) return { kind: 'session_ended' };
  if (result.status === 403) {
    if (result.code === 'account.disabled') return { kind: 'end_session' };
    // The address is checked first (R7), so a mismatch is said as such even if the
    // API ever answered it as a refusal rather than a state.
    if (result.code === 'invitation.email_mismatch') return { kind: 'email_mismatch' };
    if (result.code?.startsWith('invitation.')) return { kind: 'invalid' };
  }
  return { kind: 'failure', failure: 'unexpected' };
}
