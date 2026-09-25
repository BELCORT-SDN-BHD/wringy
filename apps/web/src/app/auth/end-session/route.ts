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
 * `GET /me` with the session the browser already holds, and only an answer that
 * says this session is finished — `403 account.disabled`, or any 401 — ends it.
 * Every other answer changes nothing and sends the visitor back to `/internal`.
 * A cross-site link to this path therefore cannot sign anyone out; it can only
 * sign out an account the API is already refusing, which is the correct answer
 * anyway.
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
 * Which refusals end a session, and what the visitor is told (R4, R9, R11).
 *
 * `null` means "leave it alone". Every 503 is retryable and says nothing about
 * the session, so `auth_unavailable`, `session_check_unavailable` and
 * `database_unavailable` all land here — as does an unreachable API. So do
 * `403 sign_in.not_allowed` and `403 profile.missing`: those belong to the
 * callback, which has already answered them with its own outcome.
 */
export function endingOutcome(result: ApiResult<unknown>): Outcome | null {
  if (result.kind !== 'error') return null;
  if (result.status === 403 && result.code === 'account.disabled') return 'disabled';
  if (result.status === 401) return 'session_ended';
  return null;
}
