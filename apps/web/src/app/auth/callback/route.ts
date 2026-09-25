/**
 * `GET /auth/callback`: finish sign-in (M2-02 R10, R11; §3 step 3).
 *
 * The provider sends the browser here. PKCE is what protects this endpoint — the
 * verifier cookie is bound to the browser that started sign-in — so the §4.5
 * Origin rule does not apply to it (a top-level cross-site navigation is exactly
 * what is expected here, and `Origin` is absent on it).
 *
 * The steps, each with its own outcome when it fails (R11):
 *
 *  1. Mode guard: the demo build has no such endpoint.
 *  2. Query errors, before any exchange: a Google cancel (`error=access_denied`)
 *     and a flow state Supabase no longer holds (`flow_state_not_found`).
 *  3. `exchangeCodeForSession(code)`, whose error says whether the link expired
 *     or the browser is not the one that started sign-in.
 *  4. `POST /identity/sign-in` on Fastify with the new access token: that is
 *     where the allow-list gate and the profile upsert live. The web decides
 *     nothing here; it only maps the API's answer to a page.
 *
 * Whatever happens, the browser leaves with a session or with no session at all —
 * never with cookies for an account the API refused. `403 sign_in.not_allowed`
 * and `403 account.disabled` both sign the local session out again, and a 5xx or
 * an unreachable API clears the cookies too, because a session the API will not
 * accept is worse than none.
 *
 * Every response carries `noStore()`: this handler always writes cookies, and on
 * the refusal paths it writes them twice (the session, then its removal), which
 * is exactly where `@supabase/ssr`'s latched cache headers would go missing (R20).
 */

import { NextResponse } from 'next/server';

import { signInResponseSchema } from '@wringy/contracts';

import { apiFetch } from '@/lib/auth/api-client';
import { safeNextPath } from '@/lib/auth/next-path';
import { outcomeFromCallbackQuery, outcomeFromExchangeError, signInPath, type Outcome } from '@/lib/auth/outcomes';
import { cookieJar, errorResponse, notFound, seeOther, type CookieJar } from '@/lib/auth/route-support';
import { isInternalMode } from '@/lib/auth/mode';
import { internalAuthEnv } from '@/lib/auth/env';
import { createRequestSupabase, isSecureOrigin, type RequestSupabase } from '@/lib/auth/supabase-server';
import { AUTH_NEXT_COOKIE, AUTH_NEXT_COOKIE_PATH } from '@/lib/auth/wire';

export async function GET(request: Request): Promise<NextResponse> {
  // The mode guard only; PKCE, not Origin, protects this endpoint. The two
  // answers are the same ones `guardRequest` gives the other three handlers: a
  // demo origin has no such endpoint (404), a misconfigured internal deployment
  // is a retryable 503 that names no value.
  if (!isInternalMode()) return notFound();
  const env = internalAuthEnv();
  if (!env.ok) return errorResponse(503, 'not_configured', 'This build is not configured for sign-in.');

  const { appOrigin, supabaseUrl, publishableKey, apiInternalUrl } = env.env;
  const secure = isSecureOrigin(appOrigin);
  const jar = await cookieJar();

  /** Leave with no session and an explanation. The next cookie goes too: this attempt is over. */
  const giveUp = (outcome: Outcome): NextResponse => {
    jar.expire(AUTH_NEXT_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: AUTH_NEXT_COOKIE_PATH });
    return jar.applyTo(seeOther(signInPath({ outcome }), appOrigin));
  };

  const params = new URL(request.url).searchParams;

  // Step 2: the provider leg already failed, so there is nothing to exchange.
  const queryOutcome = outcomeFromCallbackQuery(params);
  if (queryOutcome !== null) return giveUp(queryOutcome);

  const code = params.get('code');
  if (code === null || code === '') return giveUp('unexpected');

  const supabase = createRequestSupabase({ supabaseUrl, publishableKey, secure, cookies: jar.adapter });

  // Step 3. The session cookies are written through the jar by this call.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error !== null) return giveUp(outcomeFromExchangeError(error));

  const accessToken = data?.session?.access_token;
  if (typeof accessToken !== 'string' || accessToken === '') return giveUp('unexpected');

  // Step 4. Fastify owns the decision: the allow-list gate and the profile upsert.
  const result = await apiFetch('/identity/sign-in', {
    baseUrl: apiInternalUrl,
    token: accessToken,
    method: 'POST',
    schema: signInResponseSchema,
  });

  if (result.kind === 'ok') {
    // Read the return path before expiring the cookie that carries it.
    const next = safeNextPath(jar.read(AUTH_NEXT_COOKIE));
    jar.expire(AUTH_NEXT_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: AUTH_NEXT_COOKIE_PATH });
    return jar.applyTo(seeOther(next, appOrigin));
  }

  // The API refused this person. Undo the session we just created, then say why.
  const outcome = refusalOutcome(result);
  await signOutLocally(supabase, jar, secure);
  return giveUp(outcome);
}

/** Which page a refusal leads to (R4, R11). Every 503 is retryable, so it is `unexpected`, never `session_ended`. */
function refusalOutcome(result: { kind: 'error'; status: number; code: string | null } | { kind: 'failure' }): Outcome {
  if (result.kind !== 'error') return 'unexpected';
  if (result.status === 403 && result.code === 'sign_in.not_allowed') return 'not_allowed';
  if (result.status === 403 && result.code === 'account.disabled') return 'disabled';
  return 'unexpected';
}

/**
 * Drop the local session again.
 *
 * `signOut({ scope: 'local' })` is explicit because supabase-js defaults to
 * `global`, and signing every device out is not what a refused first sign-in
 * should do. The library can return an error without having cleared anything (a
 * retryable Auth-server failure), so the `sb-*` cookies are expired by our own
 * code in that case: the browser must not keep a session the API will refuse.
 */
async function signOutLocally(supabase: RequestSupabase, jar: CookieJar, secure: boolean): Promise<void> {
  let failed = true;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    failed = error !== null;
  } catch {
    failed = true;
  }
  if (failed) jar.expireSupabaseCookies(secure);
}
