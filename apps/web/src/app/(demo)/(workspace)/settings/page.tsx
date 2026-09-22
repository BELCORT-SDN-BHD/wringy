import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SettingsView } from './settings-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default function SettingsPage() {
  return <SettingsView />;
}
