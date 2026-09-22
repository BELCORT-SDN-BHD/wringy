'use client';

/**
 * `/ops` — the operations work queue.
 *
 * The list itself is the engine's `selectOpsQueue`, so the eight kinds, their
 * "waiting since" times and their deep links are the engine's answer, not this
 * page's opinion. Both operations capabilities read the same queue: separating
 * them here would hide finance work from the reviewer who has to escalate it, and
 * the individual actions behind each link are checked per capability anyway.
 *
 * Filtering uses the official Tabs (scope) and Select (kind) with their own
 * controlled values; there is no self-built segmented control (state-policy.md).
 */

import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { DateTimeText } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OpsQueueItem } from '@/domain/types';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectOpsQueue } from '@/store/selectors';

import { OpsPageHeader } from './ops-shared';

/** Queue kinds in the order the work order lists them. */
const KINDS: Array<OpsQueueItem['kind']> = [
  'readiness',
  'metering_review',
  'escalated',
  'appeal',
  'finalize_rejection',
  'data_unavailable',
  'payout',
  'payout_unknown',
];

/** Which capability owns each kind. Used by the scope tabs only. */
const FINANCE_KINDS: Array<OpsQueueItem['kind']> = ['payout', 'payout_unknown'];

type Scope = 'all' | 'review' | 'finance';

export function OpsQueueView() {
  const t = useTranslations('ops.queue');
  const tShared = useTranslations('ops.shared');
  const state = useDemoSnapshot();
  const [scope, setScope] = useState<Scope>('all');
  const [kind, setKind] = useState<'all' | OpsQueueItem['kind']>('all');

  const items = useMemo(() => selectOpsQueue(state), [state]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const isFinance = FINANCE_KINDS.includes(item.kind);
        if (scope === 'finance' && !isFinance) return false;
        if (scope === 'review' && isFinance) return false;
        if (kind !== 'all' && item.kind !== kind) return false;
        return true;
      }),
    [items, scope, kind],
  );

  const groups = useMemo(
    () =>
      KINDS.map((groupKind) => ({
        kind: groupKind,
        rows: filtered.filter((item) => item.kind === groupKind),
      })).filter((group) => group.rows.length > 0),
    [filtered],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader
        title={t('title')}
        description={t('subtitle')}
        meta={
          <Badge variant="outline" data-testid="ops-queue-total">
            {t('totalCount', { count: items.length })}
          </Badge>
        }
      />

      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs value={scope} onValueChange={(next) => setScope(next as Scope)}>
          <TabsList data-testid="ops-queue-scope">
            <TabsTrigger value="all">{t('scopeAll')}</TabsTrigger>
            <TabsTrigger value="review">{t('scopeReview')}</TabsTrigger>
            <TabsTrigger value="finance">{t('scopeFinance')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Field className="min-w-0 lg:max-w-xs">
          <FieldLabel htmlFor="ops-queue-kind">{t('kindFilterLabel')}</FieldLabel>
          <Select
            value={kind}
            onValueChange={(next) => setKind(next as 'all' | OpsQueueItem['kind'])}
          >
            <SelectTrigger id="ops-queue-kind" className="w-full" data-testid="ops-queue-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('kindFilterAll')}</SelectItem>
              {KINDS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`kind.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-5" data-testid="ops-queue-groups">
          {groups.map((group) => (
            <Card key={group.kind} data-queue-kind={group.kind}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span className="break-words">{t(`kind.${group.kind}`)}</span>
                  <Badge
                    variant="outline"
                    className="bg-attention-subtle text-attention-foreground border-transparent"
                    data-testid={`ops-queue-count-${group.kind}`}
                  >
                    {t('groupCount', { count: group.rows.length })}
                  </Badge>
                </CardTitle>
                <CardDescription className="break-words">
                  {t(`kindHint.${group.kind}`)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ItemGroup>
                  {group.rows.map((item) => (
                    <Item
                      key={`${item.kind}-${item.targetId}`}
                      variant="outline"
                      size="sm"
                      className="items-start"
                      data-queue-target={item.targetId}
                    >
                      <ItemContent className="min-w-0">
                        <ItemTitle className="break-words">
                          {state.campaigns[item.campaignId]?.title ?? t('unknownCampaign')}
                        </ItemTitle>
                        <ItemDescription className="flex flex-col gap-0.5">
                          <span className="break-words">
                            {tShared('creatorLabel')}:{' '}
                            {item.creatorId
                              ? (state.users[item.creatorId]?.displayName ?? item.creatorId)
                              : t('noCreator')}
                          </span>
                          <span className="flex flex-wrap items-center gap-1">
                            {tShared('waitingSince')} <DateTimeText iso={item.since} hideOffset />
                          </span>
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button asChild variant="outline" size="sm">
                          <Link href={item.href}>{tShared('openLabel')}</Link>
                        </Button>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
