'use client';

import Link from 'next/link';
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
import { ROLE_HOME } from '@/config/nav';
import { useActor, useIsSignedIn } from '@/store/actor';
import { useDispatch } from '@/store/demo-store';
import { useState } from 'react';

/** The one simulated identity the demo signs in as (kickoff seed). */
const DEMO_USER_ID = 'user-demo';

/** Only in-app paths are accepted, so `next` cannot send anyone off-site. */
function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
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
  const destination =
    next ?? (actor.role === 'guest' ? ROLE_HOME.creator : ROLE_HOME[actor.role] ?? '/');

  const signIn = () => {
    const result = dispatch({ type: 'session.signIn', userId: DEMO_USER_ID });
    if (!result.ok) {
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);
    toast.success(t('signedInToast'));
    router.push(next ?? ROLE_HOME.creator);
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
              <Button asChild size="lg" data-testid="sign-in-continue">
                <Link href={destination}>{t('continue')}</Link>
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" onClick={signIn} data-testid="sign-in-google">
                {t('button')}
              </Button>
              {next ? (
                <p className="text-muted-foreground text-xs break-all">
                  {t('nextNote', { path: next })}
                </p>
              ) : null}
            </>
          )}

          {/* There is deliberately no email, password or OTP control here. */}
          <p className="text-muted-foreground text-xs">{t('noOtherMethod')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
