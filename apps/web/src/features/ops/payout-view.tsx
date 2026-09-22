'use client';

/**
 * `/ops/payouts` and `/ops/payouts/[id]` — the finance pages.
 *
 * Everything here follows domain-states §P, where the point is what the demo
 * must NOT say:
 *
 *   - unknown ≠ failed ≠ zero. An unknown attempt offers exactly one action,
 *     "reconcile against the original transaction". There is deliberately no
 *     pay-again control, because a second request against an unresolved
 *     transaction is how a double payment happens.
 *   - a retry needs confirmed-failure evidence first, and it records a reason.
 *   - "paid" means funds are available in the simulated provider account. Bank
 *     settlement is a separate fact, shown separately, and never inferred from
 *     a provider success.
 *
 * `[id]` accepts either an obligation id or a payout-attempt id, because the
 * work queue links `payout_unknown` items by attempt and `payout` items by
 * obligation (`selectOpsQueue`).
 */

import Link from 'next/link';
import { Banknote, FlaskConical, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { attemptsFor, latestAttempt } from '@/domain';
import type { Obligation, PayoutAttempt } from '@/domain/types';
import { formatDateTime, formatSen } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectAttemptsForObligation, selectObligations } from '@/store/selectors';

import {
  AuditTrail,
  FactList,
  FinanceOnly,
  OpsCommandError,
  OpsNotFound,
  OpsPageHeader,
  actorName,
  useOpsCommand,
} from './ops-shared';

type ReconcileOutcome = 'still_unknown' | 'confirmed_succeeded' | 'confirmed_failed';

const RECONCILE_OUTCOMES: readonly ReconcileOutcome[] = [
  'still_unknown',
  'confirmed_succeeded',
  'confirmed_failed',
];

/**
 * Why `payout.start` is refused right now, mirroring the engine's own ladder in
 * `handleOpsFinance`. Derived rather than discovered by pressing: a disabled
 * control with the reason beats a refusal after the fact for a money action.
 */
function startBlockReason(
  obligation: Obligation,
  attempts: PayoutAttempt[],
): 'settled' | 'processing' | 'unknown' | 'failed' | null {
  if (obligation.status === 'settled') return 'settled';
  const unresolved = attempts.find(
    (attempt) => attempt.status === 'processing' || attempt.status === 'unknown',
  );
  if (unresolved) return unresolved.status === 'processing' ? 'processing' : 'unknown';
  const last = attempts[attempts.length - 1];
  if (last?.status === 'succeeded') return 'settled';
  if (last?.status === 'failed') return 'failed';
  return null;
}

/**
 * Opens the demo tools panel, which is where the simulated provider answers.
 * The panel is a Sheet mounted by the root layout, so the honest "link" to it is
 * its own trigger rather than a route that does not exist.
 */
function openDemoTools(): void {
  if (typeof document === 'undefined') return;
  const trigger = document.querySelector<HTMLElement>('[data-testid="demo-toolbar-trigger"]');
  trigger?.click();
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function OpsPayoutsListView() {
  const t = useTranslations('ops.payout');
  const tShared = useTranslations('ops.shared');
  const state = useDemoSnapshot();

  const rows = useMemo(
    () =>
      selectObligations(state).map((obligation) => ({
        obligation,
        attempts: selectAttemptsForObligation(state, obligation.id),
      })),
    [state],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader title={t('listTitle')} description={t('listSubtitle')} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title={t('listEmptyTitle')}
          description={t('listEmptyDescription')}
        />
      ) : (
        <ItemGroup data-testid="ops-payouts-list">
          {rows.map(({ obligation, attempts }) => {
            const last = attempts[attempts.length - 1] ?? null;
            return (
              <Item
                key={obligation.id}
                variant="outline"
                className="items-start"
                data-obligation-id={obligation.id}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex flex-wrap items-center gap-2">
                    <MoneyText sen={obligation.amountSen} tabular />
                    <StatusBadge group="obligation" code={obligation.status} />
                    {last ? <StatusBadge group="payout" code={last.status} /> : null}
                  </ItemTitle>
                  <ItemDescription className="flex flex-col gap-0.5">
                    <span className="break-words">
                      {tShared('creatorLabel')}:{' '}
                      {state.users[obligation.creatorId]?.displayName ?? obligation.creatorId} ·{' '}
                      {state.campaigns[obligation.campaignId]?.title ?? obligation.campaignId}
                    </span>
                    <span className="break-words">
                      {attempts.length === 0
                        ? t('noAttempts')
                        : t('attemptsCount', { count: attempts.length })}
                    </span>
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/ops/claims/${obligation.claimId}`}>{tShared('claimLabel')}</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/ops/payouts/${obligation.id}`}>{tShared('openLabel')}</Link>
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

export function OpsPayoutView({ id }: { id: string }) {
  const t = useTranslations('ops.payout');
  const tShared = useTranslations('ops.shared');
  const tCommon = useTranslations('common');
  const locale = useAppLocale();
  const state = useDemoSnapshot();
  const command = useOpsCommand();

  // Either id shape resolves to the same obligation page.
  const obligation = useMemo(() => {
    const direct = state.obligations[id];
    if (direct) return direct;
    const attempt = state.payoutAttempts[id];
    return attempt ? (state.obligations[attempt.obligationId] ?? null) : null;
  }, [state, id]);

  const attempts = useMemo(
    () => (obligation ? attemptsFor(state, obligation.id) : []),
    [state, obligation],
  );
  const last = useMemo(
    () => (obligation ? latestAttempt(state, obligation.id) : null),
    [state, obligation],
  );

  if (!obligation) return <OpsNotFound />;

  const claim = state.claims[obligation.claimId];
  const block = startBlockReason(obligation, attempts);
  const unknownAttempt = attempts.find((attempt) => attempt.status === 'unknown') ?? null;
  const canRetry = last !== null && last.status === 'failed' && obligation.status !== 'settled';

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader
        title={t('title')}
        description={t('subtitle')}
        backToQueue
        meta={
          <>
            <StatusBadge group="obligation" code={obligation.status} />
            {last ? <StatusBadge group="payout" code={last.status} /> : null}
            <StatusBadge group="bankSettlement" code={obligation.bankSettlement} />
            <Badge variant="outline">
              {tShared('roleResponsible', { role: tShared('roleOpsFinance') })}
            </Badge>
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/ops/claims/${obligation.claimId}`}>{tShared('claimLabel')}</Link>
          </Button>
        }
      />

      <OpsCommandError state={command} />

      <Card>
        <CardHeader>
          <CardTitle>{t('obligationLabel')}</CardTitle>
          <CardDescription className="break-words">
            {state.campaigns[obligation.campaignId]?.title ?? obligation.campaignId}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FactList
            items={[
              {
                label: tShared('amountLabel'),
                value: <MoneyText sen={obligation.amountSen} tabular />,
              },
              {
                label: t('obligationStatus'),
                value: <StatusBadge group="obligation" code={obligation.status} />,
              },
              {
                label: tShared('creatorLabel'),
                value: state.users[obligation.creatorId]?.displayName ?? obligation.creatorId,
              },
              {
                label: tShared('claimLabel'),
                value: claim ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span>#{claim.seq}</span>
                    <StatusBadge group="claim" code={claim.status} />
                  </span>
                ) : (
                  tCommon('state.notSet')
                ),
              },
              {
                label: t('providerAvailableAt'),
                value: (
                  <span data-testid="ops-provider-available">
                    <DateTimeText iso={obligation.providerAvailableAt} />
                  </span>
                ),
              },
            ]}
          />
          <TimeZoneHint />
        </CardContent>
      </Card>

      {obligation.status === 'settled' ? (
        <Alert className="bg-success-subtle" data-testid="ops-payout-settled">
          <Banknote aria-hidden="true" />
          <AlertTitle>{t('settledTitle')}</AlertTitle>
          <AlertDescription>
            {t('settledDescription', {
              amount: formatSen(obligation.amountSen, locale),
              at: obligation.providerAvailableAt
                ? formatDateTime(obligation.providerAvailableAt, locale)
                : '—',
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card data-testid="ops-bank-settlement">
        <CardHeader>
          <CardTitle>{t('bankSettlementTitle')}</CardTitle>
          <CardDescription className="break-words">
            {t('bankSettlementDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <StatusBadge
            group="bankSettlement"
            code={obligation.bankSettlement}
            className="self-start"
          />
          <p className="text-muted-foreground text-xs">{tCommon('budget.paidMeaning')}</p>
        </CardContent>
      </Card>

      <FinanceOnly probeCommand={{ type: 'payout.start', obligationId: obligation.id }}>
        <div className="flex min-w-0 flex-col gap-6">
          <Card data-testid="ops-payout-start">
            <CardHeader>
              <CardTitle>{t('startAction')}</CardTitle>
              <CardDescription className="break-words">
                {t('startConfirmDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {block !== null ? (
                <Alert
                  className="bg-inactive-subtle"
                  data-testid="ops-start-blocked"
                  data-block={block}
                >
                  <TriangleAlert aria-hidden="true" />
                  <AlertTitle>{t(`startBlocked.${block}`)}</AlertTitle>
                  <AlertDescription>
                    {block === 'unknown' ? t('noPayAgain') : tShared('simulatedCheck')}
                  </AlertDescription>
                </Alert>
              ) : null}
              <ConfirmDialog
                title={t('startConfirmTitle')}
                description={t('startConfirmDescription')}
                confirmLabel={t('startAction')}
                onConfirm={() =>
                  command.run({ type: 'payout.start', obligationId: obligation.id }, t('started'))
                }
                trigger={
                  <Button
                    className="self-start"
                    disabled={block !== null}
                    data-testid="ops-start-open"
                  >
                    <Banknote aria-hidden="true" />
                    <span className="truncate">{t('startAction')}</span>
                  </Button>
                }
              />
            </CardContent>
          </Card>

          {unknownAttempt !== null ? (
            <ReconcilePanel
              attempt={unknownAttempt}
              onReconcile={(outcome, note) =>
                command.run(
                  {
                    type: 'payout.reconcile',
                    attemptId: unknownAttempt.id,
                    outcome,
                    note,
                  },
                  t('reconciled'),
                )
              }
            />
          ) : null}

          {canRetry ? (
            <Card data-testid="ops-payout-retry">
              <CardHeader>
                <CardTitle>{t('retryTitle')}</CardTitle>
                <CardDescription className="break-words">{t('retryDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm break-words">
                  {t('failureReason')}: {last?.failureReason ?? tCommon('state.notSet')}
                </p>
                <ConfirmDialog
                  title={t('retryConfirmTitle')}
                  description={t('retryConfirmDescription')}
                  confirmLabel={t('retryAction')}
                  requireReason
                  reasonLabel={t('retryReasonLabel')}
                  onConfirm={(reason) =>
                    command.run(
                      { type: 'payout.retry', obligationId: obligation.id, reason },
                      t('retried'),
                    )
                  }
                  trigger={
                    <Button variant="outline" className="self-start" data-testid="ops-retry-open">
                      <span className="truncate">{t('retryAction')}</span>
                    </Button>
                  }
                />
                <p className="text-muted-foreground text-xs">{tShared('reasonRecorded')}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </FinanceOnly>

      <Card>
        <CardHeader>
          <CardTitle>{t('attemptsTitle')}</CardTitle>
          <CardDescription className="break-words">{t('attemptsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('noAttempts')}</p>
          ) : (
            <ItemGroup data-testid="ops-attempts">
              {attempts.map((attempt) => (
                <Item
                  key={attempt.id}
                  variant="outline"
                  className="items-start"
                  data-attempt-id={attempt.id}
                  data-attempt-status={attempt.status}
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle className="flex flex-wrap items-center gap-2">
                      <StatusBadge group="payout" code={attempt.status} />
                      <span className="font-mono text-xs break-all">{attempt.providerRef}</span>
                    </ItemTitle>
                    <ItemDescription className="flex flex-col gap-0.5">
                      <span className="break-words">
                        {t('requestKey')}:{' '}
                        <span className="font-mono break-all">{attempt.requestKey}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        {t('startedAt')} <DateTimeText iso={attempt.startedAt} hideOffset /> ·{' '}
                        {t('startedBy')} {actorName(state, attempt.startedBy)}
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        {t('resolvedAt')} <DateTimeText iso={attempt.resolvedAt} hideOffset />
                      </span>
                      {attempt.failureReason ? (
                        <span className="break-words">
                          {t('failureReason')}: {attempt.failureReason}
                        </span>
                      ) : null}
                      <span className="mt-1 flex flex-col gap-0.5">
                        <span className="font-medium">{t('reconciliationsTitle')}</span>
                        {attempt.reconciliations.length === 0 ? (
                          <span>{t('reconciliationsEmpty')}</span>
                        ) : (
                          attempt.reconciliations.map((record, index) => (
                            <span key={`${attempt.id}-rec-${index}`} className="break-words">
                              <DateTimeText iso={record.at} hideOffset /> ·{' '}
                              {t('reconciliationRow', {
                                outcome: t(`reconcileOutcome.${record.outcome}`),
                                note: record.note,
                              })}{' '}
                              · {tCommon('timeline.by', { actor: actorName(state, record.by) })}
                            </span>
                          ))
                        )}
                      </span>
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>

      <Card data-testid="ops-demo-tools-link">
        <CardHeader>
          <CardTitle>{t('demoToolsTitle')}</CardTitle>
          <CardDescription className="break-words">{tShared('demoToolsHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={openDemoTools} data-testid="ops-open-demo-tools">
            <FlaskConical aria-hidden="true" />
            <span className="truncate">{t('openDemoTools')}</span>
          </Button>
        </CardContent>
      </Card>

      <AuditTrail
        targetType="obligation"
        targetId={obligation.id}
        extra={attempts.map((attempt) => ({
          targetType: 'payout_attempt' as const,
          targetId: attempt.id,
        }))}
      />
    </div>
  );
}

function ReconcilePanel({
  attempt,
  onReconcile,
}: {
  attempt: PayoutAttempt;
  onReconcile: (outcome: ReconcileOutcome, note: string) => void;
}) {
  const t = useTranslations('ops.payout');
  const tShared = useTranslations('ops.shared');
  const [outcome, setOutcome] = useState<ReconcileOutcome>('still_unknown');

  return (
    <Card data-testid="ops-reconcile">
      <CardHeader>
        <CardTitle>{t('reconcileTitle')}</CardTitle>
        <CardDescription className="break-words">{t('reconcileDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FactList
          items={[
            {
              label: t('providerRef'),
              value: <span className="font-mono break-all">{attempt.providerRef}</span>,
            },
            {
              label: t('requestKey'),
              value: <span className="font-mono break-all">{attempt.requestKey}</span>,
            },
          ]}
        />

        <Field className="min-w-0 sm:max-w-sm">
          <FieldLabel htmlFor="ops-reconcile-outcome">{t('reconcileOutcomeLabel')}</FieldLabel>
          <Select value={outcome} onValueChange={(next) => setOutcome(next as ReconcileOutcome)}>
            <SelectTrigger
              id="ops-reconcile-outcome"
              className="w-full"
              data-testid="ops-reconcile-outcome"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECONCILE_OUTCOMES.map((option) => (
                <SelectItem key={option} value={option} data-outcome={option}>
                  {t(`reconcileOutcome.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <ConfirmDialog
          title={t('reconcileConfirmTitle')}
          description={t('reconcileConfirmDescription')}
          confirmLabel={t('reconcileAction')}
          requireReason
          reasonLabel={t('reconcileNoteLabel')}
          onConfirm={(note) => onReconcile(outcome, note)}
          trigger={
            <Button variant="outline" className="self-start" data-testid="ops-reconcile-open">
              <span className="truncate">{t('reconcileAction')}</span>
            </Button>
          }
        />

        <p className="text-muted-foreground text-xs break-words" data-testid="ops-no-pay-again">
          {t('noPayAgain')} {tShared('reasonRecorded')}
        </p>
      </CardContent>
    </Card>
  );
}
