'use client';

/**
 * Claims, offers waiting for consent, and the waitlist.
 *
 * The three are separate on purpose (three-role-flows §4): a claim holds a
 * reservation and a queue position, an offer holds neither until the creator
 * consents to the exact amount, and a waitlist entry holds neither at all and
 * carries no payment promise. A notified entry offers "Resubmit", which takes a
 * new queue time and never restores the old one.
 */

import Link from 'next/link';
import { ArrowRight, HandCoins, Hourglass, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DateTimeText } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { CommandErrorAlert } from '@/components/app/error-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { useDispatch } from '@/store/demo-store';

import { PartialOfferPanel } from './partial-offer-dialog';
import { PageHeader } from './creator-ui';
import {
  useCreatorClaims,
  useCreatorOffers,
  useCreatorWaitlist,
  type ClaimRow,
  type WaitlistRow,
} from './use-creator-data';

export function CreatorClaimsView() {
  return (
    <HydrationGate>
      <Claims />
    </HydrationGate>
  );
}

function Claims() {
  const t = useTranslations('creator.claims');
  const claims = useCreatorClaims();
  const offers = useCurrentOffers();
  const waitlist = useCreatorWaitlist();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('claimsTitle')}</h2>
        {claims.length === 0 ? (
          <EmptyState icon={HandCoins} title={t('empty')} description={t('emptyHint')} />
        ) : (
          <ItemGroup data-testid="claims-list">
            {claims.map((row) => (
              <ClaimRowItem key={row.claim.id} row={row} />
            ))}
          </ItemGroup>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('offersTitle')}</h2>
        {offers.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('offersEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-3" data-testid="offers-list">
            {offers.map((offer) => (
              <PartialOfferPanel
                // Keyed by submission, not by offer: asking for the amount again
                // supersedes the offer in place, so the panel and its dialog follow
                // the live quote instead of staying on the one that went stale.
                key={offer.offer.submissionId}
                offer={offer}
                submissionId={offer.offer.submissionId}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('waitlistTitle')}</h2>
        {waitlist.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('waitlistEmpty')}</p>
        ) : (
          <ItemGroup data-testid="waitlist-list">
            {waitlist.map((row) => (
              <WaitlistRowItem key={row.entry.id} row={row} />
            ))}
          </ItemGroup>
        )}
      </section>
    </div>
  );
}

/**
 * The offer still awaiting an answer, one per submission.
 *
 * `claim.request` invalidates the previous quote and mints a new one ("旧报价失效，重新
 * 展示并取得同意"), so only the newest offer for a submission is a live question. The
 * superseded ones stay in the record and in the audit trail, but listing them would
 * show several panels for the same money.
 */
function useCurrentOffers() {
  const offers = useCreatorOffers();
  const bySubmission = new Map<string, (typeof offers)[number]>();
  for (const offer of offers) {
    if (offer.offer.status !== 'open' && offer.offer.status !== 'stale') continue;
    // `selectOffersForCreator` sorts by minted id, so the last one wins.
    bySubmission.set(offer.offer.submissionId, offer);
  }
  return [...bySubmission.values()];
}

function ClaimRowItem({ row }: { row: ClaimRow }) {
  const t = useTranslations('creator.claims');
  const { claim, campaign } = row;

  return (
    <Item
      variant="outline"
      className="items-start"
      data-testid={`claim-${claim.id}`}
      data-claim-status={claim.status}
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <MoneyText sen={claim.amountSen} tabular />
          <StatusBadge group="claim" code={claim.status} />
          <StatusBadge group="metering" code={claim.meteringReview.status} />
          {/*
            The appeal outcome belongs in the row: a rejected appeal puts the claim
            back into `rejected_appealable`, and the claim badge alone cannot say
            whether an appeal is still to come, running, or already decided.
          */}
          {row.appeal ? <StatusBadge group="appeal" code={row.appeal.status} /> : null}
        </ItemTitle>
        <ItemDescription className="flex flex-col gap-1">
          <span className="break-words">{campaign?.title ?? claim.campaignId}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span data-claim-seq={claim.seq}>{t('queueLabel', { seq: claim.seq })}</span>
            <span className="flex flex-wrap items-center gap-1">
              {t('validAtLabel')}
              <DateTimeText iso={claim.validAt} hideOffset />
            </span>
          </span>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button asChild variant="outline" size="sm">
          <Link href={`/creator/claims/${claim.id}`}>
            <span className="truncate">{t('open')}</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </ItemActions>
    </Item>
  );
}

function WaitlistRowItem({ row }: { row: WaitlistRow }) {
  const t = useTranslations('creator.claims');
  const dispatch = useDispatch();
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);
  const { entry, campaign } = row;

  /**
   * A resubmit has the three outcomes `claim.request` has, and the engine returns
   * which one happened. Below the minimum claim nothing is filed and nothing is
   * reserved — the entry simply takes a new queue time — so saying "filed again"
   * there would report a record that does not exist ("不能伪装成功").
   */
  const resubmit = () => {
    const result = dispatch({ type: 'waitlist.resubmit', entryId: entry.id });
    if (!result.ok) {
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);
    if (result.outcome === 'waitlisted') {
      toast.info(t('resubmitStillWaitingToast'));
      return;
    }
    if (result.outcome === 'partial_offer') {
      toast.info(t('resubmitOfferToast'));
      return;
    }
    toast.success(t('resubmitToast'));
  };

  const canResubmit = entry.status === 'notified' || entry.status === 'waiting';

  return (
    <Item
      variant="outline"
      className="items-start"
      data-testid={`waitlist-${entry.id}`}
      data-waitlist-status={entry.status}
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <MoneyText sen={entry.claimableSenAtEntry} tabular />
          <StatusBadge group="waitlist" code={entry.status} />
        </ItemTitle>
        <ItemDescription className="flex flex-col gap-1">
          <span className="break-words">{campaign?.title ?? entry.campaignId}</span>
          <span className="break-words">
            {entry.status === 'notified' ? t('waitlistNotified') : t('waitlistWaiting')}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>
              {t('claimableAtEntryLabel')}: <MoneyText sen={entry.claimableSenAtEntry} />
            </span>
            <span className="flex flex-wrap items-center gap-1" data-testid="waitlist-valid-at">
              {t('validAtLabel')}
              <DateTimeText iso={entry.createdAt} hideOffset />
            </span>
            {entry.notifiedAt ? (
              <span className="flex flex-wrap items-center gap-1">
                {t('notifiedAtLabel')}
                <DateTimeText iso={entry.notifiedAt} hideOffset />
              </span>
            ) : null}
          </span>
        </ItemDescription>
        {/* Outside ItemDescription: that is a <p>, and the alert is a <div role="alert">. */}
        {error ? <CommandErrorAlert code={error.code} detail={error.detail} /> : null}
      </ItemContent>
      <ItemActions className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/creator/submissions/${entry.submissionId}`}>
            <span className="truncate">{t('openSubmission')}</span>
          </Link>
        </Button>
        {canResubmit ? (
          <Button
            variant="outline"
            size="sm"
            onClick={resubmit}
            data-testid={`waitlist-resubmit-${entry.id}`}
          >
            {entry.status === 'notified' ? (
              <RefreshCw aria-hidden="true" />
            ) : (
              <Hourglass aria-hidden="true" />
            )}
            <span className="truncate">{t('resubmit')}</span>
          </Button>
        ) : null}
      </ItemActions>
    </Item>
  );
}
