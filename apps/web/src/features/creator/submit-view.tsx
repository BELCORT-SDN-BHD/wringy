'use client';

/**
 * Submit a post link to one campaign.
 *
 * The rules the creator joins under are on the page, and the submission keeps
 * that rules version even if the merchant publishes a change later. Every
 * refusal from the engine is translated into the specific reason and the next
 * step (ticket #4): a shortened share link says to paste the full post URL, an
 * unusable account links to the accounts page, an already-submitted post links
 * to the entry that exists, and a post already counting in another campaign
 * explains the reuse rule.
 *
 * There is no upload control here. The creator publishes on the platform and
 * brings back the link.
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CircleAlert, Megaphone, Send, TriangleAlert } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CampaignRulesList } from '@/components/app/campaign-rules-list';
import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isAfter } from '@/domain';
import { errorCopyKey } from '@/lib/error-copy';
import { newCommandId } from '@/store/command-id';
import { useDemoSnapshot, useDispatch } from '@/store/demo-store';
import { selectCampaign } from '@/store/selectors';
import type { AccountConnection } from '@/domain/types';

import { DetailList, DetailRow, PageHeader, useConnectionCopy } from './creator-ui';
import { useCreatorConnections } from './use-creator-data';

export function CreatorSubmitView() {
  return (
    <HydrationGate>
      <Submit />
    </HydrationGate>
  );
}

interface SubmitError {
  code: string;
  detail?: string;
}

function Submit() {
  const t = useTranslations('creator.submit');
  const tAccounts = useTranslations('creator.accounts');
  const tCampaign = useTranslations('public.campaign');
  const state = useDemoSnapshot();
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const connections = useCreatorConnections();
  const { platformName, invalidReason } = useConnectionCopy();
  const tErrors = useTranslations('common.errors');

  const campaignId = searchParams.get('campaign') ?? '';
  const campaign = useMemo(
    () => (campaignId === '' ? null : selectCampaign(state, campaignId)),
    [state, campaignId],
  );

  const options = useMemo(() => {
    if (!campaign) return [];
    return connections.map((connection) => {
      const platformAllowed = campaign.rules.platforms.includes(connection.platform);
      const usable = platformAllowed && connection.status === 'valid';
      return { connection, platformAllowed, usable };
    });
  }, [campaign, connections]);

  const firstUsable = options.find((option) => option.usable)?.connection.id ?? '';
  const [connectionId, setConnectionId] = useState('');
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);
  // One id per user intent: the same campaign, account and link pressed again
  // replays the same command instead of creating a second submission.
  const intent = useRef<{ signature: string; commandId: string } | null>(null);

  const selected = connectionId === '' ? firstUsable : connectionId;
  const missingUrl = url.trim() === '';

  if (campaignId === '' || !campaign) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyState
          icon={Megaphone}
          title={t('noCampaignTitle')}
          description={t('noCampaignDescription')}
        >
          <Button asChild>
            <Link href="/campaigns">
              {tCampaign('backToCatalogue')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const campaignOpen =
    campaign.status === 'published' &&
    campaign.submissionsCloseAt !== null &&
    isAfter(campaign.submissionsCloseAt, state.clock.nowIso);

  const submit = () => {
    if (missingUrl) {
      setTouched(true);
      return;
    }
    const signature = `${campaign.id}|${selected}|${url.trim()}`;
    if (intent.current?.signature !== signature) {
      intent.current = { signature, commandId: newCommandId() };
    }
    const before = new Set(Object.keys(state.submissions));
    const result = dispatch(
      { type: 'submission.create', campaignId: campaign.id, connectionId: selected, url },
      intent.current.commandId,
    );
    if (!result.ok) {
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);
    const created = Object.values(result.state.submissions).find(
      (submission) => !before.has(submission.id),
    );
    if (!created) {
      // An idempotent replay of the same press: go to the entry it created.
      const existing = Object.values(result.state.submissions).find(
        (submission) => submission.url === url.trim() && submission.campaignId === campaign.id,
      );
      if (existing) router.push(`/creator/submissions/${existing.id}`);
      return;
    }
    toast.success(
      created.status === 'baseline_unavailable' ? t('pendingBaselineToast') : t('acceptedToast'),
    );
    router.push(`/creator/submissions/${created.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={
          <>
            <Badge variant="outline" className="max-w-full">
              <span className="truncate">{campaign.title}</span>
            </Badge>
            <Badge variant="outline">{t('rulesVersion', { version: campaign.rulesVersion })}</Badge>
          </>
        }
      />

      {campaignOpen ? null : (
        <Alert variant="destructive" data-testid="campaign-not-open">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t('campaignClosedTitle')}</AlertTitle>
          <AlertDescription>{t('campaignClosedDescription')}</AlertDescription>
        </Alert>
      )}

      {options.some((option) => option.usable) ? null : (
        <Alert
          className="bg-attention-subtle text-attention-foreground"
          data-testid="no-usable-connection"
        >
          <TriangleAlert aria-hidden="true" className="text-attention-foreground" />
          <AlertTitle>{t('noConnectionTitle')}</AlertTitle>
          <AlertDescription className="text-attention-foreground">
            {t('noConnectionDescription')}
          </AlertDescription>
          <AlertAction>
            <Button asChild variant="outline" size="sm" data-testid="open-accounts">
              <Link href="/creator/accounts">{t('openAccounts')}</Link>
            </Button>
          </AlertAction>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('urlLabel')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="submit-connection">{t('connectionLabel')}</FieldLabel>
            <Select value={selected} onValueChange={setConnectionId}>
              <SelectTrigger id="submit-connection" data-testid="submit-connection">
                <SelectValue placeholder={t('connectionPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {options.map(({ connection, platformAllowed, usable }) => (
                  <SelectItem
                    key={connection.id}
                    value={connection.id}
                    disabled={!usable}
                    data-connection-id={connection.id}
                  >
                    {connectionOptionLabel(
                      connection,
                      platformName(connection.platform),
                      usable
                        ? null
                        : platformAllowed
                          ? t('connectionInvalidSuffix')
                          : tErrors('unsupported_platform'),
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {options
              .filter(({ usable, connection }) => !usable && connection.status !== 'valid')
              .map(({ connection }) => (
                <FieldDescription key={connection.id} data-testid="connection-option-reason">
                  {platformName(connection.platform)} {connection.handle} —{' '}
                  {invalidReason(connection)} {tAccounts('nextStepInvalid')}{' '}
                  <Link
                    href="/creator/accounts"
                    className="underline underline-offset-2"
                    data-testid="connection-reason-accounts"
                  >
                    {t('openAccounts')}
                  </Link>
                </FieldDescription>
              ))}
          </Field>

          <Field data-invalid={touched && missingUrl ? true : undefined}>
            <FieldLabel htmlFor="submit-url">{t('urlLabel')}</FieldLabel>
            <Input
              id="submit-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={t('urlPlaceholder')}
              aria-invalid={touched && missingUrl ? true : undefined}
              data-testid="submit-url"
              autoComplete="off"
              inputMode="url"
            />
            <FieldDescription>{t('urlHint')}</FieldDescription>
            {touched && missingUrl ? <FieldError>{t('urlRequired')}</FieldError> : null}
          </Field>

          {error ? <SubmitErrorAlert error={error} /> : null}

          <div className="flex flex-col gap-2">
            <Button
              onClick={submit}
              disabled={!campaignOpen || selected === '' || missingUrl}
              data-testid="submit-link"
              className="w-full sm:w-fit"
            >
              <Send aria-hidden="true" />
              {t('submitAction')}
            </Button>
            <p className="text-muted-foreground text-xs">{t('publishFirst')}</p>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('rulesTitle')}</h2>
        <CampaignRulesList campaign={campaign} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('calendarTitle')}</h2>
        <DetailList>
          <DetailRow label={tCampaign('submissionsClose')}>
            <DateTimeText iso={campaign.submissionsCloseAt} />
          </DetailRow>
          <DetailRow label={tCampaign('metering')}>
            {tCampaign('meteringValue', { days: campaign.rules.meteringDays })}
          </DetailRow>
          <DetailRow label={tCampaign('grace')}>
            {tCampaign('graceValue', { days: campaign.rules.claimGraceDays })}
          </DetailRow>
          <DetailRow label={tCampaign('retention')}>
            {tCampaign('retentionValue', { days: campaign.rules.retentionDays })}
          </DetailRow>
        </DetailList>
        <TimeZoneHint />
      </section>
    </div>
  );
}

function connectionOptionLabel(
  connection: AccountConnection,
  platform: string,
  suffix: string | null,
): string {
  const base = `${platform} ${connection.handle}`;
  return suffix === null ? base : `${base} · ${suffix}`;
}

/**
 * One refusal, in the creator's own terms, with the action that resolves it.
 * The stable engine code stays on the element so a test asserts the mapping
 * rather than the sentence.
 */
function SubmitErrorAlert({ error }: { error: SubmitError }) {
  const t = useTranslations('creator.submit');
  const tErrors = useTranslations('common.errors');

  const message = (): string => {
    if (error.code === 'invalid_input') {
      if (error.detail === 'short_link_unresolvable') return t('errorShortLink');
      if (error.detail === 'unsupported_url') return t('errorUnsupportedUrl');
      if (error.detail === 'malformed_url') return t('errorMalformedUrl');
      if (error.detail === 'platform_mismatch') return t('errorPlatformMismatch');
      return tErrors('invalid_input');
    }
    if (error.code === 'connection_invalid') return t('errorConnectionInvalid');
    if (error.code === 'duplicate_post') return t('errorDuplicate');
    if (error.code === 'cross_campaign_blocked') return t('errorCrossCampaign');
    if (error.code === 'campaign_not_open') return t('errorCampaignNotOpen');
    return tErrors(errorCopyKey(error.code));
  };

  const action = (): { href: string; label: string } | null => {
    if (error.code === 'connection_invalid') {
      return { href: '/creator/accounts', label: t('openAccounts') };
    }
    if (error.code === 'duplicate_post' && error.detail) {
      return { href: `/creator/submissions/${error.detail}`, label: t('openExisting') };
    }
    return null;
  };

  const link = action();

  return (
    <Alert variant="destructive" data-testid="submit-error" data-error-code={error.code}>
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{t('errorTitle')}</AlertTitle>
      <AlertDescription>{message()}</AlertDescription>
      {link ? (
        <AlertAction>
          <Button asChild variant="outline" size="sm" data-testid="submit-error-action">
            <Link href={link.href}>{link.label}</Link>
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  );
}
