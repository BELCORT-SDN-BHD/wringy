'use client';

/**
 * Header for the pages anyone can read without an identity.
 *
 * It carries the language select, so a visitor can switch before signing in, and
 * the single sign-in entry. There is no email, password or one-time-code control
 * anywhere on these pages (ticket #2: "没有邮箱或其他登录入口").
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { DemoBadgeInline } from '@/components/app/demo-badge';
import { LocaleSelect } from '@/components/app/locale-select';
import { NotificationsBell } from '@/components/app/notifications-bell';
import { UserMenu } from '@/components/app/user-menu';
import { Button } from '@/components/ui/button';
import { useAppLocale } from '@/lib/use-app-locale';
import { useIsSignedIn } from '@/store/actor';
import { useHydrated } from '@/store/demo-store';
import { useSetLocale } from '@/store/use-set-locale';

export function PublicHeader() {
  const t = useTranslations('common');
  const locale = useAppLocale();
  const setLocale = useSetLocale();
  const hydrated = useHydrated();
  const signedIn = useIsSignedIn();

  return (
    <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-3 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
          <span className="bg-brand text-brand-foreground rounded-md px-1.5 py-0.5 text-xs font-semibold">
            {t('app.name')}
          </span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="min-w-0">
            <Link href="/campaigns" className="truncate">
              {t('nav.browseCampaigns')}
            </Link>
          </Button>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <DemoBadgeInline />
          <LocaleSelect value={locale} onChange={(next) => setLocale(next, true)} compact />
          {hydrated && signedIn ? <NotificationsBell /> : null}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
