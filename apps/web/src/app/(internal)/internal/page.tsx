import { ServerCog } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { loadWebEnv, tryLoadEnv } from '@wringy/config/web';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

// Read the environment and the language cookie on every request, never at build time.
export const dynamic = 'force-dynamic';

/**
 * `/internal`: the internal build's page. M2-01 W1 ships only the frame (the
 * persistent trilingual banner and the "API not configured" state); W3 replaces
 * the body with the campaigns and worker-health reads from the API.
 */
export default async function InternalPage() {
  const t = await getTranslations('internal');
  // Server-only: the web process's own environment. The error names variables,
  // never values, and nothing here reaches the browser bundle.
  const env = tryLoadEnv(() => loadWebEnv());

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div
        role="note"
        data-app-banner="internal-build"
        className="border-b bg-muted px-4 py-2 text-center text-sm font-medium text-foreground"
      >
        {t('banner')}
      </div>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </header>
        {env.ok ? null : (
          <Empty className="border" data-app-state="not-configured">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ServerCog aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t('state.notConfigured.title')}</EmptyTitle>
              <EmptyDescription>{t('state.notConfigured.description')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <p className="font-mono text-xs text-muted-foreground">
                {t('state.notConfigured.variables', {
                  names: env.error.problems.map((problem) => problem.name).join(', '),
                })}
              </p>
            </EmptyContent>
          </Empty>
        )}
      </main>
    </div>
  );
}
