/**
 * `GET /auth/end-session`: the one thing the `/internal` read cannot do for
 * itself (M2-02 R4, R10; §3 step 4).
 *
 * R4 requires that a `403 account.disabled` seen by the `/internal` read leaves
 * the browser with **no session cookie** and on
 * `/internal/sign-in?outcome=disabled`. The read is a Server Component, and a
 * Server Component cannot set cookies — which is the whole reason the access
 * token is handed to it in a header instead of a client (R10). So the page
 * redirects here, and this handler owns the cookie write, as R1 requires of every
 * cookie-writing endpoint.
 *
 * ## Why it carries no outcome in its URL, and needs no Origin rule
 *
 * The §4.5 Origin rule cannot guard a handler reached by a server-side redirect:
 * a top-level navigation sends no `Origin`, and its `Sec-Fetch-Site` is whatever
 * the *original* navigation's was (`none` for a typed URL), so the rule would
 * refuse Wringy's own redirect about as often as it refused anybody else's.
 *
 * Instead this endpoint is built so that a caller cannot decide anything with it,
 * which is the same reason the callback is exempt (there, PKCE): it takes no
 * parameters, and **the API decides what happens**. The handler re-asks
 * `GET /me` with the session the browser already holds, and the **one** answer
 * that ends it is the one R4 names: `403 account.disabled`. Every other answer —
 * including every 401 — changes nothing and sends the visitor back to
 * `/internal`. A cross-site link to this path therefore cannot sign anyone out;
 * it can only sign out an account the API has disabled, which is the correct
 * answer anyway.
 *
 * A 401 must not end a session here, and that is not a detail. `auth.expired`
 * means only that the access token in the cookie is past its 1-hour `exp` — which
 * is the ordinary state of an idle tab, and what the proxy silently refreshes on
 * the next `/internal` read. This path reads the token without refreshing, so a
 * top-level navigation from any other site (a `SameSite=Lax` cookie is sent on
 * one) would otherwise have signed a perfectly live session out on demand.
 * Wringy's own flow never needs that branch either: the `/internal` page
 * redirects here only for `403 account.disabled` and answers a 401 itself
 * (`page.tsx`).
 *
 * The extra round trip happens only on the refusal path, which is the path that
 * is about to stop being used at all.
 *
 * The token is read the way the probe reads it — from the cookie, with no
 * refresh — because a refresh here would rotate the refresh token in a response
 * that is about to throw the session away.
 */

import type { NextResponse } from 'next/server';

import { meResponseSchema } from '@wringy/contracts';

import { apiFetch, type ApiResult } from '@/lib/auth/api-client';
import { internalAuthEnv } from '@/lib/auth/env';
import { isInternalMode } from '@/lib/auth/mode';
import { signInPath, type Outcome } from '@/lib/auth/outcomes';
import { cookieJar, errorResponse, notFound, seeOther, signOutLocally } from '@/lib/auth/route-support';
import { createRequestSupabase, isSecureOrigin, readStoredAccessToken } from '@/lib/auth/supabase-server';

export async function GET(): Promise<NextResponse> {
  // The mode guard and the environment, exactly as the other handlers answer
  // them; the Origin rule is deliberately not applied (see the header).
  if (!isInternalMode()) return notFound();
  const env = internalAuthEnv();
  if (!env.ok) return errorResponse(503, 'not_configured', 'This build is not configured for sign-in.');

  const { appOrigin, supabaseUrl, publishableKey, apiInternalUrl } = env.env;
  const secure = isSecureOrigin(appOrigin);
  const jar = await cookieJar();

  const token = await readStoredAccessToken(supabaseUrl, (name) => jar.read(name));
  // Nothing to end. Say "please sign in" without claiming anything happened.
  if (token === null) return jar.applyTo(seeOther(signInPath(), appOrigin));

  const outcome = endingOutcome(await apiFetch('/me', { baseUrl: apiInternalUrl, token, schema: meResponseSchema }));
  // The API did not say this session is finished, so it is not this endpoint's
  // business to end it.
  if (outcome === null) return jar.applyTo(seeOther('/internal', appOrigin));

  const supabase = createRequestSupabase({ supabaseUrl, publishableKey, secure, cookies: jar.adapter });
  await signOutLocally(supabase, jar, secure);
  return jar.applyTo(seeOther(signInPath({ outcome }), appOrigin));
}

/**
 * Which refusal ends a session, and what the visitor is told (R4, R9, R11).
 *
 * Exactly one does: `403 account.disabled`, the refusal R4 names. `null` means
 * "leave it alone", and everything else is `null`:
 *
 *  - every **401**, because a refused token is not a finished session —
 *    `auth.expired` is an idle tab, and the proxy refreshes or expires the
 *    cookies itself on the next read (see the header: this is also what stops a
 *    cross-site link from signing a live session out);
 *  - every **503**, because it is retryable and says nothing about the session
 *    (`auth_unavailable`, `session_check_unavailable`, `database_unavailable`), as
 *    does an unreachable API;
 *  - `403 sign_in.not_allowed` and `403 profile.missing`, which belong to the
 *    callback: it has already answered them with its own outcome.
 */
export function endingOutcome(result: ApiResult<unknown>): Outcome | null {
  if (result.kind !== 'error') return null;
  return result.status === 403 && result.code === 'account.disabled' ? 'disabled' : null;
}
