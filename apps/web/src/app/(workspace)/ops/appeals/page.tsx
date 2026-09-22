import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsAppealsListView } from '@/features/ops/appeal-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.appeal');
  return { title: t('metaTitle'), description: t('listSubtitle') };
}

export default function OpsAppealsPage() {
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next="/ops/appeals">
      <OpsAppealsListView />
    </RequireRole>
  );
}
