import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';

import { orgDetailResponseSchema, orgParamsSchema, workspacesResponseSchema } from '@wringy/contracts';
import { Button } from '@/components/ui/button';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';
import { accessTokenFromHeaders, apiFetch } from '@/lib/auth/api-client';
import { internalAuthEnv } from '@/lib/auth/env';
import { isInternalMode } from '@/lib/auth/mode';

import { ApiFailureAlert } from '../../api-failure';
import { orgReadOf, readOf, redirectIfCallerRefused } from '../../identity-read';
import { OrgForbidden } from '../../org-forbidden';
import { INTERNAL_PATH } from '../../org-paths';
import { OutcomeAlert } from '../../outcome-alert';
import { outcomeFromQuery } from '../../outcomes';
import { OrgView } from './org-view';

// Every read re-authorised on every request (R5): never prerendered, never cached.
export const dynamic = 'force-dynamic';

/**
 * `/internal/orgs/<orgId>`: one organisation's page (M2-03;
 * m2-03-code-review.md R9 rev 2; M2-AC03/1, /2, /3).
 *
 * Browser → this Server Component → Fastify `GET /orgs/:orgId` (the org, its
 * active members, the caller's own role, and for admins the pending invitations)
 * and `GET /me/workspaces` (only for the caller's own id, so their row carries
 * no remove button), both with the caller's Bearer token from `proxy.ts`.
 *
 * The segment is parsed with the contracts' `z.uuid()` first; anything else is
 * this build's not-found page, and no API path is built from it. The API's
 * answer decides the rest:
 *
 * - 403 `org.forbidden` (never a member, removed, or no such org) renders the
 *   `org-forbidden` state in place, with a link back;
 * - 403 `account.disabled` leaves through `/auth/end-session`, and a 401 goes to
 *   sign-in with `session_ended`, as `/internal` does;
 * - 503 or an unreachable API renders the M2-01 failure states.
 *
 * `?outcome=` shows what the last command did (`OutcomeAlert`). The demo build
 * has no identity and no organisations, so there this page does not exist.
 */
export default async function OrgPage({ params, searchParams }: PageProps<'/internal/orgs/[orgId]'>) {
  if (!isInternalMode()) notFound();
  const parsed = orgParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { orgId } = parsed.data;

  const t = await getTranslations('internal');
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const outcome = outcomeFromQuery(await searchParams);
  const env = internalAuthEnv();

  let body: ReactNode;
  if (!env.ok) {
    body = <ApiFailureAlert failure="unexpected" />;
  } else {
    const token = await accessTokenFromHeaders();
    const baseUrl = env.env.apiInternalUrl;
    const [orgResult, workspacesResult] = await Promise.all([
      apiFetch(`/orgs/${orgId}`, { baseUrl, token, schema: orgDetailResponseSchema }),
      apiFetch('/me/workspaces', { baseUrl, token, schema: workspacesResponseSchema }),
    ]);

    redirectIfCallerRefused(orgResult);
    redirectIfCallerRefused(workspacesResult);

    const org = orgReadOf(orgResult);
    const workspaces = readOf(workspacesResult);
    if (org.kind === 'forbidden') body = <OrgForbidden />;
    else if (org.kind === 'failure') body = <ApiFailureAlert failure={org.failure} />;
    else if (!workspaces.ok) body = <ApiFailureAlert failure={workspaces.failure} />;
    else body = <OrgView orgId={orgId} detail={org.data} selfId={workspaces.data.personal.userId} locale={locale} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-8 px-4 py-6 sm:px-6" data-page="org">
      <nav aria-label={t('org.navLabel')}>
        <Button asChild variant="ghost" size="sm">
          <Link href={INTERNAL_PATH} prefetch={false} data-testid="org-back">
            <ArrowLeft aria-hidden="true" />
            {t('org.back')}
          </Link>
        </Button>
      </nav>
      {outcome !== null ? <OutcomeAlert outcome={outcome} /> : null}
      {body}
    </main>
  );
}
