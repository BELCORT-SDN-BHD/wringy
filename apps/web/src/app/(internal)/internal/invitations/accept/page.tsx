import { Hourglass, Link2Off, LogOut, MailCheck, MailX, UserCheck, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';

import { invitationPreviewResponseSchema, invitationTokenSchema } from '@wringy/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';
import { accessTokenFromHeaders, apiFetch } from '@/lib/auth/api-client';
import { internalAuthEnv } from '@/lib/auth/env';
import { isInternalMode } from '@/lib/auth/mode';
import { signInPath } from '@/lib/auth/outcomes';

import { ApiFailureAlert } from '../../api-failure';
import { InstantText } from '../../instant-text';
import { ACCEPT_CONFIRM_PATH, END_SESSION_PATH, INTERNAL_PATH, orgPath } from '../../org-paths';
import { acceptPageState, firstValue, type AcceptPageState } from '../../outcomes';
import { ROLE_STYLE, StateBadge, styleOf } from '../../state-badge';

// Asked on every request: the answer depends on who is signed in and on the invitation's state now.
export const dynamic = 'force-dynamic';

// The token is in this page's URL, so no request from here may carry it in a Referer (R7).
// What guarantees it is the `Referrer-Policy: strict-origin` header `proxy.ts` sends on
// every internal response, in force before the HTML is parsed (R9 rev 3). This
// `metadata` states the same policy for the document, but a `<meta>` applies only once
// parsed, and Next emits it after the page's own `<script src>` tags, so on its own it
// came too late for the page's first chunk requests.
//
// `strict-origin`, not the `no-referrer` R9 names: under `no-referrer` the Fetch
// standard serialises the `Origin` of a non-GET request as `null` ("append a
// request `Origin` header"), so this page's own Accept and sign-out forms reached
// their Route Handlers with `Origin: null` and the M2-02 Origin rule refused them
// with 403 (observed in Chromium, 2026-09-26). `strict-origin` gives the same
// protection for the token — a Referer carries the origin only, never the path or
// the query, and nothing at all on an https → http downgrade — while the forms
// keep a real `Origin`.
export const metadata: Metadata = { referrer: 'strict-origin' };

/**
 * `/internal/invitations/accept?token=…`: the page an invitation link opens
 * (M2-03; m2-03-code-review.md R7, R9 rev 2, R17; M2-AC03/1, /3).
 *
 * A signed-out visitor never gets here: `proxy.ts` sends them to sign in with
 * this URL as `next`, and they come back after. The invitation does not bypass
 * the allow-list (R17): whoever cannot sign in to this build gets the sign-in
 * page's own refusal and no membership.
 *
 * The first `token` value is checked against the contracts' token shape; a
 * missing or malformed one is `invalid` without asking the API. Otherwise the
 * page asks `POST /invitations/preview { token }` — the token in a POST body,
 * never an API path — and the API checks the verified address **first**: the
 * addressed person sees the org, the role and the expiry and an Accept button;
 * anybody else sees only that it was sent to a different address, with a
 * sign-out button. Accepting posts the token in a hidden field to
 * `POST /internal/invitations/accept/confirm`.
 */
export default async function AcceptInvitationPage({ searchParams }: PageProps<'/internal/invitations/accept'>) {
  if (!isInternalMode()) notFound();

  const requested = await getLocale();
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const parsedToken = invitationTokenSchema.safeParse(firstValue((await searchParams).token) ?? '');
  const env = internalAuthEnv();

  let state: AcceptPageState;
  if (!env.ok) {
    state = { kind: 'failure', failure: 'unexpected' };
  } else if (!parsedToken.success) {
    state = acceptPageState(null);
  } else {
    const result = await apiFetch('/invitations/preview', {
      baseUrl: env.env.apiInternalUrl,
      token: await accessTokenFromHeaders(),
      method: 'POST',
      body: { token: parsedToken.data },
      schema: invitationPreviewResponseSchema,
    });
    state = acceptPageState(result);
  }

  // As on `/internal`: a disabled account leaves through the handler that owns the
  // cookie write; a refused token goes to sign-in. Neither carries the token.
  if (state.kind === 'end_session') redirect(END_SESSION_PATH);
  if (state.kind === 'session_ended') redirect(signInPath({ outcome: 'session_ended' }));

  return (
    <main className="mx-auto flex w-full max-w-lg min-w-0 flex-1 flex-col justify-center gap-6 px-4 py-10 sm:px-6" data-page="accept-invitation">
      <AcceptBody state={state} token={parsedToken.success ? parsedToken.data : null} locale={locale} />
    </main>
  );
}

async function AcceptBody({
  state,
  token,
  locale,
}: {
  state: AcceptPageState;
  token: string | null;
  locale: Locale;
}): Promise<ReactNode> {
  const t = await getTranslations('internal');
  const tCommon = await getTranslations('common');

  switch (state.kind) {
    case 'failure':
      return <ApiFailureAlert failure={state.failure} />;

    case 'pending': {
      const { preview } = state;
      const role = t(`role.${preview.role}`);
      return (
        <Card className="min-w-0" data-app-state="invitation-pending">
          <CardHeader>
            <CardTitle>
              <h1 className="text-xl font-semibold tracking-tight break-words">
                {t('invitations.accept.title', { org: preview.org.name })}
              </h1>
            </CardTitle>
            <CardDescription className="wrap-break-word">{t('invitations.accept.description', { org: preview.org.name, role })}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt className="text-muted-foreground">{t('invitations.fields.org')}</dt>
              <dd className="font-medium break-words" data-testid="invitation-org">
                {preview.org.name}
              </dd>
              <dt className="text-muted-foreground">{t('invitations.fields.role')}</dt>
              <dd>
                <StateBadge kind="role" code={preview.role} style={styleOf(ROLE_STYLE, preview.role)} label={role} />
              </dd>
              <dt className="text-muted-foreground">{t('invitations.fields.expires')}</dt>
              <dd>
                <InstantText iso={preview.expiresAt} locale={locale} unknownLabel={tCommon('state.unknown')} />
              </dd>
            </dl>
          </CardContent>
          <CardFooter>
            <form method="post" action={ACCEPT_CONFIRM_PATH} className="w-full">
              <input type="hidden" name="token" value={token ?? ''} />
              <Button type="submit" className="w-full" data-testid="invitation-accept-submit">
                <UserCheck aria-hidden="true" />
                {t('invitations.accept.submit')}
              </Button>
            </form>
          </CardFooter>
        </Card>
      );
    }

    case 'expired':
      return (
        <StateCard state="invitation-expired" icon={Hourglass} title={t('invitations.accept.expired.title')}>
          {t('invitations.accept.expired.description', { org: state.preview.org.name })}
        </StateCard>
      );

    case 'used':
      return (
        <StateCard
          state="invitation-used"
          icon={MailCheck}
          title={t('invitations.accept.used.title')}
          action={
            <Button asChild variant="outline">
              <Link href={orgPath(state.preview.org.id)} prefetch={false} data-testid="invitation-open-org">
                {t('invitations.accept.used.open', { org: state.preview.org.name })}
              </Link>
            </Button>
          }
        >
          {t('invitations.accept.used.description')}
        </StateCard>
      );

    case 'email_mismatch':
      return (
        <StateCard
          state="invitation-mismatch"
          icon={MailX}
          title={t('invitations.accept.mismatch.title')}
          action={
            <form method="post" action="/auth/sign-out">
              <Button type="submit" variant="outline" data-testid="invitation-sign-out">
                <LogOut aria-hidden="true" />
                {t('session.signOut')}
              </Button>
            </form>
          }
        >
          {t('invitations.accept.mismatch.description')}
        </StateCard>
      );

    default:
      // `invalid`; the two redirect states never reach here.
      return (
        <StateCard state="invitation-invalid" icon={Link2Off} title={t('invitations.accept.invalid.title')}>
          {t('invitations.accept.invalid.description')}
        </StateCard>
      );
  }
}

/** A terminal accept-page state: an icon, one title, one sentence and the way on. */
async function StateCard({
  state,
  icon: Icon,
  title,
  children,
  action,
}: {
  state: string;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const t = await getTranslations('internal');
  return (
    <Empty className="flex-none border" data-app-state={state}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <h1>{title}</h1>
        </EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex flex-col items-center gap-3">
        {action}
        <Button asChild variant="ghost" size="sm">
          <Link href={INTERNAL_PATH} prefetch={false} data-testid="invitation-home">
            {t('invitations.accept.home')}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
