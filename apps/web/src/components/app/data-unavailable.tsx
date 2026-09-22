'use client';

/**
 * The source could not be read right now.
 *
 * This is the third page condition, separate from empty and from error. It keeps
 * the last trusted value with the time it was trusted, says unknown is not zero,
 * and never renders 0 views or RM 0.00 in place of a missing fact
 * (localization-v1, color-policy.md: unknown is neutral, not a failure).
 */

import { WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DateTimeText } from '@/components/app/date-time-text';
import { cn } from '@/lib/utils';
import type { IsoDateTime } from '@/domain/types';

export interface DataUnavailableProps {
  /** When the source last answered. Null when it never did. */
  lastTrustedAt: IsoDateTime | null;
  /** The last trusted value itself, already formatted by the caller. */
  lastValue?: ReactNode;
  /** Optional reason from the engine, e.g. `source_unreachable`. */
  reason?: string | null;
  className?: string;
}

export function DataUnavailable({
  lastTrustedAt,
  lastValue,
  reason,
  className,
}: DataUnavailableProps) {
  const t = useTranslations('common.state');

  return (
    <Alert
      className={cn('bg-inactive-subtle', className)}
      data-app-state="data-unavailable"
      data-reason={reason ?? undefined}
    >
      <WifiOff aria-hidden="true" className="text-inactive-foreground" />
      <AlertTitle>{t('unavailableTitle')}</AlertTitle>
      <AlertDescription>
        <span>{t('unavailableDescription')}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {lastTrustedAt ? (
            <>
              {lastValue ? <span className="text-foreground font-medium">{lastValue}</span> : null}
              <span className="inline-flex flex-wrap items-center gap-1">
                {t('lastTrustedLabel')}
                <DateTimeText iso={lastTrustedAt} />
              </span>
            </>
          ) : (
            <span>{t('neverTrusted')}</span>
          )}
        </span>
      </AlertDescription>
    </Alert>
  );
}

/**
 * The inline form: the last trusted value and its time on one line, for a row in
 * a list where a full Alert would not fit.
 */
export function LastTrustedInline({
  lastTrustedAt,
  lastValue,
  className,
}: {
  lastTrustedAt: IsoDateTime | null;
  lastValue: ReactNode;
  className?: string;
}) {
  const t = useTranslations('common.state');

  return (
    <span className={cn('text-muted-foreground flex flex-wrap items-center gap-2 text-xs', className)}>
      <span className="text-foreground">{lastValue}</span>
      {lastTrustedAt ? (
        <span className="inline-flex flex-wrap items-center gap-1">
          {t('lastTrustedLabel')}
          <DateTimeText iso={lastTrustedAt} hideOffset />
        </span>
      ) : (
        <span>{t('neverTrusted')}</span>
      )}
    </span>
  );
}
