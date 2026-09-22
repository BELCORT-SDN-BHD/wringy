'use client';

import Link from 'next/link';
import { Bell, Check, ExternalLink, Mail } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DateTimeText } from '@/components/app/date-time-text';
import { EmailPreviewDialog } from '@/components/app/email-preview-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { notificationValues } from '@/lib/notification-copy';
import { useAppLocale } from '@/lib/use-app-locale';
import { useActor } from '@/store/actor';
import { useDemoSnapshot, useDispatch } from '@/store/demo-store';
import { selectNotificationsSorted, selectUnreadCount } from '@/store/selectors';
import type { Notification, Role } from '@/domain/types';

const ROLE_KEY: Record<Exclude<Role, 'guest'>, string> = {
  creator: 'roleCreator',
  merchant: 'roleMerchant',
  ops_reviewer: 'roleOpsReviewer',
  ops_finance: 'roleOpsFinance',
};

/**
 * Notification centre for the identity that is acting now.
 *
 * Unread first, then newest first. A row is marked read when it is opened through
 * its deep link, or explicitly, and "Mark all read" clears the rest. Opening the
 * simulated email preview does not mark it read: the preview is a preview, and
 * the official dialog returns focus to its trigger only if the row does not
 * change under it. The read flag lives in the persisted demo state, so it
 * survives a refresh (ticket #2: 已读持久化).
 *
 * The same business event reaches each entitled role separately, so switching
 * workspace changes the list rather than relabelling one shared inbox.
 */
export function NotificationsView() {
  return (
    <HydrationGate>
      <Notifications />
    </HydrationGate>
  );
}

function Notifications() {
  const t = useTranslations('notifications');
  const actor = useActor();
  const state = useDemoSnapshot();
  const dispatch = useDispatch();

  const list = useMemo(
    () => selectNotificationsSorted(state, actor.userId || null, actor.role),
    [state, actor.userId, actor.role],
  );
  const unread = useMemo(
    () => selectUnreadCount(state, actor.userId || null, actor.role),
    [state, actor.userId, actor.role],
  );

  if (actor.role === 'guest') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
        <EmptyState
          icon={Bell}
          title={t('signedOutTitle')}
          description={t('signedOutDescription')}
        >
          <Button asChild>
            <Link href="/sign-in?next=/notifications">{t('openLink')}</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={unread === 0}
          onClick={() => {
            const result = dispatch({ type: 'notification.markAllRead' });
            if (result.ok) toast.success(t('markedAllRead'));
          }}
          data-testid="mark-all-read"
        >
          {t('markAllRead')}
        </Button>
      </header>

      {list.length === 0 ? (
        <EmptyState icon={Bell} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <ItemGroup data-testid="notifications-list">
          {list.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  const t = useTranslations('notifications');
  const tKinds = useTranslations('notifications.kinds');
  const tState = useTranslations('common.state');
  const tEmail = useTranslations('common.email');
  const tCommon = useTranslations('common');
  const locale = useAppLocale();
  const dispatch = useDispatch();
  const [previewOpen, setPreviewOpen] = useState(false);

  const unread = notification.readAt === null;

  const values = notificationValues(
    notification.kind,
    notification.params,
    locale,
    tState('unknown'),
    tCommon,
  );

  const markRead = () => {
    if (!unread) return;
    dispatch({ type: 'notification.markRead', notificationId: notification.id });
  };

  return (
    <Item variant="outline" className="items-start" data-unread={unread}>
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <span className="break-words">{tKinds(`${notification.kind}.title`)}</span>
          {unread ? (
            <Badge className="bg-attention-subtle text-attention-foreground gap-1 border-transparent">
              <Mail aria-hidden="true" />
              {t('unread')}
            </Badge>
          ) : null}
        </ItemTitle>
        <ItemDescription className="flex flex-col gap-1">
          <span className="break-words">{tKinds(`${notification.kind}.body`, values)}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <DateTimeText iso={notification.createdAt} />
            <span>{t('recipientRole', { role: t(ROLE_KEY[notification.recipientRole]) })}</span>
          </span>
          {notification.email ? <span className="text-xs">{t('emailAvailable')}</span> : null}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {notification.href ? (
          <Button asChild variant="outline" size="sm" onClick={markRead}>
            <Link href={notification.href}>
              <span className="truncate">{t('openLink')}</span>
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        {notification.email ? (
          <EmailPreviewDialog
            notification={notification}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            trigger={
              <Button variant="ghost" size="sm" data-testid="email-preview-open">
                <Mail aria-hidden="true" />
                <span className="truncate">{tEmail('open')}</span>
              </Button>
            }
          />
        ) : null}
        {unread ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              markRead();
              toast.success(t('markedRead'));
            }}
            data-testid="mark-read"
          >
            <Check aria-hidden="true" />
            <span className="truncate">{t('markRead')}</span>
          </Button>
        ) : null}
      </ItemActions>
    </Item>
  );
}
