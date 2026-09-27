'use client';

/**
 * The header's language switcher, on every internal page (M2-04;
 * m2-04-code-review.md R5 rev 2, R10).
 *
 * A plain form first: a `NativeSelect` of the three languages — each by its own
 * name, each option carrying its `lang`, no flags, Malay never "Indonesian" —
 * and an Apply button, posting to `POST /internal/locale` with the page's
 * pathname as `next`, so it works before hydration and without JavaScript. Once
 * hydrated the Apply button is hidden and a `change` switches in place through
 * `LocaleSwitchProvider`. Its accessible name is `common.shell.languageLabel`,
 * its own: the prompt and the Language card name their selects themselves.
 *
 * The polite live region beside it says what the last switch did, in the
 * language the page is in once it has re-rendered.
 */

import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { LOCALES, isLocale, type Locale } from '@/i18n/config';

import { useHydrated } from './hydrated';
import { LOCALE_ENDPOINT, type LiveResult } from './locale-switch-logic';
import { useLocaleSwitch } from './locale-switch-provider';

/** The live region's sentence per result (`internal.locale.live.*`). */
const LIVE_KEYS: Record<Exclude<LiveResult, ''>, string> = {
  pending: 'pending',
  'saved-account': 'savedAccount',
  'saved-guest': 'savedGuest',
  'not-saved': 'notSaved',
  'not-switched': 'notSwitched',
  refused: 'refused',
};

export function LocaleSwitcher() {
  const t = useTranslations('internal.locale');
  const common = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { state, refreshing, choose } = useLocaleSwitch();

  // The latest choice while it is in flight or its re-render is committing; the server's language otherwise.
  const busy = state.inFlight !== null || state.queued !== null || refreshing;
  const shown = busy && state.shown !== null ? state.shown : locale;

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
          if (typeof chosen === 'string' && isLocale(chosen)) choose(chosen);
        }}
      >
        <input type="hidden" name="intent" value="choose" />
        <input type="hidden" name="next" value={pathname} />
        <NativeSelect
          name="locale"
          size="sm"
          value={shown}
          onChange={(event) => {
            if (isLocale(event.target.value)) choose(event.target.value);
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
        <Button type="submit" size="sm" variant="outline" hidden={hydrated} data-testid="locale-switcher-apply">
          {t('apply')}
        </Button>
      </form>
    </div>
  );
}
