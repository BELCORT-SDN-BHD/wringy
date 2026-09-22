import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { CreatorClaimDetailView } from '@/features/creator/claim-detail-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('creator.claimDetail');
  const tList = await getTranslations('creator.claims');
  return { title: t('metaTitle'), description: tList('subtitle') };
}

export default async function CreatorClaimDetailPage({
  params,
}: PageProps<'/creator/claims/[id]'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['creator']} next={`/creator/claims/${id}`}>
      <CreatorClaimDetailView claimId={id} />
    </RequireRole>
  );
}
