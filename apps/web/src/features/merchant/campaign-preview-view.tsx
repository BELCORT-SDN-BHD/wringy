'use client';

/**
 * The readiness check: the last page before a campaign becomes public.
 *
 * Three things have to be true together, and the page says which one is missing
 * rather than greying out a button with no reason (state-policy.md: a control that
 * cannot be used carries its reason as readable text, not only a tooltip):
 *   1. the configuration parses — the same `validateCampaignForm` the editor uses;
 *   2. funding evidence and data-source readiness are recorded — and recording
 *      them is somebody else's job, which is why the hint names the demo tools and
 *      the operations readiness page ("不能用填写金额代替资金落实");
 *   3. the campaign is still a draft.
 *
 * The rule sheet is the shared `CampaignRulesList`, i.e. literally the component
 * the public campaign page renders, so "preview" and "public" cannot drift.
 *
 * Publish mints one command id per click (the store does that for every dispatch),
 * so a second click is a real second attempt: the engine answers
 * `invalid_transition` for an already-published campaign and the page shows that
 * refusal instead of a second success. No duplicate campaign can exist, because
 * publishing is a transition and never a create.
 */

import Link from 'next/link';
import { CircleAlert, CircleCheck, Hourglass, Rocket, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CampaignRulesList } from '@/components/app/campaign-rules-list';
import { EmptyState } from '@/components/app/empty-state';
import { CommandErrorAlert } from '@/components/app/error-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { useDemoState } from '@/store/demo-store';

import { CampaignCalendar } from './campaign-calendar';
import { formFromCampaign, validateCampaignForm } from './campaign-form';
import { useMerchantCommand, useOwnCampaign } from './hooks';

export function MerchantCampaignPreviewView({ campaignId }: { campaignId: string }) {
  return (
    <HydrationGate>
      <Preview campaignId={campaignId} />
    </HydrationGate>
  );
}

function Preview({ campaignId }: { campaignId: string }) {
  const t = useTranslations('merchant.preview');
  const tCampaigns = useTranslations('merchant.campaigns');
  const tStatus = useTranslations('common.status.campaign');
  const campaign = useOwnCampaign(campaignId);
  const nowIso = useDemoState((state) => state.clock.nowIso);
  const run = useMerchantCommand();
  const [failure, setFailure] = useState<{ code: string; detail?: string } | null>(null);

  const validity = useMemo(
    () => (campaign ? validateCampaignForm(formFromCampaign(campaign)) : null),
    [campaign],
  );

  if (!campaign || !validity) {
    return (
      <EmptyState title={tCampaigns('notFoundTitle')} description={tCampaigns('notFoundDescription')}>
        <Button asChild variant="outline">
          <Link href="/merchant/campaigns">{tCampaigns('back')}</Link>
        </Button>
      </EmptyState>
    );
  }

  const missing: string[] = [];
  if (!campaign.readiness.fundingEvidence) missing.push(t('missingFunding'));
  if (!campaign.readiness.dataSourceReady) missing.push(t('missingDataSource'));

  const isDraft = campaign.status === 'draft';
  const configurationInvalid = validity.patch === null;

  /**
   * The button is disabled for the two things the merchant can fix here, and the
   * reason is on the page. Being past draft is deliberately NOT one of them: the
   * engine owns that transition, so a second publish reaches `applyCommand` and
   * comes back as `invalid_transition`, which is what the page then shows. Hiding
   * it behind a disabled control would make the refusal invisible and would make
   * the button, not the engine, the check (kickoff decision 7).
   */
  const blockedReason = configurationInvalid
    ? t('blockedInvalid')
    : missing.length > 0
      ? t('blockedNotReady', { missing: missing.join(' · ') })
      : null;

  const publish = () => {
    setFailure(null);
    const result = run({ type: 'campaign.publish', campaignId: campaign.id });
    if (!result.ok) {
      setFailure({ code: result.code, detail: result.detail });
      toast.error(t('publishFailed'));
      return;
    }
    toast.success(t('published'));
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <StatusBadge group="campaign" code={campaign.status} />
        <h1 className="font-heading text-2xl font-semibold break-words">{t('title')}</h1>
        <p className="text-muted-foreground text-sm break-words">{campaign.title}</p>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>

      {failure ? <CommandErrorAlert code={failure.code} detail={failure.detail} /> : null}

      <Card data-testid="readiness-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck aria-hidden="true" className="size-4" />
            {t('readinessTitle')}
          </CardTitle>
          <CardDescription>{t('readinessHint')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ItemGroup>
            <ReadinessRow
              label={t('readinessFunding')}
              ready={campaign.readiness.fundingEvidence}
              testId="readiness-funding"
            />
            <ReadinessRow
              label={t('readinessDataSource')}
              ready={campaign.readiness.dataSourceReady}
              testId="readiness-data-source"
            />
          </ItemGroup>

          {blockedReason ? (
            <Alert variant="destructive" data-testid="publish-blocked">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>{blockedReason}</AlertTitle>
              <AlertDescription>{t('readinessHint')}</AlertDescription>
            </Alert>
          ) : null}

          {isDraft ? null : (
            <Alert data-testid="publish-not-draft">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>{t('blockedNotDraft', { status: tStatus(campaign.status) })}</AlertTitle>
              <AlertDescription>{t('publishHint')}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Button
              className="w-full sm:w-fit"
              disabled={blockedReason !== null}
              data-testid="publish-campaign"
              onClick={publish}
            >
              <Rocket aria-hidden="true" />
              <span className="truncate">{t('publish')}</span>
            </Button>
            <p className="text-muted-foreground text-xs break-words">{t('publishHint')}</p>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('rulesTitle')}</h2>
        <p className="text-muted-foreground text-xs">{t('rulesNote')}</p>
        <CampaignRulesList campaign={campaign} />
      </section>

      <CampaignCalendar campaign={campaign} nowIso={nowIso} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline">
          <Link href={`/merchant/campaigns/${campaign.id}/edit`}>{t('backToEditor')}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/merchant/campaigns/${campaign.id}`}>{tCampaigns('open')}</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Readiness is a boolean on the campaign, not one of the engine's status codes, so
 * it cannot go through `StatusBadge`'s vocabulary without mislabelling itself as a
 * review outcome. It uses the official `Badge` with the same semantic colour
 * variables and the same icon-plus-text rule instead — colour is never the only
 * carrier (color-policy.md), and no new Badge variant is introduced.
 */
function ReadinessRow({
  label,
  ready,
  testId,
}: {
  label: string;
  ready: boolean;
  testId: string;
}) {
  const t = useTranslations('merchant.preview');
  const Icon = ready ? CircleCheck : Hourglass;
  return (
    <Item variant="outline" size="sm" className="items-start" data-testid={testId} data-ready={ready}>
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
          >
            <Icon aria-hidden="true" />
            {ready ? t('readinessRecorded') : t('readinessMissing')}
          </Badge>
        </ItemTitle>
        <ItemDescription>{t('readinessHint')}</ItemDescription>
      </ItemContent>
    </Item>
  );
}
