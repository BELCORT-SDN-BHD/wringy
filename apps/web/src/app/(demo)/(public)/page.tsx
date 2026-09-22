import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LandingView } from './landing-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('public.landing');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function Home() {
  return <LandingView />;
}
