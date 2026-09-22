import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { CreatorClaimsView } from '@/features/creator/claims-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('creator.claims');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function CreatorClaimsPage() {
  return (
    <RequireRole allow={['creator']} next="/creator/claims">
      <CreatorClaimsView />
    </RequireRole>
  );
}
