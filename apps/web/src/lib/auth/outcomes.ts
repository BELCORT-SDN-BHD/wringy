/**
 * Sign-in outcomes: the nine things that can send a visitor back to
 * `/internal/sign-in`, and the two places they are decided (M2-02 R11;
 * kickoff-package.md §4.2 step 6).
 *
 * Every outcome has a title and a description in all three locales under
 * `internal.signIn.outcomes.<code>`, so the page always says what happened and
 * what to do next instead of failing silently.
 *
 * The three sources:
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
 *  - **Supabase's Site-URL error redirect** (rev 4), the one the founder's real
 *    walk found: once the PKCE flow state has expired, GoTrue no longer holds
 *    the flow's `redirect_to`, so it sends the provider error to the project's
 *    **Site URL root** rather than to `/auth/callback`. `proxy.ts` reads it
 *    there with `outcomeFromSiteUrlError`.
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
 * Every `error_code` that means "the flow state is gone", whichever of the two
 * URLs Supabase puts it on.
 *
 * `flow_state_not_found` is GoTrue saying it holds no record of this flow;
 * `flow_state_expired` is the same thing said by the token endpoint;
 * `bad_oauth_state` is what the **Site-URL** redirect carries once the flow
 * state's lifetime has passed (`error=invalid_request&error_code=bad_oauth_state`
 * `&error_description=OAuth+state+has+expired`, captured verbatim from the
 * founder's real walk on 2026-09-26). All three are the same story to the
 * person: the sign-in took too long, start again.
 */
const EXPIRED_FLOW_ERROR_CODES: ReadonlySet<string> = new Set([
  'bad_oauth_state',
  'flow_state_expired',
  'flow_state_not_found',
]);

/**
 * The outcome a callback's query parameters describe, or `null` when they
 * describe no failure at all (the happy path, where a `code` is present).
 *
 * `error=access_denied` is the cancel Google sends when the person declines, and
 * it wins over any `error_code`: the person's own cancel is the more useful
 * thing to say. An `error_code` from `EXPIRED_FLOW_ERROR_CODES` is `expired`.
 * Any other `error` is `unexpected`: the page says something went wrong and
 * offers to start again, rather than guessing.
 */
export function outcomeFromCallbackQuery(params: QueryLike): Outcome | null {
  const error = params.get('error');
  const errorCode = params.get('error_code');

  if (error === null && errorCode === null) return null;
  if (error === 'access_denied') return 'cancelled';
  if (errorCode !== null && EXPIRED_FLOW_ERROR_CODES.has(errorCode)) return 'expired';
  return 'unexpected';
}

/**
 * The outcome an error Supabase put on the **Site URL root** describes — the
 * third source (rev 4), and the one no simulated row had seen.
 *
 * When the PKCE flow state has expired (the tester idled on Google's account
 * chooser or consent screen past GoTrue's flow-state lifetime, the project
 * default of about five minutes), GoTrue no longer holds the flow and therefore
 * no longer knows its `redirect_to`. It falls back to the project's Site URL and
 * sends the provider error there instead, which on the internal build is
 * `GET /?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired`
 * — never `/auth/callback`. The founder's walk of 2026-09-26 captured exactly
 * that request, and until this function existed the proxy turned `/` into
 * `/internal`, dropped the query, and the tester met a bare sign-in page with no
 * outcome at all.
 *
 * The mapping is `outcomeFromCallbackQuery`'s, deliberately and not by accident:
 * the error is the provider leg failing before any token exists, which is the
 * same question asked at a different URL, and two tables that must agree would
 * eventually not. It is a separate export only so the call site in `proxy.ts`
 * names which source it is reading.
 */
export function outcomeFromSiteUrlError(params: QueryLike): Outcome | null {
  return outcomeFromCallbackQuery(params);
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
 * True when `error` says the Supabase Auth server could not answer, rather than
 * that this session is over.
 *
 * `proxy.ts` gets this error from `getClaims()`, whose JWKS fetch and token
 * refresh both go over the network. auth-js reports every transport failure,
 * timeout, abort and 5xx as `AuthRetryableFetchError` (`lib/fetch.js`
 * `_handleRequest`; `status` is 0 for a transport failure and the response's
 * status for a 5xx), and that is emphatically **not** a sign-out: R9 requires the
 * web to treat every such answer as `unexpected` (retry), because a transient
 * Auth-server blip must not sign every tester out.
 *
 * Classified structurally, by `name` and `status`, for the same reason as
 * `outcomeFromExchangeError`: `@supabase/*` may not be imported outside
 * `supabase-server.ts` (R17), and a shape check lets a test describe an error
 * without building a library object.
 */
export function isRetryableAuthError(error: unknown): boolean {
  const { name } = shapeOf(error);
  if (name === 'AuthRetryableFetchError' || name === 'AbortError' || name === 'TimeoutError') return true;
  if (error === null || typeof error !== 'object') return false;
  const { status } = error as { status?: unknown };
  return typeof status === 'number' && status >= 500;
}

/**
 * The sign-in URL to redirect to, as a **root-relative** path. Callers that
 * need an absolute URL build it with `new URL(signInPath(...), APP_ORIGIN)`, so
 * the host always comes from the environment and never from a request header
 * (R12).
 *
 * A `next` that is given is always carried, even when it happens to equal the
 * default: the proxy's contract is that its redirect names the path that was
 * asked for (`?next=<path+query>`), and a caller with nothing to return to —
 * sign-out, a refused callback — simply passes none.
 */
export function signInPath({ next, outcome }: { next?: string | null; outcome?: Outcome | null } = {}): string {
  const query = new URLSearchParams();
  if (typeof next === 'string' && next !== '') query.set('next', next);
  if (outcome != null) query.set('outcome', outcome);

  const search = query.toString();
  return search === '' ? SIGN_IN_PATH : `${SIGN_IN_PATH}?${search}`;
}
