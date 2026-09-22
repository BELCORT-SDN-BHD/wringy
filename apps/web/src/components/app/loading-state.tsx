'use client';

/**
 * The loading condition: the persisted demo state has not been read yet.
 *
 * state-policy.md allows `Skeleton` for a first read and forbids invented
 * progress percentages, so there is no Progress bar here.
 */

import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  /** Number of placeholder rows under the heading block. */
  rows?: number;
  className?: string;
}

export function LoadingState({ rows = 3, className }: LoadingStateProps) {
  const t = useTranslations('common.state');

  return (
    <div
      className={cn('flex w-full flex-col gap-4', className)}
      aria-busy="true"
      data-app-state="loading"
    >
      <span className="sr-only">{t('loadingLabel')}</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

/** A single inline placeholder, for one widget rather than a page. */
export function LoadingBlock({ className }: { className?: string }) {
  const t = useTranslations('common.state');
  return (
    <div aria-busy="true" data-app-state="loading">
      <span className="sr-only">{t('loadingLabel')}</span>
      <Skeleton className={cn('h-24 w-full', className)} />
    </div>
  );
}
