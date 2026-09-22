'use client';

/**
 * Partial budget: the creator consents to an exact amount, or nothing happens.
 *
 * Rules this dialog exists to keep (campaign-defaults-v1 部分金额, D03):
 *   - an offer reserves nothing and holds no queue position until consent;
 *   - consent carries the exact amount and both versions, so the engine can
 *     refuse a changed offer instead of converting it silently;
 *   - a stale offer is shown again and needs consent again, never auto-converted;
 *   - the remainder is recorded as unreserved and is NOT forfeited.
 */

import { CircleAlert, HandCoins, RefreshCw } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DIALOG_FIT_CLASS } from '@/components/app/dialog-fit';
import { DialogCloseIcon } from '@/components/app/close-icon-button';
import { CommandErrorAlert } from '@/components/app/error-state';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatSen } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { newCommandId } from '@/store/command-id';
import { useDispatch } from '@/store/demo-store';
import type { PartialOfferView } from '@/store/selectors';

import { DetailList, DetailRow } from './creator-ui';

export interface PartialOfferDialogProps {
  offer: PartialOfferView;
  submissionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional trigger; the dialog is also opened straight after a claim request. */
  trigger?: ReactNode;
}

export function PartialOfferDialog({
  offer,
  submissionId,
  open,
  onOpenChange,
  trigger,
}: PartialOfferDialogProps) {
  const t = useTranslations('creator.offer');
  const locale = useAppLocale();
  const dispatch = useDispatch();
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);
  // One id per consent intent: the same offer, amount and versions pressed twice
  // replays instead of reserving twice.
  const intent = useRef<{ signature: string; commandId: string } | null>(null);

  const consent = () => {
    const signature = `${offer.offer.id}|${offer.consentSen}|${offer.offer.snapshotVersion}|${offer.offer.budgetVersion}`;
    if (intent.current?.signature !== signature) {
      intent.current = { signature, commandId: newCommandId() };
    }
    const result = dispatch(
      {
        type: 'claim.consentPartial',
        offerId: offer.offer.id,
        consentedSen: offer.consentSen,
        snapshotVersion: offer.offer.snapshotVersion,
        budgetVersion: offer.offer.budgetVersion,
      },
      intent.current.commandId,
    );
    if (!result.ok) {
      // A stale offer stays on screen: the creator has to consent again to the
      // amount the server can actually allocate.
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);
    toast.success(t('consentedToast'));
    onOpenChange(false);
  };

  const decline = () => {
    const result = dispatch({ type: 'claim.declinePartial', offerId: offer.offer.id });
    if (!result.ok) {
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);
    toast.success(t('declinedToast'));
    onOpenChange(false);
  };

  /** Asks the engine for the amount again, which mints a fresh offer. */
  const refresh = () => {
    const result = dispatch({ type: 'claim.request', submissionId }, newCommandId());
    if (!result.ok) {
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={DIALOG_FIT_CLASS}
        data-testid="partial-offer-dialog"
        data-offer-id={offer.offer.id}
        showCloseButton={false}
      >
        <DialogCloseIcon />
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <HandCoins aria-hidden="true" className="size-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription data-testid="partial-offer-description">
            {t('description', {
              full: formatSen(offer.fullSen, locale),
              offered: formatSen(offer.consentSen, locale),
              remainder: formatSen(offer.unreservedRemainderSen, locale),
            })}
          </DialogDescription>
        </DialogHeader>

        <DetailList>
          <DetailRow label={t('fullLabel')}>
            <MoneyText sen={offer.fullSen} tabular />
          </DetailRow>
          <DetailRow label={t('offeredLabel')}>
            <MoneyText sen={offer.consentSen} tabular />
          </DetailRow>
          <DetailRow label={t('remainderLabel')} hint={t('remainderNote')}>
            <MoneyText sen={offer.unreservedRemainderSen} tabular />
          </DetailRow>
          <DetailRow label={t('snapshotLabel')}>{offer.offer.snapshotVersion}</DetailRow>
          <DetailRow label={t('budgetVersionLabel')}>{offer.offer.budgetVersion}</DetailRow>
        </DetailList>

        <p className="text-muted-foreground text-xs">{t('nothingHeld')}</p>

        {offer.isStale ? (
          <Alert variant="destructive" data-testid="offer-stale" data-stale-reason={offer.staleReason ?? undefined}>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>{t('staleTitle')}</AlertTitle>
            <AlertDescription>{t('staleDescription')}</AlertDescription>
          </Alert>
        ) : null}

        {error ? <CommandErrorAlert code={error.code} detail={error.detail} /> : null}

        <DialogFooter>
          <Button variant="outline" onClick={decline} data-testid="offer-decline">
            {t('decline')}
          </Button>
          {offer.isStale ? (
            <Button onClick={refresh} data-testid="offer-refresh">
              <RefreshCw aria-hidden="true" />
              {t('refresh')}
            </Button>
          ) : (
            <Button onClick={consent} data-testid="offer-consent">
              {t('consent', { amount: formatSen(offer.consentSen, locale) })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The open offer as a row on the page, with its own trigger for the dialog. */
export function PartialOfferPanel({
  offer,
  submissionId,
}: {
  offer: PartialOfferView;
  submissionId: string;
}) {
  const t = useTranslations('creator.offer');
  const locale = useAppLocale();
  const [open, setOpen] = useState(false);

  return (
    <Alert
      className="bg-attention-subtle text-attention-foreground"
      data-testid="partial-offer-panel"
    >
      <HandCoins aria-hidden="true" className="text-attention-foreground" />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        {t('title')}
        <StatusBadge group="offer" code={offer.isStale ? 'stale' : offer.offer.status} />
      </AlertTitle>
      <AlertDescription className="text-attention-foreground">
        <span className="flex flex-col gap-2">
          <span className="break-words">
            {t('description', {
              full: formatSen(offer.fullSen, locale),
              offered: formatSen(offer.consentSen, locale),
              remainder: formatSen(offer.unreservedRemainderSen, locale),
            })}
          </span>
          <span className="break-words">{t('nothingHeld')}</span>
          <span className="flex">
            <PartialOfferDialog
              offer={offer}
              submissionId={submissionId}
              open={open}
              onOpenChange={setOpen}
              trigger={
                <Button variant="outline" size="sm" data-testid="offer-review">
                  {t('reviewAction')}
                </Button>
              }
            />
          </span>
        </span>
      </AlertDescription>
    </Alert>
  );
}
