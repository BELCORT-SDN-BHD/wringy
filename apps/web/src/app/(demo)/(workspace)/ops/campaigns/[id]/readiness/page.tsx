import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsReadinessView } from '@/features/ops/readiness-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.readiness');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default async function OpsCampaignReadinessPage({
  params,
}: PageProps<'/ops/campaigns/[id]/readiness'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next={`/ops/campaigns/${id}/readiness`}>
      <OpsReadinessView campaignId={id} />
    </RequireRole>
  );
}
