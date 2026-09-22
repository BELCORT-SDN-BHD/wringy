import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

/**
 * The internal build's not-found page, rendered inside the (internal) root
 * layout (so under its trilingual banner) when a route below it calls
 * notFound(), e.g. an unmatched /internal/<path> ((internal)/internal/[...rest]).
 * It mounts nothing from the demo: no store, no demo tools, no language prompt
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md).
 */
export default async function InternalNotFound() {
  const t = await getTranslations('internal.notFound');

  return (
    <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <Empty className="flex-none border" data-app-state="not-found">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            <h1>{t('title')}</h1>
          </EmptyTitle>
          <EmptyDescription>{t('description')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/internal" prefetch={false}>{t('back')}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
