import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { createSeedState } from '@/domain';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';
import { formatSen } from '@/lib/format';

import { CampaignDetailView } from './campaign-detail-view';

/**
 * Metadata is generated from the baseline seed, not from the visitor's
 * localStorage: the server cannot see the browser's demo state. It therefore
 * describes the preset campaigns correctly and falls back to the generic title
 * for anything a scenario created locally. Nothing here claims verified search
 * indexing or link unfurling; the prototype is not publicly deployed
 * (prototype-spec-v1).
 */
export async function generateMetadata({ params }: PageProps<'/campaigns/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const t = await getTranslations('public.campaign');
  const tCatalogue = await getTranslations('public.catalogue');
  const tMoney = await getTranslations('common.money');

  const seed = createSeedState();
  const campaign = seed.campaigns[id];

  if (!campaign || campaign.status !== 'published') {
    return { title: tCatalogue('metaTitle'), description: tCatalogue('metaDescription') };
  }

  const org = seed.orgs[campaign.orgId]?.name ?? campaign.orgId;

  return {
    title: campaign.title,
    description: t('metaDescription', {
      title: campaign.title,
      org,
      rate: tMoney('perThousand', {
        amount: formatSen(campaign.rules.ratePerThousandSen, locale),
      }),
      cap: formatSen(campaign.rules.capPerSubmissionSen, locale),
      min: formatSen(campaign.rules.minClaimSen, locale),
    }),
  };
}

export default async function CampaignDetailPage({ params }: PageProps<'/campaigns/[id]'>) {
  const { id } = await params;
  return <CampaignDetailView campaignId={id} />;
}
