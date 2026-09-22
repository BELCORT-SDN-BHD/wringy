'use client';

/**
 * One submission, explained.
 *
 * The page keeps four facts apart (kickoff decision 3): the submission's own
 * metering status, the merchant's content review, the claims filed on it and any
 * payment. It never invents an acceptance time, never shows 0 for a missing
 * reading, and carries no control that adds views — the demo tools panel owns
 * the simulated clock and the simulated view data (ticket #4).
 */

import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  ExternalLink,
  FileVideo,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { ForbiddenState } from '@/components/app/forbidden-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { formatDateTime, formatViewsOrUnknown } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import type { ClaimDeadlineExtension, Submission, SubmissionStatus } from '@/domain/types';

import { DetailList, DetailRow, PageHeader, useConnectionCopy } from './creator-ui';
import { RewardPanel } from './reward-panel';
import { useSubmissionView, type SubmissionView } from './use-creator-data';

const STATUS_COPY: Record<SubmissionStatus, string> = {
  pending_baseline: 'statusPendingBaseline',
  baseline_unavailable: 'statusBaselineUnavailable',
  metering: 'statusMetering',
  data_unavailable: 'statusDataUnavailable',
  metering_ended: 'statusMeteringEnded',
};

export function CreatorSubmissionDetailView({ submissionId }: { submissionId: string }) {
  return (
    <HydrationGate>
      <Detail submissionId={submissionId} />
    </HydrationGate>
  );
}

function Detail({ submissionId }: { submissionId: string }) {
  const t = useTranslations('creator.detail');
  const view = useSubmissionView(submissionId);

  if (!view) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('metaTitle')} />
        <EmptyState
          icon={FileVideo}
          title={t('notFoundTitle')}
          description={t('notFoundDescription')}
        >
          <Button asChild variant="outline">
            <Link href="/creator/submissions">{t('backToList')}</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  // Another creator's record is refused rather than rendered empty.
  if (view.foreign) return <ForbiddenState homeHref="/creator/submissions" />;

  return <SubmissionDetail view={view} />;
}

function SubmissionDetail({ view }: { view: SubmissionView }) {
  const t = useTranslations('creator.detail');
  const tSubmissions = useTranslations('creator.submissions');
  const { platformName } = useConnectionCopy();
  const { submission, campaign, connection } = view;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={campaign?.title ?? submission.campaignId}
        subtitle={campaign?.brief}
        eyebrow={
          <>
            <StatusBadge group="submission" code={submission.status} />
            <StatusBadge group="content" code={submission.contentReview.status} />
            <Badge variant="outline">
              {tSubmissions('rulesVersion', { version: submission.rulesVersion })}
            </Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/creator/submissions">
                <span className="truncate">{t('backToList')}</span>
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <a href={submission.url} target="_blank" rel="noreferrer noopener">
                <span className="truncate">{t('openPost')}</span>
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </>
        }
      />

      <Alert data-testid="submission-status" data-submission-status={submission.status}>
        <Info aria-hidden="true" />
        <AlertTitle>{t('statusTitle')}</AlertTitle>
        <AlertDescription>{t(STATUS_COPY[submission.status])}</AlertDescription>
      </Alert>

      <Card data-testid="submission-baseline">
        <CardHeader>
          <CardTitle className="text-base">{t('baselineTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DetailList>
            <DetailRow
              label={t('acceptedAtLabel')}
              hint={submission.acceptedAt === null ? t('noAcceptance') : undefined}
              testId="submission-accepted-at"
            >
              <DateTimeText iso={submission.acceptedAt} />
            </DetailRow>
            <DetailRow
              label={t('baselineViewsLabel')}
              hint={t('baselineNote')}
              testId="submission-baseline-views"
            >
              <BaselineViews submission={submission} />
            </DetailRow>
            <DetailRow label={tSubmissions('accountLabel')}>
              {connection
                ? `${platformName(connection.platform)} ${connection.handle}`
                : platformName(submission.platform)}
            </DetailRow>
            <DetailRow label={t('openPost')}>
              <span className="break-all">{submission.url}</span>
            </DetailRow>
          </DetailList>
        </CardContent>
      </Card>

      <DeadlinesCard view={view} />

      <RewardPanel view={view} />

      <Card data-testid="content-review">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <ShieldCheck aria-hidden="true" className="size-4" />
            {t('contentReviewTitle')}
            <StatusBadge group="content" code={submission.contentReview.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm break-words">{t('contentReviewNote')}</p>
          <DetailList>
            <DetailRow label={t('contentReasonLabel')}>
              {submission.contentReview.reason ?? <span className="text-inactive-foreground">—</span>}
            </DetailRow>
            <DetailRow label={t('contentDecidedAtLabel')}>
              <DateTimeText iso={submission.contentReview.decidedAt} />
            </DetailRow>
          </DetailList>
        </CardContent>
      </Card>

      <ClaimsOnSubmission view={view} />

      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs break-words" data-testid="no-views-control">
          {t('noViewsControl')}
        </p>
        <p className="text-muted-foreground text-xs break-words" data-testid="resync-note">
          {t('resyncNote')}
        </p>
      </div>
    </div>
  );
}

/**
 * The baseline reading, or the localized unknown. A missing baseline is never
 * rendered as 0 views: nothing was metered at all.
 */
function BaselineViews({ submission }: { submission: Submission }) {
  const locale = useAppLocale();
  return (
    <span className="font-mono tabular-nums" data-baseline={submission.baselineViews ?? 'unknown'}>
      {formatViewsOrUnknown(submission.baselineViews, locale)}
    </span>
  );
}

function DeadlinesCard({ view }: { view: SubmissionView }) {
  const t = useTranslations('creator.detail');
  const { deadlines } = view;
  if (!deadlines) return null;

  return (
    <Card data-testid="submission-window">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <CalendarClock aria-hidden="true" className="size-4" />
          {t('windowTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <DetailList>
          <DetailRow label={t('meteringEndsLabel')} testId="metering-ends">
            <DateTimeText iso={deadlines.meteringEndsAt} />
          </DetailRow>
          <DetailRow label={t('baseDeadlineLabel')} testId="base-claim-deadline">
            <DateTimeText iso={deadlines.baseClaimDeadlineAt} />
          </DetailRow>
          <DetailRow label={t('claimDeadlineLabel')} testId="effective-claim-deadline">
            <DateTimeText iso={deadlines.effectiveClaimDeadlineAt} />
          </DetailRow>
        </DetailList>

        {deadlines.extensions.length > 0 ? (
          <div className="flex flex-col gap-2" data-testid="submission-extensions">
            <h3 className="text-sm font-medium">{t('extensionsTitle')}</h3>
            <ItemGroup>
              {deadlines.extensions.map((extension) => (
                <ExtensionRow key={extension.id} extension={extension} />
              ))}
            </ItemGroup>
            <p className="text-muted-foreground text-xs break-words">{t('extensionNote')}</p>
          </div>
        ) : null}

        <DetailList>
          <DetailRow
            label={t('retentionLabel')}
            hint={t(retentionReasonKey(deadlines.retentionReason))}
            testId="submission-retention"
          >
            <DateTimeText iso={deadlines.retentionEndsAt} />
          </DetailRow>
        </DetailList>

        <TimeZoneHint />
      </CardContent>
    </Card>
  );
}

function ExtensionRow({ extension }: { extension: ClaimDeadlineExtension }) {
  const t = useTranslations('creator.detail');
  const locale = useAppLocale();

  return (
    <Item variant="outline" size="sm" className="items-start" data-testid={`extension-${extension.id}`}>
      <ItemContent className="min-w-0">
        <ItemTitle className="break-words">
          {t('extensionRow', { deadline: formatDateTime(extension.newDeadlineAt, locale) })}
        </ItemTitle>
        <ItemDescription className="flex flex-col gap-0.5">
          <span className="break-words" data-extension-reason={extension.reason}>
            {extension.reason === 'data_outage'
              ? t('extensionReasonDataOutage')
              : t('extensionReasonPendingCase')}
          </span>
          <span className="flex flex-wrap items-center gap-1 text-xs">
            <DateTimeText iso={extension.notifiedAt} hideOffset />
          </span>
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

function ClaimsOnSubmission({ view }: { view: SubmissionView }) {
  const t = useTranslations('creator.detail');
  const tClaims = useTranslations('creator.claims');
  const { claims } = view;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-medium">{t('claimsTitle')}</h2>
      {claims.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('claimsEmpty')}</p>
      ) : (
        <ItemGroup data-testid="submission-claims">
          {claims.map((claim) => (
            <Item
              key={claim.id}
              variant="outline"
              className="items-start"
              data-testid={`submission-claim-${claim.id}`}
            >
              <ItemContent className="min-w-0">
                <ItemTitle className="flex flex-wrap items-center gap-2">
                  <MoneyText sen={claim.amountSen} tabular />
                  <StatusBadge group="claim" code={claim.status} />
                  <StatusBadge group="metering" code={claim.meteringReview.status} />
                </ItemTitle>
                <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{tClaims('queueLabel', { seq: claim.seq })}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {tClaims('validAtLabel')}
                    <DateTimeText iso={claim.validAt} hideOffset />
                  </span>
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/creator/claims/${claim.id}`}>
                    <span className="truncate">{t('openClaim')}</span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </section>
  );
}

function retentionReasonKey(reason: string): string {
  if (reason === 'claim_deadline') return 'retentionReasonClaimDeadline';
  if (reason === 'open_cases') return 'retentionReasonOpenCases';
  if (reason === 'confirmed_unpaid') return 'retentionReasonConfirmedUnpaid';
  return 'retentionReasonPublished';
}
