'use client';

/**
 * The creator's payment records.
 *
 * Four things stay apart (D05, ticket #7): a confirmed obligation is not a
 * payment; "paid" means funds are available in the simulated provider account;
 * bank settlement is a separate, usually unknown fact; and an unknown attempt is
 * neither failed nor paid — it is reconciled against the original transaction
 * and never paid a second time.
 *
 * There is no wallet balance here and no control that starts or repeats a
 * payment: that is an operations action.
 */

import Link from 'next/link';
import { Banknote, Info, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DateTimeText } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { reconcileOutcomeLabel } from '@/lib/reason-copy';
import type { PaymentRecordView } from '@/store/selectors';
import type { PayoutAttempt } from '@/domain/types';

import { DetailList, DetailRow, PageHeader } from './creator-ui';
import { useCreatorPayments } from './use-creator-data';

export function CreatorPaymentsView() {
  return (
    <HydrationGate>
      <Payments />
    </HydrationGate>
  );
}

function Payments() {
  const t = useTranslations('creator.payments');
  const records = useCreatorPayments();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Alert data-testid="payments-not-wallet">
        <Wallet aria-hidden="true" />
        <AlertTitle>{t('notWallet')}</AlertTitle>
        <AlertDescription>{t('noPayAgain')}</AlertDescription>
      </Alert>

      {records.length === 0 ? (
        <EmptyState icon={Banknote} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <div className="flex flex-col gap-4" data-testid="payments-list">
          {records.map((record) => (
            <PaymentCard key={record.claimId} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentCard({ record }: { record: PaymentRecordView }) {
  const t = useTranslations('creator.payments');

  return (
    <Card data-testid={`payment-${record.claimId}`} data-claim-status={record.claimStatus}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <MoneyText sen={record.amountSen} tabular />
          <StatusBadge group="claim" code={record.claimStatus} />
          {record.obligation ? (
            <StatusBadge group="obligation" code={record.obligation.status} />
          ) : null}
          <StatusBadge group="bankSettlement" code={record.bankSettlement} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DetailList>
          <DetailRow label={t('campaignLabel')}>
            <span className="break-words">{record.campaignTitle}</span>
          </DetailRow>
          <DetailRow label={t('amountLabel')} testId="payment-amount">
            <MoneyText sen={record.amountSen} tabular />
          </DetailRow>
          <DetailRow
            label={t('providerAvailableLabel')}
            hint={t('bankUnknownNote')}
            testId="payment-provider-available"
          >
            <DateTimeText iso={record.providerAvailableAt} />
          </DetailRow>
          <DetailRow label={t('bankSettlementLabel')} testId="payment-bank-settlement">
            <StatusBadge group="bankSettlement" code={record.bankSettlement} />
          </DetailRow>
        </DetailList>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t('attemptsTitle')}</h3>
          {record.attempts.length === 0 ? (
            <p className="text-muted-foreground text-sm break-words" data-testid="payment-no-attempt">
              {t('attemptsEmpty')} {t('attemptsEmptyHint')}
            </p>
          ) : (
            <ItemGroup data-testid={`attempts-${record.claimId}`}>
              {record.attempts.map((attempt) => (
                <AttemptRow key={attempt.id} attempt={attempt} />
              ))}
            </ItemGroup>
          )}
        </section>

        <div className="flex">
          <Button asChild variant="outline" size="sm">
            <Link href={`/creator/claims/${record.claimId}`}>{t('openClaim')}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AttemptRow({ attempt }: { attempt: PayoutAttempt }) {
  const t = useTranslations('creator.payments');
  const tCommon = useTranslations('common');

  const note =
    attempt.status === 'processing'
      ? t('processingNote')
      : attempt.status === 'failed'
        ? t('failedNote')
        : attempt.status === 'unknown'
          ? t('unknownNote')
          : t('bankUnknownNote');

  return (
    <Item
      variant="outline"
      className="items-start"
      data-testid={`attempt-${attempt.id}`}
      data-attempt-status={attempt.status}
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <span className="break-words">{t('attemptLabel')}</span>
          <StatusBadge group="payout" code={attempt.status} />
        </ItemTitle>
        <ItemDescription className="flex flex-col gap-1">
          <span className="break-words" data-testid="attempt-note">
            {note}
          </span>
          {attempt.failureReason ? (
            <span className="text-foreground break-words" data-testid="attempt-failure-reason">
              {t('failedReasonLabel')}: {attempt.failureReason}
            </span>
          ) : null}
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex flex-wrap items-center gap-1">
              {t('startedAtLabel')}
              <DateTimeText iso={attempt.startedAt} hideOffset />
            </span>
            <span className="flex flex-wrap items-center gap-1">
              {t('resolvedAtLabel')}
              <DateTimeText iso={attempt.resolvedAt} hideOffset />
            </span>
            <span className="break-all">
              {t('providerRefLabel')}: {attempt.providerRef}
            </span>
          </span>
          {attempt.reconciliations.length > 0 ? (
            <span className="flex flex-col gap-1" data-testid="attempt-reconciliations">
              <span className="text-foreground text-xs">{t('reconciliationsTitle')}</span>
              {attempt.reconciliations.map((entry, index) => (
                <span key={`${attempt.id}-rec-${index}`} className="flex flex-wrap items-center gap-1 text-xs">
                  <Info aria-hidden="true" className="size-3" />
                  <DateTimeText iso={entry.at} hideOffset />
                  {/*
                    The reconciliation outcome is an engine enum, so it goes through
                    the same shared copy operations reads. The note beside it is what
                    a person typed and stays verbatim (localization-v1).
                  */}
                  <span className="break-words">
                    {reconcileOutcomeLabel(entry.outcome, tCommon)} — {entry.note}
                  </span>
                </span>
              ))}
            </span>
          ) : null}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
