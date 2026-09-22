import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { CatalogueView } from './catalogue-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('public.catalogue');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function CampaignsPage() {
  return <CatalogueView />;
}
