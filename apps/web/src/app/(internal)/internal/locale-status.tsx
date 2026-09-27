'use client';

/**
 * The two language notices, at layout level on every internal page (M2-04;
 * m2-04-code-review.md R5 rev 2, R6, R12). Rendered on the server with the rest
 * of the page, from what the layout resolved and what the URL says, so they
 * survive a reload and a new document — the outage instance and the healthy one
 * are different documents, and client state does not cross between them.
 *
 * - **Unsaved** — the session cookie decided while signed in: the language is
 *   switched but the account does not hold it. It says so, names the language
 *   (with its own `lang`), and offers Retry: the same choice again.
 * - **Synced** — a sign-in carried the sign-in page's choice into the account
 *   (`?outcome=locale_synced&from=<locale|none>`). Shown only when `from` is a
 *   locale or `none` and this render's account preference **is** the displayed
 *   language (and, when `from` is a locale, differs from it); otherwise it is
 *   dropped like an unknown code. The guard proves the account holds the
 *   displayed language, not that this sign-in saved it: a crafted or stale link
 *   can still show the notice over a preference saved earlier, and its Undo is
 *   then an ordinary choice (accepted, security-privacy-3). With a previous
 *   language it offers Undo; always a way to the Language card.
 *
 * Each notice is its own named region (`<section aria-label>`,
 * `internal.locale.status.regionLabel`), rendered only while it shows. They sit
 * between the banner and each page's `<main>`, and a `role="alert"` present when
 * a document loads is not announced, so without a landmark of their own a
 * screen-reader user moving by landmarks would skip the only Retry.
 *
 * Both forms post to `POST /internal/locale` without JavaScript and go through
 * the in-place switch with it. A switch that succeeds removes the notice its
 * button sits in, so focus there moves to the header switcher before the
 * refresh (`TRANSIENT_PROPS`).
 */

import { CircleAlert, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import type { AccountPreference } from '@/lib/locale/resolve';

import { SLOT, withSlot } from './embed';
import { LocaleChoiceFields } from './locale-choice-fields';
import { LOCALE_ENDPOINT } from './locale-switch-logic';
import { TRANSIENT_PROPS, useLocaleSwitch } from './locale-switch-provider';
import { fromOfQuery } from './outcomes';

/** Where the synced notice's "change" link goes: the Language card on `/internal`. */
export const LOCALE_CARD_HREF = '/internal#internal-locale-title';

const FRAME = 'mx-auto w-full max-w-5xl min-w-0 px-4 pt-4 sm:px-6';

export interface LocaleStatusProps {
  /** The language the session cookie decided, not saved to the account; null when it did not decide. */
  unsaved: Locale | null;
  /** The account's preference as this render read it. */
  accountPreference: AccountPreference;
}

export function LocaleStatus({ unsaved, accountPreference }: LocaleStatusProps) {
  return (
    <>
      {unsaved !== null ? <UnsavedNotice locale={unsaved} /> : null}
      <Suspense fallback={null}>
        <SyncedNotice accountPreference={accountPreference} />
      </Suspense>
    </>
  );
}

/** A `choose` form for `locale`: a plain post without JavaScript, the in-place switch with it. */
function ChooseForm({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname();
  const { choose } = useLocaleSwitch();
  return (
    <form
      method="post"
      action={LOCALE_ENDPOINT}
      onSubmit={(event) => {
        event.preventDefault();
        choose(locale);
      }}
    >
      <LocaleChoiceFields intent="choose" locale={locale} next={pathname} />
      {children}
    </form>
  );
}

function UnsavedNotice({ locale }: { locale: Locale }) {
  const t = useTranslations('internal.locale.status');
  const names = useTranslations('common.locale');

  return (
    <section aria-label={t('regionLabel')} className={FRAME} {...TRANSIENT_PROPS}>
      <Alert variant="destructive" data-testid="locale-status-unsaved" data-locale={locale}>
        <CircleAlert aria-hidden="true" />
        <AlertTitle className="wrap-break-word">
          {withSlot(t('unsaved', { name: SLOT }), <span lang={locale}>{names(locale)}</span>)}
        </AlertTitle>
        <AlertDescription>
          <ChooseForm locale={locale}>
            <Button type="submit" size="sm" variant="outline" data-testid="locale-status-retry">
              {t('retry')}
            </Button>
          </ChooseForm>
        </AlertDescription>
      </Alert>
    </section>
  );
}

function SyncedNotice({ accountPreference }: { accountPreference: AccountPreference }) {
  const params = useSearchParams();
  const locale = useLocale() as Locale;
  const t = useTranslations('internal.locale.status');
  const names = useTranslations('common.locale');

  if (params.get('outcome') !== 'locale_synced') return null;
  const from = fromOfQuery({ from: params.get('from') ?? undefined });
  if (from === null || accountPreference !== locale || from === locale) return null;

  return (
    <section aria-label={t('regionLabel')} className={FRAME} {...TRANSIENT_PROPS}>
      <Alert data-testid="locale-status-synced" data-from={from}>
        <CircleCheck aria-hidden="true" />
        <AlertTitle className="wrap-break-word">
          {from === 'none' ? t('synced') : withSlot(t('syncedFrom', { name: SLOT }), <span lang={from}>{names(from)}</span>)}
        </AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {from === 'none' ? null : (
            <ChooseForm locale={from}>
              <Button type="submit" size="sm" variant="outline" data-testid="locale-status-undo">
                {t('undo')}
              </Button>
            </ChooseForm>
          )}
          <Link href={LOCALE_CARD_HREF} prefetch={false} data-testid="locale-status-change">
            {t('change')}
          </Link>
        </AlertDescription>
      </Alert>
    </section>
  );
}
