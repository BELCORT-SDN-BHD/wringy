import { getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';

// Placeholder home page. Wave 1 replaces this with the public catalogue entry.
export default async function Home() {
  const t = await getTranslations('app');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10">
      <Badge variant="outline">{t('demoBadge')}</Badge>
      <h1 className="font-heading text-2xl font-semibold">{t('name')}</h1>
      <p className="text-muted-foreground text-sm">
        Content Rewards prototype scaffold. Pages arrive with the wave 1 app shell.
      </p>
    </main>
  );
}
