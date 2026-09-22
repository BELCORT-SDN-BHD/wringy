'use client';

/**
 * Two honest notices about the persisted copy.
 *
 * `needsReset`: a stored copy existed but the engine's `migrate` could not use
 * it, so the baseline is on screen and the stored copy is still there. The page
 * says so and offers the reset instead of failing silently or pretending the
 * stored data was loaded.
 *
 * `storageBlocked`: this browser refuses to store anything. The demo still runs,
 * but it forgets after a refresh, and a language change is "switched, not saved"
 * (localization-v1 forbids showing a false save success).
 */

import { RotateCcw, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useDemoActions, useNeedsReset, useStorageBlocked } from '@/store/demo-store';

export function StorageNotice() {
  const t = useTranslations('common.reset');
  const needsReset = useNeedsReset();
  const storageBlocked = useStorageBlocked();
  const { reset } = useDemoActions();

  if (!needsReset && !storageBlocked) return null;

  return (
    <div className="flex flex-col gap-3" data-testid="storage-notice">
      {needsReset ? (
        <Alert className="bg-attention-subtle">
          <TriangleAlert aria-hidden="true" className="text-attention-foreground" />
          <AlertTitle>{t('needsResetTitle')}</AlertTitle>
          <AlertDescription>
            <span>{t('needsResetDescription')}</span>
            <span className="mt-2 flex">
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <RotateCcw aria-hidden="true" />
                    {t('action')}
                  </Button>
                }
                title={t('title')}
                description={t('description')}
                confirmLabel={t('action')}
                destructive
                onConfirm={() => {
                  reset();
                  toast.success(t('done'));
                }}
              />
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {storageBlocked ? (
        <Alert className="bg-inactive-subtle">
          <TriangleAlert aria-hidden="true" className="text-inactive-foreground" />
          <AlertTitle>{t('storageBlockedTitle')}</AlertTitle>
          <AlertDescription>{t('storageBlockedDescription')}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
