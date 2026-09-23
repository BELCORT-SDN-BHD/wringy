import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsSubmissionView } from '@/features/ops/submission-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.submission');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default async function OpsSubmissionPage({ params }: PageProps<'/ops/submissions/[id]'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next={`/ops/submissions/${id}`}>
      <OpsSubmissionView submissionId={id} />
    </RequireRole>
  );
}
