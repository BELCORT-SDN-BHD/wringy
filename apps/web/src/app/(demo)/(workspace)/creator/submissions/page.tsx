import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { CreatorSubmissionsView } from '@/features/creator/submissions-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('creator.submissions');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function CreatorSubmissionsPage() {
  return (
    <RequireRole allow={['creator']} next="/creator/submissions">
      <CreatorSubmissionsView />
    </RequireRole>
  );
}
