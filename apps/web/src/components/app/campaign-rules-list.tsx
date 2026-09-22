'use client';

/**
 * The public rule sheet for a campaign, shared by the catalogue card and the
 * campaign detail page so the two can never state different terms.
 *
 * Every figure keeps its unit and its basis: a rate is always "per 1,000
 * qualified views", a cap is always "per submission and cumulative", and the
 * service fee is never a number (kickoff decision 10). Reaching a view threshold
 * does not raise the cap, and that is said out loud rather than implied.
 */

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DateTimeText } from '@/components/app/date-time-text';
import { MoneyText, RateText, ServiceFeeText } from '@/components/app/money-text';
import { capAtThreshold } from '@/domain/money';
import { formatSen, formatViews } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import type { Campaign } from '@/domain/types';

const PLATFORM_KEY = {
  tiktok: 'platformTikTok',
  instagram: 'platformInstagram',
  youtube: 'platformYouTube',
} as const;

const LANGUAGE_KEY = {
  en: 'languageEn',
  ms: 'languageMs',
  zh: 'languageZh',
} as const;

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-muted-foreground w-full shrink-0 text-xs sm:w-56">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm break-words">{children}</span>
        {hint ? <span className="text-muted-foreground text-xs break-words">{hint}</span> : null}
      </dd>
    </div>
  );
}

export function CampaignRulesList({ campaign }: { campaign: Campaign }) {
  const t = useTranslations('public.campaign');
  const tMoney = useTranslations('common.money');
  const locale = useAppLocale();
  const { rules } = campaign;
  // "必须明确展示'达10万观看，奖励封顶RM100'" (campaign-defaults-v1.md 门槛必须能达到).
  // The threshold and the cap are two figures; the fact a creator has to read is the
  // third, derived one, so the rule sheet states it wherever it is rendered — the
  // merchant preview, the public detail page and the creator's submit page.
  const capped = capAtThreshold(rules);

  return (
    <dl className="flex flex-col" data-app-widget="campaign-rules">
      <Row label={t('rate')}>
        <RateText ratePerThousandSen={rules.ratePerThousandSen} />
      </Row>
      <Row label={t('minClaim')} hint={t('minClaimNote')}>
        <MoneyText sen={rules.minClaimSen} />
      </Row>
      <Row label={t('cap')} hint={t('capNote')}>
        <MoneyText sen={rules.capPerSubmissionSen} />
      </Row>
      <Row label={t('pool')}>
        <MoneyText sen={rules.poolSen} />
      </Row>
      <Row
        label={t('viewThreshold')}
        hint={rules.viewThreshold === null ? undefined : t('viewThresholdNote')}
      >
        <span className="flex flex-col gap-0.5">
          <span>
            {rules.viewThreshold === null
              ? t('viewThresholdNone')
              : formatViews(rules.viewThreshold, locale)}
          </span>
          {capped ? (
            <span
              className="text-attention-foreground bg-attention-subtle flex items-start gap-1.5 rounded-md px-2 py-1 text-xs break-words"
              data-testid="campaign-cap-at-threshold"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {t('viewThresholdCapNote', {
                views: formatViews(capped.views, locale),
                amount: formatSen(capped.cappedSen, locale),
              })}
            </span>
          ) : null}
        </span>
      </Row>
      <Row label={t('submissionsClose')}>
        <DateTimeText iso={campaign.submissionsCloseAt} />
      </Row>
      <Row label={t('metering')}>{t('meteringValue', { days: rules.meteringDays })}</Row>
      <Row label={t('grace')}>{t('graceValue', { days: rules.claimGraceDays })}</Row>
      <Row label={t('retention')}>{t('retentionValue', { days: rules.retentionDays })}</Row>
      <Row label={t('platforms')}>
        {rules.platforms.map((platform) => t(PLATFORM_KEY[platform])).join(' · ')}
      </Row>
      <Row label={t('languages')}>
        {rules.contentLanguages.map((language) => t(LANGUAGE_KEY[language])).join(' · ')}
      </Row>
      <Row label={tMoney('serviceFee')}>
        <ServiceFeeText />
      </Row>
    </dl>
  );
}
