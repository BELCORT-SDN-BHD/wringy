import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsExceptionsView } from '@/features/ops/exceptions-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.exceptions');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function OpsExceptionsPage() {
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next="/ops/exceptions">
      <OpsExceptionsView />
    </RequireRole>
  );
}
