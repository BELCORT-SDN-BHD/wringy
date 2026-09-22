'use client';

/**
 * Money on the page.
 *
 * `sen` is the engine's integer minor unit. A null amount renders the localized
 * word for unknown, never RM 0.00 (localization-v1: known zero, unknown and not
 * applicable are three different things). Formatting never writes back.
 */

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { formatSen } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import type { Sen } from '@/domain/types';

export interface MoneyTextProps {
  sen: Sen | null | undefined;
  className?: string;
  /** Renders in the tabular monospace face, for columns of figures. */
  tabular?: boolean;
}

export function MoneyText({ sen, className, tabular }: MoneyTextProps) {
  const t = useTranslations('common.state');
  const locale = useAppLocale();

  if (sen === null || sen === undefined) {
    return (
      <span
        className={cn('text-inactive-foreground', className)}
        title={t('notZero')}
        data-money="unknown"
      >
        {t('unknown')}
      </span>
    );
  }

  return (
    <span
      className={cn(tabular && 'font-mono tabular-nums', className)}
      data-money={String(sen)}
    >
      {formatSen(sen, locale)}
    </span>
  );
}

/** "RM 5.00 per 1,000 qualified views", with the period and basis kept in the copy. */
export function RateText({ ratePerThousandSen }: { ratePerThousandSen: Sen }) {
  const t = useTranslations('common.money');
  const locale = useAppLocale();
  return <span>{t('perThousand', { amount: formatSen(ratePerThousandSen, locale) })}</span>;
}

/** The service fee is never a number in M1 (kickoff decision 10). */
export function ServiceFeeText() {
  const t = useTranslations('common.money');
  return <span className="text-inactive-foreground">{t('serviceFeeValue')}</span>;
}
