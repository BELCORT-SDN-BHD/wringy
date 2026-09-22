'use client';

/**
 * One campaign, end to end: the rules it published, the calendar they produce, the
 * four budget buckets, the content it received, the claims against it, the report
 * and the closure position — plus the four state changes a merchant may make.
 *
 * The page is built so the reader cannot collapse two facts into one:
 *   - the four buckets are always rendered together and always sum to the pool
 *     (three-role-flows-v1 §5), and the note says reserved is not paid;
 *   - a submission row shows the content decision, the metering status and the
 *     claim status as three separate columns (§4 "四种状态分别记录");
 *   - the report keeps "confirmed unpaid" and "paid" in two columns;
 *   - the closure panel refuses to say "fully settled" while an appeal, a claim,
 *     a confirmed unpaid amount or an unresolved payout exists, discloses the
 *     sub-minimum tail, and shows the refund as pending verification.
 *
 * Everything is read through the engine's selectors, so the numbers here are the
 * same ones the creator and operations read.
 */

import Link from 'next/link';
import {
  Banknote,
  CircleAlert,
  ExternalLink,
  FileVideo,
  Hourglass,
  Megaphone,
  Pause,
  Play,
  SquareSlash,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ReactNode } from 'react';

import { BudgetBuckets } from '@/components/app/budget-buckets';
import { CampaignRulesList } from '@/components/app/campaign-rules-list';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { DataUnavailable } from '@/components/app/data-unavailable';
import { DateTimeText } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { CommandErrorAlert } from '@/components/app/error-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { formatCount, formatViewsOrUnknown } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useDemoSnapshot, useDemoState } from '@/store/demo-store';
import { selectCampaignOrgName } from '@/store/selectors';
import type { Campaign, CampaignClosureView, Command, Platform } from '@/domain/types';

import { CampaignCalendar } from './campaign-calendar';
import {
  useMerchantCampaignReport,
  useMerchantClaims,
  useMerchantCommand,
  useMerchantSubmissionRows,
  useOwnCampaign,
} from './hooks';

const PLATFORM_KEY: Record<Platform, string> = {
  tiktok: 'platformTikTok',
  instagram: 'platformInstagram',
  youtube: 'platformYouTube',
};

export function MerchantCampaignDetailView({ campaignId }: { campaignId: string }) {
  return (
    <HydrationGate>
      <Detail campaignId={campaignId} />
    </HydrationGate>
  );
}

function Detail({ campaignId }: { campaignId: string }) {
  const t = useTranslations('merchant.detail');
  const tCampaigns = useTranslations('merchant.campaigns');
  const tPublic = useTranslations('public.campaign');
  const campaign = useOwnCampaign(campaignId);
  const nowIso = useDemoState((state) => state.clock.nowIso);
  const state = useDemoSnapshot();
  const report = useMerchantCampaignReport(campaignId);
  const submissions = useMerchantSubmissionRows(campaignId);
  const claims = useMerchantClaims(campaignId);
  const locale = useAppLocale();
  const [failure, setFailure] = useState<{ code: string; detail?: string } | null>(null);

  if (!campaign || !report) {
    return (
      <EmptyState
        icon={Megaphone}
        title={tCampaigns('notFoundTitle')}
        description={tCampaigns('notFoundDescription')}
      >
        <Button asChild variant="outline">
          <Link href="/merchant/campaigns">{tCampaigns('back')}</Link>
        </Button>
      </EmptyState>
    );
  }

  const orgName = selectCampaignOrgName(state, campaign.id);
  const published = campaign.status !== 'draft';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge group="campaign" code={campaign.status} />
          {orgName ? (
            <Badge variant="outline" className="max-w-full">
              <span className="truncate">
                {tPublic('org')}: {orgName}
              </span>
            </Badge>
          ) : null}
        </div>
        <h1 className="font-heading text-2xl font-semibold break-words">{campaign.title}</h1>
        <p className="text-muted-foreground text-sm break-words">{campaign.brief}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {campaign.status === 'draft' ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/merchant/campaigns/${campaign.id}/edit`}>{t('editDraft')}</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/merchant/campaigns/${campaign.id}/preview`}>{t('previewLink')}</Link>
          </Button>
          {published ? (
            <Button asChild variant="ghost" size="sm" data-testid="campaign-public-link">
              <Link href={`/campaigns/${campaign.id}`}>
                <span className="truncate">{t('publicPage')}</span>
                <ExternalLink aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">{t('notPublished')}</p>
          )}
        </div>
      </header>

      {failure ? <CommandErrorAlert code={failure.code} detail={failure.detail} /> : null}

      <section className="flex flex-col gap-3">
        <BudgetBuckets budget={report.budget} />
        <p className="text-muted-foreground text-xs break-words" data-testid="budget-note">
          {t('budgetNote')}
        </p>
      </section>

      <CampaignActions campaign={campaign} onFailure={setFailure} />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('rulesTitle')}</h2>
        <CampaignRulesList campaign={campaign} />
      </section>

      <CampaignCalendar campaign={campaign} nowIso={nowIso} />

      {/* Submissions */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('submissionsTitle')}</h2>
        {submissions.length === 0 ? (
          <EmptyState icon={FileVideo} description={t('submissionsNone')} />
        ) : (
          <ItemGroup data-testid="campaign-submissions">
            {submissions.map((row) => (
              <Item
                key={row.submission.id}
                variant="outline"
                className="items-start"
                data-submission-id={row.submission.id}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex flex-wrap items-center gap-2">
                    <span className="break-words">{row.creatorName}</span>
                    <Badge variant="outline">
                      {tPublic(PLATFORM_KEY[row.submission.platform])}
                    </Badge>
                  </ItemTitle>
                  <ItemDescription className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        group="content"
                        code={row.submission.contentReview.status}
                      />
                      <StatusBadge group="submission" code={row.submission.status} />
                      {row.claim ? (
                        <StatusBadge group="claim" code={row.claim.status} />
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        {t('reportQualifiedViews')}:{' '}
                        {formatViewsOrUnknown(row.reward?.qualifiedViews ?? null, locale)}
                      </span>
                      <span>
                        {t('colAmount')}: <MoneyText sen={row.reward?.cappedSen ?? null} />
                      </span>
                    </span>
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/merchant/submissions/${row.submission.id}`}>
                      <span className="truncate">{t('review')}</span>
                    </Link>
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>

      {/* Claims */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('claimsTitle')}</h2>
        <p className="text-muted-foreground text-xs">{t('claimsNote')}</p>
        {claims.length === 0 ? (
          <EmptyState icon={Banknote} description={t('claimsNone')} />
        ) : (
          <ItemGroup data-testid="campaign-claims">
            {claims.map((claim) => (
              <Item
                key={claim.id}
                variant="outline"
                size="sm"
                className="items-start"
                data-claim-id={claim.id}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex flex-wrap items-center gap-2">
                    <MoneyText sen={claim.amountSen} tabular />
                    <StatusBadge group="claim" code={claim.status} />
                  </ItemTitle>
                  <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      {t('colQueue')} {formatCount(claim.seq, locale)}
                    </span>
                    <span>
                      {t('colMetering')}:{' '}
                      <StatusBadge group="metering" code={claim.meteringReview.status} />
                    </span>
                    <DateTimeText iso={claim.validAt} hideOffset />
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>

      {/* Report */}
      <Card data-testid="campaign-report">
        <CardHeader>
          <CardTitle className="text-base">{t('reportTitle')}</CardTitle>
          <CardDescription>{t('reportNote')}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label={t('reportQualifiedViews')}
              value={formatViewsOrUnknown(report.qualifiedViews, locale)}
            />
            <Stat label={t('reportSubmissions')} value={formatCount(report.submissionCount, locale)} />
            <Stat label={t('reportClaims')} value={formatCount(report.claimCount, locale)} />
            <Stat
              label={t('reportConfirmedUnpaid')}
              value={<MoneyText sen={report.confirmedUnpaidSen} tabular />}
            />
            <Stat label={t('reportPaid')} value={<MoneyText sen={report.paidSen} tabular />} />
            <Stat
              label={t('reportUnresolvedPayouts')}
              value={formatCount(report.closure?.unresolvedPayouts ?? 0, locale)}
            />
          </dl>
          <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-1 text-xs">
            <span>{t('reportLastTrusted')}</span>
            <DateTimeText iso={report.lastTrustedAt} />
          </p>
          {/* A source that cannot be read right now is its own page condition: the
              last trusted figure stays visible with its time and is never replaced
              by a zero. */}
          {report.hasUnreadableSource ? (
            <DataUnavailable
              className="mt-3"
              lastTrustedAt={report.lastTrustedAt}
              lastValue={`${formatViewsOrUnknown(report.qualifiedViews, locale)} · ${t('reportQualifiedViews')}`}
            />
          ) : null}
        </CardContent>
      </Card>

      {report.closure ? <ClosurePanel closure={report.closure} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-muted/40 flex min-w-0 flex-col gap-1 rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs break-words">{label}</dt>
      <dd className="text-sm font-medium break-words">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Closure
// ---------------------------------------------------------------------------

function ClosurePanel({ closure }: { closure: CampaignClosureView }) {
  const t = useTranslations('merchant.detail');
  const locale = useAppLocale();

  return (
    <Card data-testid="closure-panel" data-fully-settled={closure.canShowFullySettled}>
      <CardHeader>
        <CardTitle className="text-base">{t('closureTitle')}</CardTitle>
        <CardDescription>
          {closure.canShowFullySettled ? t('closureSettledNote') : t('closureNotSettledNote')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Alert
          className={closure.canShowFullySettled ? 'bg-success-subtle' : 'bg-attention-subtle'}
          data-testid="closure-verdict"
        >
          {closure.canShowFullySettled ? (
            <Banknote aria-hidden="true" className="text-success-foreground" />
          ) : (
            <CircleAlert aria-hidden="true" className="text-attention-foreground" />
          )}
          <AlertTitle>
            {closure.canShowFullySettled ? t('closureSettled') : t('closureNotSettled')}
          </AlertTitle>
          <AlertDescription>
            {closure.canShowFullySettled ? t('closureSettledNote') : t('closureNotSettledNote')}
          </AlertDescription>
        </Alert>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t('closureOpenAppeals')} value={formatCount(closure.openAppeals, locale)} />
          <Stat
            label={t('closurePendingClaims')}
            value={formatCount(closure.pendingClaims, locale)}
          />
          <Stat
            label={t('closureConfirmedUnpaid')}
            value={formatCount(closure.confirmedUnpaidClaims, locale)}
          />
          <Stat
            label={t('closureUnresolvedPayouts')}
            value={formatCount(closure.unresolvedPayouts, locale)}
          />
        </dl>

        <div className="flex flex-col gap-1" data-testid="closure-tail">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground text-xs">{t('closureTail')}</span>
            <MoneyText sen={closure.unconfirmedTailSen} tabular />
          </p>
          <p className="text-muted-foreground text-xs break-words">{t('closureTailNote')}</p>
        </div>

        <div className="flex flex-col gap-1" data-testid="closure-refund">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground text-xs">{t('closureRefund')}</span>
            <Badge
              variant="outline"
              className="bg-inactive-subtle text-inactive-foreground gap-1 border-transparent"
            >
              <Hourglass aria-hidden="true" />
              {t('closureRefundValue')}
            </Badge>
          </p>
          <p className="text-muted-foreground text-xs break-words">{t('closureRefundNote')}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function CampaignActions({
  campaign,
  onFailure,
}: {
  campaign: Campaign;
  onFailure: (failure: { code: string; detail?: string } | null) => void;
}) {
  const t = useTranslations('merchant.detail');
  const run = useMerchantCommand();

  const perform = (
    command: Command,
    successKey: 'paused' | 'resumed' | 'submissionsClosed' | 'closed',
  ) => {
    onFailure(null);
    const result = run(command);
    if (!result.ok) {
      onFailure({ code: result.code, detail: result.detail });
      toast.error(t('actionFailed'));
      return;
    }
    toast.success(t(successKey));
  };

  const canPause = campaign.status === 'published';
  const canResume = campaign.status === 'paused';
  const canCloseSubmissions = campaign.status === 'published' || campaign.status === 'paused';
  const canClose = campaign.status !== 'draft' && campaign.status !== 'closed';

  if (!canPause && !canResume && !canCloseSubmissions && !canClose) return null;

  return (
    <Card data-testid="campaign-actions">
      <CardHeader>
        <CardTitle className="text-base">{t('actionsTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canPause ? (
          <ConfirmDialog
            title={t('pause')}
            description={t('pauseDescription')}
            confirmLabel={t('pause')}
            onConfirm={() => perform({ type: 'campaign.pause', campaignId: campaign.id }, 'paused')}
            trigger={
              <Button variant="outline" data-testid="campaign-pause">
                <Pause aria-hidden="true" />
                <span className="truncate">{t('pause')}</span>
              </Button>
            }
          />
        ) : null}

        {canResume ? (
          <ConfirmDialog
            title={t('resume')}
            description={t('resumeDescription')}
            confirmLabel={t('resume')}
            onConfirm={() =>
              perform({ type: 'campaign.resume', campaignId: campaign.id }, 'resumed')
            }
            trigger={
              <Button variant="outline" data-testid="campaign-resume">
                <Play aria-hidden="true" />
                <span className="truncate">{t('resume')}</span>
              </Button>
            }
          />
        ) : null}

        {canCloseSubmissions ? (
          <ConfirmDialog
            title={t('closeSubmissions')}
            description={t('closeSubmissionsDescription')}
            confirmLabel={t('closeSubmissions')}
            requireReason
            reasonLabel={t('reasonLabel')}
            onConfirm={(reason) =>
              perform(
                { type: 'campaign.closeSubmissions', campaignId: campaign.id, reason },
                'submissionsClosed',
              )
            }
            trigger={
              <Button variant="outline" data-testid="campaign-close-submissions">
                <SquareSlash aria-hidden="true" />
                <span className="truncate">{t('closeSubmissions')}</span>
              </Button>
            }
          />
        ) : null}

        {canClose ? (
          <ConfirmDialog
            title={t('closeCampaign')}
            description={t('closeCampaignDescription')}
            confirmLabel={t('closeCampaign')}
            destructive
            requireReason
            reasonLabel={t('reasonLabel')}
            onConfirm={(reason) =>
              perform({ type: 'campaign.close', campaignId: campaign.id, reason }, 'closed')
            }
            trigger={
              <Button variant="destructive" data-testid="campaign-close">
                <SquareSlash aria-hidden="true" />
                <span className="truncate">{t('closeCampaign')}</span>
              </Button>
            }
          >
            {/* The typed reason is carried by the command and stored on the audit
                entry, so it is readable afterwards in the campaign's history. */}
            <p className="text-muted-foreground text-xs">{t('reasonStored')}</p>
          </ConfirmDialog>
        ) : null}
      </CardContent>
    </Card>
  );
}
