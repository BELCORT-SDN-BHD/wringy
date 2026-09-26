/**
 * What every M2-02 route handler does before and around its own work (R1, R13,
 * R20), in one place so the four handlers cannot drift from each other.
 *
 * R1 fixes the order and this module is that order: the mode guard first (a demo
 * origin exposes no cookie-writing surface at all, so it must 404 before
 * anything else looks at the request), then the §4.5 Origin rule, then the work.
 *
 * It also owns the cookie jar. A route handler *may* write cookies through
 * `next/headers`, but these handlers buffer their writes and apply them to the
 * response they return instead, for two reasons: the Set-Cookie and the
 * `noStore()` headers then provably belong to the same response a test inspects,
 * and the sign-out path has to be able to expire cookies the library refused to
 * clear, which needs the writes in Wringy's own hands.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { internalAuthEnv, type InternalAuthEnv } from './env';
import { isInternalMode } from './mode';
import { noStore } from './no-store';
import { checkOrigin } from './origin';
import {
  isSupabaseAuthCookie,
  sessionCookieOptions,
  type RequestCookieAdapter,
  type RequestSupabase,
} from './supabase-server';

/** The error envelope the API uses, so the web speaks one shape everywhere. */
export function errorResponse(status: number, code: string, message: string): NextResponse {
  return noStore(NextResponse.json({ error: { code, message } }, { status }));
}

/**
 * The demo build's answer for every one of these routes (R13). A 404 and not a
 * 403: on a demo origin these endpoints do not exist, and saying so reveals
 * nothing about the internal build.
 */
export function notFound(): NextResponse {
  return errorResponse(404, 'not_found', 'This endpoint does not exist in this build.');
}

/** A rejected Origin (§4.5). Nothing upstream has been called at this point. */
export function forbidden(): NextResponse {
  return errorResponse(403, 'forbidden', 'This request did not come from this site.');
}

/**
 * The guard sequence. `ok: false` carries the response to return as-is, so a
 * handler reads as `const guard = await guardRequest(request); if (!guard.ok)
 * return guard.response;`.
 */
export type Guarded =
  | { readonly ok: true; readonly env: InternalAuthEnv }
  | { readonly ok: false; readonly response: NextResponse };

/** Just the headers the Origin rule reads, so a plain `Request` fits. */
interface OriginBearing {
  readonly headers: { get(name: string): string | null };
}

export function guardRequest(request: OriginBearing): Guarded {
  // 1. The mode, read non-throwing: the demo build has no such endpoint.
  if (!isInternalMode()) return { ok: false, response: notFound() };

  // 2. The environment. In internal mode the three variables are required, so a
  // failure here is a misconfigured deployment, not a demo one: 503, retryable,
  // and it names nothing but the condition.
  const env = internalAuthEnv();
  if (!env.ok) {
    return {
      ok: false,
      response: errorResponse(503, 'not_configured', 'This build is not configured for sign-in.'),
    };
  }

  // 3. The Origin rule. A rejected request never reaches Fastify or Supabase.
  if (checkOrigin(request, env.env.appOrigin) === 'rejected') return { ok: false, response: forbidden() };

  return { ok: true, env: env.env };
}

// --- Cookies ----------------------------------------------------------------

export interface BufferedCookie {
  readonly name: string;
  readonly value: string;
  readonly options: Record<string, unknown>;
}

/** The part of a response the jar writes to, so `NextResponse` fits without importing it here. */
interface CookieBearing {
  readonly cookies: { set(name: string, value: string, options?: Record<string, unknown>): unknown };
}

export interface CookieJar {
  /** The adapter to hand `createRequestSupabase`; its `getAll` reports the buffered writes too. */
  readonly adapter: RequestCookieAdapter;
  /** A cookie this request arrived with (not one buffered for the response). */
  read(name: string): string | undefined;
  /** Buffer a write. */
  set(name: string, value: string, options: Record<string, unknown>): void;
  /** Buffer an expiry (`maxAge: 0`) for a cookie, whether or not it arrived. */
  expire(name: string, options: Record<string, unknown>): void;
  /** Expire every `sb-*` cookie the browser would be left holding — arrived or buffered — for the sign-out fallback (R10). */
  expireSupabaseCookies(secure: boolean): void;
  /** True once anything has been buffered, which is what makes a response no-store. */
  wrote(): boolean;
  /** Apply every buffered write to `response`, then return it. */
  applyTo<T extends CookieBearing>(response: T): T;
}

/** A buffered write that takes a cookie away rather than giving it a value. */
function isExpiry({ value, options }: BufferedCookie): boolean {
  return value === '' || options.maxAge === 0;
}

/**
 * A jar over this request's cookies. Reads come from `next/headers`; writes are
 * buffered until `applyTo`.
 *
 * The jar keeps two views on purpose, because two different questions are asked
 * of it:
 *
 *  - `read` answers "what did the browser send?", which is what the return-path
 *    cookie and the probe's token read want.
 *  - `adapter.getAll` and `expireSupabaseCookies` answer "what will the browser
 *    hold once this response is applied?" — the incoming cookies with every
 *    buffered write laid over them, an expiry removing a name rather than giving
 *    it an empty value.
 *
 * The second view is not a nicety. `@supabase/ssr`'s `applyServerStorage` decides
 * what to remove with `removeCookies.filter((name) => currentByName.has(name))`,
 * where `currentByName` is built from exactly this `getAll`. A `getAll` that
 * reported only the incoming cookies would tell the library that the session it
 * just wrote through `setAll` does not exist, so `signOut()` would succeed while
 * removing nothing — and the refused callback (`sign_in.not_allowed`,
 * `account.disabled`, an unreachable API) would hand the browser a session for an
 * account the API refused, which is precisely what R10 and §3 step 3 forbid. The
 * sign-out handler never showed it, because there the session cookies do arrive
 * with the request.
 */
export async function cookieJar(): Promise<CookieJar> {
  const store = await cookies();
  const incoming = store.getAll().map(({ name, value }) => ({ name, value }));
  const buffered: BufferedCookie[] = [];

  const set = (name: string, value: string, options: Record<string, unknown>) => {
    buffered.push({ name, value, options });
  };

  /** The cookies the browser will hold after `applyTo`: the incoming ones, then every buffered write. */
  const effective = (): { name: string; value: string }[] => {
    const byName = new Map(incoming.map(({ name, value }) => [name, value]));
    for (const cookie of buffered) {
      if (isExpiry(cookie)) byName.delete(cookie.name);
      else byName.set(cookie.name, cookie.value);
    }
    return [...byName].map(([name, value]) => ({ name, value }));
  };

  return {
    adapter: {
      getAll: () => effective(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          set(name, value, options as Record<string, unknown>);
        }
      },
    },
    read: (name) => incoming.find((cookie) => cookie.name === name)?.value,
    set,
    expire: (name, options) => set(name, '', { ...options, maxAge: 0 }),
    expireSupabaseCookies: (secure) => {
      for (const { name } of effective()) {
        if (isSupabaseAuthCookie(name)) set(name, '', { ...sessionCookieOptions(secure), maxAge: 0 });
      }
    },
    wrote: () => buffered.length > 0,
    applyTo: (response) => {
      for (const { name, value, options } of buffered) response.cookies.set(name, value, options);
      return response;
    },
  };
}

/**
 * Drop the local session again, and make sure the browser keeps nothing.
 *
 * `scope: 'local'` is explicit because supabase-js defaults to `global`, and
 * signing every device out is not what a refusal on this one device should do
 * (R10). The library can return an error without having cleared anything (a
 * retryable Auth-server failure), so in that case the `sb-*` cookies are expired
 * by Wringy's own code: a browser must not keep a session the API will refuse.
 *
 * Shared by `GET /auth/callback` and `GET /auth/end-session`, which reach it for
 * the same reason — the API refused this account — and must not drift apart.
 *
 * Returns whether the library confirmed the sign-out, which is only ever used to
 * choose between the `signed_out` and `signed_out_unconfirmed` wording.
 */
export async function signOutLocally(supabase: RequestSupabase, jar: CookieJar, secure: boolean): Promise<boolean> {
  let confirmed = false;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    confirmed = error === null;
  } catch {
    confirmed = false;
  }
  if (!confirmed) jar.expireSupabaseCookies(secure);
  return confirmed;
}

/**
 * The redirect every handler answers a browser form with: **303**, so the
 * browser follows it with a GET and the POST is not repeated on a reload, with
 * the host taken from `APP_ORIGIN` and never from a request header.
 */
export function seeOther(path: string, appOrigin: string): NextResponse {
  return noStore(NextResponse.redirect(new URL(path, appOrigin), 303));
}
