import { CircleAlert, Info, LogIn } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { isOutcome, type Outcome } from '@/lib/auth/outcomes';
import { safeNextPath } from '@/lib/auth/next-path';

// Read the query on every request. This page must never be cached: it is the one
// page that says what just happened to a session, and a shared cache serving one
// person's outcome to the next would be both wrong and confusing. It writes no
// cookie, so it needs no `noStore()` of its own — being dynamic is enough
// (kickoff-package.md §4.7).
export const dynamic = 'force-dynamic';

/**
 * `/internal/sign-in`: the only public page of the internal build (M2-02 R11).
 *
 * It is reachable without a session, so `proxy.ts` excludes it from the refresh
 * branch. It holds no state: everything it shows comes from the query —
 * `outcome` (what just happened) and `next` (where to go afterwards) — and the
 * `next` value is passed straight back to `POST /auth/sign-in` as a hidden field,
 * after `safeNextPath()` has reduced anything hostile to `/internal`.
 *
 * The nine outcomes each have their own title and description in all three
 * languages, so the page always says what happened rather than just failing.
 */
export default async function InternalSignInPage({ searchParams }: PageProps<'/internal/sign-in'>) {
  const t = await getTranslations('internal.signIn');
  const query = await searchParams;

  const outcome: Outcome | null = isOutcome(firstValue(query.outcome)) ? (firstValue(query.outcome) as Outcome) : null;
  const next = safeNextPath(firstValue(query.next));

  return (
    <main
      className="mx-auto flex w-full max-w-lg min-w-0 flex-1 flex-col justify-center gap-6 px-4 py-10 sm:px-6"
      data-app-state="sign-in"
      data-outcome={outcome ?? ''}
    >
      {outcome !== null ? <OutcomeAlert outcome={outcome} /> : null}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h1>{t('title')}</h1>
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/*
            A plain POST form, not a Server Action: R1 puts every write path in a
            Route Handler, where the mode guard and the Origin rule are Wringy's
            own code rather than Next's Server-Action check.
          */}
          <form method="post" action="/auth/sign-in" className="flex flex-col gap-3">
            <input type="hidden" name="next" value={next} />
            <Button type="submit" data-testid="sign-in-google" className="w-full">
              <LogIn aria-hidden="true" />
              {t('google')}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">{t('returnHint')}</p>
        </CardFooter>
      </Card>
    </main>
  );
}

/** The outcome titles that read as a problem rather than as a confirmation. */
const PROBLEM_OUTCOMES = new Set<Outcome>([
  'expired',
  'wrong_browser',
  'not_allowed',
  'disabled',
  'unexpected',
  'signed_out_unconfirmed',
]);

async function OutcomeAlert({ outcome }: { outcome: Outcome }) {
  const t = await getTranslations('internal.signIn.outcomes');
  const problem = PROBLEM_OUTCOMES.has(outcome);
  const Icon = problem ? CircleAlert : Info;

  return (
    <Alert
      variant={problem ? 'destructive' : 'default'}
      data-testid="sign-in-outcome"
      data-outcome={outcome}
    >
      <Icon aria-hidden="true" />
      <AlertTitle>{t(`${outcome}.title`)}</AlertTitle>
      <AlertDescription>{t(`${outcome}.description`)}</AlertDescription>
    </Alert>
  );
}

/** A repeated query parameter arrives as an array; only the first value is ever meant. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
