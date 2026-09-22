import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsPayoutsListView } from '@/features/ops/payout-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.payout');
  return { title: t('metaTitle'), description: t('listSubtitle') };
}

/**
 * Reading the obligations is not a finance capability: a reviewer has to be able
 * to see why a payout is stuck, and the queue links them here. Starting,
 * reconciling and retrying one is, and those controls sit behind `FinanceOnly`
 * on the detail page.
 */
export default function OpsPayoutsPage() {
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next="/ops/payouts">
      <OpsPayoutsListView />
    </RequireRole>
  );
}
