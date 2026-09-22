'use client';

/**
 * What this post has earned, and what can be claimed right now.
 *
 * Order and wording follow the approved rule (D01/D02, campaign-defaults-v1
 * 金额 and 门槛): the exact cumulative reward is capped first and rounded down to
 * the sen, then the amounts already reserved, confirmed or paid for this post are
 * subtracted; the remainder must reach the minimum claim and any extra view
 * threshold. Reaching a view threshold never raises the cap.
 *
 * Three words stay apart everywhere on this panel: estimated, confirmed, paid.
 * When the source cannot be read the last trusted number and its time stay on
 * screen — never 0, never "fraud" (localization-v1).
 */

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BudgetBuckets } from '@/components/app/budget-buckets';
import { DataUnavailable } from '@/components/app/data-unavailable';
import { DateTimeText } from '@/components/app/date-time-text';
import { MoneyText, RateText } from '@/components/app/money-text';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatSen, formatViews, formatViewsOrUnknown } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';

import { ClaimAction } from './claim-action';
import { DetailList, DetailRow } from './creator-ui';
import { PartialOfferPanel } from './partial-offer-dialog';
import type { SubmissionView } from './use-creator-data';

export function RewardPanel({ view }: { view: SubmissionView }) {
  const t = useTranslations('creator.reward');
  const tCommon = useTranslations('common.budget');
  const locale = useAppLocale();
  const { reward, campaign, budget, openOffer, submission } = view;

  if (!reward) return null;

  const rules = campaign?.rules ?? null;
  const capSen = rules?.capPerSubmissionSen ?? null;
  // No trusted reading → no progress against the cap either. A 0% bar would be the
  // same "unknown read as zero" the panel's own note rules out, so the bar is
  // replaced by the cap figure alone until a reading exists.
  const capPercent =
    capSen === null || capSen === 0 || reward.exactRewardMilliSen === null
      ? null
      : Math.min(100, Math.floor(reward.exactRewardMilliSen / (capSen * 10)));

  return (
    <Card data-testid="reward-panel">
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('estimateNote')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {reward.dataStatus === 'trusted' ? null : (
          <DataUnavailable
            lastTrustedAt={reward.lastTrustedAt}
            lastValue={`${formatViewsOrUnknown(reward.qualifiedViews, locale)} · ${t('basisLabel')}`}
            reason={submission.status}
          />
        )}
        {reward.dataStatus === 'trusted' ? null : (
          <p className="text-muted-foreground text-xs break-words" data-testid="reward-unknown-note">
            {t('dataUnavailableNote')}
          </p>
        )}

        <DetailList>
          <DetailRow label={t('basisLabel')} hint={t('definition')} testId="reward-qualified-views">
            <span className="font-mono tabular-nums" data-views={reward.qualifiedViews ?? 'unknown'}>
              {formatViewsOrUnknown(reward.qualifiedViews, locale)}
            </span>
          </DetailRow>
          {rules ? (
            <DetailRow label={t('rateLabel')}>
              <RateText ratePerThousandSen={rules.ratePerThousandSen} />
            </DetailRow>
          ) : null}
          <DetailRow label={t('lastTrustedLabel')} testId="reward-last-trusted">
            <DateTimeText iso={reward.lastTrustedAt} />
          </DetailRow>
          <DetailRow label={t('snapshotLabel')}>
            {reward.lastSnapshotVersion ?? <span className="text-inactive-foreground">—</span>}
          </DetailRow>
          <DetailRow label={t('estimateLabel')} hint={t('estimateNote')} testId="reward-estimate">
            <MoneyText sen={reward.cappedSen} tabular />
          </DetailRow>
        </DetailList>

        {capSen === null ? null : (
          <div className="flex flex-col gap-1" data-testid="reward-cap">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-xs">{t('capLabel')}</span>
              <span className="text-sm">
                <MoneyText sen={capSen} tabular />
              </span>
            </div>
            {capPercent === null ? (
              <span className="text-muted-foreground text-xs">{t('capProgressUnknown')}</span>
            ) : (
              <>
                <Progress value={capPercent} aria-label={t('capProgress', { percent: capPercent })} />
                <span className="text-muted-foreground text-xs">
                  {t('capProgress', { percent: capPercent })}
                </span>
              </>
            )}
            {reward.capReached ? (
              <span
                className="text-attention-foreground bg-attention-subtle flex items-start gap-1.5 rounded-md px-2 py-1 text-xs break-words"
                data-testid="reward-cap-reached"
              >
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                {t('capReached', { cap: formatSen(capSen, locale) })}
              </span>
            ) : null}
          </div>
        )}

        <DetailList>
          <DetailRow label={t('reservedLabel')} testId="reward-reserved">
            <MoneyText sen={reward.reservedSen} tabular />
          </DetailRow>
          <DetailRow label={t('confirmedUnpaidLabel')} testId="reward-confirmed-unpaid">
            <MoneyText sen={reward.confirmedUnpaidSen} tabular />
          </DetailRow>
          <DetailRow label={t('paidLabel')} testId="reward-paid">
            <MoneyText sen={reward.paidSen} tabular />
          </DetailRow>
          <DetailRow
            label={t('claimableLabel')}
            hint={t('claimableNote')}
            testId="reward-claimable"
          >
            <MoneyText sen={reward.claimableSen} tabular />
          </DetailRow>
          {rules ? (
            <DetailRow
              label={t('minClaimLabel')}
              hint={reward.meetsMinClaim ? t('minClaimMet') : t('minClaimNotMet')}
              testId="reward-min-claim"
            >
              <MoneyText sen={rules.minClaimSen} tabular />
            </DetailRow>
          ) : null}
          {rules ? (
            <DetailRow
              label={t('thresholdLabel')}
              hint={
                rules.viewThreshold === null
                  ? t('thresholdNone')
                  : reward.meetsViewThreshold
                    ? t('thresholdMet')
                    : t('thresholdNotMet')
              }
              testId="reward-threshold"
            >
              {rules.viewThreshold === null
                ? t('thresholdNone')
                : formatViews(rules.viewThreshold, locale)}
            </DetailRow>
          ) : null}
        </DetailList>

        {reward.pendingClaimId ? (
          <p className="text-muted-foreground text-xs break-words" data-testid="reward-pending-claim">
            {t('pendingClaimNotice')}
          </p>
        ) : null}

        {openOffer ? <PartialOfferPanel offer={openOffer} submissionId={submission.id} /> : null}

        <ClaimAction view={view} />

        {budget ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs">{tCommon('title')}</h3>
            <BudgetBuckets budget={budget} bare />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
