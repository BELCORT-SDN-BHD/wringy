'use client';

/**
 * The appeal panel on a rejected claim.
 *
 * Approved rules (campaign-defaults-v1 补充规则, three-role-flows §7): the
 * rejection carries a readable reason, the appeal window is 7 calendar days from
 * the decision, the reservation stays held while the window runs or an appeal is
 * open, and only operations can finalise the rejection and release it. An upheld
 * appeal puts the claim back into verification and keeps the reservation and the
 * queue position.
 */

import { Gavel, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DateTimeText } from '@/components/app/date-time-text';
import { CommandErrorAlert } from '@/components/app/error-state';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { isAtOrBefore } from '@/domain';
import { formatDateTime, formatSen } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { newCommandId } from '@/store/command-id';
import { useDispatch } from '@/store/demo-store';
import type { Appeal, Claim, Sen } from '@/domain/types';

import { DetailList, DetailRow } from './creator-ui';

export interface AppealPanelProps {
  claim: Claim;
  appeal: Appeal | null;
  /** The simulated server clock, which decides whether the window is still open. */
  nowIso: string;
}

export function AppealPanel({ claim, appeal, nowIso }: AppealPanelProps) {
  const t = useTranslations('creator.appeal');
  const locale = useAppLocale();
  const dispatch = useDispatch();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);
  const intent = useRef<{ signature: string; commandId: string } | null>(null);

  const rejection = claim.rejection;
  // Nothing to appeal: no rejection was ever recorded on this claim.
  if (rejection === null && appeal === null) return null;

  const windowOpen =
    rejection !== null &&
    claim.status === 'rejected_appealable' &&
    isAtOrBefore(nowIso, rejection.appealDeadlineAt);
  const held = claim.status === 'rejected_appealable' || claim.status === 'appealing';
  const missingReason = reason.trim() === '';

  const file = () => {
    if (missingReason) {
      setTouched(true);
      return;
    }
    const signature = `${claim.id}|${reason.trim()}`;
    if (intent.current?.signature !== signature) {
      intent.current = { signature, commandId: newCommandId() };
    }
    const result = dispatch(
      { type: 'appeal.file', claimId: claim.id, reason: reason.trim() },
      intent.current.commandId,
    );
    if (!result.ok) {
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);
    setReason('');
    setTouched(false);
    toast.success(t('filedToast'));
  };

  return (
    <Card data-testid="appeal-panel" data-appeal-status={appeal?.status ?? 'none'}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Gavel aria-hidden="true" className="size-4" />
          {t('title')}
          {appeal ? <StatusBadge group="appeal" code={appeal.status} /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rejection ? (
          <DetailList>
            <DetailRow label={t('rejectionReasonLabel')} testId="rejection-reason">
              <span className="break-words">{rejection.reason}</span>
            </DetailRow>
            <DetailRow
              label={t('deadlineLabel')}
              hint={
                rejection.source === 'content'
                  ? t('rejectionSourceContent')
                  : t('rejectionSourceMetering')
              }
              testId="appeal-deadline"
            >
              <DateTimeText iso={rejection.appealDeadlineAt} />
            </DetailRow>
          </DetailList>
        ) : null}

        {held ? <ReservationHeldAlert amountSen={claim.amountSen} /> : null}

        {appeal ? <AppealOutcome appeal={appeal} /> : null}

        {windowOpen && appeal === null ? (
          <div className="flex flex-col gap-3">
            <Field data-invalid={touched && missingReason ? true : undefined}>
              <FieldLabel htmlFor="appeal-reason">{t('reasonLabel')}</FieldLabel>
              <Textarea
                id="appeal-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                onBlur={() => setTouched(true)}
                placeholder={t('reasonPlaceholder')}
                aria-invalid={touched && missingReason ? true : undefined}
                data-testid="appeal-reason"
              />
              <FieldDescription>
                {t('deadlineLabel')}:{' '}
                {rejection === null ? '' : formatDateTime(rejection.appealDeadlineAt, locale)}
              </FieldDescription>
              {touched && missingReason ? <FieldError>{t('reasonRequired')}</FieldError> : null}
            </Field>
            <Button
              onClick={file}
              disabled={missingReason}
              data-testid="appeal-file"
              className="w-full sm:w-fit"
            >
              <Gavel aria-hidden="true" />
              {t('file')}
            </Button>
          </div>
        ) : null}

        {!windowOpen && appeal === null && rejection !== null ? (
          <Alert variant="destructive" data-testid="appeal-window-closed">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{t('windowClosedTitle')}</AlertTitle>
            <AlertDescription>
              {t('windowClosedDescription', {
                deadline: formatDateTime(rejection.appealDeadlineAt, locale),
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? <CommandErrorAlert code={error.code} detail={error.detail} /> : null}
      </CardContent>
    </Card>
  );
}

/**
 * The reservation is still held. It stays visible until operations finalise the
 * rejection, so a rejected claim never looks like released money.
 */
export function ReservationHeldAlert({ amountSen }: { amountSen: Sen }) {
  const t = useTranslations('creator.claimDetail');
  const locale = useAppLocale();

  return (
    <Alert className="bg-attention-subtle text-attention-foreground" data-testid="reservation-held">
      <TriangleAlert aria-hidden="true" className="text-attention-foreground" />
      <AlertTitle>{t('reservationHeldTitle')}</AlertTitle>
      <AlertDescription className="text-attention-foreground">
        {t('reservationHeldDescription', { amount: formatSen(amountSen, locale) })}
      </AlertDescription>
    </Alert>
  );
}

function AppealOutcome({ appeal }: { appeal: Appeal }) {
  const t = useTranslations('creator.appeal');

  const copy =
    appeal.status === 'open'
      ? { title: t('openTitle'), description: t('openDescription') }
      : appeal.status === 'upheld'
        ? { title: t('upheldTitle'), description: t('upheldDescription') }
        : { title: t('rejectedTitle'), description: t('rejectedDescription') };

  return (
    <div className="flex flex-col gap-3">
      <Alert data-testid="appeal-outcome" data-outcome={appeal.status}>
        <Gavel aria-hidden="true" />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription>{copy.description}</AlertDescription>
      </Alert>
      <DetailList>
        <DetailRow label={t('filedAtLabel')}>
          <DateTimeText iso={appeal.filedAt} />
        </DetailRow>
        <DetailRow label={t('yourReasonLabel')}>
          <span className="break-words">{appeal.reason}</span>
        </DetailRow>
        <DetailRow label={t('noteLabel')}>
          {appeal.note ?? <span className="text-inactive-foreground">—</span>}
        </DetailRow>
      </DetailList>
    </div>
  );
}
