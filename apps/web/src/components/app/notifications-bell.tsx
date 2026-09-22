'use client';

/**
 * Header bell with the unread count for the identity that is acting now.
 *
 * The count comes from the engine's own routing (one business event reaches each
 * entitled role in its own context), so switching workspace changes the count
 * rather than re-labelling the same list.
 */

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActor } from '@/store/actor';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectUnreadCount } from '@/store/selectors';

export function NotificationsBell() {
  const t = useTranslations('common.shell');
  const actor = useActor();
  const state = useDemoSnapshot();

  const unread = useMemo(
    () => selectUnreadCount(state, actor.userId || null, actor.role),
    [state, actor.userId, actor.role],
  );

  const label = unread > 0 ? t('unreadCount', { count: unread }) : t('noUnread');

  return (
    <Button
      asChild
      variant="ghost"
      size="icon-sm"
      className="relative"
      aria-label={`${t('notificationsLabel')} — ${label}`}
      data-testid="notifications-bell"
      data-unread={unread}
    >
      <Link href="/notifications">
        <Bell aria-hidden="true" />
        {unread > 0 ? (
          <Badge
            className="bg-attention-subtle text-attention-foreground absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px]"
            aria-hidden="true"
          >
            {unread}
          </Badge>
        ) : null}
      </Link>
    </Button>
  );
}
