import { CircleAlert, CircleCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Alert, AlertTitle } from '@/components/ui/alert';

import { PAGE_CONFIRMATION_OUTCOMES, type PageOutcome } from './outcomes';

/**
 * What an organisation command or an invitation just did, as one sentence
 * (M2-03; m2-03-code-review.md R9 rev 2): the `ProbeAlert` pattern of the
 * session section, one localized sentence per code under
 * `internal.outcomes.<code>`, so the title says what happened and what to do
 * next and there is no description to pad. A confirmation reads as default, a
 * refusal or a failure as destructive. Server-rendered; no client code.
 *
 * M2-04 (m2-04-code-review.md R12) adds what the language form's no-JS path
 * lands with: `locale_saved` and `locale_switched` confirm, `locale_not_saved`
 * does not. `locale_synced` is never passed here (`locale-status.tsx` owns it).
 * `PAGE_CONFIRMATION_OUTCOMES` is already typed `ReadonlySet<PageOutcome>`, so
 * `outcome` needs no cast to ask it (Standards T6).
 */
export async function OutcomeAlert({ outcome }: { outcome: PageOutcome }) {
  const t = await getTranslations('internal.outcomes');
  const confirmation = PAGE_CONFIRMATION_OUTCOMES.has(outcome);

  return (
    <Alert variant={confirmation ? 'default' : 'destructive'} data-testid="org-outcome" data-outcome={outcome}>
      {confirmation ? <CircleCheck aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
      <AlertTitle>{t(outcome)}</AlertTitle>
    </Alert>
  );
}
