'use client';

/**
 * Account menu: who is acting, settings, and sign-out.
 *
 * The identity is labelled as simulated everywhere it appears, so nobody reads
 * the demo's role switching as an authorisation decision.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/store/actor';
import { useDispatch } from '@/store/demo-store';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export function UserMenu() {
  const t = useTranslations('common.shell');
  const user = useCurrentUser();
  const dispatch = useDispatch();
  const router = useRouter();

  if (!user) {
    return (
      <Button asChild size="sm" data-testid="header-sign-in">
        <Link href="/sign-in">{t('signIn')}</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('accountLabel')}
          data-testid="user-menu"
        >
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">{initials(user.displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{user.displayName}</span>
          <span className="text-muted-foreground truncate text-xs font-normal">{user.email}</span>
          <span className="text-muted-foreground text-xs font-normal">
            {t('simulatedIdentity')}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden="true" />
            {t('accountLabel')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            dispatch({ type: 'session.signOut' });
            toast.info(t('signedOutToast'));
            router.push('/');
          }}
          data-testid="sign-out"
        >
          <LogOut aria-hidden="true" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact identity line for the sidebar footer. */
export function IdentityLine() {
  const t = useTranslations('common.shell');
  const user = useCurrentUser();
  if (!user) return null;

  return (
    <div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
      <UserRound aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium">{user.displayName}</span>
        <span className="text-muted-foreground truncate text-[11px]">
          {t('simulatedIdentity')}
        </span>
      </span>
    </div>
  );
}
