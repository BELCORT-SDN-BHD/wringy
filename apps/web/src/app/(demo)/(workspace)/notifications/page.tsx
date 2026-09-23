import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { NotificationsView } from './notifications-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notifications');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function NotificationsPage() {
  return <NotificationsView />;
}
