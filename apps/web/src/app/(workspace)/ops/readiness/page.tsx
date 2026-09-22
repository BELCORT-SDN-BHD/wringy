import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsReadinessListView } from '@/features/ops/readiness-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.readiness');
  return { title: t('metaTitle'), description: t('listSubtitle') };
}

export default function OpsReadinessListPage() {
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next="/ops/readiness">
      <OpsReadinessListView />
    </RequireRole>
  );
}
