'use client';

/**
 * The campaign calendar, shared by the readiness check and the campaign detail
 * page so a merchant cannot read two different sets of dates for one campaign.
 *
 * Four nodes, and they are deliberately four (three-role-flows-v1 §4: "停止收稿、
 * 停止计量与结案是三个不同节点"): publish, submissions close, the metering window
 * every accepted post gets, and the claim grace after that window. Retention has
 * its own row because its real end is the LATEST of several facts, not a fixed
 * count of days.
 *
 * For a draft there is no publish instant yet, so the dates are projected from the
 * simulated clock and said to be projected. Inventing a definite date for an
 * unpublished campaign would be the "把希望写成已验证" this project refuses.
 */

import { CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calendarDaysAfter } from '@/domain';
import { formatDateTime } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import type { Campaign, IsoDateTime } from '@/domain/types';

export interface CampaignCalendarProps {
  campaign: Campaign;
  /** The simulated clock, used to project a draft's dates. */
  nowIso: IsoDateTime;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-muted-foreground shrink-0 text-xs sm:w-56">{label}</dt>
      <dd className="min-w-0 text-sm break-words sm:text-right">{value}</dd>
    </div>
  );
}

export function CampaignCalendar({ campaign, nowIso }: CampaignCalendarProps) {
  const t = useTranslations('merchant.preview');
  const locale = useAppLocale();
  const { rules } = campaign;

  const projected = campaign.publishedAt === null;
  const publishAt = campaign.publishedAt ?? nowIso;
  const submissionsCloseAt =
    campaign.submissionsCloseAt ?? calendarDaysAfter(publishAt, rules.submissionWindowDays);
  // The worked example from campaign-defaults-v1: a link accepted at the publish
  // instant stops metering meteringDays later and can be claimed for
  // claimGraceDays after that.
  const exampleMeteringEnd = calendarDaysAfter(publishAt, rules.meteringDays);
  const exampleClaimDeadline = calendarDaysAfter(exampleMeteringEnd, rules.claimGraceDays);

  return (
    <Card data-app-widget="campaign-calendar">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <CalendarDays aria-hidden="true" className="size-4" />
          {t('calendarTitle')}
        </CardTitle>
        {projected ? <CardDescription>{t('calendarProjected')}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col">
          <Row label={t('calPublish')} value={<DateTimeText iso={publishAt} />} />
          <Row label={t('calSubmissionsClose')} value={<DateTimeText iso={submissionsCloseAt} />} />
          <Row
            label={t('calMetering')}
            value={t('calMeteringValue', { days: rules.meteringDays })}
          />
          <Row label={t('calGrace')} value={t('calGraceValue', { days: rules.claimGraceDays })} />
          <Row
            label={t('calRetention')}
            value={t('calRetentionValue', { days: rules.retentionDays })}
          />
        </dl>
        <p className="text-muted-foreground text-xs break-words" data-testid="calendar-example">
          {t('calExample', {
            accepted: formatDateTime(publishAt, locale),
            meteringEnd: formatDateTime(exampleMeteringEnd, locale),
            claimDeadline: formatDateTime(exampleClaimDeadline, locale),
          })}
        </p>
        <TimeZoneHint />
      </CardContent>
    </Card>
  );
}
