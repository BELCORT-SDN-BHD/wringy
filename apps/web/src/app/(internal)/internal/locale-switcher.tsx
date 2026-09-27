'use client';

/**
 * The header's language switcher, on every internal page (M2-04;
 * m2-04-code-review.md R5 rev 2, R10).
 *
 * A plain form: a `NativeSelect` of the three languages — each by its own name,
 * each option carrying its `lang`, no flags, Malay never "Indonesian" — and an
 * Apply button, posting to `POST /internal/locale` with the page's pathname as
 * `next`, so it works before hydration and without JavaScript. Once hydrated the
 * form's submit — Apply, by pointer or keyboard — switches in place through
 * `LocaleSwitchProvider`; the button stays visible.
 *
 * Choosing in the select only moves the selection. A closed native select fires
 * `change` on every arrow key and type-ahead press (Chromium on Windows and
 * Linux), so switching on `change` would apply — and, signed in, save — every
 * language a keyboard or screen-reader user passes on the way to the one they
 * want, re-rendering the page between presses (WCAG 3.2.2; localization-v1's
 * "明确更改"). The select stays controlled: the selection is local until Apply,
 * the in-flight choice while it is being switched, the server's language
 * otherwise. Its accessible name is `common.shell.languageLabel`, its own: the
 * prompt and the Language card name their selects themselves.
 *
 * The polite live region beside it says what the last switch did, in the
 * language the page is in once it has re-rendered, and when the prompt's Skip
 * could not be recorded. The select carries `LOCALE_SWITCHER_ID`: focus comes
 * here when a refresh is about to remove the control that had it.
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { LOCALES, isLocale, type Locale } from '@/i18n/config';

import { LOCALE_ENDPOINT, LOCALE_SWITCHER_ID, type LiveResult } from './locale-switch-logic';
import { useLocaleSwitch } from './locale-switch-provider';

/** The live region's sentence per result (`internal.locale.live.*`). */
const LIVE_KEYS: Record<Exclude<LiveResult, ''>, string> = {
  pending: 'pending',
  'saved-account': 'savedAccount',
  'saved-guest': 'savedGuest',
  'not-saved': 'notSaved',
  'not-switched': 'notSwitched',
  refused: 'refused',
  'not-skipped': 'notSkipped',
};

/** A selection not applied yet, and the language the page was in when it was made. */
interface Draft {
  readonly value: Locale;
  readonly over: Locale;
}

export function LocaleSwitcher() {
  const t = useTranslations('internal.locale');
  const common = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const { state, refreshing, choose } = useLocaleSwitch();
  const [draft, setDraft] = useState<Draft | null>(null);

  // A selection made in this language and not applied yet; else the latest choice
  // while it is in flight or its re-render is committing; else the server's language.
  // A draft made before the page changed language is dropped with that language.
  const busy = state.inFlight !== null || state.queued !== null || refreshing;
  const shown = draft !== null && draft.over === locale ? draft.value : busy && state.shown !== null ? state.shown : locale;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <p
        data-testid="locale-live"
        role="status"
        aria-live="polite"
        data-result={state.result}
        className="min-w-0 text-right text-xs text-muted-foreground"
      >
        {state.result === '' ? null : t(`live.${LIVE_KEYS[state.result]}`)}
      </p>
      <form
        method="post"
        action={LOCALE_ENDPOINT}
        className="flex items-center gap-2"
        data-testid="locale-switcher-form"
        onSubmit={(event) => {
          event.preventDefault();
          const chosen = new FormData(event.currentTarget).get('locale');
          setDraft(null);
          if (typeof chosen === 'string' && isLocale(chosen)) choose(chosen);
        }}
      >
        <input type="hidden" name="intent" value="choose" />
        <input type="hidden" name="next" value={pathname} />
        <NativeSelect
          id={LOCALE_SWITCHER_ID}
          name="locale"
          size="sm"
          value={shown}
          onChange={(event) => {
            const value = event.target.value;
            if (isLocale(value)) setDraft({ value, over: locale });
          }}
          aria-label={common('shell.languageLabel')}
          data-testid="locale-switcher"
        >
          {LOCALES.map((code) => (
            <NativeSelectOption key={code} value={code} lang={code}>
              {common(`locale.${code}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" variant="outline" data-testid="locale-switcher-apply">
          {t('apply')}
        </Button>
      </form>
    </div>
  );
}
