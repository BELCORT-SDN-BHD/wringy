import { ArrowLeft, Link2Off, MailQuestionMark } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';

import { invitationTokenSchema, orgDetailResponseSchema, orgInvitationParamsSchema } from '@wringy/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';
import { accessTokenFromHeaders, apiFetch } from '@/lib/auth/api-client';
import { internalAuthEnv } from '@/lib/auth/env';
import { isInternalMode } from '@/lib/auth/mode';

import { ApiFailureAlert } from '../../../../api-failure';
import { orgReadOf, redirectIfCallerRefused } from '../../../../identity-read';
import { InstantText } from '../../../../instant-text';
import { OrgForbidden } from '../../../../org-forbidden';
import { acceptLink, inviteCookieName, orgPath } from '../../../../org-paths';
import { OutcomeAlert } from '../../../../outcome-alert';
import { outcomeFromQuery } from '../../../../outcomes';
import { ROLE_STYLE, StateBadge, styleOf } from '../../../../state-badge';

// The link is read from a cookie on every request; never prerendered, never cached.
export const dynamic = 'force-dynamic';

// This page holds an accept link, so nothing it links to is told where it came from.
export const metadata: Metadata = { referrer: 'no-referrer' };

/**
 * `/internal/orgs/<orgId>/invitations/<invitationId>`: the invitation an admin
 * just created, with the accept link to hand over (M2-03; m2-03-code-review.md
 * R7, R9 rev 2).
 *
 * The token is not in this URL. The create handler put it in a cookie scoped to
 * exactly this page (`wringy-invite-<invitationId>`, httpOnly, 10 minutes), so
 * the admin's history and Referer carry nothing and a crafted URL cannot make an
 * admin's page show a link to another invitation: only the browser that created
 * it holds the cookie. The link is shown in a read-only input to copy; Wringy
 * sends no mail (M2-08 owns delivery). Without the cookie — later, or on another
 * device — the page shows the invitation without a link, because the database
 * keeps only the token's hash and the link cannot be made again.
 *
 * The address, role and expiry come from `GET /orgs/:orgId`'s pending
 * invitations, which the API sends to admins only; an invitation that is not
 * there (accepted, revoked, or the caller is not an admin) is said plainly.
 */
export default async function InvitationPage({
  params,
  searchParams,
}: PageProps<'/internal/orgs/[orgId]/invitations/[invitationId]'>) {
  if (!isInternalMode()) notFound();
  const parsed = orgInvitationParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { orgId, invitationId } = parsed.data;

  const t = await getTranslations('internal');
  const tCommon = await getTranslations('common');
  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const outcome = outcomeFromQuery(await searchParams);
  const env = internalAuthEnv();

  let body: ReactNode;
  if (!env.ok) {
    body = <ApiFailureAlert failure="unexpected" />;
  } else {
    const token = await accessTokenFromHeaders();
    const result = await apiFetch(`/orgs/${orgId}`, {
      baseUrl: env.env.apiInternalUrl,
      token,
      schema: orgDetailResponseSchema,
    });
    redirectIfCallerRefused(result);
    const org = orgReadOf(result);

    if (org.kind === 'forbidden') {
      body = <OrgForbidden />;
    } else if (org.kind === 'failure') {
      body = <ApiFailureAlert failure={org.failure} />;
    } else {
      const invitation = org.data.invitations?.find((row) => row.id.toLowerCase() === invitationId.toLowerCase());
      if (invitation === undefined) {
        body = (
          <Empty className="flex-none border" data-app-state="invitation-not-pending">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MailQuestionMark aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t('invitations.notPending.title')}</EmptyTitle>
              <EmptyDescription>{t('invitations.notPending.description')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        );
      } else {
        const stored = (await cookies()).get(inviteCookieName(invitationId))?.value;
        const linkToken = invitationTokenSchema.safeParse(stored ?? '');
        const link = linkToken.success ? acceptLink(env.env.appOrigin, linkToken.data) : null;

        body = (
          <Card className="min-w-0" data-app-state="invitation-created" data-invitation-id={invitation.id}>
            <CardHeader>
              <CardTitle>
                <h1 className="text-2xl font-semibold tracking-tight break-words">{t('invitations.created.title')}</h1>
              </CardTitle>
              <CardDescription className="wrap-break-word">{t('invitations.created.description', { org: org.data.org.name })}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className="text-muted-foreground">{t('invitations.fields.address')}</dt>
                <dd className="font-medium break-all" data-testid="invitation-address">
                  {invitation.inviteeEmailNorm}
                </dd>
                <dt className="text-muted-foreground">{t('invitations.fields.role')}</dt>
                <dd>
                  <StateBadge
                    kind="role"
                    code={invitation.role}
                    style={styleOf(ROLE_STYLE, invitation.role)}
                    label={t(`role.${invitation.role}`)}
                  />
                </dd>
                <dt className="text-muted-foreground">{t('invitations.fields.expires')}</dt>
                <dd>
                  <InstantText iso={invitation.expiresAt} locale={locale} unknownLabel={tCommon('state.unknown')} />
                </dd>
              </dl>

              {link !== null ? (
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor="invitation-accept-link">{t('invitations.link.label')}</Label>
                  <Input
                    id="invitation-accept-link"
                    readOnly
                    value={link}
                    className="font-mono text-xs"
                    data-testid="invitation-accept-link"
                  />
                  <p className="text-sm wrap-break-word text-muted-foreground">
                    {t('invitations.link.note', { email: invitation.inviteeEmailNorm })}
                  </p>
                </div>
              ) : (
                <Alert data-testid="invitation-no-link">
                  <Link2Off aria-hidden="true" />
                  <AlertTitle>{t('invitations.noLink.title')}</AlertTitle>
                  <AlertDescription>{t('invitations.noLink.description')}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        );
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-8 px-4 py-6 sm:px-6" data-page="invitation">
      <nav aria-label={t('org.navLabel')}>
        <Button asChild variant="ghost" size="sm">
          <Link href={orgPath(orgId)} prefetch={false} data-testid="invitation-back">
            <ArrowLeft aria-hidden="true" />
            {t('invitations.backToOrg')}
          </Link>
        </Button>
      </nav>
      {outcome !== null ? <OutcomeAlert outcome={outcome} /> : null}
      {body}
    </main>
  );
}
