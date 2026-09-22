'use client';

/**
 * Confirmation for an action that changes money, a review outcome or the whole
 * demo data set.
 *
 * Built on the official `AlertDialog` composition, so Escape, the overlay and
 * focus return to the trigger are the library's behaviour rather than something
 * re-implemented here (state-policy.md forbids a self-built confirmation layer,
 * extra timers or long-press gates).
 *
 * With `requireReason` the confirm button stays disabled until a reason is
 * typed, because the reason is what the audit trail records.
 */

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DIALOG_FIT_CLASS } from '@/components/app/dialog-fit';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

export interface ConfirmDialogProps {
  /** Attaches the dialog to its own trigger; focus returns here on close. */
  trigger?: ReactNode;
  /** Controlled mode, for a dialog opened from a menu item or a row action. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  title?: string;
  description?: string;
  /** Extra content between the description and the reason field. */
  children?: ReactNode;

  confirmLabel?: string;
  cancelLabel?: string;
  /** Uses the official destructive button for an irreversible demo action. */
  destructive?: boolean;
  /** Blocks confirmation until a reason is written, and passes it to `onConfirm`. */
  requireReason?: boolean;
  reasonLabel?: string;

  onConfirm: (reason: string) => void;
}

export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  destructive,
  requireReason,
  reasonLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations('common.confirm');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const reasonId = useId();

  const missingReason = Boolean(requireReason) && reason.trim() === '';

  // A reopened dialog starts from a clean reason, so a previous attempt's text
  // is never submitted against a different target. Radix reports every close
  // here, controlled or not, so no effect is needed.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('');
      setTouched(false);
    }
    onOpenChange?.(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent className={DIALOG_FIT_CLASS}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t('defaultTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? t('demoNote')}</AlertDialogDescription>
        </AlertDialogHeader>

        {children}

        {requireReason ? (
          <Field data-invalid={touched && missingReason ? true : undefined}>
            <FieldLabel htmlFor={reasonId}>{reasonLabel ?? t('reasonLabel')}</FieldLabel>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={t('reasonPlaceholder')}
              aria-invalid={touched && missingReason ? true : undefined}
              required
            />
            {touched && missingReason ? <FieldError>{t('reasonRequired')}</FieldError> : null}
          </Field>
        ) : null}

        <p className="text-muted-foreground text-xs">{t('demoNote')}</p>

        <AlertDialogFooter>
          <AlertDialogCancel data-testid="confirm-cancel">
            {cancelLabel ?? t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="confirm-accept"
            variant={destructive ? 'destructive' : 'default'}
            disabled={missingReason}
            onClick={(event) => {
              if (missingReason) {
                // Keeps the official dialog open instead of confirming nothing.
                event.preventDefault();
                setTouched(true);
                return;
              }
              onConfirm(reason.trim());
              setReason('');
              setTouched(false);
            }}
          >
            {confirmLabel ?? t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
