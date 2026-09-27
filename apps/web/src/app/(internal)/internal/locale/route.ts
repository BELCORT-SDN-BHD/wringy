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
 * - **`choose`, no session cookie** for this project: the guest's choice — the
 *   guest cookie, the carry cookie (for a sign-in that starts within ten
 *   minutes, R6), the prompt cookie; any `wringy-locale-session` is expired.
 * - **`choose` with a session cookie**: `POST /me/locale` with the stored token,
 *   read as the probe reads it (no refresh). On success the session-choice
 *   cookie is expired — the account holds the choice now — and the prompt
 *   cookie is set. On a failure, what happens depends on the page that posted
 *   (below).
 *
 * ## The page that posted decides the fallback; the API decides the account
 *
 * A choice made inside a session is saved to that session's account at once,
 * wherever it was made (the founder's ruling: a signed-in choice is saved). The
 * API is what says whether there is such a session: the handler asks it with
 * the token the browser holds and never guesses from the page.
 *
 * The page decides what happens when the API says no, and what a success must
 * also write. `proxy.ts` renders the sign-in page, the not-found page, `/auth/…`
 * and every path outside the build without a session check, so those pages
 * resolve as signed out whatever the jar holds (R3); `rendersSignedOut`
 * (`lib/auth/internal-paths.ts`, the module the proxy routes by) names them from
 * `next`, which for a path the proxy rewrites is still what the address bar —
 * and so the client's `usePathname()` — shows.
 *
 * - **An ordinary page**: a failure writes `wringy-locale-session` (the language
 *   is switched, the preference is not saved, the page offers Retry) with the
 *   reason. The guest cookie is never written for a signed-in choice.
 * - **A page that renders signed out**: a success also writes the guest cookie,
 *   because that page reads the guest's order and must switch too, and expires
 *   any carry, which could only take an older choice into the next sign-in. A
 *   refusal or failure of any kind (401, `session.revoked`, 403, 5xx,
 *   unreachable, no usable token) is the guest's choice, exactly as with no
 *   session cookie at all: guest, carry and prompt cookies, and never
 *   `wringy-locale-session`, which such a page would never show — the choice
 *   would be invisible and lost. It lands in an account only through the carry,
 *   with the token of the sign-in that follows (R6).
 *
 * On a shared device the session in the jar may be somebody else's: a choice
 * made over it is saved to that account, exactly as a header switch inside the
 * same session on `/internal` would be (M2-02's accepted residual of a session
 * left open). A stale or revoked one saves nothing: the API refuses it.
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
 * `/auth/end-session` for a disabled account on an ordinary page.
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
import { rendersSignedOut } from '@/lib/auth/internal-paths';
import { safeNextPath } from '@/lib/auth/next-path';
import { noStore } from '@/lib/auth/no-store';
import { cookieJar, errorResponse, guardRequest, seeOther } from '@/lib/auth/route-support';
import { holdsSessionCookie, isSecureOrigin, readStoredAccessToken } from '@/lib/auth/supabase-server';
import { expireCarry, expireUnsaved, writeCarry, writeGuestChoice, writePromptDone, writeUnsaved } from '@/lib/locale/cookies';

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

  /** The guest's choice in this browser, carried into a sign-in that starts within ten minutes (R4, R6). */
  const asGuest = (): NextResponse => {
    writeGuestChoice(jar, chosen, secure);
    writeCarry(jar, chosen, secure);
    expireUnsaved(jar, secure);
    return json ? reply({ switched: true, locale: chosen, scope: 'guest', saved: true }) : backTo('locale_switched');
  };

  if (!holdsSessionCookie(supabaseUrl, (await jar.adapter.getAll()) ?? [])) return asGuest();

  // The API decides the account; the page that posted decides the fallback (see the header).
  const signedOutPage = rendersSignedOut(next);
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
    if (signedOutPage) {
      // That page renders the guest's order, so it switches only through the guest cookie; an older carry would
      // take a superseded choice into the next sign-in.
      writeGuestChoice(jar, chosen, secure);
      expireCarry(jar, secure);
    }
    return json ? reply({ switched: true, locale: chosen, scope: 'account', saved: true }) : backTo('locale_saved');
  }

  // A page rendered signed out never shows an unsaved choice: it would be invisible there, and lost.
  if (signedOutPage) return asGuest();

  writeUnsaved(jar, chosen, secure);
  if (json) return reply({ switched: true, locale: chosen, scope: 'account', saved: false, reason });
  if (reason === 'account_disabled') return jar.applyTo(seeOther(END_SESSION_PATH, appOrigin));
  return backTo('locale_not_saved');
}
