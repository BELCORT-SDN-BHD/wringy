'use client';

/**
 * Every submission across the organisation's campaigns, with the work that is
 * still waiting first.
 *
 * Three columns of status, never one: the content decision (the merchant's), the
 * metering state of the submission, and the claim (operations and finance own
 * what happens to it). That separation is the point of the page.
 */

import Link from 'next/link';
import { FileVideo } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/app/empty-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { Platform } from '@/domain/types';

import { useMerchantSubmissionRows } from './hooks';
import type { MerchantSubmissionRow } from './selectors';

const PLATFORM_KEY: Record<Platform, string> = {
  tiktok: 'platformTikTok',
  instagram: 'platformInstagram',
  youtube: 'platformYouTube',
};

export function MerchantSubmissionListView() {
  return (
    <HydrationGate>
      <SubmissionList />
    </HydrationGate>
  );
}

function SubmissionList() {
  const t = useTranslations('merchant.submissions');
  const rows = useMerchantSubmissionRows();

  const { pending, decided } = useMemo(() => {
    return {
      pending: rows.filter((row) => row.submission.contentReview.status === 'pending'),
      decided: rows.filter((row) => row.submission.contentReview.status !== 'pending'),
    };
  }, [rows]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <EmptyState icon={FileVideo} title={t('none')} description={t('emptyDescription')} />
      ) : (
        <>
          {pending.length > 0 ? (
            <Section title={t('pendingFirst')} rows={pending} testId="submissions-pending" />
          ) : null}
          {decided.length > 0 ? (
            <Section title={t('decided')} rows={decided} testId="submissions-decided" />
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  testId,
}: {
  title: string;
  rows: MerchantSubmissionRow[];
  testId: string;
}) {
  const t = useTranslations('merchant.detail');
  const tPublic = useTranslations('public.campaign');
  const locale = useAppLocale();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-medium">{title}</h2>
      <ItemGroup data-testid={testId}>
        {rows.map((row) => (
          <Item
            key={row.submission.id}
            variant="outline"
            className="items-start"
            data-submission-id={row.submission.id}
          >
            <ItemContent className="min-w-0">
              <ItemTitle className="flex flex-wrap items-center gap-2">
                <span className="break-words">{row.creatorName}</span>
                <Badge variant="outline">{tPublic(PLATFORM_KEY[row.submission.platform])}</Badge>
              </ItemTitle>
              <ItemDescription className="flex flex-col gap-1">
                <Link
                  href={`/merchant/campaigns/${row.campaign.id}`}
                  className="break-words underline-offset-4 hover:underline"
                >
                  {row.campaign.title}
                </Link>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge group="content" code={row.submission.contentReview.status} />
                  <StatusBadge group="submission" code={row.submission.status} />
                  {row.claim ? <StatusBadge group="claim" code={row.claim.status} /> : null}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {t('reportQualifiedViews')}:{' '}
                    {formatViewsOrUnknown(row.reward?.qualifiedViews ?? null, locale)}
                  </span>
                  <span>
                    {t('colAmount')}: <MoneyText sen={row.reward?.cappedSen ?? null} />
                  </span>
                </span>
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button asChild variant="outline" size="sm">
                <Link href={`/merchant/submissions/${row.submission.id}`}>
                  <span className="truncate">{t('review')}</span>
                </Link>
              </Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}
