import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTimeZone, getTranslations } from 'next-intl/server';

import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { appMode } from '@/lib/auth/mode';
import { resolveInternalLocale } from '@/lib/locale/read';
import type { AccountPreference } from '@/lib/locale/resolve';

import { geistMono, geistSans } from '../fonts';
import '../globals.css';
import { InternalLocalePrompt, type PromptCopy } from './internal/internal-locale-prompt';
import { LocaleStatus } from './internal/locale-status';
import { LocaleSwitchProvider } from './internal/locale-switch-provider';
import { LocaleSwitcher } from './internal/locale-switcher';

/**
 * Root layout of the internal build (kickoff-package.md §8.3, §8.6).
 *
 * It shares the design system, fonts and language cookie with the demo, and
 * nothing else: no AppProviders (so the demo store is never hydrated and
 * `wringy-demo-v1` is never read or written), no DemoToolbar, no LocalePrompt.
 * `pnpm depcruise` (rule internal-not-to-demo) keeps it that way. Client
 * components below get only the `common` and `internal` namespaces of the
 * active language.
 *
 * The persistent trilingual "internal build" banner is rendered here, so every
 * page of the internal build, its not-found page included, carries it.
 *
 * ## The language (M2-04; m2-04-code-review.md R3, R5, R10)
 *
 * In internal mode the language is resolved in localization-v1's order
 * (`resolveInternalLocale()`, the same per-request answer `getLocale()` and every
 * `getTranslations` get), and the layout adds, on every internal page — sign-in
 * and not-found included:
 *
 * - `<body data-locale data-locale-source data-account-preference>`: what was
 *   resolved and from which step, for the evidence rows;
 * - a `<header>` row under the banner (which stays text-only) with the language
 *   switcher and its live region;
 * - the layout-level notices (`LocaleStatus`): "switched, not saved · Retry" and
 *   "saved as your account language · Undo";
 * - the first-visit prompt, inline above the page, while the language is only a
 *   suggestion and nobody has answered it;
 * - `LocaleSwitchProvider` around it all, the in-place switch: a post, then one
 *   server re-render. No other language's catalogue reaches the client.
 *
 * `<html lang>` is server-rendered from the resolved language; the client never
 * sets it. The demo build's `/internal` pages (demo mode) render as before: no
 * switch, because its handler does not exist there.
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

/**
 * The prompt's own copy in all three languages, so its preview needs no
 * catalogue on the client. The demo prompt's `common.localePrompt.*`, except its
 * description: "change this anytime in Settings" names a page this build does
 * not have, and the prompt is shown to guests, who get no Language card either.
 * `internal.locale.prompt.description` points at the header's Language menu,
 * which every internal page has.
 */
function promptCopy(): Record<Locale, PromptCopy> {
  return Object.fromEntries(
    LOCALES.map((code) => {
      const { common, internal } = getMessages(code);
      const { title, draftNote, continue: proceed, skip } = common.localePrompt;
      const { description, selectLabel } = internal.locale.prompt;
      return [code, { title, description, draftNote, continue: proceed, skip, selectLabel }];
    }),
  ) as Record<Locale, PromptCopy>;
}

/** `data-account-preference`: a locale, `none` (the account holds none) or `unknown` (not read, or signed out). */
const preferenceAttribute = (preference: AccountPreference): string => (preference === null ? 'none' : preference);

export default async function InternalRootLayout({ children }: { children: ReactNode }) {
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const { common, internal } = getMessages(locale);
  const t = await getTranslations('internal');
  const timeZone = await getTimeZone();
  const resolved = appMode() === 'internal' ? await resolveInternalLocale() : null;

  const banner = (
    <div
      role="note"
      data-app-banner="internal-build"
      className="border-b bg-muted px-4 py-2 text-center text-sm font-medium text-foreground"
    >
      {t('banner')}
    </div>
  );

  if (resolved === null) {
    return (
      <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="flex min-h-full flex-col">
          <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={{ common, internal }}>
            {banner}
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body
        className="flex min-h-full flex-col"
        data-locale={locale}
        data-locale-source={resolved.source}
        data-account-preference={preferenceAttribute(resolved.accountPreference)}
      >
        <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={{ common, internal }}>
          <LocaleSwitchProvider>
            {banner}
            <header data-testid="internal-header" className="border-b px-4 py-2 sm:px-6">
              <div className="mx-auto flex w-full max-w-5xl min-w-0 justify-end">
                <LocaleSwitcher />
              </div>
            </header>
            <LocaleStatus unsaved={resolved.unsaved} accountPreference={resolved.accountPreference} />
            {resolved.showPrompt ? <InternalLocalePrompt suggested={locale} copy={promptCopy()} /> : null}
            {children}
          </LocaleSwitchProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
