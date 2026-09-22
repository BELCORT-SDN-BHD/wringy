'use client';

/**
 * The cross-campaign report.
 *
 * One card per campaign with the four buckets, the metered qualified views and the
 * closure position, so the merchant page listed as "活动报告／结算" in
 * three-role-flows-v1 §3 exists and shows the update time, the disputed amounts and
 * the refund as pending — rather than one grand total that hides which money is
 * only promised.
 */

import Link from 'next/link';
import { ChartNoAxesColumn } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { BudgetBuckets } from '@/components/app/budget-buckets';
import { DateTimeText } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { StatusBadge } from '@/components/app/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCount, formatViewsOrUnknown } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useActor } from '@/store/actor';
import { useDemoSnapshot } from '@/store/demo-store';

import { selectMerchantCampaignReports } from './selectors';

export function MerchantReportsView() {
  return (
    <HydrationGate>
      <Reports />
    </HydrationGate>
  );
}

function Reports() {
  const t = useTranslations('merchant.reports');
  const tDetail = useTranslations('merchant.detail');
  const locale = useAppLocale();
  const state = useDemoSnapshot();
  const actor = useActor();

  const reports = useMemo(() => selectMerchantCampaignReports(state, actor), [state, actor]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>

      {reports.length === 0 ? (
        <EmptyState icon={ChartNoAxesColumn} description={t('none')} />
      ) : (
        reports.map((report) => (
          <Card key={report.campaign.id} data-campaign-id={report.campaign.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base break-words">
                {report.campaign.title}
                <StatusBadge group="campaign" code={report.campaign.status} />
              </CardTitle>
              <CardDescription>{tDetail('reportNote')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <BudgetBuckets budget={report.budget} bare />
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-muted/40 flex min-w-0 flex-col gap-1 rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs break-words">
                    {tDetail('reportQualifiedViews')}
                  </dt>
                  <dd className="text-sm font-medium">
                    {formatViewsOrUnknown(report.qualifiedViews, locale)}
                  </dd>
                </div>
                <div className="bg-muted/40 flex min-w-0 flex-col gap-1 rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs break-words">
                    {tDetail('reportSubmissions')}
                  </dt>
                  <dd className="text-sm font-medium">
                    {formatCount(report.submissionCount, locale)}
                  </dd>
                </div>
                <div className="bg-muted/40 flex min-w-0 flex-col gap-1 rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs break-words">
                    {tDetail('reportClaims')}
                  </dt>
                  <dd className="text-sm font-medium">{formatCount(report.claimCount, locale)}</dd>
                </div>
                <div className="bg-muted/40 flex min-w-0 flex-col gap-1 rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs break-words">
                    {tDetail('reportUnresolvedPayouts')}
                  </dt>
                  <dd className="text-sm font-medium">
                    {formatCount(report.closure?.unresolvedPayouts ?? 0, locale)}
                  </dd>
                </div>
              </dl>
              <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <span>{tDetail('reportLastTrusted')}</span>
                <DateTimeText iso={report.lastTrustedAt} />
              </p>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-fit">
                <Link href={`/merchant/campaigns/${report.campaign.id}`}>
                  <span className="truncate">{t('open')}</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
