'use client';

/**
 * One claim, with the evidence it froze and the four separate facts around it.
 *
 * What this page must never merge (kickoff decision 3, ticket #6): the content
 * review is the merchant's, the metering review is operations', the claim status
 * is the money's classification, and a payment is a fourth fact. A rejection
 * keeps its reservation visible as held until operations finalise it, and the
 * 48-hour review target only escalates — it never approves anything.
 */

import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  CircleCheck,
  CircleDashed,
  HandCoins,
  Hourglass,
  ShieldCheck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { ForbiddenState } from '@/components/app/forbidden-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { TimelineList, type TimelineEntry } from '@/components/app/timeline-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { REVIEW_TARGET_HOURS } from '@/domain';
import { formatAuditAction } from '@/lib/audit-copy';
import { formatSen, formatViews } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import type { ClaimStatus } from '@/domain/types';

import { AppealPanel } from './appeal-panel';
import { DetailList, DetailRow, PageHeader } from './creator-ui';
import { useClaimView, useNowIso, type ClaimView } from './use-creator-data';

export function CreatorClaimDetailView({ claimId }: { claimId: string }) {
  return (
    <HydrationGate>
      <Detail claimId={claimId} />
    </HydrationGate>
  );
}

function Detail({ claimId }: { claimId: string }) {
  const t = useTranslations('creator.claimDetail');
  const view = useClaimView(claimId);
  const nowIso = useNowIso();

  if (!view) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('metaTitle')} />
        <EmptyState
          icon={HandCoins}
          title={t('notFoundTitle')}
          description={t('notFoundDescription')}
        >
          <Button asChild variant="outline">
            <Link href="/creator/claims">{t('back')}</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  if (view.foreign) return <ForbiddenState homeHref="/creator/claims" />;

  return <ClaimDetail view={view} nowIso={nowIso} />;
}

function ClaimDetail({ view, nowIso }: { view: ClaimView; nowIso: string }) {
  const t = useTranslations('creator.claimDetail');
  const tClaims = useTranslations('creator.claims');
  const tActions = useTranslations('common.actions');
  const locale = useAppLocale();
  const { claim, campaign, submission, appeal, obligation, audit, actorNames } = view;

  const timeline: TimelineEntry[] = audit.map((entry) => ({
    id: entry.id,
    at: entry.at,
    title: formatAuditAction(entry.action, tActions),
    actor: actorNames[entry.actorUserId] ?? entry.actorUserId,
    reason: entry.reason,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={campaign?.title ?? claim.campaignId}
        subtitle={t('evidenceNote')}
        eyebrow={
          <>
            <StatusBadge group="claim" code={claim.status} />
            <StatusBadge group="metering" code={claim.meteringReview.status} />
            {submission ? (
              <StatusBadge group="content" code={submission.contentReview.status} />
            ) : null}
            {claim.isPartial ? (
              <Badge variant="outline" className="max-w-full">
                <span className="truncate">
                  {t('partialLabel', {
                    remainder: formatSen(claim.unreservedRemainderSen, locale),
                  })}
                </span>
              </Badge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/creator/claims">
                <span className="truncate">{t('back')}</span>
              </Link>
            </Button>
            {submission ? (
              <Button asChild variant="ghost">
                <Link href={`/creator/submissions/${submission.id}`}>
                  <span className="truncate">{t('openSubmission')}</span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <Card data-testid="claim-summary">
        <CardHeader>
          <CardTitle className="text-base">{t('amountLabel')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList>
            <DetailRow label={t('amountLabel')} testId="claim-amount">
              <MoneyText sen={claim.amountSen} tabular />
            </DetailRow>
            <DetailRow label={t('queueLabel')} testId="claim-queue">
              <span data-claim-seq={claim.seq}>{tClaims('queueLabel', { seq: claim.seq })}</span>
            </DetailRow>
            <DetailRow label={t('validAtLabel')} testId="claim-valid-at">
              <DateTimeText iso={claim.validAt} />
            </DetailRow>
          </DetailList>
          <TimeZoneHint className="mt-2" />
        </CardContent>
      </Card>

      <Card data-testid="claim-evidence">
        <CardHeader>
          <CardTitle className="text-base">{t('evidenceTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DetailList>
            <DetailRow label={t('snapshotLabel')} testId="claim-snapshot">
              {claim.snapshotVersion}
            </DetailRow>
            <DetailRow label={t('viewsAtClaimLabel')} testId="claim-views">
              <span className="font-mono tabular-nums">
                {formatViews(claim.qualifiedViewsAtClaim, locale)}
              </span>
            </DetailRow>
            <DetailRow label={t('cutoffLabel')} testId="claim-cutoff">
              <DateTimeText iso={claim.meteringCutoffAt} />
            </DetailRow>
            <DetailRow label={t('rulesVersionLabel')}>{claim.rulesVersion}</DetailRow>
          </DetailList>
          <p className="text-muted-foreground text-xs break-words">{t('evidenceNote')}</p>
        </CardContent>
      </Card>

      <Card data-testid="claim-stages">
        <CardHeader>
          <CardTitle className="text-base">{t('timelineTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <StageList view={view} />
          <p className="text-muted-foreground text-xs break-words">{t('timelineNote')}</p>
        </CardContent>
      </Card>

      {claim.escalatedAt !== null ? (
        <Alert className="bg-attention-subtle text-attention-foreground" data-testid="claim-escalated">
          <Hourglass aria-hidden="true" className="text-attention-foreground" />
          <AlertTitle>{t('escalatedTitle')}</AlertTitle>
          <AlertDescription className="text-attention-foreground">
            {t('escalatedDescription', { hours: REVIEW_TARGET_HOURS })}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="claim-content-review">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <ShieldCheck aria-hidden="true" className="size-4" />
              {t('contentTitle')}
              {submission ? (
                <StatusBadge group="content" code={submission.contentReview.status} />
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label={t('reasonLabel')}>
                {submission?.contentReview.reason ?? (
                  <span className="text-inactive-foreground">—</span>
                )}
              </DetailRow>
              <DetailRow label={t('decidedAtLabel')}>
                <DateTimeText iso={submission?.contentReview.decidedAt ?? null} />
              </DetailRow>
            </DetailList>
          </CardContent>
        </Card>

        <Card data-testid="claim-metering-review">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <CircleCheck aria-hidden="true" className="size-4" />
              {t('meteringTitle')}
              <StatusBadge group="metering" code={claim.meteringReview.status} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label={t('reasonLabel')} testId="metering-reason">
                {claim.meteringReview.reason ?? <span className="text-inactive-foreground">—</span>}
              </DetailRow>
              <DetailRow label={t('decidedAtLabel')}>
                <DateTimeText iso={claim.meteringReview.decidedAt} />
              </DetailRow>
              <DetailRow label={t('decidedByLabel')}>
                {claim.meteringReview.decidedBy === null
                  ? '—'
                  : (actorNames[claim.meteringReview.decidedBy] ?? claim.meteringReview.decidedBy)}
              </DetailRow>
            </DetailList>
          </CardContent>
        </Card>
      </div>

      {claim.status === 'rejected_final' ? (
        <Alert data-testid="reservation-released">
          <CircleDashed aria-hidden="true" />
          <AlertTitle>{t('releasedTitle')}</AlertTitle>
          <AlertDescription>{t('releasedDescription')}</AlertDescription>
        </Alert>
      ) : null}

      <AppealPanel claim={claim} appeal={appeal} nowIso={nowIso} />

      {obligation ? (
        <Alert data-testid="claim-payment">
          <Banknote aria-hidden="true" />
          <AlertTitle>{t('paymentTitle')}</AlertTitle>
          <AlertDescription>
            <span className="flex flex-col gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge group="obligation" code={obligation.status} />
                <StatusBadge group="bankSettlement" code={obligation.bankSettlement} />
              </span>
              <span className="flex">
                <Button asChild variant="outline" size="sm">
                  <Link href="/creator/payments">{t('openPayments')}</Link>
                </Button>
              </span>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('auditTitle')}</h2>
        <TimelineList entries={timeline} />
      </section>
    </div>
  );
}

/**
 * The named stages, each marked done, now or not yet. The rejection track is
 * shown only once a rejection exists, so a healthy claim does not advertise one.
 */
function StageList({ view }: { view: ClaimView }) {
  const t = useTranslations('creator.claimDetail');
  const { claim, appeal } = view;
  const status: ClaimStatus = claim.status;

  const stages: Array<{ key: string; label: string; done: boolean; current: boolean }> = [
    {
      key: 'pending_review',
      label: t('stagePendingReview'),
      done: status !== 'pending_review',
      current: status === 'pending_review',
    },
  ];

  if (claim.rejection !== null || status === 'rejected_final') {
    stages.push({
      key: 'rejected_appealable',
      label: t('stageRejected'),
      done: status === 'appealing' || status === 'rejected_final',
      current: status === 'rejected_appealable',
    });
    if (appeal !== null) {
      stages.push({
        key: 'appealing',
        label: t('stageAppealing'),
        done: appeal.status !== 'open',
        current: status === 'appealing',
      });
    }
    stages.push({
      key: 'rejected_final',
      label: t('stageRejectedFinal'),
      done: status === 'rejected_final',
      current: status === 'rejected_final',
    });
  }

  if (status === 'confirmed_unpaid' || status === 'paid' || claim.rejection === null) {
    stages.push({
      key: 'confirmed_unpaid',
      label: t('stageConfirmedUnpaid'),
      done: status === 'paid',
      current: status === 'confirmed_unpaid',
    });
    stages.push({
      key: 'paid',
      label: t('stagePaid'),
      done: status === 'paid',
      current: status === 'paid',
    });
  }

  return (
    <ol className="flex flex-col gap-2" data-testid="claim-stage-list">
      {stages.map((stage) => (
        <li
          key={stage.key}
          className="flex min-w-0 flex-wrap items-center gap-2"
          data-stage={stage.key}
          data-stage-state={stage.current ? 'current' : stage.done ? 'done' : 'pending'}
        >
          {stage.current ? (
            <Hourglass aria-hidden="true" className="text-info-foreground size-4" />
          ) : stage.done ? (
            <CircleCheck aria-hidden="true" className="text-success-foreground size-4" />
          ) : (
            <CircleDashed aria-hidden="true" className="text-inactive-foreground size-4" />
          )}
          <span className="text-sm break-words">{stage.label}</span>
          <span className="text-muted-foreground text-xs">
            {stage.current ? t('stageCurrent') : stage.done ? t('stageReached') : t('stagePending')}
          </span>
        </li>
      ))}
    </ol>
  );
}
