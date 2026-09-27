import { TriangleAlert } from 'lucide-react';
import { getMessages, getTranslations } from 'next-intl/server';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { criticalCopyMissing, type CriticalForm } from '@/lib/locale/critical-copy';

/**
 * Whether each named critical form's copy is missing in this request's language
 * (M2-04; m2-04-code-review.md R9 rev 2), read from the active catalogue only —
 * never another language's.
 */
export async function missingCriticalCopy<F extends CriticalForm>(forms: readonly F[]): Promise<Record<F, boolean>> {
  const messages = await getMessages();
  return Object.fromEntries(forms.map((form) => [form, criticalCopyMissing(messages, form)])) as Record<F, boolean>;
}

/**
 * What a guarded confirmation shows beside its disabled submit when its copy is
 * missing in the active language: switch to a fully available language first.
 * The parity test keeps this from rendering in this tree; the guard is proven by
 * unit tests on a mutated catalogue.
 */
export async function CriticalCopyAlert() {
  const t = await getTranslations('internal.locale.critical');
  return (
    <Alert variant="destructive" data-testid="critical-copy-unavailable">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle className="wrap-break-word whitespace-normal">{t('unavailable')}</AlertTitle>
    </Alert>
  );
}
