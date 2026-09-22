'use client';

/**
 * Audit and history rows.
 *
 * Every row shows the absolute time the event happened, who acted and the
 * recorded reason, so a decision can be read back later against the rule version
 * that applied at the time (prototype-spec: 关键操作确认并写演示记录).
 */

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DateTimeText } from '@/components/app/date-time-text';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import type { IsoDateTime } from '@/domain/types';

export interface TimelineEntry {
  id: string;
  at: IsoDateTime;
  /** What happened, already translated by the caller. */
  title: string;
  /** Who acted; a display name, not an id, where one is known. */
  actor?: string | null;
  /** The recorded reason or note. */
  reason?: string | null;
  /** Anything extra, e.g. a status badge. */
  trailing?: ReactNode;
}

export interface TimelineListProps {
  entries: TimelineEntry[];
  /** Newest first when true (the default). */
  newestFirst?: boolean;
  className?: string;
}

export function TimelineList({ entries, newestFirst = true, className }: TimelineListProps) {
  const t = useTranslations('common.timeline');

  if (entries.length === 0) {
    return <p className={cn('text-muted-foreground text-sm', className)}>{t('empty')}</p>;
  }

  const ordered = newestFirst
    ? [...entries].sort((a, b) => b.at.localeCompare(a.at))
    : [...entries].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <ItemGroup className={cn(className)} data-app-widget="timeline">
      {ordered.map((entry) => (
        <Item key={entry.id} variant="outline" size="sm" className="items-start">
          <ItemContent className="min-w-0">
            <ItemTitle className="flex flex-wrap items-center gap-2">
              <span className="break-words">{entry.title}</span>
              {entry.trailing}
            </ItemTitle>
            <ItemDescription className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <DateTimeText iso={entry.at} hideOffset />
                {entry.actor ? <span>{t('by', { actor: entry.actor })}</span> : null}
              </span>
              {entry.reason ? (
                <span className="break-words">{t('reason', { reason: entry.reason })}</span>
              ) : null}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
