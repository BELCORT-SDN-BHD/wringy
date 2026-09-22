'use client';

/**
 * Content review for one submission.
 *
 * The page is laid out so a content approval can never be read as a payment
 * (kickoff decision 3, three-role-flows-v1 §4). The merchant's own decision is one
 * panel; the metering review that operations own is a second, read-only panel that
 * says so in its heading; the reward figures are a third, read-only panel. Nothing
 * on this page turns green because the content passed — the claim keeps its own
 * status badge, and `StatusBadge` deliberately does not paint `confirmed_unpaid`
 * green either.
 *
 * A rejection needs a written reason, which is what the audit entry records, so it
 * goes through the official `AlertDialog` composition with a required reason field
 * (`ConfirmDialog`), not a bare button.
 *
 * The post link leaves the product, so it is `target="_blank"` with an accessible
 * name that says a new tab opens.
 */

import Link from 'next/link';
import { CalendarClock, CircleCheck, CircleSlash, ExternalLink, FileVideo } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ReactNode } from 'react';

import { DataUnavailable } from '@/components/app/data-unavailable';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { CommandErrorAlert } from '@/components/app/error-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { TimelineList, type TimelineEntry } from '@/components/app/timeline-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAuditAction } from '@/lib/audit-copy';
import { formatDateTime, formatViewsOrUnknown } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectAuditFor } from '@/store/selectors';
import type {
  ClaimDeadlineExtension,
  Platform,
  SubmissionDeadlinesView,
} from '@/domain/types';

import { useMerchantCommand, useOwnSubmission } from './hooks';

const PLATFORM_KEY: Record<Platform, string> = {
  tiktok: 'platformTikTok',
  instagram: 'platformInstagram',
  youtube: 'platformYouTube',
};

export function MerchantContentReviewView({ submissionId }: { submissionId: string }) {
  return (
    <HydrationGate>
      <Review submissionId={submissionId} />
    </HydrationGate>
  );
}

function Review({ submissionId }: { submissionId: string }) {
  const t = useTranslations('merchant.review');
  const tPublic = useTranslations('public.campaign');
  const tDetail = useTranslations('merchant.detail');
  const tActions = useTranslations('common.actions');
  const locale = useAppLocale();
  const state = useDemoSnapshot();
  const detail = useOwnSubmission(submissionId);
  const run = useMerchantCommand();
  const [failure, setFailure] = useState<{ code: string; detail?: string } | null>(null);

  const audit = useMemo(
    () => selectAuditFor(state, 'submission', submissionId),
    [state, submissionId],
  );

  if (!detail) {
    return (
      <EmptyState icon={FileVideo} title={t('notFoundTitle')} description={t('notFoundDescription')}>
        <Button asChild variant="outline">
          <Link href="/merchant/submissions">{t('back')}</Link>
        </Button>
      </EmptyState>
    );
  }

  const { submission, campaign, creatorName, reward, claim } = detail;
  const pending = submission.contentReview.status === 'pending';

  const decide = (decision: 'approve' | 'reject', reason: string | null) => {
    setFailure(null);
    const result = run({
      type: 'submission.reviewContent',
      submissionId: submission.id,
      decision,
      reason,
    });
    if (!result.ok) {
      setFailure({ code: result.code, detail: result.detail });
      toast.error(t('decisionFailed'));
      return;
    }
    toast.success(decision === 'approve' ? t('approved') : t('rejected'));
  };

  const timeline: TimelineEntry[] = audit.map((entry) => ({
    id: entry.id,
    at: entry.at,
    title: formatAuditAction(entry.action, tActions),
    actor: state.users[entry.actorUserId]?.displayName ?? entry.actorUserId,
    reason: entry.reason,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge group="content" code={submission.contentReview.status} />
          <Badge variant="outline">{tPublic(PLATFORM_KEY[submission.platform])}</Badge>
          <Badge variant="outline">
            <span className="truncate">{t('rulesVersion', { version: submission.rulesVersion })}</span>
          </Badge>
        </div>
        <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>

      {failure ? <CommandErrorAlert code={failure.code} detail={failure.detail} /> : null}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <dl className="flex flex-col">
            <Row label={t('creator')} value={creatorName} />
            <Row
              label={t('campaign')}
              value={
                <Link
                  href={`/merchant/campaigns/${campaign.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {campaign.title}
                </Link>
              }
            />
            <Row
              label={t('postLink')}
              value={
                <a
                  href={submission.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={t('postLinkAction')}
                  data-testid="submission-post-link"
                  className="inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
                >
                  <span className="truncate break-all">{submission.url}</span>
                  <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                </a>
              }
              hint={t('postLinkAction')}
            />
            <Row label={t('submittedAt')} value={<DateTimeText iso={submission.submittedAt} />} />
            <Row label={t('acceptedAt')} value={<DateTimeText iso={submission.acceptedAt} />} />
          </dl>
        </CardContent>
      </Card>

      {/* The merchant's own decision */}
      <Card data-testid="content-decision">
        <CardHeader>
          <CardTitle className="text-base">{t('contentTitle')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pending ? (
            <p className="text-muted-foreground text-sm">{t('contentPending')}</p>
          ) : (
            <Alert
              className={
                submission.contentReview.status === 'approved'
                  ? 'bg-success-subtle'
                  : 'bg-error-subtle'
              }
              data-testid="content-decided"
            >
              {submission.contentReview.status === 'approved' ? (
                <CircleCheck aria-hidden="true" className="text-success-foreground" />
              ) : (
                <CircleSlash aria-hidden="true" className="text-error-foreground" />
              )}
              <AlertTitle>
                {submission.contentReview.status === 'approved' ? t('approved') : t('rejected')}
              </AlertTitle>
              <AlertDescription>
                <span className="flex flex-wrap items-center gap-2">
                  <span>{t('decidedAt')}</span>
                  <DateTimeText iso={submission.contentReview.decidedAt} hideOffset />
                </span>
                {submission.contentReview.reason ? (
                  <span className="break-words" data-testid="content-reason">
                    {submission.contentReview.reason}
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
          )}

          {pending ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <ConfirmDialog
                title={t('approve')}
                description={t('approveDescription')}
                confirmLabel={t('approve')}
                onConfirm={() => decide('approve', null)}
                trigger={
                  <Button data-testid="content-approve">
                    <CircleCheck aria-hidden="true" />
                    <span className="truncate">{t('approve')}</span>
                  </Button>
                }
              />
              <ConfirmDialog
                title={t('reject')}
                description={t('rejectDescription')}
                confirmLabel={t('reject')}
                destructive
                requireReason
                reasonLabel={tDetail('reasonLabel')}
                onConfirm={(reason) => decide('reject', reason)}
                trigger={
                  <Button variant="destructive" data-testid="content-reject">
                    <CircleSlash aria-hidden="true" />
                    <span className="truncate">{t('reject')}</span>
                  </Button>
                }
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Operations own this one */}
      <Card data-testid="metering-panel">
        <CardHeader>
          <CardTitle className="text-base">{t('meteringTitle')}</CardTitle>
          <CardDescription>{t('meteringDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {claim === null ? (
            <p className="text-muted-foreground text-sm">{t('meteringNoClaim')}</p>
          ) : (
            <dl className="flex flex-col">
              <Row
                label={t('meteringClaimLabel')}
                value={
                  <span className="flex flex-wrap items-center gap-2">
                    <MoneyText sen={claim.amountSen} tabular />
                    <StatusBadge group="claim" code={claim.status} />
                  </span>
                }
              />
              <Row
                label={tDetail('colMetering')}
                value={<StatusBadge group="metering" code={claim.meteringReview.status} />}
                hint={claim.meteringReview.reason ?? undefined}
              />
              <Row label={tDetail('colQueue')} value={String(claim.seq)} />
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Reward, read-only */}
      <Card data-testid="reward-panel">
        <CardHeader>
          <CardTitle className="text-base">{t('rewardTitle')}</CardTitle>
          <CardDescription>{t('rewardNote')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label={t('rewardQualifiedViews')}
              value={formatViewsOrUnknown(reward?.qualifiedViews ?? null, locale)}
            />
            <Stat label={t('rewardCapped')} value={<MoneyText sen={reward?.cappedSen ?? null} tabular />} />
            <Stat
              label={t('rewardOccupied')}
              value={
                <MoneyText
                  sen={
                    reward
                      ? reward.reservedSen + reward.confirmedUnpaidSen + reward.paidSen
                      : null
                  }
                  tabular
                />
              }
            />
            <Stat
              label={t('rewardClaimable')}
              value={<MoneyText sen={reward?.claimableSen ?? null} tabular />}
            />
          </dl>
          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span>{t('rewardLastTrusted')}</span>
            <DateTimeText iso={reward?.lastTrustedAt ?? null} />
          </p>
          {reward && reward.dataStatus !== 'trusted' ? (
            <DataUnavailable
              lastTrustedAt={reward.lastTrustedAt}
              lastValue={`${formatViewsOrUnknown(reward.qualifiedViews, locale)} · ${t('rewardQualifiedViews')}`}
              reason={submission.status}
            />
          ) : null}
        </CardContent>
      </Card>

      <DeadlinesCard deadlines={detail.deadlines} />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('historyTitle')}</h2>
        <TimelineList entries={timeline} />
      </section>

      <div className="flex">
        <Button asChild variant="outline">
          <Link href="/merchant/submissions">{t('back')}</Link>
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-muted-foreground w-full shrink-0 text-xs sm:w-48">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm break-words">{value}</span>
        {hint ? <span className="text-muted-foreground text-xs break-words">{hint}</span> : null}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-muted/40 flex min-w-0 flex-col gap-1 rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs break-words">{label}</dt>
      <dd className="text-sm font-medium break-words">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metering window, claim deadline, extensions and retention
// ---------------------------------------------------------------------------

/**
 * The same four dates the creator and operations read, on the merchant's copy of
 * the submission.
 *
 * Ticket #8 wants the metering end and the claim deadline "shown identically" to
 * all three roles, and the merchant is the party that chose the 7-day windows —
 * reading them only on the creator's page would leave the merchant guessing when
 * their own obligation ends. Every value comes from `selectSubmissionDeadlines`,
 * so there is one computation and three renderings of it, never three
 * computations.
 */
function DeadlinesCard({ deadlines }: { deadlines: SubmissionDeadlinesView | null }) {
  const t = useTranslations('merchant.review');
  const locale = useAppLocale();
  if (!deadlines) return null;

  return (
    <Card data-testid="merchant-window">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <CalendarClock aria-hidden="true" className="size-4" />
          {t('windowTitle')}
        </CardTitle>
        <CardDescription>{t('windowNote')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col">
          <Row
            label={t('windowAccepted')}
            value={<DateTimeText iso={deadlines.acceptedAt} />}
          />
          <Row
            label={t('windowMeteringEnds')}
            value={
              <span data-testid="merchant-metering-ends">
                <DateTimeText iso={deadlines.meteringEndsAt} />
              </span>
            }
            hint={t('windowMeteringEndsNote')}
          />
          <Row
            label={t('windowBaseDeadline')}
            value={
              <span data-testid="merchant-base-claim-deadline">
                <DateTimeText iso={deadlines.baseClaimDeadlineAt} />
              </span>
            }
          />
          <Row
            label={t('windowEffectiveDeadline')}
            value={
              <span data-testid="merchant-effective-claim-deadline">
                <DateTimeText iso={deadlines.effectiveClaimDeadlineAt} />
              </span>
            }
            hint={t('windowEffectiveDeadlineNote')}
          />
          <Row
            label={t('windowRetention')}
            value={
              <span data-testid="merchant-retention">
                <DateTimeText iso={deadlines.retentionEndsAt} />
              </span>
            }
            hint={t(RETENTION_REASON_KEY[deadlines.retentionReason])}
          />
        </dl>

        {deadlines.extensions.length > 0 ? (
          <div className="flex flex-col gap-2" data-testid="merchant-extensions">
            <h3 className="text-sm font-medium">{t('extensionsTitle')}</h3>
            {deadlines.extensions.map((extension) => (
              <div
                key={extension.id}
                className="bg-attention-subtle text-attention-foreground flex flex-col gap-0.5 rounded-lg border border-transparent p-3"
                data-extension-reason={extension.reason}
              >
                <span className="text-sm break-words">
                  {t(EXTENSION_REASON_KEY[extension.reason])}
                </span>
                <span className="text-xs break-words">
                  {t('extensionRow', {
                    unblocked: formatDateTime(extension.unblockedAt, locale),
                    deadline: formatDateTime(extension.newDeadlineAt, locale),
                  })}
                </span>
              </div>
            ))}
            <p className="text-muted-foreground text-xs break-words">{t('extensionNote')}</p>
          </div>
        ) : null}

        <TimeZoneHint />
      </CardContent>
    </Card>
  );
}

/** Retention has one reason each, and the copy names which one applied. */
const RETENTION_REASON_KEY: Record<SubmissionDeadlinesView['retentionReason'], string> = {
  published_retention: 'retentionReasonPublished',
  claim_deadline: 'retentionReasonClaimDeadline',
  open_cases: 'retentionReasonOpenCases',
  confirmed_unpaid: 'retentionReasonConfirmedUnpaid',
};

const EXTENSION_REASON_KEY: Record<ClaimDeadlineExtension['reason'], string> = {
  data_outage: 'extensionReasonDataOutage',
  pending_case: 'extensionReasonPendingCase',
};
