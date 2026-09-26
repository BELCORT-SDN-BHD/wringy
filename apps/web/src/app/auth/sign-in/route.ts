/**
 * `POST /auth/sign-in`: start the Google sign-in (M2-02 R1, R10; §3 step 2).
 *
 * The order is R1's: mode guard, Origin rule, then the work. Nothing upstream is
 * called until both guards pass, so a cross-site post costs one 403 and no
 * Supabase request.
 *
 * `next` is read from the form and kept in the short-lived `wringy-auth-next`
 * cookie rather than added to `redirectTo`: `redirectTo` stays the constant
 * `APP_ORIGIN + '/auth/callback'`, so one exact entry in Supabase's redirect
 * allow-list works in every environment. The value is only validated when it is
 * used (`safeNextPath` in the callback), so an attacker-chosen path can never
 * leave `APP_ORIGIN` even if it reaches the cookie.
 *
 * `skipBrowserRedirect: true` makes auth-js return the authorize URL instead of
 * trying to navigate, which is the only sensible thing on a server; this handler
 * then answers 303 to it. The PKCE verifier lands in an `httpOnly` cookie through
 * the jar's `setAll`, and `noStore()` is applied to every response because
 * `@supabase/ssr` does not send its cache headers on the verifier write (R20).
 *
 * There is no `GET`: Next answers 405 for an unexported method, which is §4.5
 * rule 3 by construction.
 */

import type { NextResponse } from 'next/server';

import { signInPath } from '@/lib/auth/outcomes';
import { cookieJar, guardRequest, seeOther } from '@/lib/auth/route-support';
import { createRequestSupabase, isSecureOrigin } from '@/lib/auth/supabase-server';
import { AUTH_NEXT_COOKIE, AUTH_NEXT_COOKIE_MAX_AGE_SECONDS, AUTH_NEXT_COOKIE_PATH } from '@/lib/auth/wire';

export async function POST(request: Request): Promise<NextResponse> {
  const guard = guardRequest(request);
  if (!guard.ok) return guard.response;

  const { appOrigin, supabaseUrl, publishableKey } = guard.env;
  const secure = isSecureOrigin(appOrigin);
  const jar = await cookieJar();

  // The form field, stored as sent. It is validated where it is consumed.
  let next: string | null = null;
  try {
    const form = await request.formData();
    const value = form.get('next');
    if (typeof value === 'string' && value !== '') next = value;
  } catch {
    // No form body, or an unreadable one: sign in and come back to the default.
  }

  // Scoped to /auth and ten minutes: it is only ever read by the callback, and a
  // stale one must not outlive the sign-in it belongs to.
  if (next !== null) {
    jar.set(AUTH_NEXT_COOKIE, next, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: AUTH_NEXT_COOKIE_PATH,
      maxAge: AUTH_NEXT_COOKIE_MAX_AGE_SECONDS,
    });
  }

  const supabase = createRequestSupabase({
    supabaseUrl,
    publishableKey,
    secure,
    cookies: jar.adapter,
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${appOrigin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error !== null || typeof data?.url !== 'string' || data.url === '') {
    // Nothing to send the person to. Say so on the page rather than redirecting
    // into a provider URL that may not exist.
    return jar.applyTo(seeOther(signInPath({ outcome: 'unexpected' }), appOrigin));
  }

  // `data.url` is Supabase's absolute authorize URL, so `new URL(url, appOrigin)`
  // resolves to it unchanged; `appOrigin` is only the base for the relative paths
  // above. This is the one redirect that deliberately leaves this origin.
  return jar.applyTo(seeOther(data.url, appOrigin));
}
