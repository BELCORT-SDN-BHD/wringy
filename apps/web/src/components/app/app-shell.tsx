'use client';

/**
 * Workspace layout: a Linear-style left sidebar with the role's navigation and a
 * header carrying the workspace switch, the notifications bell, the language
 * select and the account menu.
 *
 * The sidebar is the unchanged official `sidebar.tsx`, which is why the mobile
 * breakpoint is the library's own 768px (`src/hooks/use-mobile.ts`): below it the
 * same navigation renders inside the official `Sheet` drawer, above it as a fixed
 * column. Forking that file to move the breakpoint would fork the design system,
 * which reference-contract.md forbids.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DEMO_SAFE_AREA_CLASS, DemoBadgeInline } from '@/components/app/demo-badge';
import { LocaleSelect } from '@/components/app/locale-select';
import { NotificationsBell } from '@/components/app/notifications-bell';
import { StorageNotice } from '@/components/app/storage-notice';
import { IdentityLine, UserMenu } from '@/components/app/user-menu';
import { WorkspaceSwitcher } from '@/components/app/workspace-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { isActive, navGroupsFor } from '@/config/nav';
import { cn } from '@/lib/utils';
import { useAppLocale } from '@/lib/use-app-locale';
import { useActor } from '@/store/actor';
import { useSetLocale } from '@/store/use-set-locale';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const t = useTranslations('common');
  const actor = useActor();
  const pathname = usePathname();
  const locale = useAppLocale();
  const setLocale = useSetLocale();
  const groups = navGroupsFor(actor.role);

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <Link href="/" className="flex min-w-0 items-center gap-2 px-2 py-1.5">
            <span className="bg-brand text-brand-foreground rounded-md px-1.5 py-0.5 text-xs font-semibold">
              {t('app.name')}
            </span>
            <span className="text-muted-foreground truncate text-xs">{t('nav.home')}</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          {groups.map((group) => (
            <SidebarGroup key={group.labelKey}>
              <SidebarGroupLabel>{t(`nav.${group.labelKey}`)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={`${group.labelKey}-${item.href}`}>
                        <SidebarMenuButton asChild isActive={isActive(pathname, item)}>
                          <Link href={item.href}>
                            <Icon aria-hidden="true" />
                            <span>{t(`nav.${item.labelKey}`)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator />
          <IdentityLine />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="bg-background/95 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur supports-backdrop-filter:bg-background/80">
          <SidebarTrigger aria-label={t('shell.toggleNav')} />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <WorkspaceSwitcher />
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <DemoBadgeInline />
            <LocaleSelect value={locale} onChange={(next) => setLocale(next, true)} compact />
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-4 px-3 pt-4 sm:px-6',
            DEMO_SAFE_AREA_CLASS,
          )}
        >
          <StorageNotice />
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
