'use client';

/**
 * `/ops/submissions` and `/ops/submissions/[id]`.
 *
 * The metering evidence page. Three rules shape it:
 *
 *   - a failed read is recorded as a failed read. The snapshot table shows every
 *     read with its `trusted` flag and missing reason, and the reward keeps the
 *     last trusted value with the time it was trusted. Nothing renders 0 views
 *     for a missing fact (localization-v1, domain-states §P).
 *   - a re-sync reads the source at the current simulated time. It never
 *     back-dates a reading, so the result — successful or not — is written to the
 *     audit trail with the reason operations typed.
 *   - the content review belongs to the merchant. Operations read it; the page
 *     has no control that could change it.
 */

import Link from 'next/link';
import { FileVideo, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { DataUnavailable } from '@/components/app/data-unavailable';
import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MissingReason, Submission } from '@/domain/types';
import { formatDateTime, formatViewsOrUnknown } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useDemoSnapshot } from '@/store/demo-store';
import {
  selectAllSubmissions,
  selectAuditFor,
  selectClaimsForSubmission,
  selectSubmission,
  selectSubmissionDeadlines,
  selectSubmissionReward,
} from '@/store/selectors';

import {
  AuditTrail,
  FactList,
  OpsCommandError,
  OpsNotFound,
  OpsPageHeader,
  actorName,
  useOpsCommand,
} from './ops-shared';

const MISSING_REASONS: readonly MissingReason[] = [
  'source_unreachable',
  'permission_revoked',
  'post_private',
];

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function OpsSubmissionsListView() {
  const t = useTranslations('ops.submission');
  const tShared = useTranslations('ops.shared');
  const tCommon = useTranslations('common');
  const locale = useAppLocale();
  const state = useDemoSnapshot();

  const rows = useMemo(
    () =>
      selectAllSubmissions(state).map((submission) => ({
        submission,
        reward: selectSubmissionReward(state, submission.id),
      })),
    [state],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader title={t('listTitle')} description={t('listSubtitle')} />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileVideo}
          title={t('listEmptyTitle')}
          description={t('listEmptyDescription')}
        />
      ) : (
        <ItemGroup data-testid="ops-submissions-list">
          {rows.map(({ submission, reward }) => (
            <Item
              key={submission.id}
              variant="outline"
              className="items-start"
              data-submission-id={submission.id}
            >
              <ItemContent className="min-w-0">
                <ItemTitle className="flex flex-wrap items-center gap-2">
                  <span className="break-words">
                    {state.campaigns[submission.campaignId]?.title ?? submission.campaignId}
                  </span>
                  <StatusBadge group="submission" code={submission.status} />
                  <StatusBadge group="content" code={submission.contentReview.status} />
                </ItemTitle>
                <ItemDescription className="flex flex-col gap-0.5">
                  <span className="break-words">
                    {tShared('creatorLabel')}:{' '}
                    {state.users[submission.creatorId]?.displayName ?? submission.creatorId} ·{' '}
                    {submission.platform} · {submission.postId}
                  </span>
                  <span className="break-words">
                    {tCommon('views.qualifiedLabel')}:{' '}
                    {formatViewsOrUnknown(reward?.qualifiedViews ?? null, locale)}
                  </span>
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/ops/submissions/${submission.id}`}>{tShared('openLabel')}</Link>
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function OpsSubmissionView({ submissionId }: { submissionId: string }) {
  const t = useTranslations('ops.submission');
  const tShared = useTranslations('ops.shared');
  const tCommon = useTranslations('common');
  const locale = useAppLocale();
  const state = useDemoSnapshot();
  const command = useOpsCommand();

  const submission = useMemo(() => selectSubmission(state, submissionId), [state, submissionId]);
  const reward = useMemo(
    () => (submission ? selectSubmissionReward(state, submission.id) : null),
    [state, submission],
  );
  const deadlines = useMemo(
    () => (submission ? selectSubmissionDeadlines(state, submission.id) : null),
    [state, submission],
  );
  const claims = useMemo(
    () => (submission ? selectClaimsForSubmission(state, submission.id) : []),
    [state, submission],
  );
  /**
   * The outcome of the last re-sync, read back from the audit trail rather than
   * kept in component state: after a refresh the page must still say whether the
   * source answered.
   */
  const lastResync = useMemo(() => {
    if (!submission) return null;
    const rows = selectAuditFor(state, 'submission', submission.id).filter(
      (entry) => entry.action === 'submission.resync',
    );
    const entry = rows[rows.length - 1];
    if (!entry) return null;
    return { entry, failed: (entry.after ?? '').includes('resync_failed') };
  }, [state, submission]);

  if (!submission) return <OpsNotFound />;

  const campaign = state.campaigns[submission.campaignId];
  const unreadable = reward !== null && reward.dataStatus !== 'trusted';

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader
        title={t('title')}
        description={t('subtitle')}
        backToQueue
        meta={
          <>
            <StatusBadge group="submission" code={submission.status} />
            <StatusBadge group="content" code={submission.contentReview.status} />
            <Badge variant="outline">
              {tShared('roleResponsible', { role: tShared('roleOpsReviewer') })}
            </Badge>
          </>
        }
      />

      <OpsCommandError state={command} />

      <Card>
        <CardHeader>
          <CardTitle>{tShared('submissionLabel')}</CardTitle>
          <CardDescription className="break-words">
            {campaign?.title ?? submission.campaignId}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FactList
            items={[
              {
                label: tShared('creatorLabel'),
                value: state.users[submission.creatorId]?.displayName ?? submission.creatorId,
              },
              { label: t('platformLabel'), value: submission.platform },
              { label: t('postIdLabel'), value: <span className="font-mono">{submission.postId}</span> },
              {
                label: t('urlLabel'),
                value: <span className="font-mono break-all">{submission.url}</span>,
              },
              { label: t('rulesVersionLabel'), value: submission.rulesVersion },
              {
                label: t('baselineLabel'),
                value: formatViewsOrUnknown(submission.baselineViews, locale),
              },
              {
                label: t('qualifiedLabel'),
                value: formatViewsOrUnknown(reward?.qualifiedViews ?? null, locale),
              },
              {
                label: tCommon('state.lastTrustedLabel'),
                value: <DateTimeText iso={reward?.lastTrustedAt ?? null} />,
              },
            ]}
          />
          <p className="text-muted-foreground text-xs">{tCommon('views.definition')}</p>
        </CardContent>
      </Card>

      {unreadable ? (
        <DataUnavailable
          lastTrustedAt={reward?.lastTrustedAt ?? null}
          lastValue={`${formatViewsOrUnknown(reward?.qualifiedViews ?? null, locale)} · ${tCommon('views.qualifiedLabel')}`}
          reason={submission.status}
        />
      ) : null}

      <ResyncPanel
        submission={submission}
        lastResync={lastResync}
        onResync={(reason) =>
          command.run({ type: 'submission.resync', submissionId: submission.id, reason }, t('resyncDone'))
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('snapshotsTitle')}</CardTitle>
          <CardDescription className="break-words">{t('snapshotsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-2">
          {submission.snapshots.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('snapshotsEmpty')}</p>
          ) : (
            <div className="min-w-0" data-testid="ops-snapshots">
              <Table className="min-w-[46rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colVersion')}</TableHead>
                    <TableHead>{t('colObservedAt')}</TableHead>
                    <TableHead>{t('colSourceTime')}</TableHead>
                    <TableHead>{t('colTotalViews')}</TableHead>
                    <TableHead>{t('colQualified')}</TableHead>
                    <TableHead>{t('colMissingReason')}</TableHead>
                    <TableHead>{t('colTrusted')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submission.snapshots.map((snapshot) => (
                    <TableRow key={snapshot.id} data-snapshot-version={snapshot.version}>
                      <TableCell className="font-mono tabular-nums">{snapshot.version}</TableCell>
                      <TableCell>
                        <DateTimeText iso={snapshot.observedAt} hideOffset />
                      </TableCell>
                      <TableCell>
                        <DateTimeText iso={snapshot.sourceTime} hideOffset />
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatViewsOrUnknown(snapshot.totalViews, locale)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatViewsOrUnknown(snapshot.qualifiedViewsInWindow, locale)}
                      </TableCell>
                      <TableCell>
                        {snapshot.missingReason !== null &&
                        MISSING_REASONS.includes(snapshot.missingReason)
                          ? t(`missing.${snapshot.missingReason}`)
                          : tCommon('state.notApplicable')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            snapshot.trusted
                              ? 'bg-success-subtle text-success-foreground border-transparent'
                              : 'bg-inactive-subtle text-inactive-foreground border-transparent'
                          }
                        >
                          {snapshot.trusted ? t('trustedYes') : t('trustedNo')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <TimeZoneHint />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('deadlinesTitle')}</CardTitle>
          <CardDescription>
            <TimeZoneHint />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FactList
            items={[
              { label: t('acceptedAt'), value: <DateTimeText iso={deadlines?.acceptedAt ?? null} /> },
              {
                label: t('meteringEndsAt'),
                value: <DateTimeText iso={deadlines?.meteringEndsAt ?? null} />,
              },
              {
                label: t('baseDeadline'),
                value: <DateTimeText iso={deadlines?.baseClaimDeadlineAt ?? null} />,
              },
              {
                label: t('effectiveDeadline'),
                value: (
                  <span data-testid="ops-effective-deadline">
                    <DateTimeText iso={deadlines?.effectiveClaimDeadlineAt ?? null} />
                  </span>
                ),
              },
              {
                label: t('retentionEndsAt'),
                value: (
                  <span className="flex flex-col gap-0.5">
                    <DateTimeText iso={deadlines?.retentionEndsAt ?? null} />
                    <span className="text-muted-foreground text-xs break-words">
                      {deadlines ? t(`retentionReason.${deadlines.retentionReason}`) : null}
                    </span>
                  </span>
                ),
              },
            ]}
          />

          <section className="flex flex-col gap-2" data-testid="ops-extensions">
            <h3 className="text-sm font-medium">{t('extensionsTitle')}</h3>
            {(deadlines?.extensions.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">{t('extensionsEmpty')}</p>
            ) : (
              <ItemGroup>
                {deadlines?.extensions.map((extension) => (
                  <Item key={extension.id} variant="outline" size="sm" className="items-start">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="break-words">
                        {t(`extensionReason.${extension.reason}`)}
                      </ItemTitle>
                      <ItemDescription className="break-words">
                        {t('extensionRow', {
                          from: formatDateTime(extension.blockedFrom, locale),
                          unblocked: formatDateTime(extension.unblockedAt, locale),
                          deadline: formatDateTime(extension.newDeadlineAt, locale),
                        })}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            )}
            <p className="text-muted-foreground text-xs break-words">{t('extensionNote')}</p>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('contentReviewTitle')}</CardTitle>
          <CardDescription className="break-words">{t('contentReviewDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <FactList
            items={[
              {
                label: tShared('statusLabel'),
                value: <StatusBadge group="content" code={submission.contentReview.status} />,
              },
              {
                label: tShared('reasonLabel'),
                value: submission.contentReview.reason ?? t('contentReviewNoReason'),
              },
              {
                label: t('contentReviewDecidedBy'),
                value: submission.contentReview.decidedBy
                  ? actorName(state, submission.contentReview.decidedBy)
                  : tCommon('state.notSet'),
              },
              {
                label: t('contentReviewDecidedAt'),
                value: <DateTimeText iso={submission.contentReview.decidedAt} />,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('claimsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('claimsEmpty')}</p>
          ) : (
            <ItemGroup data-testid="ops-submission-claims">
              {claims.map((claim) => (
                <Item
                  key={claim.id}
                  variant="outline"
                  size="sm"
                  className="items-start"
                  data-claim-id={claim.id}
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle className="flex flex-wrap items-center gap-2">
                      <MoneyText sen={claim.amountSen} tabular />
                      <StatusBadge group="claim" code={claim.status} />
                      <StatusBadge group="metering" code={claim.meteringReview.status} />
                    </ItemTitle>
                    <ItemDescription className="break-words">
                      {tShared('seqLabel')} #{claim.seq} · {tShared('validAtLabel')}{' '}
                      <DateTimeText iso={claim.validAt} hideOffset />
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/ops/claims/${claim.id}`}>{tShared('openLabel')}</Link>
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>

      <AuditTrail targetType="submission" targetId={submission.id} />
    </div>
  );
}

function ResyncPanel({
  submission,
  lastResync,
  onResync,
}: {
  submission: Submission;
  lastResync: { failed: boolean } | null;
  onResync: (reason: string) => void;
}) {
  const t = useTranslations('ops.submission');
  const tShared = useTranslations('ops.shared');

  return (
    <Card data-testid="ops-resync">
      <CardHeader>
        <CardTitle>{t('resyncTitle')}</CardTitle>
        <CardDescription className="break-words">{t('resyncDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {submission.dataOutage ? (
          <Alert className="bg-inactive-subtle" data-testid="ops-resync-outage">
            <RefreshCw aria-hidden="true" />
            <AlertTitle>{t('resyncOutageNote')}</AlertTitle>
            <AlertDescription>{tShared('demoToolsHint')}</AlertDescription>
          </Alert>
        ) : null}

        {lastResync ? (
          <p className="text-sm" data-testid="ops-resync-result">
            {t('resultLabel')}:{' '}
            <Badge
              variant="outline"
              className={
                lastResync.failed
                  ? 'bg-inactive-subtle text-inactive-foreground border-transparent'
                  : 'bg-success-subtle text-success-foreground border-transparent'
              }
            >
              {lastResync.failed ? t('resultFailed') : t('resultOk')}
            </Badge>
          </p>
        ) : null}

        <ConfirmDialog
          title={t('resyncConfirmTitle')}
          description={t('resyncConfirmDescription')}
          confirmLabel={t('resyncAction')}
          requireReason
          reasonLabel={t('resyncReasonLabel')}
          onConfirm={onResync}
          trigger={
            <Button variant="outline" className="self-start" data-testid="ops-resync-open">
              <RefreshCw aria-hidden="true" />
              <span className="truncate">{t('resyncAction')}</span>
            </Button>
          }
        />
        <p className="text-muted-foreground text-xs">{tShared('reasonRecorded')}</p>
      </CardContent>
    </Card>
  );
}
