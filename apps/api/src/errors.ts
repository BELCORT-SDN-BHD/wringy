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
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function errorBody(code: ErrorCode): ApiError {
  return { error: { code, message: ERROR_MESSAGES[code] } };
}
