/**
 * Every non-2xx body is `{ error: { code, message } }` (apiErrorSchema in
 * @wringy/contracts). Codes are stable; messages are fixed operator English and
 * never carry a stack, a SQL error or a connection string.
 *
 * The identity codes are M2-02 R9. Two properties are deliberate:
 *
 * - **Nothing here tells an attacker what went wrong.** Every token that is not
 *   acceptable — no bearer, a forged signature, a wrong issuer or audience, a
 *   missing claim, a role other than `authenticated`, an anonymous or OAuth-client
 *   token, an unknown key id — answers the one `unauthenticated` message. Only
 *   `auth.expired` is separate, because the web must know to sign in again rather
 *   than report a fault.
 * - **A blip is never a sign-out.** `auth_unavailable` (the project's JWKS could
 *   not be fetched) and `session_check_unavailable` (the liveness question could
 *   not be answered) are 503 and retryable. Answering 401 there would sign every
 *   signed-in tester out of the internal build because one network call failed.
 *
 * The organisation codes are M2-03 R12. Domain codes stay dotted; each is a
 * refusal of the authorisation logic, so each writes one denial row to
 * `app.audit_log` (R4). The identity codes above, `bad_request` and every 503 are
 * decided before an actor is admitted and are not audited.
 */
import type { ApiError } from '@wringy/contracts';

export const ERROR_MESSAGES = {
  bad_request: 'The request could not be processed.',
  not_found: 'No route matches this request.',
  internal_error: 'The server could not complete the request.',
  database_unavailable: 'The database is unavailable. Try again shortly.',
  /** No acceptable bearer token. One message for every reason (see above). */
  unauthenticated: 'This request needs a valid access token.',
  /** The signature and the claims were fine; the token's own lifetime has passed. */
  'auth.expired': 'This access token has expired.',
  /** The signing keys could not be fetched, so no token can be judged right now. */
  auth_unavailable: 'Sign-in verification is unavailable. Try again shortly.',
  /** The token is valid but its session no longer exists (a sign-out, or an expired session). */
  'session.revoked': 'This session has ended.',
  /** Whether the session is still live could not be established. */
  session_check_unavailable: 'The session could not be checked. Try again shortly.',
  /** First sign-in, and this address is not on the internal build's list (R5). */
  'sign_in.not_allowed': 'This account may not sign in to this build.',
  /** An operator disabled this profile (R4, ruling D12). */
  'account.disabled': 'This account is disabled.',
  /** A verified subject with no profile called something other than POST /identity/sign-in. */
  'profile.missing': 'This account has not completed sign-in.',

  // --- Organisations, memberships, invitations, capabilities (M2-03 R12) -----
  // Every one of these is decided by the authorisation logic and is audited
  // (R4): one denial row per refusal, never the token, the session id or an
  // address. The messages say what the caller may do next and nothing about
  // whether an object the caller cannot see exists.

  /** Not an active member of this org, or no such org: one answer, no existence oracle. */
  'org.forbidden': 'You do not have access to this organisation.',
  /** The caller is a member, but the command needs an admin of this org. */
  'org.admin_required': 'Only an admin of this organisation can do this.',
  /** The change would leave the org without an active admin (ruling D3). */
  'org.last_admin': 'An organisation must keep at least one active admin.',
  /** No active member with that id in this org (audited as `not_in_org`). */
  'member.not_found': 'No such member in this organisation.',
  /** An admin tried to remove themselves: leaving is its own command. */
  'member.self': 'Use leave to remove yourself from an organisation.',
  /** Unknown or revoked invitation token; the same answer for both. */
  'invitation.invalid': 'This invitation link is not valid.',
  /** The invitation was already accepted: links are single-use (ruling D2). */
  'invitation.used': 'This invitation has already been used.',
  /** The invitation is past its expiry. */
  'invitation.expired': 'This invitation has expired.',
  /** The signed-in account's verified address is not the one the invitation was sent to. */
  'invitation.email_mismatch': 'This invitation was sent to a different address.',
  /** The caller is already an active member; the invitation is closed. */
  'invitation.already_member': 'You are already a member of this organisation.',
  /** A pending, unexpired invitation for this address already exists in this org. */
  'invitation.pending': 'An invitation for this address is already pending.',
  /** No invitation with that id in this org (audited as `not_in_org`). */
  'invitation.not_found': 'No such invitation in this organisation.',
  /** Only a pending invitation can be revoked. */
  'invitation.not_pending': 'This invitation is no longer pending.',
  /** Capabilities are granted only by the operator script (ruling D4; R18). */
  'capability.script_only': 'Capabilities cannot be granted through the API.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function errorBody(code: ErrorCode): ApiError {
  return { error: { code, message: ERROR_MESSAGES[code] } };
}
