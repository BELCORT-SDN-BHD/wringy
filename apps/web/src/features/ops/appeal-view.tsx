'use client';

/**
 * `/ops/appeals` and `/ops/appeals/[id]`.
 *
 * The two outcomes are deliberately asymmetric and the page says so:
 *
 *   - upheld → the claim goes back to `pending_review` keeping its queue
 *     position, its valid time and its amount ("成立后继续核验，不重排"), and the
 *     review that rejected it is reset to pending. The reservation was never
 *     released, so nothing has to be re-reserved.
 *   - rejected → the reservation is STILL held. Releasing it is a separate,
 *     explicit `claim.finalizeRejection` on the claim page, never a timed job.
 */

import Link from 'next/link';
import { Gavel } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { ConfirmDialog } from '@/components/app/confirm-dialog';
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
import { formatDateTime, formatViewsOrUnknown } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectClaim, selectSubmission } from '@/store/selectors';

import {
  AuditTrail,
  FactList,
  OpsCommandError,
  OpsNotFound,
  OpsPageHeader,
  actorName,
  useOpsCommand,
} from './ops-shared';

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function OpsAppealsListView() {
  const t = useTranslations('ops.appeal');
  const tShared = useTranslations('ops.shared');
  const state = useDemoSnapshot();

  /**
   * Appeals are keyed by id and every one belongs to exactly one claim, so the
   * open ones first / newest first ordering is done here rather than asking the
   * queue selector, which only carries the open ones.
   */
  const appeals = useMemo(
    () =>
      Object.values(state.appeals)
        .slice()
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
          return b.filedAt.localeCompare(a.filedAt);
        }),
    [state],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader title={t('listTitle')} description={t('listSubtitle')} />

      {appeals.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={t('listEmptyTitle')}
          description={t('listEmptyDescription')}
        />
      ) : (
        <ItemGroup data-testid="ops-appeals-list">
          {appeals.map((appeal) => {
            const claim = state.claims[appeal.claimId];
            return (
              <Item
                key={appeal.id}
                variant="outline"
                className="items-start"
                data-appeal-id={appeal.id}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex flex-wrap items-center gap-2">
                    <MoneyText sen={claim?.amountSen ?? null} tabular />
                    <StatusBadge group="appeal" code={appeal.status} />
                    {claim ? <StatusBadge group="claim" code={claim.status} /> : null}
                  </ItemTitle>
                  <ItemDescription className="flex flex-col gap-0.5">
                    <span className="break-words">
                      {tShared('creatorLabel')}:{' '}
                      {state.users[appeal.creatorId]?.displayName ?? appeal.creatorId}
                      {claim
                        ? ` · ${state.campaigns[claim.campaignId]?.title ?? claim.campaignId}`
                        : ''}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      {t('filedAt')} <DateTimeText iso={appeal.filedAt} hideOffset />
                    </span>
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/ops/appeals/${appeal.id}`}>{tShared('openLabel')}</Link>
                  </Button>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function OpsAppealView({ appealId }: { appealId: string }) {
  const t = useTranslations('ops.appeal');
  const tClaim = useTranslations('ops.claim');
  const tSubmission = useTranslations('ops.submission');
  const tShared = useTranslations('ops.shared');
  const tCommon = useTranslations('common');
  const locale = useAppLocale();
  const state = useDemoSnapshot();
  const command = useOpsCommand();

  const appeal = useMemo(() => state.appeals[appealId] ?? null, [state, appealId]);
  const claim = useMemo(
    () => (appeal ? selectClaim(state, appeal.claimId) : null),
    [state, appeal],
  );
  const submission = useMemo(
    () => (claim ? selectSubmission(state, claim.submissionId) : null),
    [state, claim],
  );

  if (!appeal || !claim || !submission) return <OpsNotFound />;

  const open = appeal.status === 'open';

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader
        title={t('title')}
        description={t('subtitle')}
        backToQueue
        meta={
          <>
            <StatusBadge group="appeal" code={appeal.status} />
            <StatusBadge group="claim" code={claim.status} />
            <Badge variant="outline">
              {tShared('roleResponsible', { role: tShared('roleOpsReviewer') })}
            </Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/ops/claims/${claim.id}`}>{t('openClaim')}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/ops/submissions/${submission.id}`}>{tClaim('openSubmission')}</Link>
            </Button>
          </>
        }
      />

      <OpsCommandError state={command} />

      <Card>
        <CardHeader>
          <CardTitle>{tShared('claimLabel')}</CardTitle>
          <CardDescription className="break-words">
            {state.campaigns[claim.campaignId]?.title ?? claim.campaignId}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FactList
            items={[
              { label: tShared('amountLabel'), value: <MoneyText sen={claim.amountSen} tabular /> },
              { label: tShared('seqLabel'), value: `#${claim.seq}` },
              { label: tShared('validAtLabel'), value: <DateTimeText iso={claim.validAt} /> },
              {
                label: tShared('creatorLabel'),
                value: state.users[claim.creatorId]?.displayName ?? claim.creatorId,
              },
              { label: t('filedAt'), value: <DateTimeText iso={appeal.filedAt} /> },
              { label: t('resolvedAt'), value: <DateTimeText iso={appeal.resolvedAt} /> },
            ]}
          />
          <TimeZoneHint />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('creatorReasonTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm break-words" data-testid="ops-appeal-creator-reason">
            {appeal.reason}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('originalDecisionTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FactList
            items={[
              {
                label: tClaim('rejectionSource'),
                value:
                  claim.rejection === null
                    ? claim.meteringReview.status === 'rejected'
                      ? tClaim('rejectionSourceMetering')
                      : tCommon('state.notSet')
                    : claim.rejection.source === 'content'
                      ? tClaim('rejectionSourceContent')
                      : tClaim('rejectionSourceMetering'),
              },
              {
                label: tClaim('rejectionReason'),
                value:
                  claim.rejection?.reason ??
                  claim.meteringReview.reason ??
                  tCommon('state.notSet'),
              },
              {
                label: tClaim('rejectionDecidedAt'),
                value: <DateTimeText iso={claim.rejection?.decidedAt ?? null} />,
              },
              {
                label: tClaim('appealDeadline'),
                value: <DateTimeText iso={claim.rejection?.appealDeadlineAt ?? null} />,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('evidenceTitle')}</CardTitle>
          <CardDescription className="break-words">{t('evidenceDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          {submission.snapshots.length === 0 ? (
            <p className="text-muted-foreground text-sm">{tSubmission('snapshotsEmpty')}</p>
          ) : (
            <div className="min-w-0" data-testid="ops-appeal-evidence">
              <Table className="min-w-[34rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{tSubmission('colVersion')}</TableHead>
                    <TableHead>{tSubmission('colSourceTime')}</TableHead>
                    <TableHead>{tSubmission('colQualified')}</TableHead>
                    <TableHead>{tSubmission('colTrusted')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submission.snapshots.map((snapshot) => (
                    <TableRow key={snapshot.id}>
                      <TableCell className="font-mono tabular-nums">{snapshot.version}</TableCell>
                      <TableCell>
                        <DateTimeText iso={snapshot.sourceTime} hideOffset />
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatViewsOrUnknown(snapshot.qualifiedViewsInWindow, locale)}
                      </TableCell>
                      <TableCell>
                        {snapshot.trusted
                          ? tSubmission('trustedYes')
                          : tSubmission('trustedNo')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="ops-appeal-decide">
        <CardHeader>
          <CardTitle>{t('decideTitle')}</CardTitle>
          <CardDescription className="break-words">{t('decideDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {open ? (
            <div className="flex flex-wrap gap-2">
              <ConfirmDialog
                title={t('upholdConfirmTitle')}
                description={t('upholdConfirmDescription')}
                confirmLabel={t('uphold')}
                requireReason
                reasonLabel={t('noteLabel')}
                onConfirm={(note) =>
                  command.run(
                    { type: 'appeal.resolve', appealId: appeal.id, decision: 'uphold', note },
                    t('resolved'),
                  )
                }
                trigger={
                  <Button variant="default" data-testid="ops-appeal-uphold">
                    {t('uphold')}
                  </Button>
                }
              />
              <ConfirmDialog
                title={t('rejectConfirmTitle')}
                description={t('rejectConfirmDescription')}
                confirmLabel={t('rejectAppeal')}
                destructive
                requireReason
                reasonLabel={t('noteLabel')}
                onConfirm={(note) =>
                  command.run(
                    { type: 'appeal.resolve', appealId: appeal.id, decision: 'reject', note },
                    t('resolved'),
                  )
                }
                trigger={
                  <Button variant="destructive" data-testid="ops-appeal-reject">
                    {t('rejectAppeal')}
                  </Button>
                }
              />
            </div>
          ) : (
            <Alert data-testid="ops-appeal-resolved">
              <Gavel aria-hidden="true" />
              <AlertTitle>{t('alreadyResolvedTitle')}</AlertTitle>
              <AlertDescription className="flex flex-col gap-1">
                <span className="break-words">
                  {t('alreadyResolvedDescription', {
                    at: appeal.resolvedAt ? formatDateTime(appeal.resolvedAt, locale) : '—',
                  })}
                </span>
                <span className="break-words">
                  {appeal.status === 'upheld' ? t('outcomeUpheldNote') : t('outcomeRejectedNote')}
                </span>
                {appeal.note ? (
                  <span className="break-words">
                    {t('noteLabel')}: {appeal.note}
                  </span>
                ) : null}
                {appeal.resolvedBy ? (
                  <span className="break-words">
                    {tCommon('timeline.by', { actor: actorName(state, appeal.resolvedBy) })}
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
          )}
          <p className="text-muted-foreground text-xs break-words">{tShared('reasonRecorded')}</p>
        </CardContent>
      </Card>

      <AuditTrail
        targetType="appeal"
        targetId={appeal.id}
        extra={[{ targetType: 'claim' as const, targetId: claim.id }]}
      />
    </div>
  );
}
