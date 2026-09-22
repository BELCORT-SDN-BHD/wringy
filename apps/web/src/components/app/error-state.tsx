'use client';

/**
 * A read or a command failed.
 *
 * state-policy.md: a failed read uses `Alert` with a retry where one exists, and
 * must not be dressed up as an empty list or as a missing amount of zero.
 */

import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorCopyKey } from '@/lib/error-copy';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Renders the retry button when given. */
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  const t = useTranslations('common.state');

  return (
    <Alert variant="destructive" className={cn(className)} data-app-state="error">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title ?? t('errorTitle')}</AlertTitle>
      <AlertDescription>{description ?? t('errorDescription')}</AlertDescription>
      {onRetry ? (
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t('retry')}
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  );
}

/**
 * The engine refused a command. Money-critical refusals stay on the page as
 * this Alert rather than only in a toast (state-policy.md).
 */
export function CommandErrorAlert({ code, detail }: { code: string; detail?: string }) {
  const tErrors = useTranslations('common.errors');
  const t = useTranslations('common.state');

  return (
    <Alert variant="destructive" data-app-state="command-error" data-error-code={code}>
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t('errorTitle')}</AlertTitle>
      <AlertDescription>
        {tErrors(errorCopyKey(code))}
        {detail ? ` (${detail})` : null}
      </AlertDescription>
    </Alert>
  );
}
