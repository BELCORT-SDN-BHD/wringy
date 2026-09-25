/**
 * Sign-in outcomes: the nine things that can send a visitor back to
 * `/internal/sign-in`, and the two places they are decided (M2-02 R11;
 * kickoff-package.md §4.2 step 6).
 *
 * Every outcome has a title and a description in all three locales under
 * `internal.signIn.outcomes.<code>`, so the page always says what happened and
 * what to do next instead of failing silently.
 *
 * The two sources:
 *
 *  - **Callback query parameters**, which Supabase appends when the provider
 *    leg fails before any token exists: a Google cancel arrives as
 *    `error=access_denied`, a flow state Supabase no longer holds as
 *    `error_code=flow_state_not_found`.
 *  - **The error `exchangeCodeForSession` returns**, which is a GoTrue response
 *    to `POST /token?grant_type=pkce`: `flow_state_expired` (422) or
 *    `bad_code_verifier` (400), plus auth-js's own
 *    `AuthPKCECodeVerifierMissingError` when this browser holds no verifier
 *    cookie at all.
 *
 * `bad_code_verifier` and a missing verifier share the `wrong_browser` copy on
 * purpose: both mean "the browser finishing sign-in is not the browser that
 * started it", whether because the person opened the link on another device or
 * because a second sign-in overwrote the verifier (no PKCE flow id is appended
 * to the redirect, so the most recent flow wins — R11).
 *
 * Errors are classified **structurally**, by `name` and `code`, not with
 * `instanceof`: `pnpm depcruise` (rule `supabase-client-only-in-auth-lib`)
 * allows `@supabase/*` imports only in `supabase-server.ts`, and a shape check
 * also lets the tests describe an error without building a library object.
 */

import { DEFAULT_NEXT_PATH } from './next-path';

/** Every outcome code, in the order the copy and the tests list them. */
export const OUTCOMES = [
  'cancelled',
  'expired',
  'wrong_browser',
  'session_ended',
  'signed_out',
  'signed_out_unconfirmed',
  'not_allowed',
  'disabled',
  'unexpected',
] as const;

export type Outcome = (typeof OUTCOMES)[number];

/** The only public page of the internal build (R11). */
export const SIGN_IN_PATH = '/internal/sign-in';

export function isOutcome(value: string | null | undefined): value is Outcome {
  return typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value);
}

/** Just the `get` of a `URLSearchParams`, so a plain object of params fits in a test. */
interface QueryLike {
  get(name: string): string | null;
}

/**
 * The outcome a callback's query parameters describe, or `null` when they
 * describe no failure at all (the happy path, where a `code` is present).
 *
 * `error=access_denied` is the cancel Google sends when the person declines;
 * `error_code=flow_state_not_found` is Supabase saying it has no record of this
 * flow. Any other `error` is `unexpected`: the page says something went wrong
 * and offers to start again, rather than guessing.
 */
export function outcomeFromCallbackQuery(params: QueryLike): Outcome | null {
  const error = params.get('error');
  const errorCode = params.get('error_code');

  if (error === null && errorCode === null) return null;
  if (error === 'access_denied') return 'cancelled';
  if (errorCode === 'flow_state_not_found') return 'expired';
  return 'unexpected';
}

/** The fields this module reads off an unknown thrown or returned value. */
function shapeOf(error: unknown): { name?: string; code?: string } {
  if (error === null || typeof error !== 'object') return {};
  const { name, code } = error as { name?: unknown; code?: unknown };
  return {
    name: typeof name === 'string' ? name : undefined,
    code: typeof code === 'string' ? code : undefined,
  };
}

/**
 * The outcome an `exchangeCodeForSession` error describes.
 *
 * `flow_state_expired` → `expired` (the person took too long, or reused a link).
 * `bad_code_verifier` and `AuthPKCECodeVerifierMissingError`
 * (`pkce_code_verifier_not_found`) → `wrong_browser`.
 * Anything else, including a transport failure → `unexpected`.
 */
export function outcomeFromExchangeError(error: unknown): Outcome {
  const { name, code } = shapeOf(error);

  if (code === 'flow_state_expired') return 'expired';
  if (code === 'bad_code_verifier') return 'wrong_browser';
  if (name === 'AuthPKCECodeVerifierMissingError' || code === 'pkce_code_verifier_not_found') {
    return 'wrong_browser';
  }
  return 'unexpected';
}

/**
 * The sign-in URL to redirect to, as a **root-relative** path. Callers that
 * need an absolute URL build it with `new URL(signInPath(...), APP_ORIGIN)`, so
 * the host always comes from the environment and never from a request header
 * (R12).
 *
 * `next` is left out when it is the default, so the common redirect is the bare
 * `/internal/sign-in` and the URL stays readable in a log or a screenshot.
 */
export function signInPath({ next, outcome }: { next?: string | null; outcome?: Outcome | null } = {}): string {
  const query = new URLSearchParams();
  if (typeof next === 'string' && next !== '' && next !== DEFAULT_NEXT_PATH) query.set('next', next);
  if (outcome != null) query.set('outcome', outcome);

  const search = query.toString();
  return search === '' ? SIGN_IN_PATH : `${SIGN_IN_PATH}?${search}`;
}
