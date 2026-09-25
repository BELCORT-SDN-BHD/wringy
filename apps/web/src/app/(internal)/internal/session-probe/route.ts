/**
 * `POST /internal/session-probe`: the thin proxy to the API's reserved
 * fund-sensitive stub (M2-02 R10; §3 step 5; M2-AC02/2).
 *
 * It exists to prove one thing end to end: a state-changing command re-checks
 * that the session is still live, inside its own transaction, so signing out in
 * one browser stops a command in another even while the old access token is
 * still inside its hour. This handler decides nothing — it forwards the token and
 * turns the API's answer into a result the page can show.
 *
 * ## How the token is read, and why not the obvious way
 *
 * `proxy.ts` passes non-GET requests through, so there is no
 * `x-wringy-access-token` header here; the token has to come from the session
 * cookie. Neither client accessor is safe for that:
 *
 *  - `getSession()` runs auth-js's `__loadSession`, which **refreshes** when the
 *    access token is within the 90 s expiry margin;
 *  - `getClaims()` called with no argument calls `getSession()` first, so it
 *    inherits the same refresh.
 *
 * A refresh inside a probe would rotate the refresh token, and whichever
 * concurrent response lost the race would leave the browser holding a dead one —
 * the isolation failure M2-AC02/2 is meant to catch. So the token is read
 * straight out of the cookie the library wrote, with the library's own public
 * helpers (`readStoredAccessToken` in `supabase-server.ts`: `combineChunks`,
 * `stringFromBase64URL`, `JSON.parse`). No Supabase client is created here at
 * all, so no refresh can happen, and this handler writes no cookies.
 *
 * The token is not verified locally: it is forwarded, and Fastify verifies it
 * against the JWKS as it does on every request. A cookie holding a forged token
 * therefore gets a 401 from the API, which is `unauthenticated` here.
 */

import type { NextResponse } from 'next/server';

import { sessionProbeResponseSchema } from '@wringy/contracts';

import { apiFetch, type ApiResult } from '@/lib/auth/api-client';
import { cookieJar, guardRequest, seeOther } from '@/lib/auth/route-support';
import { readStoredAccessToken } from '@/lib/auth/supabase-server';

/** What the page shows afterwards, as `/internal?probe=<result>`. */
export type ProbeResult = 'ok' | 'revoked' | 'unauthenticated' | 'unavailable';

export async function POST(request: Request): Promise<NextResponse> {
  const guard = guardRequest(request);
  if (!guard.ok) return guard.response;

  const { appOrigin, supabaseUrl, apiInternalUrl } = guard.env;
  const jar = await cookieJar();

  const token = await readStoredAccessToken(supabaseUrl, (name) => jar.read(name));
  if (token === null) return seeOther('/internal?probe=unauthenticated', appOrigin);

  const result = await apiFetch('/me/session/probe', {
    baseUrl: apiInternalUrl,
    token,
    method: 'POST',
    schema: sessionProbeResponseSchema,
  });

  return seeOther(`/internal?probe=${probeResultOf(result)}`, appOrigin);
}

/**
 * The API's answer as a result the page can name (R9).
 *
 * `session.revoked` is the one that proves the guard. Every 503 —
 * `session_check_unavailable` when the liveness check itself could not answer,
 * `database_unavailable` — is `unavailable` and never `revoked`: a transient blip
 * must not tell someone their session ended. `account.disabled` is `revoked` too:
 * from this page's point of view the session no longer works, and the `/internal`
 * read redirects to the disabled page on the next load.
 */
export function probeResultOf(result: ApiResult<unknown>): ProbeResult {
  if (result.kind === 'ok') return 'ok';
  if (result.kind === 'failure') return 'unavailable';
  if (result.status === 401) return result.code === 'session.revoked' ? 'revoked' : 'unauthenticated';
  if (result.status === 403) return result.code === 'account.disabled' ? 'revoked' : 'unauthenticated';
  return 'unavailable';
}
