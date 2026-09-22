'use client';

/**
 * `/ops/exceptions` — the exception log.
 *
 * Five conditions the demo has to be able to show at once, because each one is a
 * different kind of "not settled" and collapsing them would hide the distinction
 * the whole prototype is about: an unreadable source, an unknown payout, a
 * confirmed failed payout, a claim past the 48-hour target, and a claim deadline
 * that was extended.
 *
 * Each row's actor and reason come from the engine's own audit trail for that
 * target, so nothing here is a second opinion about what happened. Export is not
 * part of M1.
 */

import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { StatusBadge } from '@/components/app/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import type { AuditEntry, DemoState, IsoDateTime } from '@/domain/types';
import { useDemoSnapshot } from '@/store/demo-store';
import { formatAuditAction } from '@/lib/audit-copy';
import {
  selectAllSubmissions,
  selectAuditFor,
  selectLastSnapshot,
  selectObligations,
} from '@/store/selectors';

import { OpsPageHeader, actorName } from './ops-shared';

type ExceptionKind =
  | 'data_unavailable'
  | 'payout_unknown'
  | 'payout_failed'
  | 'escalated'
  | 'extension';

const KINDS: readonly ExceptionKind[] = [
  'data_unavailable',
  'payout_unknown',
  'payout_failed',
  'escalated',
  'extension',
];

interface ExceptionRow {
  id: string;
  kind: ExceptionKind;
  /** What this is about, already resolved to readable names. */
  target: string;
  since: IsoDateTime;
  /** Latest audit entry for the record, or null when nothing was recorded. */
  audit: AuditEntry | null;
  /** Status code for the badge, and the group it belongs to. */
  badge: { group: 'submission' | 'payout' | 'claim'; code: string } | null;
  href: string;
}

/** The most recent recorded action on one target; the exception's "who and why". */
function latestAudit(
  state: DemoState,
  targetType: AuditEntry['targetType'],
  targetId: string,
): AuditEntry | null {
  const rows = selectAuditFor(state, targetType, targetId);
  return rows[rows.length - 1] ?? null;
}

function buildRows(state: DemoState, unknownCampaign: string): ExceptionRow[] {
  const rows: ExceptionRow[] = [];
  const campaignTitle = (campaignId: string) =>
    state.campaigns[campaignId]?.title ?? unknownCampaign;
  const creatorName = (userId: string) => state.users[userId]?.displayName ?? userId;

  for (const submission of selectAllSubmissions(state)) {
    if (submission.status === 'data_unavailable' || submission.status === 'baseline_unavailable') {
      rows.push({
        id: `data-${submission.id}`,
        kind: 'data_unavailable',
        target: `${campaignTitle(submission.campaignId)} · ${creatorName(submission.creatorId)} · ${submission.platform}`,
        since: selectLastSnapshot(submission)?.observedAt ?? submission.submittedAt,
        audit: latestAudit(state, 'submission', submission.id),
        badge: { group: 'submission', code: submission.status },
        href: `/ops/submissions/${submission.id}`,
      });
    }
    for (const extension of submission.extensions) {
      rows.push({
        id: `ext-${extension.id}`,
        kind: 'extension',
        target: `${campaignTitle(submission.campaignId)} · ${creatorName(submission.creatorId)}`,
        since: extension.unblockedAt,
        audit: latestAudit(state, 'submission', submission.id),
        badge: null,
        href: `/ops/submissions/${submission.id}`,
      });
    }
  }

  for (const claim of Object.values(state.claims)) {
    if (claim.escalatedAt === null) continue;
    rows.push({
      id: `esc-${claim.id}`,
      kind: 'escalated',
      target: `${campaignTitle(claim.campaignId)} · ${creatorName(claim.creatorId)} · #${claim.seq}`,
      since: claim.escalatedAt,
      audit: latestAudit(state, 'claim', claim.id),
      badge: { group: 'claim', code: claim.status },
      href: `/ops/claims/${claim.id}`,
    });
  }

  for (const obligation of selectObligations(state)) {
    for (const attempt of Object.values(state.payoutAttempts)) {
      if (attempt.obligationId !== obligation.id) continue;
      if (attempt.status !== 'unknown' && attempt.status !== 'failed') continue;
      rows.push({
        id: `pay-${attempt.id}`,
        kind: attempt.status === 'unknown' ? 'payout_unknown' : 'payout_failed',
        target: `${campaignTitle(obligation.campaignId)} · ${creatorName(obligation.creatorId)} · ${attempt.providerRef}`,
        since: attempt.resolvedAt ?? attempt.startedAt,
        audit: latestAudit(state, 'payout_attempt', attempt.id),
        badge: { group: 'payout', code: attempt.status },
        href: `/ops/payouts/${obligation.id}`,
      });
    }
  }

  return rows.sort((a, b) => b.since.localeCompare(a.since));
}

export function OpsExceptionsView() {
  const t = useTranslations('ops.exceptions');
  const tQueue = useTranslations('ops.queue');
  const tShared = useTranslations('ops.shared');
  const tActions = useTranslations('common.actions');
  const state = useDemoSnapshot();

  const unknownCampaign = tQueue('unknownCampaign');
  const rows = useMemo(() => buildRows(state, unknownCampaign), [state, unknownCampaign]);

  const groups = useMemo(
    () =>
      KINDS.map((kind) => ({ kind, rows: rows.filter((row) => row.kind === kind) })).filter(
        (group) => group.rows.length > 0,
      ),
    [rows],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader
        title={t('title')}
        description={t('subtitle')}
        meta={
          <Badge variant="outline" data-testid="ops-exceptions-total">
            {t('totalCount', { count: rows.length })}
          </Badge>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={TriangleAlert}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-5" data-testid="ops-exceptions-groups">
          {groups.map((group) => (
            <Card key={group.kind} data-exception-kind={group.kind}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span className="break-words">{t(`kind.${group.kind}`)}</span>
                  <Badge
                    variant="outline"
                    className="bg-attention-subtle text-attention-foreground border-transparent"
                    data-testid={`ops-exceptions-count-${group.kind}`}
                  >
                    {group.rows.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="break-words">
                  {t(`kindHint.${group.kind}`)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ItemGroup>
                  {group.rows.map((row) => (
                    <Item
                      key={row.id}
                      variant="outline"
                      size="sm"
                      className="items-start"
                      data-exception-id={row.id}
                    >
                      <ItemContent className="min-w-0">
                        <ItemTitle className="flex flex-wrap items-center gap-2">
                          <span className="break-words">{row.target}</span>
                          {row.badge ? (
                            <StatusBadge group={row.badge.group} code={row.badge.code} />
                          ) : null}
                        </ItemTitle>
                        <ItemDescription className="flex flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-1">
                            {t('colSince')} <DateTimeText iso={row.since} hideOffset />
                          </span>
                          <span className="break-words">
                            {t('colActor')}:{' '}
                            {row.audit ? actorName(state, row.audit.actorUserId) : t('noActor')}
                            {row.audit ? ` · ${formatAuditAction(row.audit.action, tActions)}` : ''}
                          </span>
                          <span className="break-words">
                            {t('colReason')}: {row.audit?.reason ?? t('noReason')}
                          </span>
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button asChild variant="outline" size="sm">
                          <Link href={row.href}>{tShared('openLabel')}</Link>
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

      <TimeZoneHint />
    </div>
  );
}
