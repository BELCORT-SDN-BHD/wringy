import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { LoadingState } from '@/components/app/loading-state';
import { RequireRole } from '@/components/app/require-role';
import { CreatorSubmitView } from '@/features/creator/submit-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('creator.submit');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function CreatorSubmitPage() {
  // The view reads `campaign` from the query string, so it needs a Suspense
  // boundary — the same rule the sign-in page follows.
  return (
    <RequireRole allow={['creator']} next="/creator/submissions/new">
      <Suspense fallback={<LoadingState rows={2} />}>
        <CreatorSubmitView />
      </Suspense>
    </RequireRole>
  );
}
