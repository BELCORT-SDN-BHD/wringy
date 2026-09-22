import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsSubmissionsListView } from '@/features/ops/submission-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.submission');
  return { title: t('metaTitle'), description: t('listSubtitle') };
}

export default function OpsSubmissionsPage() {
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next="/ops/submissions">
      <OpsSubmissionsListView />
    </RequireRole>
  );
}
