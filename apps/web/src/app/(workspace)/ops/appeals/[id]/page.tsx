import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsAppealView } from '@/features/ops/appeal-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.appeal');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default async function OpsAppealPage({ params }: PageProps<'/ops/appeals/[id]'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next={`/ops/appeals/${id}`}>
      <OpsAppealView appealId={id} />
    </RequireRole>
  );
}
