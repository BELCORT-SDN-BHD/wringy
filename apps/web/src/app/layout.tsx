import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { getLocale, getTranslations } from 'next-intl/server';

import { DemoToolbar } from '@/components/app/demo-toolbar';
import { LocalePrompt } from '@/components/app/locale-prompt';
import { AppProviders } from '@/components/app/providers';
import { Toaster } from '@/components/ui/sonner';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';

import './globals.css';

// Same family the design-system showcase loads via @fontsource-variable/geist.
// `--font-sans` is what globals.css maps into Tailwind's `font-sans`.
const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app');

  return {
    title: {
      default: `${t('name')} — prototype`,
      template: `%s — ${t('name')}`,
    },
    // No claim is made about search indexing or link unfurling: nothing is
    // deployed publicly (prototype-spec-v1).
    description: t('tagline'),
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppProviders initialLocale={locale}>
          {/* First-visit language prompt sits above everything in the flow, so
              it never covers a header or a primary action. */}
          <LocalePrompt />
          {children}
          {/* The "Demo data · simulated" mark (ticket #2) lives in the page
              header at every viewport, not in a floating pill: see
              `demo-badge.tsx` for why the fixed one was removed. */}
          {/* The only place the clock, views, readiness, payouts, identity and
              scenarios can be changed. */}
          <DemoToolbar />
          {/* bottom-center keeps toasts off the sticky header controls and the demo badge / tools corners. */}
          <Toaster position="bottom-center" />
        </AppProviders>
      </body>
    </html>
  );
}
