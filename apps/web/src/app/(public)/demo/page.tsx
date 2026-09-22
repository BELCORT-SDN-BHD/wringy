import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DemoGuideView } from './demo-guide-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('demo.guide');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function DemoPage() {
  return <DemoGuideView />;
}
