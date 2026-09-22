import { CircleAlert, DatabaseZap, ServerOff, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import type { ApiFailure } from './api-read';

const FAILURE: Record<ApiFailure, { key: 'apiUnreachable' | 'apiUnavailable' | 'unexpected'; icon: LucideIcon }> = {
  'api-unreachable': { key: 'apiUnreachable', icon: ServerOff },
  'api-unavailable': { key: 'apiUnavailable', icon: DatabaseZap },
  unexpected: { key: 'unexpected', icon: CircleAlert },
};

/**
 * A read that failed, as an explicit page state (state-policy.md: a failed read
 * uses `Alert` with a retry, never an empty list or a zero). The copy names
 * what failed in plain words; no URL, status line, stack or error text reaches
 * the page. "Try again" links back to /internal, which the server renders again.
 */
export async function ApiFailureAlert({ failure, className }: { failure: ApiFailure; className?: string }) {
  const t = await getTranslations('internal.state');
  const tCommon = await getTranslations('common.state');
  const { key, icon: Icon } = FAILURE[failure];

  return (
    <Alert variant="destructive" className={className} data-app-state={failure}>
      <Icon aria-hidden="true" />
      <AlertTitle>{t(`${key}.title`)}</AlertTitle>
      <AlertDescription>{t(`${key}.description`)}</AlertDescription>
      <AlertAction>
        <Button asChild variant="outline" size="sm">
          <Link href="/internal" prefetch={false}>{tCommon('retry')}</Link>
        </Button>
      </AlertAction>
    </Alert>
  );
}
