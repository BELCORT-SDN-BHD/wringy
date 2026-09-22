'use client';

/**
 * Absolute event times.
 *
 * Always the instant the source reported, in Malaysia time with the UTC offset
 * written out, so a page refresh is never mistaken for the business event
 * (localization-v1). There is no relative "2 hours ago" shortcut here: a
 * deadline has to be readable as an exact date.
 */

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { formatDateOnly, formatDateTime, formatDateTimeBare } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import type { IsoDateTime } from '@/domain/types';

export interface DateTimeTextProps {
  iso: IsoDateTime | null | undefined;
  className?: string;
  /** Drops the "(UTC+08:00)" suffix; use only where the hint is shown nearby. */
  hideOffset?: boolean;
}

export function DateTimeText({ iso, className, hideOffset }: DateTimeTextProps) {
  const t = useTranslations('common.state');
  const locale = useAppLocale();

  if (!iso) {
    return (
      <span className={cn('text-inactive-foreground', className)} data-datetime="unknown">
        {t('notSet')}
      </span>
    );
  }

  return (
    <time dateTime={iso} className={className}>
      {hideOffset ? formatDateTimeBare(iso, locale) : formatDateTime(iso, locale)}
    </time>
  );
}

/** A calendar day with a written month; stays on the Malaysian day. */
export function DateText({ iso, className }: { iso: IsoDateTime | null; className?: string }) {
  const t = useTranslations('common.state');
  const locale = useAppLocale();

  if (!iso) {
    return <span className={cn('text-inactive-foreground', className)}>{t('notSet')}</span>;
  }
  return (
    <time dateTime={iso} className={className}>
      {formatDateOnly(iso, locale)}
    </time>
  );
}

/** The standing "Malaysia time (UTC+08:00)" note for a block of times. */
export function TimeZoneHint({ className }: { className?: string }) {
  const t = useTranslations('common.time');
  return <span className={cn('text-muted-foreground text-xs', className)}>{t('timezoneHint')}</span>;
}
