/**
 * The language switch's decisions, as pure functions (M2-04;
 * m2-04-code-review.md R4, R5 rev 2). `locale-switch-provider.tsx` owns the
 * fetch, the refresh and the navigation; this module decides which of them
 * happen, so the queue, the echo rule and the refused-storage rule are unit
 * tests rather than browser rows.
 *
 * The switch is server-authoritative. The client never holds another
 * language's catalogue and never re-renders on its own: it posts the choice to
 * `POST /internal/locale` and, when the answer says the server wrote it, asks
 * for one `router.refresh()`, which re-resolves on the server and commits every
 * node — server text, client text, `<html lang>` — at once. So:
 *
 * - **One request in flight, one pending value.** A choice made while a request
 *   is in flight replaces the pending value rather than queueing behind it;
 *   when the in-flight answer arrives it is stale — nothing is announced or
 *   refreshed — and the newest choice is posted.
 * - **The echo rule.** The answer names the locale that request wrote; only an
 *   answer whose locale is the one this client last asked for is acted on.
 * - **Refused storage.** After a guest answer the browser must hold
 *   `wringy-locale=<locale>`; if it does not, the server cannot render the new
 *   language, so the client says the browser refused and does not refresh — one
 *   language everywhere beats two.
 * - **A failed request** (transport, a `guardRequest` refusal, an unreadable
 *   body, a redirect) wrote nothing: the old language stays and the live region
 *   says it could not switch.
 */

import { isLocale, type Locale } from '@/i18n/config';

/** The Route Handler every language control posts to. */
export const LOCALE_ENDPOINT = '/internal/locale';

/** Why a signed-in choice switched the language but did not reach the account (R4, R12). */
export const SWITCH_REASONS = ['unavailable', 'unexpected', 'session_ended', 'account_disabled'] as const;
export type SwitchReason = (typeof SWITCH_REASONS)[number];

export type SwitchScope = 'account' | 'guest';

/** The handler's JSON answer to a `choose` (R4). `locale` echoes what this request wrote. */
export interface SwitchedBody {
  readonly switched: true;
  readonly locale: Locale;
  readonly scope: SwitchScope;
  readonly saved: boolean;
  readonly reason?: SwitchReason;
}

/** The handler's JSON answer to a `skip`: nothing is switched and nothing is saved. */
export interface SkippedBody {
  readonly skipped: true;
}

/** What the live region says, as `data-result`. Empty when nothing has happened yet. */
export type LiveResult = 'saved-account' | 'saved-guest' | 'not-saved' | 'not-switched' | 'refused' | 'pending' | '';

export interface SwitchState {
  /** The value of the request in flight, or null. */
  readonly inFlight: Locale | null;
  /** The newest choice made while a request was in flight; posted when it settles. */
  readonly queued: Locale | null;
  /** What the control shows until the server's own answer renders: the latest choice, or null. */
  readonly shown: Locale | null;
  readonly result: LiveResult;
  /** The reason of a `not-saved` result. */
  readonly reason: SwitchReason | null;
}

export const IDLE: SwitchState = { inFlight: null, queued: null, shown: null, result: '', reason: null };

/** One answer, as the client reads it. */
export type SwitchAnswer =
  | { readonly kind: 'switched'; readonly locale: Locale; readonly scope: SwitchScope; readonly saved: boolean; readonly reason: SwitchReason | null }
  | { readonly kind: 'failed' };

/** What the provider does once an answer has been read. */
export type SwitchEffect = 'refresh' | 'end-session' | 'none';

export interface Step {
  readonly state: SwitchState;
  /** A value to post now, or null. */
  readonly post: Locale | null;
  readonly effect: SwitchEffect;
}

/** A choice. Posted at once when nothing is in flight; otherwise it replaces the pending value. */
export function choose(state: SwitchState, locale: Locale): Step {
  if (state.inFlight !== null) {
    return { state: { ...state, queued: locale, shown: locale, result: 'pending', reason: null }, post: null, effect: 'none' };
  }
  return {
    state: { inFlight: locale, queued: null, shown: locale, result: 'pending', reason: null },
    post: locale,
    effect: 'none',
  };
}

/**
 * The in-flight request's answer. `guestStored(locale)` says whether the browser
 * now holds the guest cookie with that value (`document.cookie` in the provider).
 */
export function settle(state: SwitchState, answer: SwitchAnswer, guestStored: (locale: Locale) => boolean): Step {
  const asked = state.inFlight;

  // A newer choice replaced this one: the answer is stale whatever it says.
  if (state.queued !== null) {
    return {
      state: { ...state, inFlight: state.queued, queued: null, result: 'pending', reason: null },
      post: state.queued,
      effect: 'none',
    };
  }

  const settled = { inFlight: null, queued: null } as const;

  // Nothing was written, or not what this client asked for: the old language stays.
  if (answer.kind === 'failed' || answer.locale !== asked) {
    return { state: { ...settled, shown: null, result: 'not-switched', reason: null }, post: null, effect: 'none' };
  }

  if (answer.scope === 'guest') {
    if (!guestStored(answer.locale)) {
      return { state: { ...settled, shown: null, result: 'refused', reason: null }, post: null, effect: 'none' };
    }
    return { state: { ...settled, shown: answer.locale, result: 'saved-guest', reason: null }, post: null, effect: 'refresh' };
  }

  if (answer.saved) {
    return { state: { ...settled, shown: answer.locale, result: 'saved-account', reason: null }, post: null, effect: 'refresh' };
  }

  // Switched, not saved. A disabled account leaves through end-session; every other
  // reason re-renders, and the server shows the unsaved notice with its Retry.
  const reason = answer.reason ?? 'unexpected';
  return {
    state: { ...settled, shown: answer.locale, result: 'not-saved', reason },
    post: null,
    effect: reason === 'account_disabled' ? 'end-session' : 'refresh',
  };
}

const isReason = (value: unknown): value is SwitchReason =>
  typeof value === 'string' && (SWITCH_REASONS as readonly string[]).includes(value);

/** The handler's answer, read defensively: anything but a 200 with the R4 shape is a failure. */
export function answerOf(status: number, body: unknown): SwitchAnswer {
  if (status !== 200 || body === null || typeof body !== 'object') return { kind: 'failed' };
  const { switched, locale, scope, saved, reason } = body as Record<string, unknown>;
  if (switched !== true || typeof locale !== 'string' || !isLocale(locale)) return { kind: 'failed' };
  if ((scope !== 'account' && scope !== 'guest') || typeof saved !== 'boolean') return { kind: 'failed' };
  return { kind: 'switched', locale, scope, saved, reason: isReason(reason) ? reason : null };
}

/** The form body of a choice or a skip, as the no-JS form would post it. */
export function switchForm(intent: 'choose' | 'skip', locale: Locale, next: string): URLSearchParams {
  return new URLSearchParams({ intent, locale, next });
}
