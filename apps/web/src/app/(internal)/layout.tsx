import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTimeZone, getTranslations } from 'next-intl/server';

import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';

import { geistMono, geistSans } from '../fonts';
import '../globals.css';

/**
 * Root layout of the internal build (kickoff-package.md §8.3, §8.6).
 *
 * It shares the design system, fonts and language cookie with the demo, and
 * nothing else: no AppProviders (so the demo store is never hydrated and
 * `wringy-demo-v1` is never read or written), no DemoToolbar, no LocalePrompt.
 * `pnpm depcruise` (rule internal-not-to-demo) keeps it that way. The language
 * is read from the `wringy-locale` cookie through src/i18n/request.ts; client
 * components below get only the `common` and `internal` namespaces.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('internal.meta');
  const app = await getTranslations('common.app');

  return {
    title: { default: `${t('title')} — ${app('name')}`, template: `%s — ${app('name')}` },
    description: t('description'),
    robots: { index: false, follow: false },
  };
}

export default async function InternalRootLayout({ children }: { children: ReactNode }) {
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const { common, internal } = getMessages(locale);

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider locale={locale} timeZone={await getTimeZone()} messages={{ common, internal }}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
