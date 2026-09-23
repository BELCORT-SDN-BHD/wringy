import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { CreatorSubmissionDetailView } from '@/features/creator/submission-detail-view';

/**
 * Metadata cannot name the submission: the server does not see the visitor's
 * localStorage, and a submission exists only in that browser's demo state.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('creator.detail');
  const tList = await getTranslations('creator.submissions');
  return { title: t('metaTitle'), description: tList('subtitle') };
}

export default async function CreatorSubmissionDetailPage({
  params,
}: PageProps<'/creator/submissions/[id]'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['creator']} next={`/creator/submissions/${id}`}>
      <CreatorSubmissionDetailView submissionId={id} />
    </RequireRole>
  );
}
