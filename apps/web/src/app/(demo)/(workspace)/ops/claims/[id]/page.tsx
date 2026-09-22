import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsClaimView } from '@/features/ops/claim-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.claim');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default async function OpsClaimPage({ params }: PageProps<'/ops/claims/[id]'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next={`/ops/claims/${id}`}>
      <OpsClaimView claimId={id} />
    </RequireRole>
  );
}
