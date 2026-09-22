'use client';

import { useCallback } from 'react';

import { writeLocaleCookie } from '@/i18n/locale-cookie';
import type { Locale } from '@/domain/types';

import { useDispatch } from './demo-store';

export interface SetLocaleOutcome {
  /** True when the engine accepted the change (it always should). */
  switched: boolean;
  /** False when the browser refused to store the preference. */
  saved: boolean;
}

/**
 * Changes the language.
 *
 * `explicit` separates a preview or a suggested default from a preference the
 * person actually chose (localization-v1: skipping must not record a preference).
 * The cookie is only a mirror so server rendering agrees; when the browser
 * refuses it, the caller must say "switched, not saved" rather than claim a save.
 */
export function useSetLocale(): (locale: Locale, explicit: boolean) => SetLocaleOutcome {
  const dispatch = useDispatch();

  return useCallback(
    (locale: Locale, explicit: boolean) => {
      const result = dispatch({ type: 'session.setLocale', locale, explicit });
      const saved = writeLocaleCookie(locale);
      return { switched: result.ok, saved: saved && result.ok };
    },
    [dispatch],
  );
}
