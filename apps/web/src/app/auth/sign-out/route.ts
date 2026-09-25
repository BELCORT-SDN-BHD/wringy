/**
 * `POST /auth/sign-out`: end the session on this device (M2-02 R10, R20; §3
 * step 6; kickoff-package.md §4.6).
 *
 * `scope: 'local'` is passed explicitly because supabase-js defaults to
 * `global`. Signing every device out is not what "sign out" means here, and the
 * page says so in all three languages: 已退出此设备；其他设备上的登录不受影响.
 *
 * The library's result is inspected rather than trusted. `signOut()` can return
 * an error **without having cleared the cookies** — a retryable Auth-server
 * failure — and a browser left holding a session after being told it signed out
 * is the worst of the two failures. So on any error this handler expires every
 * `sb-*` cookie itself and says `signed_out_unconfirmed`: this device is signed
 * out, but the server could not confirm it revoked the session. The access token
 * stays valid until its own `exp` either way, which is why every fund-sensitive
 * command re-checks liveness in its transaction (R2, R8).
 *
 * There is no `GET`: Next answers 405 for an unexported method (§4.5 rule 3).
 */

import type { NextResponse } from 'next/server';

import { signInPath } from '@/lib/auth/outcomes';
import { cookieJar, guardRequest, seeOther } from '@/lib/auth/route-support';
import { createRequestSupabase, isSecureOrigin } from '@/lib/auth/supabase-server';

export async function POST(request: Request): Promise<NextResponse> {
  const guard = guardRequest(request);
  if (!guard.ok) return guard.response;

  const { appOrigin, supabaseUrl, publishableKey } = guard.env;
  const secure = isSecureOrigin(appOrigin);
  const jar = await cookieJar();

  const supabase = createRequestSupabase({ supabaseUrl, publishableKey, secure, cookies: jar.adapter });

  let confirmed = false;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    confirmed = error === null;
  } catch {
    confirmed = false;
  }

  // Whatever the library did or did not clear, make sure the browser keeps nothing.
  if (!confirmed) jar.expireSupabaseCookies(secure);

  return jar.applyTo(seeOther(signInPath({ outcome: confirmed ? 'signed_out' : 'signed_out_unconfirmed' }), appOrigin));
}
