'use client';

/**
 * "There is nothing here" — the official `Empty` composition.
 *
 * state-policy.md keeps three page conditions apart, and this is only the first
 * one: no objects exist. A failed read is `ErrorState`, and a source that cannot
 * be read right now is `DataUnavailable`. Never show this for either of those.
 *
 * A filter that matched nothing is a fourth condition and the same file demands it
 * be distinguished by text ("无匹配、首次空、暂不可读用文字区分"), so pass
 * `state="no-match"` with its own copy and a way to clear the filter. Never reuse
 * the first-run wording there: it would assert that no object exists while the
 * count on the same screen says otherwise.
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
  /** Which page condition this is; `no-match` is a filter that matched nothing. */
  state?: 'empty' | 'no-match';
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  children,
  className,
  state = 'empty',
}: EmptyStateProps) {
  const t = useTranslations('common.state');

  return (
    <Empty className={cn('border', className)} data-app-state={state}>
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
