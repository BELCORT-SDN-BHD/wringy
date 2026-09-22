'use client';

/**
 * `/ops/claims` and `/ops/claims/[id]`.
 *
 * The page where the four status lines have to stay apart (kickoff decision 3):
 *
 *   - content review is the merchant's and is read-only here;
 *   - metering review is operations' and is decided here;
 *   - the claim status moves to `confirmed_unpaid` only when BOTH approved, so
 *     one approval alone never shows a payment anywhere on the page;
 *   - the payout attempt is a fourth, separate fact and lives on the payout page.
 *
 * Two refusals are shown rather than hidden. Releasing a held reservation is
 * gated by the engine's own `finalizeRejectionBlock`, so the button is disabled
 * with the engine's reason instead of failing after the press; and a press that
 * the engine still refuses renders its `release_not_allowed` code on the page.
 */

import Link from 'next/link';
import { HandCoins, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { BudgetBuckets } from '@/components/app/budget-buckets';
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
import { claimsForCampaign, finalizeRejectionBlock } from '@/domain';
import type { Claim } from '@/domain/types';
import { formatDateTime, formatSen, formatViews } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useDemoSnapshot } from '@/store/demo-store';
import {
  selectAllCampaigns,
  selectAppealForClaim,
  selectBudget,
  selectClaim,
  selectObligationForClaim,
  selectSubmission,
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

/** Block reasons `finalizeRejectionBlock` can return; anything else is `other`. */
const BLOCK_KEYS = [
  'appeal_open',
  'appeal_window_open',
  'appeal_upheld',
  'claim_not_rejected_appealable',
  'no_rejection_record',
] as const;

function blockKey(block: string): string {
  return (BLOCK_KEYS as readonly string[]).includes(block) ? block : 'other';
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function OpsClaimsListView() {
  const t = useTranslations('ops.claim');
  const tShared = useTranslations('ops.shared');
  const state = useDemoSnapshot();

  const claims = useMemo(
    () => selectAllCampaigns(state).flatMap((campaign) => claimsForCampaign(state, campaign.id)),
    [state],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader title={t('listTitle')} description={t('listSubtitle')} />

      {claims.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={t('listEmptyTitle')}
          description={t('listEmptyDescription')}
        />
      ) : (
        <ItemGroup data-testid="ops-claims-list">
          {claims.map((claim) => (
            <Item
              key={claim.id}
              variant="outline"
              className="items-start"
              data-claim-id={claim.id}
            >
              <ItemContent className="min-w-0">
                <ItemTitle className="flex flex-wrap items-center gap-2">
                  <MoneyText sen={claim.amountSen} tabular />
                  <StatusBadge group="claim" code={claim.status} />
                  <StatusBadge group="metering" code={claim.meteringReview.status} />
                  {claim.escalatedAt !== null ? (
                    <Badge
                      variant="outline"
                      className="bg-attention-subtle text-attention-foreground gap-1 border-transparent"
                    >
                      <TriangleAlert aria-hidden="true" />
                      {t('escalatedTitle')}
                    </Badge>
                  ) : null}
                </ItemTitle>
                <ItemDescription className="flex flex-col gap-0.5">
                  <span className="break-words">
                    {state.campaigns[claim.campaignId]?.title ?? claim.campaignId} ·{' '}
                    {tShared('creatorLabel')}:{' '}
                    {state.users[claim.creatorId]?.displayName ?? claim.creatorId}
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {tShared('seqLabel')} #{claim.seq} · {tShared('validAtLabel')}{' '}
                    <DateTimeText iso={claim.validAt} hideOffset />
                  </span>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function OpsClaimView({ claimId }: { claimId: string }) {
  const t = useTranslations('ops.claim');
  const tShared = useTranslations('ops.shared');
  const tCommon = useTranslations('common');
  const locale = useAppLocale();
  const state = useDemoSnapshot();
  const command = useOpsCommand();

  const claim = useMemo(() => selectClaim(state, claimId), [state, claimId]);
  const submission = useMemo(
    () => (claim ? selectSubmission(state, claim.submissionId) : null),
    [state, claim],
  );
  const appeal = useMemo(() => (claim ? selectAppealForClaim(state, claim.id) : null), [state, claim]);
  const obligation = useMemo(
    () => (claim ? selectObligationForClaim(state, claim.id) : null),
    [state, claim],
  );
  const budget = useMemo(
    () => (claim ? selectBudget(state, claim.campaignId) : null),
    [state, claim],
  );
  const block = useMemo(
    () => (claim ? finalizeRejectionBlock(state, claim) : 'no_rejection_record'),
    [state, claim],
  );

  if (!claim || !submission || !budget) return <OpsNotFound />;

  const campaign = state.campaigns[claim.campaignId];
  const pending = claim.status === 'pending_review';

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader
        title={t('title')}
        description={t('subtitle')}
        backToQueue
        meta={
          <>
            <StatusBadge group="claim" code={claim.status} />
            <StatusBadge group="metering" code={claim.meteringReview.status} />
            <StatusBadge group="content" code={submission.contentReview.status} />
            <Badge variant="outline">
              {tShared('roleResponsible', { role: tShared('roleOpsReviewer') })}
            </Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/ops/submissions/${submission.id}`}>{t('openSubmission')}</Link>
            </Button>
            {appeal ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/ops/appeals/${appeal.id}`}>{t('openAppeal')}</Link>
              </Button>
            ) : null}
            {obligation ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/ops/payouts/${obligation.id}`}>{t('openPayout')}</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <OpsCommandError state={command} />

      {claim.escalatedAt !== null ? (
        <Alert className="bg-attention-subtle" data-testid="ops-claim-escalated">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t('escalatedTitle')}</AlertTitle>
          <AlertDescription>
            {t('escalatedDescription', { at: formatDateTime(claim.escalatedAt, locale) })}
          </AlertDescription>
        </Alert>
      ) : null}

      {claim.status === 'confirmed_unpaid' || claim.status === 'paid' ? (
        <Alert data-testid="ops-claim-confirmed">
          <HandCoins aria-hidden="true" />
          <AlertTitle>{t('confirmedTitle')}</AlertTitle>
          <AlertDescription>
            {t('confirmedDescription', { amount: formatSen(claim.amountSen, locale) })}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('evidenceTitle')}</CardTitle>
          <CardDescription className="break-words">{t('evidenceDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FactList
            items={[
              { label: tShared('amountLabel'), value: <MoneyText sen={claim.amountSen} tabular /> },
              { label: tShared('seqLabel'), value: `#${claim.seq}` },
              { label: tShared('validAtLabel'), value: <DateTimeText iso={claim.validAt} /> },
              { label: t('snapshotVersion'), value: claim.snapshotVersion },
              {
                label: t('qualifiedAtClaim'),
                value: formatViews(claim.qualifiedViewsAtClaim, locale),
              },
              { label: t('rulesVersion'), value: claim.rulesVersion },
              {
                label: t('meteringCutoff'),
                value: <DateTimeText iso={claim.meteringCutoffAt} />,
              },
              {
                label: tShared('creatorLabel'),
                value: state.users[claim.creatorId]?.displayName ?? claim.creatorId,
              },
            ]}
          />
          {claim.isPartial ? (
            <Alert data-testid="ops-claim-partial">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{t('partialTitle')}</AlertTitle>
              <AlertDescription>
                {t('partialDescription', {
                  remainder: formatSen(claim.unreservedRemainderSen, locale),
                })}
              </AlertDescription>
            </Alert>
          ) : null}
          <TimeZoneHint />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('budgetTitle')}</CardTitle>
          <CardDescription className="break-words">
            {campaign?.title ?? claim.campaignId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetBuckets budget={budget} bare />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('reviewsTitle')}</CardTitle>
          <CardDescription className="break-words">{t('reviewsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FactList
            items={[
              {
                label: t('contentReview'),
                value: (
                  <span className="flex flex-col gap-1">
                    <StatusBadge group="content" code={submission.contentReview.status} />
                    <span className="text-muted-foreground text-xs break-words">
                      {submission.contentReview.reason ?? tCommon('state.notSet')}
                    </span>
                  </span>
                ),
              },
              {
                label: t('meteringReview'),
                value: (
                  <span className="flex flex-col gap-1">
                    <StatusBadge group="metering" code={claim.meteringReview.status} />
                    <span className="text-muted-foreground text-xs break-words">
                      {claim.meteringReview.reason ?? tCommon('state.notSet')}
                      {claim.meteringReview.decidedBy
                        ? ` · ${actorName(state, claim.meteringReview.decidedBy)}`
                        : ''}
                    </span>
                  </span>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card data-testid="ops-metering-panel">
        <CardHeader>
          <CardTitle>{t('meteringPanelTitle')}</CardTitle>
          <CardDescription className="break-words">{t('meteringPanelDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pending ? (
            <div className="flex flex-wrap gap-2">
              <ConfirmDialog
                title={t('approveConfirmTitle')}
                description={t('approveConfirmDescription')}
                confirmLabel={t('approve')}
                onConfirm={(reason) =>
                  command.run(
                    {
                      type: 'claim.reviewMetering',
                      claimId: claim.id,
                      decision: 'approve',
                      reason: reason === '' ? null : reason,
                    },
                    t('decisionRecorded'),
                  )
                }
                trigger={
                  <Button variant="default" data-testid="ops-metering-approve">
                    {t('approve')}
                  </Button>
                }
              />
              <ConfirmDialog
                title={t('holdConfirmTitle')}
                description={t('holdConfirmDescription')}
                confirmLabel={t('hold')}
                requireReason
                reasonLabel={t('reasonLabel')}
                onConfirm={(reason) =>
                  command.run(
                    { type: 'claim.reviewMetering', claimId: claim.id, decision: 'hold', reason },
                    t('decisionRecorded'),
                  )
                }
                trigger={
                  <Button variant="outline" data-testid="ops-metering-hold">
                    {t('hold')}
                  </Button>
                }
              />
              <ConfirmDialog
                title={t('rejectConfirmTitle')}
                description={t('rejectConfirmDescription')}
                confirmLabel={t('reject')}
                destructive
                requireReason
                reasonLabel={t('reasonLabel')}
                onConfirm={(reason) =>
                  command.run(
                    { type: 'claim.reviewMetering', claimId: claim.id, decision: 'reject', reason },
                    t('decisionRecorded'),
                  )
                }
                trigger={
                  <Button variant="destructive" data-testid="ops-metering-reject">
                    {t('reject')}
                  </Button>
                }
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm break-words" data-testid="ops-metering-closed">
              {t('notPendingNote', { status: tCommon(`status.claim.${claim.status}`) })}{' '}
              {t('decidedNote')}
            </p>
          )}
          <p className="text-muted-foreground text-xs break-words">{tShared('reasonRecorded')}</p>
        </CardContent>
      </Card>

      {claim.rejection !== null || claim.status === 'rejected_final' ? (
        <RejectionPanel
          claim={claim}
          block={block}
          appealStatus={appeal?.status ?? null}
          onFinalize={(reason) =>
            command.run(
              { type: 'claim.finalizeRejection', claimId: claim.id, reason },
              t('finalizeDone'),
            )
          }
        />
      ) : null}

      <AuditTrail
        targetType="claim"
        targetId={claim.id}
        extra={appeal ? [{ targetType: 'appeal' as const, targetId: appeal.id }] : []}
      />
    </div>
  );
}

function RejectionPanel({
  claim,
  block,
  appealStatus,
  onFinalize,
}: {
  claim: Claim;
  block: string | null;
  appealStatus: string | null;
  onFinalize: (reason: string) => void;
}) {
  const t = useTranslations('ops.claim');
  const tShared = useTranslations('ops.shared');
  const tCommon = useTranslations('common');
  const locale = useAppLocale();
  const rejection = claim.rejection;

  return (
    <Card data-testid="ops-rejection-panel">
      <CardHeader>
        <CardTitle>{t('rejectionTitle')}</CardTitle>
        <CardDescription>
          <TimeZoneHint />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FactList
          items={[
            {
              label: t('rejectionSource'),
              value:
                rejection === null
                  ? tCommon('state.notSet')
                  : rejection.source === 'content'
                    ? t('rejectionSourceContent')
                    : t('rejectionSourceMetering'),
            },
            {
              label: t('rejectionReason'),
              value: rejection?.reason ?? tCommon('state.notSet'),
            },
            {
              label: t('rejectionDecidedAt'),
              value: <DateTimeText iso={rejection?.decidedAt ?? null} />,
            },
            {
              label: t('appealDeadline'),
              value: (
                <span data-testid="ops-appeal-deadline">
                  <DateTimeText iso={rejection?.appealDeadlineAt ?? null} />
                </span>
              ),
            },
            {
              label: t('appealStatus'),
              value:
                appealStatus === null ? (
                  t('appealNone')
                ) : (
                  <StatusBadge group="appeal" code={appealStatus} />
                ),
            },
          ]}
        />

        {claim.status === 'rejected_appealable' || claim.status === 'appealing' ? (
          <p className="text-sm break-words" data-testid="ops-reservation-held">
            {t('reservationHeld', { amount: formatSen(claim.amountSen, locale) })}
          </p>
        ) : null}

        {block !== null ? (
          <Alert className="bg-attention-subtle" data-testid="ops-finalize-blocked" data-block={block}>
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{t('finalizeBlockedTitle')}</AlertTitle>
            <AlertDescription className="break-words">
              {t(`finalizeBlocked.${blockKey(block)}`, {
                deadline: rejection ? formatDateTime(rejection.appealDeadlineAt, locale) : '—',
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        <ConfirmDialog
          title={t('finalizeConfirmTitle')}
          description={t('finalizeConfirmDescription')}
          confirmLabel={t('finalizeAction')}
          destructive
          requireReason
          reasonLabel={t('finalizeReasonLabel')}
          onConfirm={onFinalize}
          trigger={
            <Button
              variant="destructive"
              className="self-start"
              disabled={block !== null}
              data-testid="ops-finalize-open"
            >
              <span className="truncate">{t('finalizeAction')}</span>
            </Button>
          }
        />
        <p className="text-muted-foreground text-xs break-words">{tShared('reasonRecorded')}</p>
      </CardContent>
    </Card>
  );
}
