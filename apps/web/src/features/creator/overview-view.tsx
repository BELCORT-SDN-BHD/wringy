'use client';

/**
 * The creator's landing page: accounts, active submissions, open claims,
 * payments and notifications, each with the next action when there is nothing
 * to show yet ("Browse campaigns").
 *
 * Every figure comes from the same engine selectors the detail pages use, so the
 * summary can never contradict them.
 */

import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  FileVideo,
  HandCoins,
  TriangleAlert,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { BudgetBuckets } from '@/components/app/budget-buckets';
import { DataUnavailable } from '@/components/app/data-unavailable';
import { DateTimeText } from '@/components/app/date-time-text';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText } from '@/components/app/money-text';
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
import { formatViewsOrUnknown } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useActor } from '@/store/actor';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectBudget, selectUnreadCount } from '@/store/selectors';
import type { ReactNode } from 'react';

import { PageHeader, useConnectionCopy } from './creator-ui';
import {
  useCreatorClaims,
  useCreatorConnections,
  useCreatorOffers,
  useCreatorPayments,
  useCreatorSubmissions,
  useCreatorWaitlist,
  useNowIso,
} from './use-creator-data';

export function CreatorOverviewView() {
  return (
    <HydrationGate>
      <Overview />
    </HydrationGate>
  );
}

function Overview() {
  const t = useTranslations('creator.overview');
  const tSubmissions = useTranslations('creator.submissions');
  const tShell = useTranslations('common.shell');
  const tBudget = useTranslations('common.budget');
  const tViews = useTranslations('common.views');
  const locale = useAppLocale();
  const actor = useActor();
  const state = useDemoSnapshot();
  const nowIso = useNowIso();
  const { platformName } = useConnectionCopy();

  const connections = useCreatorConnections();
  const submissions = useCreatorSubmissions();
  const claims = useCreatorClaims();
  const offers = useCreatorOffers();
  const waitlist = useCreatorWaitlist();
  const payments = useCreatorPayments();

  const unread = useMemo(
    () => selectUnreadCount(state, actor.userId || null, actor.role),
    [state, actor.userId, actor.role],
  );

  const valid = connections.filter((connection) => connection.status === 'valid').length;
  const invalid = connections.length - valid;
  const pendingClaims = claims.filter(
    (row) =>
      row.claim.status === 'pending_review' ||
      row.claim.status === 'appealing' ||
      row.claim.status === 'rejected_appealable',
  ).length;
  const openOffers = offers.filter(
    (offer) => offer.offer.status === 'open' || offer.offer.status === 'stale',
  ).length;
  const waiting = waitlist.filter(
    (row) => row.entry.status === 'waiting' || row.entry.status === 'notified',
  ).length;
  const confirmedUnpaid = payments.filter(
    (record) => record.claimStatus === 'confirmed_unpaid',
  ).length;
  const paid = payments.filter((record) => record.claimStatus === 'paid').length;

  /**
   * Submissions whose source cannot be read right now. The last trusted number
   * and its time stay on the overview; a missing reading is never a zero and is
   * never read as fraud (ticket #4).
   */
  const unreadable = submissions.filter(
    ({ reward }) => reward !== null && reward.dataStatus !== 'trusted',
  );

  /**
   * The reward pool of every campaign this creator took part in. It is the same
   * four buckets the merchant and operations see, from the same selector, which
   * is the point: one record set, one set of numbers (three-role-flows §1).
   */
  const pools = useMemo(() => {
    const ids = [...new Set(submissions.map(({ submission }) => submission.campaignId))].sort();
    return ids.map((campaignId) => ({
      campaignId,
      title: state.campaigns[campaignId]?.title ?? campaignId,
      budget: selectBudget(state, campaignId),
    }));
  }, [state, submissions]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={
          <Badge variant="outline" className="max-w-full">
            <span className="truncate">
              <DateTimeText iso={nowIso} hideOffset />
            </span>
          </Badge>
        }
        actions={
          <Button asChild data-testid="overview-browse">
            <Link href="/campaigns">
              {t('browse')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {unreadable.length > 0 ? (
        <section className="flex flex-col gap-3" data-testid="overview-data-unavailable">
          {unreadable.map(({ submission, reward }) => (
            <DataUnavailable
              key={submission.id}
              lastTrustedAt={reward?.lastTrustedAt ?? null}
              lastValue={`${formatViewsOrUnknown(reward?.qualifiedViews ?? null, locale)} · ${tViews('qualifiedLabel')}`}
              reason={submission.status}
            />
          ))}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard
          icon={<UserRound aria-hidden="true" className="size-4" />}
          title={t('accountsTitle')}
          description={
            connections.length === 0
              ? t('accountsEmpty')
              : t('accountsCount', { valid, invalid })
          }
          hint={invalid > 0 ? t('accountsFix') : undefined}
          action={{ href: '/creator/accounts', label: t('accountsAction') }}
          testId="overview-accounts"
        >
          {connections.length === 0 ? null : (
            <div className="flex flex-wrap gap-2">
              {connections.map((connection) => (
                <Badge
                  key={connection.id}
                  variant="outline"
                  className="max-w-full"
                  data-connection-status={connection.status}
                >
                  <span className="truncate">
                    {platformName(connection.platform)} {connection.handle}
                  </span>
                </Badge>
              ))}
            </div>
          )}
        </SummaryCard>

        <SummaryCard
          icon={<HandCoins aria-hidden="true" className="size-4" />}
          title={t('claimsTitle')}
          description={
            claims.length === 0 && openOffers === 0 && waiting === 0
              ? t('claimsEmpty')
              : t('claimsCount', {
                  pending: pendingClaims,
                  offers: openOffers,
                  waitlisted: waiting,
                })
          }
          action={{ href: '/creator/claims', label: t('claimsAction') }}
          testId="overview-claims"
        />

        <SummaryCard
          icon={<Wallet aria-hidden="true" className="size-4" />}
          title={t('paymentsTitle')}
          description={
            payments.length === 0
              ? t('paymentsEmpty')
              : t('paymentsCount', { confirmed: confirmedUnpaid, paid })
          }
          action={{ href: '/creator/payments', label: t('paymentsAction') }}
          testId="overview-payments"
        />

        <SummaryCard
          icon={<Bell aria-hidden="true" className="size-4" />}
          title={t('notificationsTitle')}
          description={unread > 0 ? tShell('unreadCount', { count: unread }) : tShell('noUnread')}
          action={{ href: '/notifications', label: t('notificationsAction') }}
          testId="overview-notifications"
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('submissionsTitle')}</h2>
        {submissions.length === 0 ? (
          <Card data-testid="overview-submissions-empty">
            <CardHeader>
              <CardTitle className="text-base">{t('submissionsEmpty')}</CardTitle>
              <CardDescription>{t('submissionsEmptyHint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs">{t('nextStep')}</span>
              <div className="flex">
                <Button asChild data-testid="overview-browse-empty">
                  <Link href="/campaigns">
                    {t('browse')}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ItemGroup data-testid="overview-submissions">
            {submissions.map(({ submission, campaign, reward }) => (
              <Item
                key={submission.id}
                variant="outline"
                className="items-start"
                data-testid={`overview-submission-${submission.id}`}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex flex-wrap items-center gap-2">
                    <span className="break-words">{campaign?.title ?? submission.campaignId}</span>
                    <StatusBadge group="submission" code={submission.status} />
                  </ItemTitle>
                  <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      {tSubmissions('qualifiedLabel')}:{' '}
                      <span className="text-foreground">
                        {formatViewsOrUnknown(reward?.qualifiedViews ?? null, locale)}
                      </span>
                    </span>
                    <span>
                      {tSubmissions('estimateLabel')}:{' '}
                      <span className="text-foreground">
                        <MoneyText sen={reward?.cappedSen ?? null} />
                      </span>
                    </span>
                    <span>
                      {tSubmissions('claimableLabel')}:{' '}
                      <span className="text-foreground">
                        <MoneyText sen={reward?.claimableSen ?? null} />
                      </span>
                    </span>
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/creator/submissions/${submission.id}`}>
                      <span className="truncate">{tSubmissions('open')}</span>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
        <div className="flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/creator/submissions">
              <FileVideo aria-hidden="true" />
              <span className="truncate">{t('submissionsAction')}</span>
            </Link>
          </Button>
        </div>
      </section>

      {pools.length > 0 ? (
        <section className="flex flex-col gap-3" data-testid="overview-pools">
          <h2 className="font-heading text-lg font-medium">{tBudget('title')}</h2>
          {pools.map((pool) => (
            <Card key={pool.campaignId} data-campaign-id={pool.campaignId}>
              <CardHeader>
                <CardTitle className="text-base break-words">{pool.title}</CardTitle>
                <CardDescription>{tBudget('note')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BudgetBuckets budget={pool.budget} bare />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}

interface SummaryCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  hint?: string;
  action: { href: string; label: string };
  testId: string;
  children?: ReactNode;
}

function SummaryCard({
  icon,
  title,
  description,
  hint,
  action,
  testId,
  children,
}: SummaryCardProps) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="break-words">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        {hint ? (
          <p className="text-attention-foreground flex items-start gap-1.5 text-xs break-words">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {hint}
          </p>
        ) : null}
        <div className="flex">
          <Button asChild variant="outline" size="sm">
            <Link href={action.href}>
              <span className="truncate">{action.label}</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
