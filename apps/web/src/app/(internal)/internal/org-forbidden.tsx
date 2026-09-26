import { ShieldX } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

import { INTERNAL_PATH } from './org-paths';

/**
 * The API's 403 `org.forbidden` on an org's page, rendered in place (M2-03;
 * m2-03-code-review.md R9 rev 2; M2-AC03/2, /3).
 *
 * The URL stays what it was, so a tab left open after a removal shows plainly
 * that it no longer has access, instead of bouncing somewhere that hides what
 * happened. One wording for "never a member", "no longer a member" and "no such
 * organisation": the API gives one answer for all three, so the page cannot be
 * used to learn whether an org exists.
 */
export async function OrgForbidden() {
  const t = await getTranslations('internal.org.forbidden');

  return (
    <Empty className="flex-none border" data-app-state="org-forbidden">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldX aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('title')}</EmptyTitle>
        <EmptyDescription>{t('description')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href={INTERNAL_PATH} prefetch={false} data-testid="org-forbidden-back">
            {t('back')}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
