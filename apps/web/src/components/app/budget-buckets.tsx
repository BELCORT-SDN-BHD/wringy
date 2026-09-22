'use client';

/**
 * The four reward-pool buckets.
 *
 * They are always shown together and always add up to the pool
 * (prototype-spec-v1 step 7: 2000/0/0/0 → 1995/5/0/0 → 1995/0/5/0 → 1995/0/0/5,
 * identical in all three roles). Showing one bucket alone would let a reader
 * mistake "reserved" for "paid", so this component takes the whole
 * `BudgetBuckets` value from the engine and renders every column.
 *
 * Paid means funds are available in the simulated provider account; bank
 * settlement is a separate fact and is not implied here.
 */

import { useTranslations } from 'next-intl';

import { MoneyText } from '@/components/app/money-text';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BudgetBuckets as BudgetBucketsValue } from '@/domain/types';

/** `bucket` is the engine's `Bucket` name; `labelKey` is the copy key. */
const COLUMNS = [
  { bucket: 'available', labelKey: 'available', field: 'availableSen' },
  { bucket: 'reserved', labelKey: 'reserved', field: 'reservedSen' },
  { bucket: 'confirmed_unpaid', labelKey: 'confirmedUnpaid', field: 'confirmedUnpaidSen' },
  { bucket: 'paid', labelKey: 'paid', field: 'paidSen' },
] as const;

export interface BudgetBucketsProps {
  budget: BudgetBucketsValue;
  /** Renders without the surrounding Card, for use inside another panel. */
  bare?: boolean;
  className?: string;
}

export function BudgetBuckets({ budget, bare, className }: BudgetBucketsProps) {
  const t = useTranslations('common.budget');

  const grid = (
    <div className="flex flex-col gap-3" data-app-widget="budget-buckets">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COLUMNS.map(({ bucket, labelKey, field }) => (
          <div
            key={bucket}
            className="bg-muted/40 flex min-w-0 flex-col gap-1 rounded-lg border p-3"
            data-bucket={bucket}
          >
            <dt className="text-muted-foreground text-xs break-words">{t(labelKey)}</dt>
            <dd className="text-sm font-medium">
              <MoneyText sen={budget[field]} tabular />
            </dd>
          </div>
        ))}
      </dl>
      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <p className="flex flex-wrap items-center gap-1">
          <span>{t('pool')}</span>
          <span className="text-foreground font-medium">
            <MoneyText sen={budget.poolSen} tabular />
          </span>
          <span>· {t('note')}</span>
        </p>
        <p>{t('paidMeaning')}</p>
      </div>
    </div>
  );

  if (bare) return <div className={className}>{grid}</div>;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('note')}</CardDescription>
      </CardHeader>
      <CardContent>{grid}</CardContent>
    </Card>
  );
}
