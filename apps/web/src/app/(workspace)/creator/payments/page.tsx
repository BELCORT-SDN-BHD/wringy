import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { CreatorPaymentsView } from '@/features/creator/payments-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('creator.payments');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function CreatorPaymentsPage() {
  return (
    <RequireRole allow={['creator']} next="/creator/payments">
      <CreatorPaymentsView />
    </RequireRole>
  );
}
