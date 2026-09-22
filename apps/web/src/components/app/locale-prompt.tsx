'use client';

/**
 * First-visit language prompt.
 *
 * phase-0/foundation/localization-v1.md specifies exactly this shape: a light
 * inline prompt rather than a full-screen gate, the three names in their own
 * language, a preview before committing, and a skip that does **not** record a
 * preference. The copy is the approved draft from that file.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { LocaleSelect } from '@/components/app/locale-select';
import { Button } from '@/components/ui/button';
import { useDemoState, useDispatch, useHydrated } from '@/store/demo-store';
import { useSetLocale } from '@/store/use-set-locale';
import { useAppLocale } from '@/lib/use-app-locale';

export function LocalePrompt() {
  const t = useTranslations('common.localePrompt');
  const hydrated = useHydrated();
  const promptDone = useDemoState((state) => state.session.localePromptDone);
  const setLocale = useSetLocale();
  const dispatch = useDispatch();
  const locale = useAppLocale();
  const [dismissed, setDismissed] = useState(false);

  if (!hydrated || promptDone || dismissed) return null;

  return (
    <div
      // In the document flow, not an overlay: it never covers the header or a
      // primary action, which matters at 320px.
      className="bg-card border-b"
      data-testid="locale-prompt"
      role="region"
      aria-label={t('title')}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-medium">{t('title')}</p>
          <p className="text-muted-foreground text-xs">{t('description')}</p>
          <p className="text-muted-foreground text-xs">{t('draftNote')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Choosing here previews the language; only Continue records it. */}
          <LocaleSelect
            value={locale}
            onChange={(next) => setLocale(next, false)}
            compact
            className="w-full sm:w-auto"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setLocale(locale, true);
                dispatch({ type: 'session.dismissLocalePrompt' });
                setDismissed(true);
              }}
              data-testid="locale-prompt-continue"
            >
              {t('continue')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                // Skip keeps the current suggestion and records no preference.
                dispatch({ type: 'session.dismissLocalePrompt' });
                setDismissed(true);
              }}
              data-testid="locale-prompt-skip"
            >
              {t('skip')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
