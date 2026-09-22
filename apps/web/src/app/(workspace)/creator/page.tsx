import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { CreatorOverviewView } from '@/features/creator/overview-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('creator.overview');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function CreatorOverviewPage() {
  return (
    <RequireRole allow={['creator']} next="/creator">
      <CreatorOverviewView />
    </RequireRole>
  );
}
