'use client';

/**
 * "Claim reward" and what comes back.
 *
 * One press is one intent: the command id is minted per (submission, reading
 * version, claimable amount), so a second press of the same intent — or a press
 * that arrives twice — replays through the engine's idempotency instead of
 * filing a second claim. The engine is the guarantee; this only stops the UI
 * from spamming it (ticket #5: 重复点击或同视频已有待处理申请不新增记录).
 *
 * A claim request has three possible outcomes and each one is explained in its
 * own terms: a reservation with the four pool buckets, a partial offer that
 * reserves nothing until consent, or a waitlist entry with no reservation and no
 * payment promise.
 */

import Link from 'next/link';
import { CircleCheck, HandCoins, Hourglass } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { BudgetBuckets } from '@/components/app/budget-buckets';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { CommandErrorAlert } from '@/components/app/error-state';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorCopyKey } from '@/lib/error-copy';
import { formatSen } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { newCommandId } from '@/store/command-id';
import { useDispatch } from '@/store/demo-store';
import type { BudgetBuckets as BudgetBucketsValue, SubmissionRewardView } from '@/domain/types';

import { PartialOfferDialog } from './partial-offer-dialog';
import type { SubmissionView } from './use-creator-data';

type Outcome =
  | { kind: 'claim'; claimId: string; amountSen: number }
  | { kind: 'waitlisted'; entryId: string }
  | { kind: 'replay' }
  | null;

export function ClaimAction({ view }: { view: SubmissionView }) {
  const t = useTranslations('creator.claim');
  const tReward = useTranslations('creator.reward');
  const locale = useAppLocale();
  const dispatch = useDispatch();

  const [outcome, setOutcome] = useState<Outcome>(null);
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const intent = useRef<{ signature: string; commandId: string } | null>(null);

  const { reward, budget, openOffer, submission } = view;
  if (!reward) return null;

  const request = () => {
    const signature = `${submission.id}|${reward.lastSnapshotVersion ?? 'none'}|${reward.claimableSen}`;
    if (intent.current?.signature !== signature) {
      intent.current = { signature, commandId: newCommandId() };
    }
    // The claims already on this submission, so the new one can be named.
    const knownClaims = new Set(view.claims.map((claim) => claim.id));
    const result = dispatch(
      { type: 'claim.request', submissionId: submission.id },
      intent.current.commandId,
    );

    if (!result.ok) {
      setOutcome(null);
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);

    if (result.outcome === 'partial_offer') {
      setOutcome(null);
      setOfferOpen(true);
      return;
    }
    if (result.outcome === 'waitlisted') {
      const entry = Object.values(result.state.waitlist).find(
        (candidate) => candidate.submissionId === submission.id,
      );
      setOutcome(entry ? { kind: 'waitlisted', entryId: entry.id } : null);
      return;
    }
    if (result.outcome === 'idempotent_replay') {
      setOutcome({ kind: 'replay' });
      return;
    }
    const created = Object.values(result.state.claims).find(
      (claim) => claim.submissionId === submission.id && !knownClaims.has(claim.id),
    );
    setOutcome(
      created ? { kind: 'claim', claimId: created.id, amountSen: created.amountSen } : null,
    );
  };

  return (
    <div className="flex flex-col gap-3" data-testid="claim-action">
      <div className="flex flex-col gap-2">
        <ConfirmDialog
          title={t('confirmTitle', { amount: formatSen(reward.claimableSen, locale) })}
          description={t('confirmDescription', {
            amount: formatSen(reward.claimableSen, locale),
          })}
          confirmLabel={t('confirmAction')}
          onConfirm={request}
          trigger={
            <Button disabled={!reward.canClaim} data-testid="claim-reward" className="w-full sm:w-fit">
              <HandCoins aria-hidden="true" />
              {t('action')}
            </Button>
          }
        />
        {reward.canClaim ? null : <BlockReason reward={reward} />}
      </div>

      {openOffer ? (
        <PartialOfferDialog
          offer={openOffer}
          submissionId={submission.id}
          open={offerOpen}
          onOpenChange={setOfferOpen}
        />
      ) : null}

      {error ? <CommandErrorAlert code={error.code} detail={error.detail} /> : null}

      {outcome?.kind === 'claim' ? (
        <ClaimReservedAlert
          claimId={outcome.claimId}
          amountSen={outcome.amountSen}
          budget={budget}
        />
      ) : null}

      {outcome?.kind === 'waitlisted' ? (
        <Alert className="bg-attention-subtle text-attention-foreground" data-testid="claim-waitlisted">
          <Hourglass aria-hidden="true" className="text-attention-foreground" />
          <AlertTitle>{t('waitlistedTitle')}</AlertTitle>
          <AlertDescription className="text-attention-foreground">
            {t('waitlistedDescription')}
          </AlertDescription>
          <AlertAction>
            <Button asChild variant="outline" size="sm">
              <Link href="/creator/claims">{t('openWaitlist')}</Link>
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {outcome?.kind === 'replay' ? (
        <Alert data-testid="claim-replay">
          <Hourglass aria-hidden="true" />
          <AlertTitle>{t('idempotentNotice')}</AlertTitle>
          <AlertDescription>{tReward('pendingClaimNotice')}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function ClaimReservedAlert({
  claimId,
  amountSen,
  budget,
}: {
  claimId: string;
  amountSen: number;
  budget: BudgetBucketsValue | null;
}) {
  const t = useTranslations('creator.claim');
  const locale = useAppLocale();

  return (
    <Alert data-testid="claim-reserved" data-claim-id={claimId}>
      <CircleCheck aria-hidden="true" />
      <AlertTitle>{t('reservedTitle', { amount: formatSen(amountSen, locale) })}</AlertTitle>
      <AlertDescription>
        <span className="flex flex-col gap-3">
          <span className="break-words">{t('reservedDescription')}</span>
          {budget ? (
            <span className="flex flex-col gap-1">
              <span className="text-xs">{t('bucketsTitle')}</span>
              <BudgetBuckets budget={budget} bare />
            </span>
          ) : null}
          <span className="flex">
            <Button asChild variant="outline" size="sm" data-testid="claim-reserved-open">
              <Link href={`/creator/claims/${claimId}`}>{t('openClaim')}</Link>
            </Button>
          </span>
        </span>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Why the button is disabled, as the engine's own block reason. The code is on
 * the element so a test asserts the mapping rather than the sentence.
 */
function BlockReason({ reward }: { reward: SubmissionRewardView }) {
  const tReward = useTranslations('creator.reward');
  const tErrors = useTranslations('common.errors');
  if (reward.blockReason === null) return null;
  return (
    <p
      className="text-muted-foreground text-xs break-words"
      data-testid="claim-block-reason"
      data-block-reason={reward.blockReason}
    >
      {tReward('blockedTitle')}: {tErrors(errorCopyKey(reward.blockReason))}
    </p>
  );
}
