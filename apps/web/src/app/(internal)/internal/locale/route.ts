/**
 * `POST /internal/locale`: every language control's one write path (M2-04;
 * m2-04-code-review.md R4 rev 2). The header switcher, the first-visit prompt,
 * the Language card, the unsaved notice's Retry and the synced notice's Undo
 * all post here: with JavaScript as a `fetch` asking for JSON, without it as a
 * plain form.
 *
 * The order is M2-02's: `guardRequest` (a demo origin has no such endpoint, a
 * misconfigured one answers 503, a cross-site post 403, before anything else is
 * read), then the form, then the work. Fields: `intent` (`choose` | `skip`),
 * `locale` (one of the three; else 400 and nothing is written) and `next` (the
 * page to return to, as a pathname).
 *
 * - **`skip`** writes the prompt cookie and nothing else: a skip records no
 *   preference in any scope, so a signed-in skip leaves `locale_pref` NULL.
 * - **`choose`, signed out** (no session cookie for this project, **or a post
 *   from a page that renders signed out**, see below): the guest cookie, the
 *   carry cookie (for a sign-in that starts within ten minutes, R6), the prompt
 *   cookie; any `wringy-locale-session` is expired.
 * - **`choose`, signed in**: `POST /me/locale` with the stored token, read as the
 *   probe reads it (no refresh). On success the session-choice cookie is
 *   expired — the account holds the choice now — and the prompt cookie is set.
 *   On any failure `wringy-locale-session` is written instead (the language is
 *   switched, the preference is not saved) with the reason. The guest cookie is
 *   never written for a signed-in choice.
 *
 * ## The page that posted decides
 *
 * `proxy.ts` renders the sign-in page and the not-found page without a session
 * check, so they resolve as signed out whatever cookies the browser holds (R3).
 * A choice posted from one of them is the guest's, like everything else those
 * pages show: the handler never calls the API with the session cookie the
 * request arrived with, which on a shared device can be somebody else's, stale
 * or still valid. The choice lands in an account only through the carry cookie,
 * with the token of the sign-in that follows (R6). `next` names the page: the
 * sign-in path, the not-found path, or any path outside `/internal`, which the
 * proxy rewrites to the not-found page while the address bar — and so the
 * client's `usePathname()` — keeps what the visitor typed.
 *
 * ## JSON or a redirect
 *
 * A request asked for JSON when its `Sec-Fetch-Mode` is not `navigate` **and**
 * its `Accept` lists the literal `application/json` (a navigation's `Accept`
 * ends in the any-type wildcard, so a media-range match would answer a form
 * with JSON). Such a
 * request never gets a 3xx, on any branch: `fetch` follows a redirect silently,
 * applies its `Set-Cookie`, and then fails to read the HTML (record §1). Its
 * answer is `200 { switched: true, locale, scope, saved, reason? }` — `locale`
 * echoes what this request wrote, so the client can tell a stale answer — or
 * `200 { skipped: true }`. Everything else is a form, answered 303 to `next` with
 * `?outcome=locale_saved | locale_switched | locale_not_saved`, or to
 * `/auth/end-session` for a disabled account.
 *
 * `next` is reduced by `safeNextPath`, then to its **pathname**, then by
 * `safeNextPath` again: the query and the fragment are dropped, so an invitation
 * token in the accept page's URL is never rebuilt into a redirect (the no-JS
 * switch there returns to the accept page without its token; recorded in
 * known-issues), and a dot segment cannot leave a protocol-relative path behind.
 * The redirect sets that pathname on a URL of `APP_ORIGIN` and the outcome with
 * `searchParams.set`, never by concatenation, so its origin cannot change.
 *
 * Every response is `noStore()`.
 */

import { NextResponse } from 'next/server';

import { setLocaleResponseSchema } from '@wringy/contracts';
import { isLocale, type Locale } from '@/i18n/config';
import { apiFetch, type ApiResult } from '@/lib/auth/api-client';
import { safeNextPath } from '@/lib/auth/next-path';
import { noStore } from '@/lib/auth/no-store';
import { SIGN_IN_PATH } from '@/lib/auth/outcomes';
import { cookieJar, errorResponse, guardRequest, seeOther, type CookieJar } from '@/lib/auth/route-support';
import { isSecureOrigin, isSessionCookieName, readStoredAccessToken } from '@/lib/auth/supabase-server';
import { expireUnsaved, writeCarry, writeGuestChoice, writePromptDone, writeUnsaved } from '@/lib/locale/cookies';

import type { SkippedBody, SwitchedBody, SwitchReason } from '../locale-switch-logic';
import { END_SESSION_PATH } from '../org-paths';
import type { LocaleOutcome } from '../outcomes';

/** Just the headers the JSON test reads, so a plain `Request` fits. */
interface HeaderBearing {
  readonly headers: { get(name: string): string | null };
}

/** True when the request asked for JSON rather than being a form navigation (R4). */
export function asksForJson(request: HeaderBearing): boolean {
  if (request.headers.get('sec-fetch-mode') === 'navigate') return false;
  const accept = request.headers.get('accept') ?? '';
  return accept.split(',').some((range) => range.split(';')[0]?.trim().toLowerCase() === 'application/json');
}

/**
 * The pathname of a safe return path: no query and no fragment ever survive (R4).
 *
 * `safeNextPath` runs again on the reduced pathname, because resolving dot
 * segments can turn a value it accepted into a protocol-relative path —
 * `/internal/..//evil.example` and `/%2e%2e//evil.example` both reduce to
 * `//evil.example` — which any later `new URL(path, origin)` reads as a host.
 */
export function returnPathname(raw: string, appOrigin: string): string {
  return safeNextPath(new URL(safeNextPath(raw === '' ? null : raw), appOrigin).pathname);
}

/** The page `proxy.ts` rewrites every path outside `/internal` and `/auth` to (its `NOT_FOUND_PATH`). */
const NOT_FOUND_PATH = '/internal/__not-found';

/**
 * Whether the page at `pathname` renders signed out whatever the cookie jar holds:
 * the two pages the proxy passes through without a session check, and every path
 * outside `/internal`, which it rewrites to one of them.
 */
export function rendersSignedOut(pathname: string): boolean {
  if (pathname === SIGN_IN_PATH || pathname === NOT_FOUND_PATH) return true;
  return pathname !== '/internal' && !pathname.startsWith('/internal/');
}

/** Why a signed-in save failed, or null when it did not (R4, R12). */
export function reasonOf(result: ApiResult<unknown>): SwitchReason | null {
  if (result.kind === 'ok') return null;
  if (result.kind === 'failure') return result.failure === 'api-unavailable' ? 'unavailable' : 'unexpected';
  if (result.status === 401) return 'session_ended';
  if (result.status === 403 && result.code === 'account.disabled') return 'account_disabled';
  return 'unexpected';
}

async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null; // Not a form body: every field reads as empty, which is a 400.
  }
}

function field(form: FormData | null, name: string): string {
  const value = form?.get(name);
  return typeof value === 'string' ? value : '';
}

const badRequest = (): NextResponse => errorResponse(400, 'bad_request', 'The language choice was not understood.');

export async function POST(request: Request): Promise<NextResponse> {
  const guard = guardRequest(request);
  if (!guard.ok) return guard.response;

  const { appOrigin, supabaseUrl, apiInternalUrl } = guard.env;
  const secure = isSecureOrigin(appOrigin);
  const json = asksForJson(request);
  const form = await readForm(request);
  const intent = field(form, 'intent');
  if (intent !== 'choose' && intent !== 'skip') return badRequest();

  const locale = field(form, 'locale');
  if (intent === 'choose' && !isLocale(locale)) return badRequest();
  const next = returnPathname(field(form, 'next'), appOrigin);

  const jar = await cookieJar();

  /**
   * A 303 to `next`, with the outcome set through `searchParams` when there is one.
   * The path is set on a URL of this origin rather than resolved against it, so
   * no value of `next` can change the host, whatever `returnPathname` let through.
   */
  const backTo = (outcome: Exclude<LocaleOutcome, 'locale_synced'> | null): NextResponse => {
    const target = new URL('/', appOrigin);
    target.pathname = next;
    if (outcome !== null) target.searchParams.set('outcome', outcome);
    return jar.applyTo(seeOther(target.toString(), appOrigin));
  };
  const reply = (body: SwitchedBody | SkippedBody): NextResponse => jar.applyTo(noStore(NextResponse.json(body)));

  writePromptDone(jar, secure);
  if (intent === 'skip') return json ? reply({ skipped: true }) : backTo(null);

  const chosen = locale as Locale;
  // The page that posted decides: a page rendered signed out never saves to the account whose cookie arrived.
  if (rendersSignedOut(next) || !(await signedIn(jar, supabaseUrl))) {
    writeGuestChoice(jar, chosen, secure);
    writeCarry(jar, chosen, secure);
    expireUnsaved(jar, secure);
    return json ? reply({ switched: true, locale: chosen, scope: 'guest', saved: true }) : backTo('locale_switched');
  }

  const token = await readStoredAccessToken(supabaseUrl, (name) => jar.read(name));
  const reason =
    token === null
      ? 'session_ended'
      : reasonOf(
          await apiFetch('/me/locale', {
            baseUrl: apiInternalUrl,
            token,
            method: 'POST',
            body: { locale: chosen },
            schema: setLocaleResponseSchema,
          }),
        );

  if (reason === null) {
    expireUnsaved(jar, secure);
    return json ? reply({ switched: true, locale: chosen, scope: 'account', saved: true }) : backTo('locale_saved');
  }

  writeUnsaved(jar, chosen, secure);
  if (json) return reply({ switched: true, locale: chosen, scope: 'account', saved: false, reason });
  if (reason === 'account_disabled') return jar.applyTo(seeOther(END_SESSION_PATH, appOrigin));
  return backTo('locale_not_saved');
}

/** Whether the browser holds this project's session cookie: the signed-in branch, whatever the token then says. */
async function signedIn(jar: CookieJar, supabaseUrl: string): Promise<boolean> {
  const cookies = (await jar.adapter.getAll()) ?? [];
  return cookies.some(({ name }) => isSessionCookieName(supabaseUrl, name));
}
