'use client';

/**
 * `/ops/readiness` and `/ops/campaigns/[id]/readiness`.
 *
 * Readiness is the operations-side control the merchant's publish preview refers
 * to: `campaign.publish` fails with `campaign_not_ready` while either row is
 * unconfirmed, and only `demo.setReadiness` changes it. Both rows are simulated
 * evidence — no funding check and no platform integration exists in M1 — so the
 * copy says so on the page rather than only in a tooltip.
 */

import Link from 'next/link';
import { CircleAlert, CircleCheck, Hourglass, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import type { Campaign } from '@/domain/types';
import { useDemoSnapshot } from '@/store/demo-store';
import { formatSen } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { selectAllCampaigns, selectCampaign, selectCampaignClosure } from '@/store/selectors';

import {
  AuditTrail,
  FactList,
  OpsCommandError,
  OpsNotFound,
  OpsPageHeader,
  useOpsCommand,
} from './ops-shared';

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function OpsReadinessListView() {
  const t = useTranslations('ops.readiness');
  const tShared = useTranslations('ops.shared');
  const state = useDemoSnapshot();
  const campaigns = useMemo(() => selectAllCampaigns(state), [state]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader title={t('listTitle')} description={t('listSubtitle')} />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t('listEmptyTitle')}
          description={t('listEmptyDescription')}
        />
      ) : (
        <ItemGroup data-testid="ops-readiness-list">
          {campaigns.map((campaign) => (
            <Item
              key={campaign.id}
              variant="outline"
              className="items-start"
              data-campaign-id={campaign.id}
            >
              <ItemContent className="min-w-0">
                <ItemTitle className="break-words">{campaign.title}</ItemTitle>
                <ItemDescription className="flex flex-wrap items-center gap-2">
                  <StatusBadge group="campaign" code={campaign.status} />
                  <Badge
                    variant="outline"
                    className={
                      campaign.readiness.fundingEvidence
                        ? 'bg-success-subtle text-success-foreground gap-1 border-transparent'
                        : 'bg-attention-subtle text-attention-foreground gap-1 border-transparent'
                    }
                  >
                    {campaign.readiness.fundingEvidence ? (
                      <CircleCheck aria-hidden="true" />
                    ) : (
                      <TriangleAlert aria-hidden="true" />
                    )}
                    {t('rowFunding')} ·{' '}
                    {campaign.readiness.fundingEvidence ? t('ready') : t('notReady')}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      campaign.readiness.dataSourceReady
                        ? 'bg-success-subtle text-success-foreground gap-1 border-transparent'
                        : 'bg-attention-subtle text-attention-foreground gap-1 border-transparent'
                    }
                  >
                    {campaign.readiness.dataSourceReady ? (
                      <CircleCheck aria-hidden="true" />
                    ) : (
                      <TriangleAlert aria-hidden="true" />
                    )}
                    {t('rowDataSource')} ·{' '}
                    {campaign.readiness.dataSourceReady ? t('ready') : t('notReady')}
                  </Badge>
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/ops/campaigns/${campaign.id}/readiness`}>
                    {tShared('openLabel')}
                  </Link>
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function OpsReadinessView({ campaignId }: { campaignId: string }) {
  const t = useTranslations('ops.readiness');
  const tShared = useTranslations('ops.shared');
  const state = useDemoSnapshot();
  const command = useOpsCommand();

  const campaign = useMemo(() => selectCampaign(state, campaignId), [state, campaignId]);
  if (!campaign) return <OpsNotFound />;

  const blocked = [
    !campaign.readiness.fundingEvidence ? t('blockedFunding') : null,
    !campaign.readiness.dataSourceReady ? t('blockedDataSource') : null,
  ].filter((reason): reason is string => reason !== null);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <OpsPageHeader
        title={t('title', { campaign: campaign.title })}
        description={t('subtitle')}
        backToQueue
        meta={
          <>
            <StatusBadge group="campaign" code={campaign.status} />
            <Badge variant="outline">
              {tShared('roleResponsible', { role: tShared('roleOpsReviewer') })}
            </Badge>
          </>
        }
      />

      <Alert
        className={blocked.length > 0 ? 'bg-attention-subtle' : undefined}
        data-testid="ops-readiness-blocking"
        data-blocked={blocked.length > 0}
      >
        <ShieldCheck aria-hidden="true" />
        <AlertTitle>
          {blocked.length > 0 ? t('blockingTitle') : t('blockingNone')}
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-1">
          {blocked.length > 0 ? (
            <>
              <span className="break-words">{t('blockingDescription')}</span>
              {blocked.map((reason) => (
                <span key={reason} className="break-words">
                  · {reason}
                </span>
              ))}
            </>
          ) : (
            <span className="break-words">{tShared('simulatedCheck')}</span>
          )}
          {campaign.status !== 'draft' ? (
            <span className="break-words">{t('publishedNote')}</span>
          ) : null}
        </AlertDescription>
      </Alert>

      <OpsCommandError state={command} />

      <Card>
        <CardHeader>
          <CardTitle>{t('listTitle')}</CardTitle>
          <CardDescription>{tShared('simulatedCheck')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            <ReadinessRow
              campaign={campaign}
              field="fundingEvidence"
              testId="funding"
              label={t('rowFunding')}
              description={t('rowFundingDescription')}
              onChange={(next) =>
                command.run(
                  { type: 'demo.setReadiness', campaignId: campaign.id, fundingEvidence: next },
                  t('changed'),
                )
              }
            />
            <ReadinessRow
              campaign={campaign}
              field="dataSourceReady"
              testId="data-source"
              label={t('rowDataSource')}
              description={t('rowDataSourceDescription')}
              onChange={(next) =>
                command.run(
                  { type: 'demo.setReadiness', campaignId: campaign.id, dataSourceReady: next },
                  t('changed'),
                )
              }
            />
          </ItemGroup>
        </CardContent>
      </Card>

      <ClosureCard campaignId={campaign.id} />

      <AuditTrail targetType="campaign" targetId={campaign.id} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Closure, from the operations side
// ---------------------------------------------------------------------------

/**
 * What still blocks calling a campaign settled, read by operations.
 *
 * Ticket #8: "仍有未清款/申诉不能显示全结清". The merchant has the same panel on its
 * own campaign page; operations needs it too, because operations is who resolves
 * the appeals and payouts the verdict waits on. Both read
 * `selectCampaignClosure`, so the two pages cannot disagree about whether a
 * campaign is settled.
 *
 * The unconfirmed tail below the minimum claim is disclosed here before closure
 * rather than after it, and the refund of the unused pool stays "pending
 * verification": M1 invents no automatic refund path.
 */
function ClosureCard({ campaignId }: { campaignId: string }) {
  const t = useTranslations('ops.closure');
  const state = useDemoSnapshot();
  const locale = useAppLocale();
  const closure = useMemo(() => selectCampaignClosure(state, campaignId), [state, campaignId]);
  if (!closure) return null;

  const blockers = [
    closure.openAppeals > 0 ? t('blockerAppeals', { count: closure.openAppeals }) : null,
    closure.pendingClaims > 0 ? t('blockerPendingClaims', { count: closure.pendingClaims }) : null,
    closure.confirmedUnpaidClaims > 0
      ? t('blockerConfirmedUnpaid', { count: closure.confirmedUnpaidClaims })
      : null,
    closure.unresolvedPayouts > 0
      ? t('blockerUnresolvedPayouts', { count: closure.unresolvedPayouts })
      : null,
  ].filter((reason): reason is string => reason !== null);

  return (
    <Card data-testid="ops-closure-panel" data-fully-settled={closure.canShowFullySettled}>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Alert
          className={closure.canShowFullySettled ? 'bg-success-subtle' : 'bg-attention-subtle'}
          data-testid="ops-closure-verdict"
        >
          {closure.canShowFullySettled ? (
            <ShieldCheck aria-hidden="true" />
          ) : (
            <CircleAlert aria-hidden="true" />
          )}
          <AlertTitle>
            {closure.canShowFullySettled ? t('settled') : t('notSettled')}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            <span className="break-words">
              {closure.canShowFullySettled ? t('settledNote') : t('notSettledNote')}
            </span>
            {blockers.map((reason) => (
              <span key={reason} className="break-words">
                · {reason}
              </span>
            ))}
          </AlertDescription>
        </Alert>

        <FactList
          items={[
            {
              label: t('tail'),
              value: <MoneyText sen={closure.unconfirmedTailSen} tabular />,
              hint: t('tailNote'),
            },
            {
              label: t('refund'),
              value: (
                <Badge
                  variant="outline"
                  className="bg-inactive-subtle text-inactive-foreground gap-1 border-transparent"
                  data-testid="ops-closure-refund"
                >
                  <Hourglass aria-hidden="true" />
                  {t('refundValue')}
                </Badge>
              ),
              hint: t('refundNote'),
            },
            {
              label: t('pool'),
              value: <MoneyText sen={closure.budget.poolSen} tabular />,
            },
            {
              label: t('confirmedUnpaidAmount'),
              value: <MoneyText sen={closure.budget.confirmedUnpaidSen} tabular />,
            },
          ]}
        />
        <p className="text-muted-foreground text-xs break-words">
          {t('poolNote', { currency: formatSen(closure.budget.availableSen, locale) })}
        </p>
      </CardContent>
    </Card>
  );
}

function ReadinessRow({
  campaign,
  field,
  testId,
  label,
  description,
  onChange,
}: {
  campaign: Campaign;
  field: 'fundingEvidence' | 'dataSourceReady';
  testId: string;
  label: string;
  description: string;
  onChange: (next: boolean) => void;
}) {
  const t = useTranslations('ops.readiness');
  const ready = campaign.readiness[field];

  return (
    <Item variant="outline" className="items-start" data-readiness={field}>
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <span className="break-words">{label}</span>
          <Badge
            variant="outline"
            className={
              ready
                ? 'bg-success-subtle text-success-foreground gap-1 border-transparent'
                : 'bg-attention-subtle text-attention-foreground gap-1 border-transparent'
            }
            data-testid={`ops-readiness-state-${testId}`}
          >
            {ready ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
            {ready ? t('ready') : t('notReady')}
          </Badge>
        </ItemTitle>
        <ItemDescription className="break-words">{description}</ItemDescription>
      </ItemContent>
      <ItemActions className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <ConfirmDialog
          title={t('confirmTitle')}
          description={t('confirmDescription')}
          confirmLabel={t('markReady')}
          onConfirm={() => onChange(true)}
          trigger={
            <Button variant="outline" size="sm" disabled={ready} data-testid={`ops-readiness-ready-${testId}`}>
              <span className="truncate">{t('markReady')}</span>
            </Button>
          }
        />
        <ConfirmDialog
          title={t('confirmTitle')}
          description={t('confirmDescription')}
          confirmLabel={t('markNotReady')}
          destructive
          onConfirm={() => onChange(false)}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              disabled={!ready}
              data-testid={`ops-readiness-not-ready-${testId}`}
            >
              <span className="truncate">{t('markNotReady')}</span>
            </Button>
          }
        />
      </ItemActions>
    </Item>
  );
}
