'use client';

/**
 * The creator's submissions.
 *
 * Each row carries the submission status, the merchant's separate content
 * review, the last trusted qualified-view count with its time, and the
 * estimate — labelled as an estimate, because an estimate is not a confirmed
 * payment (three-role-flows §4).
 */

import Link from 'next/link';
import { ArrowRight, FileVideo } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DateTimeText } from '@/components/app/date-time-text';
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

import { PageHeader, useConnectionCopy } from './creator-ui';
import { useCreatorSubmissions, type SubmissionRow } from './use-creator-data';

export function CreatorSubmissionsView() {
  return (
    <HydrationGate>
      <Submissions />
    </HydrationGate>
  );
}

function Submissions() {
  const t = useTranslations('creator.submissions');
  const rows = useCreatorSubmissions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button asChild variant="outline">
            <Link href="/campaigns">
              <span className="truncate">{t('browse')}</span>
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={FileVideo} title={t('empty')} description={t('emptyHint')}>
          <Button asChild data-testid="submissions-browse">
            <Link href="/campaigns">
              {t('browse')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <ItemGroup data-testid="submissions-list">
          {rows.map((row) => (
            <SubmissionRowItem key={row.submission.id} row={row} />
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

function SubmissionRowItem({ row }: { row: SubmissionRow }) {
  const t = useTranslations('creator.submissions');
  const locale = useAppLocale();
  const { platformName } = useConnectionCopy();
  const { submission, campaign, reward } = row;

  return (
    <Item
      variant="outline"
      className="items-start"
      data-testid={`submission-${submission.id}`}
      data-submission-status={submission.status}
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <span className="break-words">{campaign?.title ?? submission.campaignId}</span>
          <StatusBadge group="submission" code={submission.status} />
          <StatusBadge group="content" code={submission.contentReview.status} />
        </ItemTitle>
        <ItemDescription className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="break-words">
              {t('accountLabel')}: {platformName(submission.platform)}
            </span>
            <Badge variant="outline">{t('rulesVersion', { version: submission.rulesVersion })}</Badge>
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="break-words">
              {t('qualifiedLabel')}:{' '}
              <span className="text-foreground font-medium">
                {formatViewsOrUnknown(reward?.qualifiedViews ?? null, locale)}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-1">
              {t('lastTrusted')}
              <DateTimeText iso={reward?.lastTrustedAt ?? null} hideOffset />
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {t('estimateLabel')}:{' '}
              <span className="text-foreground font-medium">
                <MoneyText sen={reward?.cappedSen ?? null} tabular />
              </span>
            </span>
            <span>
              {t('claimableLabel')}:{' '}
              <span className="text-foreground font-medium">
                <MoneyText sen={reward?.claimableSen ?? null} tabular />
              </span>
            </span>
          </span>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button asChild variant="outline" size="sm">
          <Link href={`/creator/submissions/${submission.id}`}>
            <span className="truncate">{t('open')}</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </ItemActions>
    </Item>
  );
}
