import { ServerCog } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';

import { loadWebEnv, tryLoadEnv } from '@wringy/config/web';
import { internalCampaignsResponseSchema, meResponseSchema, workerHealthResponseSchema } from '@wringy/contracts';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';
import { accessTokenFromHeaders, apiFetch } from '@/lib/auth/api-client';
import { appMode } from '@/lib/auth/mode';
import { signInPath } from '@/lib/auth/outcomes';

import { ApiFailureAlert } from './api-failure';
import { readInternalApi, type ApiFailure } from './api-read';
import { CampaignsSection } from './campaigns-section';
import { SessionSection } from './session-section';
import type { ProbeResult } from './session-probe/route';
import { WorkerHealthSection } from './worker-health-section';

// Read the environment, the language cookie, the identity header and the API on
// every request, never at build time (node_modules/next/dist/docs/01-app/02-guides/
// caching-without-cache-components.md, route segment config `dynamic`).
export const dynamic = 'force-dynamic';

/** The four results `POST /internal/session-probe` can redirect back with. */
const PROBE_RESULTS = new Set<string>(['ok', 'revoked', 'unauthenticated', 'unavailable']);

/** The Route Handler that ends a refused session, because this page cannot write a cookie. */
const END_SESSION_PATH = '/auth/end-session';

/**
 * `/internal`: the internal build's narrow loop (kickoff-package.md §8.3):
 * Browser → this Server Component → Fastify `GET /me`, `GET /internal/campaigns`
 * and `GET /internal/worker-health` (server to server, at API_INTERNAL_URL, no
 * cache, 5 s each, each carrying the caller's Bearer token) → PostgreSQL as the
 * API's runtime login.
 *
 * Page states, each marked with `data-app-state`: `not-configured` (the web
 * server has no usable API_INTERNAL_URL), `api-unreachable`, `api-unavailable`
 * (the API answered 503), `unexpected`, `empty` (no fixture campaigns) and
 * `no-workers` (no worker has reported: unknown, never zero). When every read
 * fails the same way the page shows that state once; otherwise each section
 * shows its own data or its own failure. No client-side code beyond the
 * layout's, no demo store, no demo tools.
 *
 * ## Identity (M2-02 R10, R19)
 *
 * The access token arrives in the `x-wringy-access-token` request header, which
 * `proxy.ts` set from a session it just verified and which it overwrites or
 * removes on every matched request — so this page never creates a Supabase
 * client. That matters: a Server Component cannot set cookies, so a refresh here
 * would silently drop the rotated refresh token.
 *
 * In `demo` mode none of this happens. There is no sign-in on a demo origin
 * (R13), so the page reads no identity header and calls no `/me`.
 *
 * What the two M2-01 sections then show depends on the API, and is worth being
 * exact about. With no `API_INTERNAL_URL` — the env-less image smoke — the page
 * renders its `not-configured` state. With one configured, the reads go out with
 * **no** Bearer token, and since M2-02 every `/internal/*` route sits behind the
 * API's authentication hook (R8), so the API answers 401, which is `unexpected`
 * here: one "something went wrong" alert rather than the fixture campaigns. The
 * M2-01 sections are readable on a demo origin no longer; `WRINGY_APP_MODE=internal`
 * and a sign-in are what show them (README "启动顺序"; known-issues.md).
 */
export default async function InternalPage({ searchParams }: PageProps<'/internal'>) {
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
    const internal = appMode() === 'internal';
    const token = internal ? await accessTokenFromHeaders() : null;

    // One round trip's worth of latency for all three reads, not three.
    const [me, campaigns, workers] = await Promise.all([
      internal
        ? apiFetch('/me', { baseUrl: base, token, schema: meResponseSchema })
        : Promise.resolve(null),
      readInternalApi(base, '/internal/campaigns', internalCampaignsResponseSchema, { token }),
      readInternalApi(base, '/internal/worker-health', workerHealthResponseSchema, { token }),
    ]);

    // A refusal is not a page state: it means this person should not be looking at
    // this page at all, so say why on the sign-in page instead (R4, R11).
    // `redirect()` throws, and is called outside any try/catch on purpose.
    //
    // A disabled account must also leave with no session cookie (R4), and this is
    // a Server Component: it cannot set one. So that one refusal goes through
    // `GET /auth/end-session`, the Route Handler that owns the cookie write and
    // re-asks the API rather than trusting its caller. A 401 needs no such detour:
    // the token is simply not accepted any more, and the proxy expires the cookies
    // itself the moment the refresh behind it fails.
    if (me !== null && me.kind === 'error') {
      if (me.status === 403 && me.code === 'account.disabled') redirect(END_SESSION_PATH);
      if (me.status === 401) redirect(signInPath({ outcome: 'session_ended' }));
    }

    // `/me` failing the way a data read can fail is a page state, not a redirect:
    // an unreachable API says nothing about whether the session is good (R19).
    const failures: ApiFailure[] = [
      ...(me !== null && me.kind === 'failure' ? [me.failure] : []),
      ...(campaigns.ok ? [] : [campaigns.failure]),
      ...(workers.ok ? [] : [workers.failure]),
    ];
    const reads = (me !== null ? 1 : 0) + 2;
    const sameFailureThroughout = failures.length === reads && new Set(failures).size === 1;

    const profile = me !== null && me.kind === 'ok' ? me.data.profile : null;
    const probe = probeOf(await searchParams);

    body = sameFailureThroughout ? (
      <ApiFailureAlert failure={failures[0]} />
    ) : (
      <>
        {profile !== null ? <SessionSection profile={profile} probe={probe} /> : null}
        {me !== null && me.kind === 'failure' ? <ApiFailureAlert failure={me.failure} /> : null}
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

/** `?probe=` as written by the probe handler; anything else is ignored. */
function probeOf(query: Record<string, string | string[] | undefined>): ProbeResult | null {
  const raw = query.probe;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value !== undefined && PROBE_RESULTS.has(value) ? (value as ProbeResult) : null;
}
