'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CommandErrorAlert } from '@/components/app/error-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLE_HOME, ROLE_ROUTE_PREFIX } from '@/config/nav';
import { useActor, useIsSignedIn } from '@/store/actor';
import { useDispatch } from '@/store/demo-store';
import { useState } from 'react';
import type { Role } from '@/domain/types';

/** The one simulated identity the demo signs in as (kickoff seed). */
const DEMO_USER_ID = 'user-demo';

/** Only in-app paths are accepted, so `next` cannot send anyone off-site. */
function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

/**
 * Which roles a return path belongs to, read from the same map `RequireRole` guards
 * with so sign-in and the guard cannot disagree.
 */
function rolesForPath(path: string | null): Array<Exclude<Role, 'guest'>> | null {
  if (!path) return null;
  const prefix = Object.keys(ROLE_ROUTE_PREFIX).find(
    (candidate) => path === candidate || path.startsWith(`${candidate}/`),
  );
  return prefix === undefined ? null : ROLE_ROUTE_PREFIX[prefix];
}

export function SignInView() {
  return (
    <HydrationGate>
      <SignIn />
    </HydrationGate>
  );
}

function SignIn() {
  const t = useTranslations('public.signIn');
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const signedIn = useIsSignedIn();
  const actor = useActor();
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);

  const next = safeNext(searchParams.get('next'));
  const nextRoles = rolesForPath(next);
  // The demo's operations identities are separate simulated users reachable only
  // from the demo tools, so an /ops return path is a refusal this identity cannot
  // clear. Saying so beats handing it a workspace it does not own.
  const opsPath = nextRoles !== null && !nextRoles.includes('creator') && !nextRoles.includes('merchant');
  const destination = opsPath
    ? ROLE_HOME.creator
    : (next ?? (actor.role === 'guest' ? ROLE_HOME.creator : ROLE_HOME[actor.role] ?? '/'));

  /**
   * `session.signIn` always lands in the creator workspace (it is the baseline a
   * reset returns to), and the engine derives the role from the active workspace.
   * So a `/merchant` return path has to select that workspace before navigating, or
   * the only sign-in control in the demo would deposit the visitor on a refusal for
   * an org this very identity owns.
   */
  const enter = () => {
    let state = null;
    if (!signedIn) {
      const result = dispatch({ type: 'session.signIn', userId: DEMO_USER_ID });
      if (!result.ok) {
        setError({ code: result.code, detail: result.detail });
        return;
      }
      state = result.state;
      setError(null);
      toast.success(t('signedInToast'));
    }
    if (nextRoles?.includes('merchant')) {
      const user = (state ?? undefined)?.users[DEMO_USER_ID];
      const ownsOrg = (user?.orgIds.length ?? (actor.orgId === null ? 0 : 1)) > 0;
      if (ownsOrg) {
        const switched = dispatch({ type: 'session.switchWorkspace', workspace: 'merchant' });
        if (!switched.ok) {
          setError({ code: switched.code, detail: switched.detail });
          return;
        }
      } else {
        router.push(ROLE_HOME.creator);
        return;
      }
    }
    if (opsPath) toast.info(t('opsNotice'));
    router.push(destination);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <Badge variant="outline" className="bg-inactive-subtle text-inactive-foreground w-fit border-transparent gap-1">
            <Lock aria-hidden="true" />
            {t('simulatedLabel')}
          </Badge>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <CommandErrorAlert code={error.code} detail={error.detail} /> : null}

          {signedIn ? (
            <>
              <Alert>
                <Lock aria-hidden="true" />
                <AlertTitle>{t('alreadySignedIn')}</AlertTitle>
                <AlertDescription>{t('nextNote', { path: destination })}</AlertDescription>
              </Alert>
              <Button size="lg" onClick={enter} data-testid="sign-in-continue">
                {t('continue')}
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" onClick={enter} data-testid="sign-in-google">
                {t('button')}
              </Button>
              {next ? (
                <p className="text-muted-foreground text-xs break-all">
                  {t('nextNote', { path: destination })}
                </p>
              ) : null}
            </>
          )}
          {opsPath ? (
            <p className="text-muted-foreground text-xs" data-testid="sign-in-ops-notice">
              {t('opsNotice')}
            </p>
          ) : null}

          {/* There is deliberately no email, password or OTP control here. */}
          <p className="text-muted-foreground text-xs">{t('noOtherMethod')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
