'use client';

/**
 * "Simulated email preview — not sent".
 *
 * Important events carry an email in the engine's notification record. The demo
 * never sends anything, so this dialog renders exactly what the message would
 * say, from the same copy keys and the same rule vocabulary the page uses
 * (localization-v1: email and page share terms and the rule version).
 */

import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DIALOG_FIT_CLASS } from '@/components/app/dialog-fit';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { notificationValues } from '@/lib/notification-copy';
import { useAppLocale } from '@/lib/use-app-locale';
import type { Notification } from '@/domain/types';
import type { ReactNode } from 'react';

export interface EmailPreviewDialogProps {
  notification: Notification;
  /** The control that opens the preview; focus returns to it on close. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EmailPreviewDialog({
  notification,
  trigger,
  open,
  onOpenChange,
}: EmailPreviewDialogProps) {
  const t = useTranslations('common.email');
  const tState = useTranslations('common.state');
  const tKinds = useTranslations('notifications.kinds');
  const locale = useAppLocale();

  const values = notificationValues(
    notification.kind,
    notification.params,
    locale,
    tState('unknown'),
  );

  const subject = tKinds(`${notification.kind}.emailSubject`, values);
  const body = tKinds(`${notification.kind}.emailBody`, values);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={DIALOG_FIT_CLASS} data-app-widget="email-preview">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Mail aria-hidden="true" className="size-4" />
            {t('previewTitle')}
          </DialogTitle>
          <DialogDescription>{t('previewDescription')}</DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="text-muted-foreground w-20 shrink-0 text-xs">{t('to')}</dt>
            <dd className="min-w-0 break-all">
              {notification.email?.to ?? tState('notApplicable')}
              <Badge variant="outline" className="ml-2">
                {t('previewTitle')}
              </Badge>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="text-muted-foreground w-20 shrink-0 text-xs">{t('subject')}</dt>
            <dd className="min-w-0 font-medium break-words">{subject}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{t('body')}</dt>
            <dd className="bg-muted/40 rounded-lg border p-3 break-words whitespace-pre-line">
              {body}
            </dd>
          </div>
        </dl>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
