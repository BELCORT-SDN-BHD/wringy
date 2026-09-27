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
 *
 * ## The language chosen on the sign-in page (M2-04; m2-04-code-review.md R6)
 *
 * A choice made on the sign-in page is carried into the account by the sign-in
 * it belongs to, and nothing else is:
 *
 * - only after `POST /identity/sign-in` answered 200, and only when
 *   `wringy-locale-carry` is present, valid and differs from the profile's
 *   preference, `POST /me/locale` is called **with the token the exchange just
 *   returned** — never the one the request arrived with, which on a shared device
 *   may be somebody else's stale session;
 * - saved: the landing URL carries `outcome=locale_synced` and
 *   `from=<previous preference | none>`, set through `searchParams`, and the page
 *   shows an undoable notice; not saved (a 401 included): `wringy-locale-session`
 *   keeps the choice for this browsing session, stamped with the instant it was
 *   made (`writeUnsaved`) so a newer save to the account outranks it, and the outcome is
 *   `locale_not_saved`; `account.disabled`: the new session is signed out again
 *   and the person is told the account is disabled, as for the sign-in itself;
 * - the carry cookie is **spent** by a sign-in the API let in (used, equal to the
 *   profile's preference, or invalid — an invalid value never reaches the API)
 *   and by a refusal that names who was signing in (`not_allowed`, `disabled`,
 *   a carry refused as `disabled`), so it never outlives the person it was
 *   refused with. An attempt that ended before the API knew who it was — a
 *   Google cancel, a flow Supabase no longer holds, an exchange error, a missing
 *   code or token, a 5xx or an unreachable API — **keeps** it, so the retry
 *   lands in the language just chosen; its ten-minute max-age still bounds it
 *   (R6 rev 3);
 * - `wringy-locale-session` is expired by every successful sign-in (it belonged to
 *   whoever sat here before), unless this very callback wrote it for a failed
 *   carry, and wherever a refusal signs the new session out again.
 *
 * With no carry cookie nothing is written: a guest preference left by an earlier
 * browsing session is never written to an account.
 */

import { NextResponse } from 'next/server';

import { setLocaleResponseSchema, signInResponseSchema } from '@wringy/contracts';

import { isLocale } from '@/i18n/config';
import { apiFetch } from '@/lib/auth/api-client';
import { safeNextPath } from '@/lib/auth/next-path';
import { outcomeFromCallbackQuery, outcomeFromExchangeError, signInPath, type Outcome } from '@/lib/auth/outcomes';
import { cookieJar, errorResponse, notFound, seeOther, signOutLocally } from '@/lib/auth/route-support';
import { isInternalMode } from '@/lib/auth/mode';
import { internalAuthEnv } from '@/lib/auth/env';
import { createRequestSupabase, isSecureOrigin } from '@/lib/auth/supabase-server';
import { AUTH_NEXT_COOKIE, AUTH_NEXT_COOKIE_PATH } from '@/lib/auth/wire';
import { LOCALE_CARRY_COOKIE, expireCarry, expireUnsaved, writeUnsaved } from '@/lib/locale/cookies';

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

  // The sign-in page's language choice. It is spent only once the API has answered
  // for a person; an attempt that failed before that keeps it for the retry (R6 rev 3).
  const carry = jar.read(LOCALE_CARRY_COOKIE);

  /**
   * Leave with no session and an explanation. The next cookie goes too: this attempt is over.
   * The carry is left alone here: the caller spends it when the exit names a person.
   */
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
    // The API let this person in: the carry is theirs, used below or not at all.
    expireCarry(jar, secure);
    // Read the return path before expiring the cookie that carries it.
    const next = safeNextPath(jar.read(AUTH_NEXT_COOKIE));
    jar.expire(AUTH_NEXT_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: AUTH_NEXT_COOKIE_PATH });
    const landing = new URL(next, appOrigin);

    // R6: carry the sign-in page's choice with THIS sign-in's token, only now that the API has let the person in.
    const previous = result.data.profile.localePref;
    let wroteUnsaved = false;
    if (carry !== undefined && isLocale(carry) && carry !== previous) {
      const carried = await apiFetch('/me/locale', {
        baseUrl: apiInternalUrl,
        token: accessToken,
        method: 'POST',
        body: { locale: carry },
        schema: setLocaleResponseSchema,
      });
      if (carried.kind === 'ok') {
        landing.searchParams.set('outcome', 'locale_synced');
        landing.searchParams.set('from', previous ?? 'none');
      } else if (carried.kind === 'error' && carried.status === 403 && carried.code === 'account.disabled') {
        // Refused between the two calls: no session for a refused account survives.
        await signOutLocally(supabase, jar, secure);
        expireUnsaved(jar, secure);
        return giveUp('disabled');
      } else {
        writeUnsaved(jar, carry, secure);
        wroteUnsaved = true;
        landing.searchParams.set('outcome', 'locale_not_saved');
      }
    }
    // Whoever sat here before took their unsaved choice with them.
    if (!wroteUnsaved) expireUnsaved(jar, secure);
    return jar.applyTo(seeOther(landing.toString(), appOrigin));
  }

  // The API refused this person, or could not answer. Undo the session we just created, then say why.
  const outcome = refusalOutcome(result);
  await signOutLocally(supabase, jar, secure);
  expireUnsaved(jar, secure);
  // A refusal names who was signing in, so their choice goes with them; a 5xx or an
  // unreachable API says nothing about the person, so the retry keeps it.
  if (outcome === 'not_allowed' || outcome === 'disabled') expireCarry(jar, secure);
  return giveUp(outcome);
}

/** Which page a refusal leads to (R4, R11). Every 503 is retryable, so it is `unexpected`, never `session_ended`. */
function refusalOutcome(result: { kind: 'error'; status: number; code: string | null } | { kind: 'failure' }): Outcome {
  if (result.kind !== 'error') return 'unexpected';
  if (result.status === 403 && result.code === 'sign_in.not_allowed') return 'not_allowed';
  if (result.status === 403 && result.code === 'account.disabled') return 'disabled';
  return 'unexpected';
}
