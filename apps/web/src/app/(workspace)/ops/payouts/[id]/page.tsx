import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsPayoutView } from '@/features/ops/payout-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.payout');
  return { title: t('metaTitle'), description: t('subtitle') };
}

/** `[id]` is an obligation id or a payout-attempt id; both resolve to this page. */
export default async function OpsPayoutPage({ params }: PageProps<'/ops/payouts/[id]'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next={`/ops/payouts/${id}`}>
      <OpsPayoutView id={id} />
    </RequireRole>
  );
}
