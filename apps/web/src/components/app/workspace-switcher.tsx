'use client';

/**
 * Creator ↔ merchant workspace switch.
 *
 * Kickoff decision 7: one simulated identity owns both the creator workspace and
 * the merchant org, and the switch sits where a real product would put it. The
 * operations identities are deliberately **not** here; they exist only in the
 * demo tools, so the product UI never implies an ops role is self-service.
 */

import { useRouter } from 'next/navigation';
import { Building2, ChevronsUpDown, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { errorCopyKey } from '@/lib/error-copy';
import { useActor, useCurrentUser, useOpsRole } from '@/store/actor';
import { useDemoSnapshot, useDispatch } from '@/store/demo-store';
import { ROLE_HOME } from '@/config/nav';

export function WorkspaceSwitcher() {
  const t = useTranslations('common.shell');
  const tErrors = useTranslations('common.errors');
  const tDemo = useTranslations('demo.role');
  const actor = useActor();
  const user = useCurrentUser();
  const opsRole = useOpsRole();
  const state = useDemoSnapshot();
  const dispatch = useDispatch();
  const router = useRouter();

  if (!user) return null;

  const orgId = user.orgIds[0] ?? null;
  const orgName = orgId ? state.orgs[orgId]?.name ?? null : null;

  // While an ops identity is active the switch would be misleading, so the
  // header states the acting role instead of offering a workspace choice.
  if (opsRole) {
    return (
      <span
        className="text-muted-foreground max-w-[14rem] truncate text-xs"
        data-testid="workspace-switcher"
      >
        {t('opsActive', { role: opsRole === 'ops_finance' ? tDemo('opsFinance') : tDemo('opsReviewer') })}
      </span>
    );
  }

  const current = actor.role === 'merchant' ? (orgName ?? t('workspaceLabel')) : t('workspaceCreator');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-[12rem]" data-testid="workspace-switcher">
          {actor.role === 'merchant' ? (
            <Building2 aria-hidden="true" />
          ) : (
            <UserRound aria-hidden="true" />
          )}
          <span className="truncate">{current}</span>
          <ChevronsUpDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuLabel>{t('switchWorkspace')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            const result = dispatch({ type: 'session.switchWorkspace', workspace: 'creator' });
            if (result.ok) router.push(ROLE_HOME.creator);
            else toast.error(tErrors(errorCopyKey(result.code)));
          }}
        >
          <UserRound aria-hidden="true" />
          {t('workspaceCreator')}
        </DropdownMenuItem>
        {orgName ? (
          <DropdownMenuItem
            onSelect={() => {
              const result = dispatch({ type: 'session.switchWorkspace', workspace: 'merchant' });
              if (result.ok) router.push(ROLE_HOME.merchant);
              else toast.error(tErrors(errorCopyKey(result.code)));
            }}
          >
            <Building2 aria-hidden="true" />
            <span className="truncate">{orgName}</span>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
