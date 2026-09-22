import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsClaimsListView } from '@/features/ops/claim-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.claim');
  return { title: t('metaTitle'), description: t('listSubtitle') };
}

export default function OpsClaimsPage() {
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next="/ops/claims">
      <OpsClaimsListView />
    </RequireRole>
  );
}
