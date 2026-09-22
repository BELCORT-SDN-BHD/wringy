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
import { ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import type { Campaign } from '@/domain/types';
import { useDemoSnapshot } from '@/store/demo-store';
import { selectAllCampaigns, selectCampaign } from '@/store/selectors';

import { AuditTrail, OpsCommandError, OpsNotFound, OpsPageHeader, useOpsCommand } from './ops-shared';

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
                        ? 'bg-success-subtle text-success-foreground border-transparent'
                        : 'bg-attention-subtle text-attention-foreground border-transparent'
                    }
                  >
                    {t('rowFunding')} ·{' '}
                    {campaign.readiness.fundingEvidence ? t('ready') : t('notReady')}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      campaign.readiness.dataSourceReady
                        ? 'bg-success-subtle text-success-foreground border-transparent'
                        : 'bg-attention-subtle text-attention-foreground border-transparent'
                    }
                  >
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

      <AuditTrail targetType="campaign" targetId={campaign.id} />
    </div>
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
                ? 'bg-success-subtle text-success-foreground border-transparent'
                : 'bg-attention-subtle text-attention-foreground border-transparent'
            }
            data-testid={`ops-readiness-state-${testId}`}
          >
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
