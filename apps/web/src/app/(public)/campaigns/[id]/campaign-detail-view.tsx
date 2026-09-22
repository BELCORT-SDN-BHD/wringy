'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, Megaphone } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { CampaignRulesList } from '@/components/app/campaign-rules-list';
import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { StatusBadge } from '@/components/app/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsSignedIn } from '@/store/actor';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectPublicCampaigns } from '@/store/selectors';

/**
 * A campaign's public detail page.
 *
 * "Join campaign" is the only route into the product from here, and it goes
 * through the simulated Google entry when there is no identity yet
 * (P03: 未登录可看公开详情，参加走明确Google模拟入口).
 */
export function CampaignDetailView({ campaignId }: { campaignId: string }) {
  return (
    <HydrationGate>
      <Detail campaignId={campaignId} />
    </HydrationGate>
  );
}

function Detail({ campaignId }: { campaignId: string }) {
  const t = useTranslations('public.campaign');
  const state = useDemoSnapshot();
  const signedIn = useIsSignedIn();

  // Only published campaigns are public: a draft must not be readable by url.
  const campaign = useMemo(
    () => selectPublicCampaigns(state).find((candidate) => candidate.id === campaignId) ?? null,
    [state, campaignId],
  );

  if (!campaign) {
    return (
      <EmptyState
        icon={Megaphone}
        title={t('notFoundTitle')}
        description={t('notFoundDescription')}
      >
        <Button asChild variant="outline">
          <Link href="/campaigns">{t('backToCatalogue')}</Link>
        </Button>
      </EmptyState>
    );
  }

  const orgName = state.orgs[campaign.orgId]?.name ?? campaign.orgId;
  const joinPath = `/creator/submissions/new?campaign=${campaign.id}`;
  const joinHref = signedIn ? joinPath : `/sign-in?next=${encodeURIComponent(joinPath)}`;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge group="campaign" code={campaign.status} />
          <Badge variant="outline" className="max-w-full">
            <span className="truncate">
              {t('org')}: {orgName}
            </span>
          </Badge>
        </div>
        <h1 className="font-heading text-2xl font-semibold break-words">{campaign.title}</h1>
        <p className="text-muted-foreground text-sm break-words">{campaign.brief}</p>
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" className="w-full sm:w-fit" data-testid="join-campaign">
            <Link href={joinHref}>
              {t('join')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          {signedIn ? null : (
            <p className="text-muted-foreground text-xs">{t('joinSignedOut')}</p>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('rules')}</h2>
        <CampaignRulesList campaign={campaign} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('calendar')}</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays aria-hidden="true" className="size-4" />
              {t('calendar')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <dl className="flex flex-col gap-2">
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground text-xs">{t('submissionsClose')}</dt>
                <dd>
                  <DateTimeText iso={campaign.submissionsCloseAt} />
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground text-xs">{t('metering')}</dt>
                <dd>{t('meteringValue', { days: campaign.rules.meteringDays })}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground text-xs">{t('grace')}</dt>
                <dd>{t('graceValue', { days: campaign.rules.claimGraceDays })}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground text-xs">{t('retention')}</dt>
                <dd>{t('retentionValue', { days: campaign.rules.retentionDays })}</dd>
              </div>
            </dl>
            <TimeZoneHint />
          </CardContent>
        </Card>
      </section>
    </article>
  );
}
