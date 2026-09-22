'use client';

/**
 * The merchant landing page: who you are acting for, what state the campaigns are
 * in, the reward pool of the open ones, the content waiting for a decision and the
 * most recent events.
 *
 * It answers the three questions the merchant pages list in three-role-flows-v1 §3
 * for "活动列表／总览" — find a campaign, see the pool being used, and get to the work
 * that is waiting — and it shows the empty state rather than an empty grid when the
 * organisation has no campaign yet.
 */

import Link from 'next/link';
import { Bell, Megaphone } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { BudgetBuckets } from '@/components/app/budget-buckets';
import { DateTimeText } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { StatusBadge } from '@/components/app/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { formatCount } from '@/lib/format';
import { notificationValues } from '@/lib/notification-copy';
import { useAppLocale } from '@/lib/use-app-locale';
import { useActor } from '@/store/actor';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectNotificationsSorted } from '@/store/selectors';

import { NewCampaignButton } from './campaign-list-view';
import {
  useMerchantCampaignRows,
  useMerchantOrg,
  useMerchantStatusCounts,
  useMerchantSubmissionRows,
} from './hooks';
import { isCampaignOpen } from './selectors';

export function MerchantOverviewView() {
  return (
    <HydrationGate>
      <Overview />
    </HydrationGate>
  );
}

function Overview() {
  const t = useTranslations('merchant.overview');
  const tDetail = useTranslations('merchant.detail');
  const tKinds = useTranslations('notifications.kinds');
  const tState = useTranslations('common.state');
  const locale = useAppLocale();
  const actor = useActor();
  const state = useDemoSnapshot();
  const org = useMerchantOrg();
  const rows = useMerchantCampaignRows();
  const statusCounts = useMerchantStatusCounts();
  const submissions = useMerchantSubmissionRows();

  const pendingReviews = useMemo(
    () => submissions.filter((row) => row.submission.contentReview.status === 'pending'),
    [submissions],
  );

  const notifications = useMemo(
    () => selectNotificationsSorted(state, actor.userId || null, actor.role).slice(0, 4),
    [state, actor.userId, actor.role],
  );

  const openCampaigns = rows.filter((row) => isCampaignOpen(row.campaign));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            {t('org')}: <span className="text-foreground font-medium">{org?.name ?? '—'}</span>
          </p>
          <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
          <p className="text-muted-foreground text-xs">
            <DateTimeText iso={state.clock.nowIso} />
          </p>
        </div>
        <NewCampaignButton />
      </header>

      {rows.length === 0 ? (
        <EmptyState icon={Megaphone} title={t('emptyTitle')} description={t('emptyDescription')}>
          <NewCampaignButton />
        </EmptyState>
      ) : (
        <>
          <Card data-testid="overview-status-counts">
            <CardHeader>
              <CardTitle className="text-base">{t('statusTitle')}</CardTitle>
              <CardDescription>{t('statusDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {statusCounts.map(({ status, count }) => (
                  <div
                    key={status}
                    className="bg-muted/40 flex min-w-0 flex-col gap-1 rounded-lg border p-3"
                    data-status={status}
                    data-count={count}
                  >
                    <dt className="text-xs">
                      <StatusBadge group="campaign" code={status} />
                    </dt>
                    <dd className="font-mono text-sm font-medium tabular-nums">
                      {formatCount(count, locale)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <section className="flex flex-col gap-3" data-testid="overview-budgets">
            <h2 className="font-heading text-lg font-medium">{t('budgetTitle')}</h2>
            <p className="text-muted-foreground text-xs">{t('budgetDescription')}</p>
            {openCampaigns.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('budgetNone')}</p>
            ) : (
              openCampaigns.map((row) => (
                <Card key={row.campaign.id} data-campaign-id={row.campaign.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base break-words">
                      <Link
                        href={`/merchant/campaigns/${row.campaign.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {row.campaign.title}
                      </Link>
                      <StatusBadge group="campaign" code={row.campaign.status} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <BudgetBuckets budget={row.budget} bare />
                    <p className="text-muted-foreground text-xs break-words">
                      {tDetail('budgetNote')}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        </>
      )}

      <section className="flex flex-col gap-3" data-testid="overview-pending-reviews">
        <h2 className="font-heading text-lg font-medium">{t('reviewsTitle')}</h2>
        {pendingReviews.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('reviewsNone')}</p>
        ) : (
          <>
            <Badge
              className="bg-attention-subtle text-attention-foreground w-fit border-transparent"
              data-testid="pending-review-count"
            >
              {t('reviewsCount', { count: pendingReviews.length })}
            </Badge>
            <ItemGroup>
              {pendingReviews.map((row) => (
                <Item
                  key={row.submission.id}
                  variant="outline"
                  size="sm"
                  className="items-start"
                  data-submission-id={row.submission.id}
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle className="break-words">{row.creatorName}</ItemTitle>
                    <ItemDescription className="break-words">{row.campaign.title}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/merchant/submissions/${row.submission.id}`}>
                        <span className="truncate">{t('reviewsOpen')}</span>
                      </Link>
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3" data-testid="overview-events">
        <h2 className="font-heading text-lg font-medium">{t('eventsTitle')}</h2>
        {notifications.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('eventsNone')}</p>
        ) : (
          <ItemGroup>
            {notifications.map((notification) => (
              <Item
                key={notification.id}
                variant="outline"
                size="sm"
                className="items-start"
                data-unread={notification.readAt === null}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="break-words">
                    {tKinds(`${notification.kind}.title`)}
                  </ItemTitle>
                  <ItemDescription className="flex flex-col gap-1">
                    <span className="break-words">
                      {tKinds(
                        `${notification.kind}.body`,
                        notificationValues(
                          notification.kind,
                          notification.params,
                          locale,
                          tState('unknown'),
                        ),
                      )}
                    </span>
                    <DateTimeText iso={notification.createdAt} hideOffset />
                  </ItemDescription>
                </ItemContent>
                {notification.href ? (
                  <ItemActions>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={notification.href}>
                        <span className="truncate">{t('reviewsOpen')}</span>
                      </Link>
                    </Button>
                  </ItemActions>
                ) : null}
              </Item>
            ))}
          </ItemGroup>
        )}
        <Button asChild variant="outline" size="sm" className="w-full sm:w-fit">
          <Link href="/notifications">
            <Bell aria-hidden="true" />
            <span className="truncate">{t('eventsAll')}</span>
          </Link>
        </Button>
      </section>

      <div className="flex">
        <Button asChild variant="ghost">
          <Link href="/merchant/campaigns">{t('allCampaigns')}</Link>
        </Button>
      </div>
    </div>
  );
}
