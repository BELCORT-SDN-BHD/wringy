'use client';

import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText, RateText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatViews } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectPublicCampaigns } from '@/store/selectors';

/**
 * The public catalogue.
 *
 * Every card states the rate per 1,000 qualified views, the minimum claim, the
 * cap per submission, the view threshold when the campaign sets one, and the
 * dates, so nobody has to open the detail page to learn the terms.
 */
export function CatalogueView() {
  const t = useTranslations('public.catalogue');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>
      <HydrationGate>
        <CatalogueList />
      </HydrationGate>
    </div>
  );
}

function CatalogueList() {
  const t = useTranslations('public.catalogue');
  const tCampaign = useTranslations('public.campaign');
  const state = useDemoSnapshot();
  const locale = useAppLocale();

  const campaigns = useMemo(() => selectPublicCampaigns(state), [state]);

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title={t('emptyTitle')}
        description={t('emptyDescription')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">{t('count', { count: campaigns.length })}</p>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {campaigns.map((campaign) => {
          const orgName = state.orgs[campaign.orgId]?.name ?? campaign.orgId;
          return (
            <li key={campaign.id} className="flex">
              <Card className="flex w-full min-w-0 flex-col">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge group="campaign" code={campaign.status} />
                    <Badge variant="outline" className="max-w-full">
                      <span className="truncate">{orgName}</span>
                    </Badge>
                  </div>
                  <CardTitle className="break-words">{campaign.title}</CardTitle>
                  <CardDescription className="break-words">{campaign.brief}</CardDescription>
                </CardHeader>
                <CardContent className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                  <p className="font-medium">
                    <RateText ratePerThousandSen={campaign.rules.ratePerThousandSen} />
                  </p>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    <div className="flex min-w-0 justify-between gap-2">
                      <dt className="text-muted-foreground">{tCampaign('minClaim')}</dt>
                      <dd>
                        <MoneyText sen={campaign.rules.minClaimSen} />
                      </dd>
                    </div>
                    <div className="flex min-w-0 justify-between gap-2">
                      <dt className="text-muted-foreground">{tCampaign('cap')}</dt>
                      <dd>
                        <MoneyText sen={campaign.rules.capPerSubmissionSen} />
                      </dd>
                    </div>
                    <div className="flex min-w-0 justify-between gap-2">
                      <dt className="text-muted-foreground">{tCampaign('viewThreshold')}</dt>
                      <dd>
                        {campaign.rules.viewThreshold === null
                          ? tCampaign('viewThresholdNone')
                          : formatViews(campaign.rules.viewThreshold, locale)}
                      </dd>
                    </div>
                    <div className="flex min-w-0 justify-between gap-2">
                      <dt className="text-muted-foreground">{tCampaign('metering')}</dt>
                      <dd>{tCampaign('meteringValue', { days: campaign.rules.meteringDays })}</dd>
                    </div>
                    <div className="flex min-w-0 justify-between gap-2">
                      <dt className="text-muted-foreground">{tCampaign('grace')}</dt>
                      <dd>{tCampaign('graceValue', { days: campaign.rules.claimGraceDays })}</dd>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <dt className="text-muted-foreground">{tCampaign('submissionsClose')}</dt>
                      <dd>
                        <DateTimeText iso={campaign.submissionsCloseAt} hideOffset />
                      </dd>
                    </div>
                  </dl>
                  <TimeZoneHint />
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                    <Link href={`/campaigns/${campaign.id}`}>{t('viewDetail')}</Link>
                  </Button>
                </CardFooter>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
