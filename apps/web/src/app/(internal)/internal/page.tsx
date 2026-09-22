import { ServerCog } from 'lucide-react';
import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';

import { loadWebEnv, tryLoadEnv } from '@wringy/config/web';
import { internalCampaignsResponseSchema, workerHealthResponseSchema } from '@wringy/contracts';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';

import { ApiFailureAlert } from './api-failure';
import { readInternalApi } from './api-read';
import { CampaignsSection } from './campaigns-section';
import { WorkerHealthSection } from './worker-health-section';

// Read the environment, the language cookie and the API on every request,
// never at build time (node_modules/next/dist/docs/01-app/02-guides/
// caching-without-cache-components.md, route segment config `dynamic`).
export const dynamic = 'force-dynamic';

/**
 * `/internal`: the internal build's narrow loop (kickoff-package.md §8.3):
 * Browser → this Server Component → Fastify `GET /internal/campaigns` and
 * `GET /internal/worker-health` (server to server, at API_INTERNAL_URL, no
 * cache, 5 s each) → PostgreSQL as the API's runtime login.
 *
 * Page states, each marked with `data-app-state`: `not-configured` (the web
 * server has no usable API_INTERNAL_URL), `api-unreachable`, `api-unavailable`
 * (the API answered 503), `unexpected`, `empty` (no fixture campaigns) and
 * `no-workers` (no worker has reported: unknown, never zero). When both reads
 * fail the same way the page shows that state once; otherwise each section
 * shows its own data or its own failure. No client-side code beyond the
 * layout's, no demo store, no demo tools.
 */
export default async function InternalPage() {
  const t = await getTranslations('internal');
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  // Server-only: the web process's own environment. The error names variables,
  // never values, and nothing here reaches the browser bundle.
  const env = tryLoadEnv(() => loadWebEnv());

  let body: ReactNode;
  if (!env.ok) {
    body = (
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
    );
  } else {
    const base = env.env.API_INTERNAL_URL;
    const [campaigns, workers] = await Promise.all([
      readInternalApi(base, '/internal/campaigns', internalCampaignsResponseSchema),
      readInternalApi(base, '/internal/worker-health', workerHealthResponseSchema),
    ]);
    body =
      !campaigns.ok && !workers.ok && campaigns.failure === workers.failure ? (
        <ApiFailureAlert failure={campaigns.failure} />
      ) : (
        <>
          <CampaignsSection read={campaigns} locale={locale} />
          <WorkerHealthSection read={workers} locale={locale} />
        </>
      );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('page.title')}</h1>
        <p className="text-muted-foreground">{t('page.description')}</p>
      </header>
      {body}
    </main>
  );
}
