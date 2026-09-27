'use client';

/**
 * The in-place language switch's interaction (M2-04; m2-04-code-review.md R5
 * rev 2): one client component mounted by the internal layout around every
 * internal page, which the header switcher, the first-visit prompt and the
 * notices' Retry and Undo all go through.
 *
 * It owns the request and nothing else. A choice is `POST /internal/locale`
 * (`fetch`, `Accept: application/json`, `redirect: 'error'` as a backstop: the
 * handler never answers JSON with a redirect); the decisions — one request in
 * flight and a single pending value a newer choice replaces, the echo rule, the
 * refused-storage rule — are `locale-switch-logic.ts`'s. When the answer says
 * the server wrote the choice, one `router.refresh()` re-renders the page on the
 * server in the new language: every node in one RSC commit, typed input, a
 * `NativeSelect` choice and a minted request key kept (executed, record §1).
 * Nothing here is keyed by locale, so nothing below it remounts. Before that
 * refresh a language outcome in the URL (`?outcome=locale_*`, `from`) is
 * stripped with `history.replaceState`: it described the switch that landed
 * here, not this one. Next keys a page by its segment without the search, so the
 * stripped URL re-renders the same page rather than mounting a new one.
 *
 * A disabled account leaves through `/auth/end-session`; an expired token
 * (`session_ended`) re-renders, which renews the session through the proxy and
 * shows the server-rendered "not saved · Retry" notice.
 */

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import type { Locale } from '@/i18n/config';
import { guestCookieHolds } from '@/lib/locale/cookies';

import {
  IDLE,
  LOCALE_ENDPOINT,
  answerOf,
  choose as chooseStep,
  settle,
  switchForm,
  withoutLocaleOutcome,
  type Step,
  type SwitchAnswer,
  type SwitchState,
} from './locale-switch-logic';
import { END_SESSION_PATH } from './org-paths';

export interface LocaleSwitch {
  readonly state: SwitchState;
  /** The refresh after a switch has not committed yet. */
  readonly refreshing: boolean;
  choose(locale: Locale): void;
  /** Answer the prompt without choosing; `locale` is only the form field's value. */
  skip(locale: Locale): void;
}

const LocaleSwitchContext = createContext<LocaleSwitch | null>(null);

export function useLocaleSwitch(): LocaleSwitch {
  const value = useContext(LocaleSwitchContext);
  if (value === null) throw new Error('useLocaleSwitch() is used outside <LocaleSwitchProvider>.');
  return value;
}

/** POST to the handler as the client, asking for JSON. Never throws. */
async function postChoice(body: URLSearchParams): Promise<{ status: number; json: unknown } | null> {
  try {
    const response = await fetch(LOCALE_ENDPOINT, {
      method: 'POST',
      body,
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return { status: response.status, json };
  } catch {
    return null; // Transport failure, or a redirect: nothing was written by this client's reading.
  }
}

export function LocaleSwitchProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<SwitchState>(IDLE);
  // The machine's current state for the async continuations; the render reads `state`.
  const machine = useRef<SwitchState>(IDLE);
  const [refreshing, startRefresh] = useTransition();

  /** Apply one step of the machine: its state, its effect, and the value it says to post next. */
  function run(step: Step): void {
    machine.current = step.state;
    setState(step.state);
    if (step.effect === 'end-session') window.location.assign(END_SESSION_PATH);
    else if (step.effect === 'refresh') refresh();
    if (step.post !== null) void send(step.post);
  }

  /**
   * Re-render on the server, first consuming a language outcome the URL still
   * carries (`withoutLocaleOutcome`): a refresh re-renders the same URL, so the
   * alert of the switch that landed here would otherwise survive beside what
   * this one did. Next patches `history.replaceState` into its router, so the
   * refresh that follows asks for the stripped URL and `useSearchParams` sees it.
   */
  function refresh(): void {
    const consumed = withoutLocaleOutcome(window.location.href);
    if (consumed !== null) window.history.replaceState(null, '', consumed);
    startRefresh(() => router.refresh());
  }

  async function send(locale: Locale): Promise<void> {
    const answered = await postChoice(switchForm('choose', locale, pathname));
    const answer: SwitchAnswer = answered === null ? { kind: 'failed' } : answerOf(answered.status, answered.json);
    run(settle(machine.current, answer, (value) => guestCookieHolds(document.cookie, value)));
  }

  const value: LocaleSwitch = {
    state,
    refreshing,
    choose: (locale) => run(chooseStep(machine.current, locale)),
    skip: (locale) => {
      void postChoice(switchForm('skip', locale, pathname)).then((answered) => {
        if (answered !== null && answered.status === 200) startRefresh(() => router.refresh());
      });
    },
  };

  return <LocaleSwitchContext.Provider value={value}>{children}</LocaleSwitchContext.Provider>;
}
