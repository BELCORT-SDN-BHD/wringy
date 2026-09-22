'use client';

/**
 * The current simulated identity may not see this workspace.
 *
 * Two things are deliberate here. The page says the check is simulated, not
 * production authorisation (kickoff decision 7 and ticket #2's acceptance), and
 * it never renders a fake success or an empty list in place of the refusal.
 */

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export interface ForbiddenStateProps {
  /** Where "go to your workspace" should lead for the current identity. */
  homeHref?: string;
}

export function ForbiddenState({ homeHref = '/' }: ForbiddenStateProps) {
  const t = useTranslations('common.state');
  const tShell = useTranslations('common.shell');

  return (
    <div className="flex w-full flex-col gap-4" data-app-state="forbidden">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('forbiddenTitle')}</EmptyTitle>
          <EmptyDescription>{t('forbiddenDescription')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href={homeHref}>{t('forbiddenBack')}</Link>
          </Button>
        </EmptyContent>
      </Empty>
      <Alert>
        <Lock aria-hidden="true" />
        <AlertTitle>{tShell('simulatedIdentity')}</AlertTitle>
        <AlertDescription>{t('forbiddenDescription')}</AlertDescription>
      </Alert>
    </div>
  );
}
