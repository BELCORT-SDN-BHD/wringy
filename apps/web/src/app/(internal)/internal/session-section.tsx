import { BadgeCheck, CircleAlert, CircleCheck, LogOut, ShieldQuestion } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Profile } from '@wringy/contracts';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { ProbeResult } from './session-probe/route';

/**
 * Who is signed in, how to sign out, and the reserved session check
 * (M2-02 R10; M2-AC02/2).
 *
 * Both forms are plain POSTs to Route Handlers (R1), so the mode guard and the
 * Origin rule are Wringy's own code on the way in. Neither form carries any
 * identity: the handlers read the session from the cookie, because a field a
 * browser can edit is not an identity.
 *
 * The sign-out copy states the scope in all three languages — signing out ends
 * this device's session only (kickoff-package.md §4.6) — so nobody reads it as
 * "signed out everywhere".
 */
export async function SessionSection({ profile, probe }: { profile: Profile; probe: ProbeResult | null }) {
  const t = await getTranslations('internal');

  return (
    <section
      aria-labelledby="internal-session-title"
      data-internal-section="session"
      className="flex min-w-0 flex-col gap-3"
    >
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2 id="internal-session-title" className="text-lg font-semibold tracking-tight">
              {t('probe.title')}
            </h2>
          </CardTitle>
          <CardDescription>{t('probe.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <BadgeCheck aria-hidden="true" className="size-4 text-muted-foreground" />
            <span data-testid="signed-in-as">{t('session.signedInAs', { email: profile.contactEmail })}</span>
          </p>

          {probe !== null ? <ProbeAlert probe={probe} /> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form method="post" action="/internal/session-probe">
              <Button type="submit" variant="outline" size="sm" data-testid="session-probe">
                <ShieldQuestion aria-hidden="true" />
                {t('probe.button')}
              </Button>
            </form>
            <form method="post" action="/auth/sign-out">
              <Button type="submit" variant="outline" size="sm" data-testid="sign-out">
                <LogOut aria-hidden="true" />
                {t('session.signOut')}
              </Button>
            </form>
          </div>

          <p className="text-xs text-muted-foreground">{t('session.otherDevicesNote')}</p>
        </CardContent>
      </Card>
    </section>
  );
}

/** Which probe results read as a failure rather than a confirmation. */
const PROBE_PROBLEM: Record<ProbeResult, boolean> = {
  ok: false,
  revoked: true,
  unauthenticated: true,
  unavailable: true,
};

async function ProbeAlert({ probe }: { probe: ProbeResult }) {
  const t = await getTranslations('internal.probe.results');
  const problem = PROBE_PROBLEM[probe];

  // One sentence per result, so it is the title and there is no description to
  // pad: the copy already says what happened and what to do next.
  return (
    <Alert variant={problem ? 'destructive' : 'default'} data-testid="probe-result" data-probe={probe}>
      {problem ? <CircleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
      <AlertTitle>{t(probe)}</AlertTitle>
    </Alert>
  );
}
