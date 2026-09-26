import { CircleAlert, CircleCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Alert, AlertTitle } from '@/components/ui/alert';

import { CONFIRMATION_OUTCOMES, type OrgOutcome } from './outcomes';

/**
 * What an organisation command or an invitation just did, as one sentence
 * (M2-03; m2-03-code-review.md R9 rev 2): the `ProbeAlert` pattern of the
 * session section, one localized sentence per code under
 * `internal.outcomes.<code>`, so the title says what happened and what to do
 * next and there is no description to pad. A confirmation reads as default, a
 * refusal or a failure as destructive. Server-rendered; no client code.
 */
export async function OutcomeAlert({ outcome }: { outcome: OrgOutcome }) {
  const t = await getTranslations('internal.outcomes');
  const confirmation = CONFIRMATION_OUTCOMES.has(outcome);

  return (
    <Alert variant={confirmation ? 'default' : 'destructive'} data-testid="org-outcome" data-outcome={outcome}>
      {confirmation ? <CircleCheck aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
      <AlertTitle>{t(outcome)}</AlertTitle>
    </Alert>
  );
}
