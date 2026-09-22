import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { CreatorAccountsView } from '@/features/creator/accounts-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('creator.accounts');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function CreatorAccountsPage() {
  return (
    <RequireRole allow={['creator']} next="/creator/accounts">
      <CreatorAccountsView />
    </RequireRole>
  );
}
