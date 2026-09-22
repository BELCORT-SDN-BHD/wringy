'use client';

/**
 * Client providers for the whole app.
 *
 * The locale is not in the URL (kickoff decision 8), so this is where the
 * language actually switches: messages are swapped in place from the persisted
 * session, without navigating, so a half-filled form survives the switch.
 *
 * Before hydration the render uses the locale the server saw in the cookie, so
 * the first client render matches the server output; afterwards the persisted
 * session is the source of truth and the cookie is kept in step for metadata.
 */

import { NextIntlClientProvider } from 'next-intl';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { TIMEZONE, type Locale } from '@/domain/types';
import { getMessages } from '@/i18n/messages';
import { writeLocaleCookie } from '@/i18n/locale-cookie';
import { hydrateDemoStore, useHydrated } from '@/store/demo-store';
import { useSessionLocale } from '@/store/actor';

export interface AppProvidersProps {
  /** The locale the server rendered with, read from the `wringy-locale` cookie. */
  initialLocale: Locale;
  children: ReactNode;
}

export function AppProviders({ initialLocale, children }: AppProvidersProps) {
  const hydrated = useHydrated();
  const sessionLocale = useSessionLocale();
  const locale = hydrated ? sessionLocale : initialLocale;

  // Reading the persisted demo state is started here, once per page load.
  useEffect(() => {
    hydrateDemoStore();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (hydrated) writeLocaleCookie(locale);
  }, [locale, hydrated]);

  return (
    <NextIntlClientProvider locale={locale} messages={getMessages(locale)} timeZone={TIMEZONE}>
      {children}
    </NextIntlClientProvider>
  );
}
