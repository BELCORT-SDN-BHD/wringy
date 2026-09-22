'use client';

/**
 * "There is nothing here" — the official `Empty` composition.
 *
 * state-policy.md keeps three page conditions apart, and this is only the first
 * one: no objects exist. A failed read is `ErrorState`, and a source that cannot
 * be read right now is `DataUnavailable`. Never show this for either of those.
 */

import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  /** Primary action, e.g. a link to the catalogue. */
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  children,
  className,
}: EmptyStateProps) {
  const t = useTranslations('common.state');

  return (
    <Empty className={cn('border', className)} data-app-state="empty">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title ?? t('emptyTitle')}</EmptyTitle>
        <EmptyDescription>{description ?? t('emptyDescription')}</EmptyDescription>
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}
