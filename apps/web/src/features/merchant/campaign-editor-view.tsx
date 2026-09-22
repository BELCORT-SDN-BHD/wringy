'use client';

/**
 * The campaign editor.
 *
 * Only a draft is editable: `campaign.updateDraft` refuses anything else because a
 * submission keeps the rule version it joined under, so a published campaign is
 * shown here as a read-only rule sheet with a notice. The read-only form is a
 * definition list rather than a page of disabled controls, because state-policy.md
 * only allows native `readOnly` where the control supports it and requires
 * "已标注的只读文本" for a Checkbox or Switch instead of a faked attribute.
 *
 * Money is typed in ringgit and stored in sen: `validateCampaignForm` does the
 * conversion with integer arithmetic, and the same function decides whether Save
 * dispatches, which error each `FieldError` shows, and whether the readiness check
 * calls the configuration invalid.
 *
 * The form holds its own state, so switching language re-renders the labels around
 * whatever has been typed (`AppProviders` swaps the catalogue in place instead of
 * navigating) and nothing is lost.
 */

import Link from 'next/link';
import { CircleAlert, Info, PencilLine, TriangleAlert } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ReactNode } from 'react';

import { CampaignRulesList } from '@/components/app/campaign-rules-list';
import { EmptyState } from '@/components/app/empty-state';
import { CommandErrorAlert } from '@/components/app/error-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { ServiceFeeText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_RULES } from '@/domain';
import { formatSen, formatViews } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useDemoState } from '@/store/demo-store';
import type { Campaign, ContentLanguage, Platform } from '@/domain/types';

import { CampaignCalendar } from './campaign-calendar';
import { useMerchantCommand, useOwnCampaign } from './hooks';
import {
  LANGUAGE_OPTIONS,
  PLATFORM_OPTIONS,
  capExplanation,
  formFromCampaign,
  isSameForm,
  toggleOption,
  validateCampaignForm,
  type CampaignFormErrorKey,
  type CampaignFormField,
  type CampaignFormValues,
} from './campaign-form';

const PLATFORM_KEY: Record<Platform, string> = {
  tiktok: 'platformTikTok',
  instagram: 'platformInstagram',
  youtube: 'platformYouTube',
};

const LANGUAGE_KEY: Record<ContentLanguage, string> = {
  en: 'languageEn',
  ms: 'languageMs',
  zh: 'languageZh',
};

export function MerchantCampaignEditorView({ campaignId }: { campaignId: string }) {
  return (
    <HydrationGate>
      <Editor campaignId={campaignId} />
    </HydrationGate>
  );
}

function Editor({ campaignId }: { campaignId: string }) {
  const t = useTranslations('merchant.campaigns');
  const campaign = useOwnCampaign(campaignId);

  if (!campaign) {
    return (
      <EmptyState title={t('notFoundTitle')} description={t('notFoundDescription')}>
        <Button asChild variant="outline">
          <Link href="/merchant/campaigns">{t('back')}</Link>
        </Button>
      </EmptyState>
    );
  }

  if (campaign.status !== 'draft') return <ReadOnlyConfiguration campaign={campaign} />;
  // Keyed on the id so navigating between two drafts starts from the right values.
  return <DraftForm key={campaign.id} campaign={campaign} />;
}

// ---------------------------------------------------------------------------
// Draft form
// ---------------------------------------------------------------------------

function DraftForm({ campaign }: { campaign: Campaign }) {
  const t = useTranslations('merchant.editor');
  const tCampaigns = useTranslations('merchant.campaigns');
  const tMoney = useTranslations('common.money');
  const tPublic = useTranslations('public.campaign');
  const locale = useAppLocale();
  const run = useMerchantCommand();
  const ids = useId();

  const saved = useMemo(() => formFromCampaign(campaign), [campaign]);
  const [values, setValues] = useState<CampaignFormValues>(saved);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<{ code: string; detail?: string } | null>(null);

  const { errors, patch } = useMemo(() => validateCampaignForm(values), [values]);
  const explanation = useMemo(() => capExplanation(values), [values]);
  const dirty = !isSameForm(values, saved);

  const set = <K extends CampaignFormField>(field: K, value: CampaignFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  /**
   * Errors appear when Save is pressed, and from then on they follow every
   * keystroke so a correction is visible immediately.
   *
   * Deliberately NOT on blur. An error that appears when a field loses focus
   * inserts a line into the form at the moment of the click that caused the blur,
   * which pushes the primary action out from under the pointer — the press lands
   * on whatever moved into its place. That is a real failure at 390px, not a test
   * artefact, and reserving blank space under every field instead would be worse.
   */
  const errorFor = (field: CampaignFormField): CampaignFormErrorKey | null =>
    submitted ? (errors[field] ?? null) : null;

  const save = () => {
    setSubmitted(true);
    setFailure(null);
    if (!patch) {
      toast.error(t('errorSummary'));
      return;
    }
    const result = run({ type: 'campaign.updateDraft', campaignId: campaign.id, patch });
    if (!result.ok) {
      setFailure({ code: result.code, detail: result.detail });
      toast.error(t('saveFailed'));
      return;
    }
    setSubmitted(false);
    toast.success(t('saved'));
  };

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge group="campaign" code={campaign.status} />
          {dirty ? (
            <Badge
              className="bg-attention-subtle text-attention-foreground gap-1 border-transparent"
              data-testid="editor-dirty"
            >
              <PencilLine aria-hidden="true" />
              {t('unsaved')}
            </Badge>
          ) : null}
        </div>
        <h1 className="font-heading text-2xl font-semibold break-words">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        <p className="text-muted-foreground text-xs">{t('keyboardHint')}</p>
      </header>

      <Alert data-testid="editor-defaults">
        <Info aria-hidden="true" />
        <AlertTitle>{t('defaultsTitle')}</AlertTitle>
        <AlertDescription>
          {t('defaultsDescription', {
            pool: formatSen(DEFAULT_RULES.poolSen, locale),
            rate: tMoney('perThousand', {
              amount: formatSen(DEFAULT_RULES.ratePerThousandSen, locale),
            }),
            min: formatSen(DEFAULT_RULES.minClaimSen, locale),
            cap: formatSen(DEFAULT_RULES.capPerSubmissionSen, locale),
            submissionDays: DEFAULT_RULES.submissionWindowDays,
            meteringDays: DEFAULT_RULES.meteringDays,
            graceDays: DEFAULT_RULES.claimGraceDays,
            retentionDays: DEFAULT_RULES.retentionDays,
          })}
        </AlertDescription>
      </Alert>

      {failure ? <CommandErrorAlert code={failure.code} detail={failure.detail} /> : null}
      {submitted && !patch ? (
        <Alert variant="destructive" data-testid="editor-error-summary">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{t('errorSummary')}</AlertTitle>
          <AlertDescription>{t('errorSummary')}</AlertDescription>
        </Alert>
      ) : null}

      {/* Campaign and audience */}
      <FieldSet>
        <FieldLegend>{t('sectionBasics')}</FieldLegend>
        <FieldGroup>
          <TextField
            id={`${ids}-title`}
            testId="field-title"
            label={t('fieldTitle')}
            hint={t('fieldTitleHint')}
            value={values.title}
            error={errorFor('title')}
            onChange={(next) => set('title', next)}
          />

          <Field data-invalid={errorFor('brief') ? true : undefined}>
            <FieldLabel htmlFor={`${ids}-brief`}>{t('fieldBrief')}</FieldLabel>
            <Textarea
              id={`${ids}-brief`}
              data-testid="field-brief"
              value={values.brief}
              rows={4}
              onChange={(event) => set('brief', event.target.value)}
            />
            <FieldDescription>{t('fieldBriefHint')}</FieldDescription>
          </Field>

          <Field data-invalid={errorFor('platforms') ? true : undefined}>
            {/* A group of checkboxes has no single control to label, so the
                official `FieldTitle` carries the heading and the group's own
                `aria-label` carries the accessible name. */}
            <FieldTitle>{t('fieldPlatforms')}</FieldTitle>
            <div className="flex flex-wrap gap-4" role="group" aria-label={t('fieldPlatforms')}>
              {PLATFORM_OPTIONS.map((platform) => (
                <FieldLabel
                  key={platform}
                  htmlFor={`${ids}-platform-${platform}`}
                  className="items-center gap-2"
                >
                  <Checkbox
                    id={`${ids}-platform-${platform}`}
                    data-testid={`field-platform-${platform}`}
                    checked={values.platforms.includes(platform)}
                    aria-invalid={errorFor('platforms') ? true : undefined}
                    onCheckedChange={() => {
                      set('platforms', toggleOption(values.platforms, platform, PLATFORM_OPTIONS));
                    }}
                  />
                  <span>{tPublic(PLATFORM_KEY[platform])}</span>
                </FieldLabel>
              ))}
            </div>
            <FieldDescription>{t('fieldPlatformsHint')}</FieldDescription>
            {errorFor('platforms') ? <FieldError>{t(errorFor('platforms')!)}</FieldError> : null}
          </Field>

          <Field data-invalid={errorFor('contentLanguages') ? true : undefined}>
            <FieldTitle>{t('fieldLanguages')}</FieldTitle>
            <div className="flex flex-wrap gap-4" role="group" aria-label={t('fieldLanguages')}>
              {LANGUAGE_OPTIONS.map((language) => (
                <FieldLabel
                  key={language}
                  htmlFor={`${ids}-language-${language}`}
                  className="items-center gap-2"
                >
                  <Checkbox
                    id={`${ids}-language-${language}`}
                    data-testid={`field-language-${language}`}
                    checked={values.contentLanguages.includes(language)}
                    aria-invalid={errorFor('contentLanguages') ? true : undefined}
                    onCheckedChange={() => {
                      set(
                        'contentLanguages',
                        toggleOption(values.contentLanguages, language, LANGUAGE_OPTIONS),
                      );
                    }}
                  />
                  <span>{tPublic(LANGUAGE_KEY[language])}</span>
                </FieldLabel>
              ))}
            </div>
            <FieldDescription>{t('fieldLanguagesHint')}</FieldDescription>
            {errorFor('contentLanguages') ? (
              <FieldError>{t(errorFor('contentLanguages')!)}</FieldError>
            ) : null}
          </Field>

          <ReadOnlyRow label={t('fieldRegion')} hint={t('fieldRegionHint')}>
            <span data-testid="field-region">{t('fieldRegionValue')}</span>
          </ReadOnlyRow>
        </FieldGroup>
      </FieldSet>

      {/* Reward, budget and thresholds */}
      <FieldSet>
        <FieldLegend>{t('sectionRewards')}</FieldLegend>
        <FieldGroup>
          <MoneyField
            id={`${ids}-pool`}
            testId="field-pool"
            label={t('fieldPool')}
            hint={t('fieldPoolHint')}
            unit={t('unitRm')}
            value={values.pool}
            error={errorFor('pool')}
            onChange={(next) => set('pool', next)}
          />
          <MoneyField
            id={`${ids}-rate`}
            testId="field-rate"
            label={t('fieldRate')}
            hint={t('fieldRateHint')}
            unit={t('unitRm')}
            value={values.ratePerThousand}
            error={errorFor('ratePerThousand')}
            onChange={(next) => set('ratePerThousand', next)}
          />
          <MoneyField
            id={`${ids}-min`}
            testId="field-min-claim"
            label={t('fieldMinClaim')}
            hint={t('fieldMinClaimHint')}
            unit={t('unitRm')}
            value={values.minClaim}
            error={errorFor('minClaim')}
            onChange={(next) => set('minClaim', next)}
          />
          <MoneyField
            id={`${ids}-cap`}
            testId="field-cap"
            label={t('fieldCap')}
            hint={t('fieldCapHint')}
            unit={t('unitRm')}
            value={values.capPerSubmission}
            error={errorFor('capPerSubmission')}
            onChange={(next) => set('capPerSubmission', next)}
          />
          <CountField
            id={`${ids}-threshold`}
            testId="field-threshold"
            label={t('fieldThreshold')}
            hint={t('fieldThresholdHint')}
            unit={t('unitViews')}
            value={values.viewThreshold}
            error={errorFor('viewThreshold')}
            onChange={(next) => set('viewThreshold', next)}
          />

          {explanation ? (
            <Alert
              className="bg-attention-subtle"
              data-testid="cap-explanation"
              data-app-state="cap-explained"
            >
              <TriangleAlert aria-hidden="true" className="text-attention-foreground" />
              <AlertTitle>{t('capExplainTitle')}</AlertTitle>
              <AlertDescription>
                <span>
                  {t('capExplain', {
                    views: formatViews(explanation.views, locale),
                    amount: formatSen(explanation.cappedSen, locale),
                  })}
                </span>
                <span>{t('capExplainNote')}</span>
              </AlertDescription>
            </Alert>
          ) : null}

          <ReadOnlyRow label={tMoney('serviceFee')}>
            <span data-testid="field-service-fee">
              <ServiceFeeText />
            </span>
          </ReadOnlyRow>
        </FieldGroup>
      </FieldSet>

      {/* Calendar */}
      <FieldSet>
        <FieldLegend>{t('sectionCalendar')}</FieldLegend>
        <FieldGroup>
          <CountField
            id={`${ids}-submission-window`}
            testId="field-submission-window"
            label={t('fieldSubmissionWindow')}
            hint={t('fieldSubmissionWindowHint')}
            unit={t('unitDays')}
            value={values.submissionWindowDays}
            error={errorFor('submissionWindowDays')}
            onChange={(next) => set('submissionWindowDays', next)}
          />
          <CountField
            id={`${ids}-metering`}
            testId="field-metering-days"
            label={t('fieldMetering')}
            hint={t('fieldMeteringHint')}
            unit={t('unitDays')}
            value={values.meteringDays}
            error={errorFor('meteringDays')}
            onChange={(next) => set('meteringDays', next)}
          />
          <CountField
            id={`${ids}-grace`}
            testId="field-grace-days"
            label={t('fieldGrace')}
            hint={t('fieldGraceHint')}
            unit={t('unitDays')}
            value={values.claimGraceDays}
            error={errorFor('claimGraceDays')}
            onChange={(next) => set('claimGraceDays', next)}
          />
          <CountField
            id={`${ids}-retention`}
            testId="field-retention-days"
            label={t('fieldRetention')}
            hint={t('fieldRetentionHint')}
            unit={t('unitDays')}
            value={values.retentionDays}
            error={errorFor('retentionDays')}
            onChange={(next) => set('retentionDays', next)}
          />
        </FieldGroup>
      </FieldSet>

      {/* Controls */}
      <FieldSet>
        <FieldLegend>{t('sectionControls')}</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel htmlFor={`${ids}-cross-platform`}>{t('fieldCrossPlatform')}</FieldLabel>
            <Switch
              id={`${ids}-cross-platform`}
              data-testid="field-cross-platform"
              checked={values.crossPlatformIndependentCap}
              onCheckedChange={(checked) => set('crossPlatformIndependentCap', checked === true)}
            />
          </Field>
          <FieldDescription>{t('fieldCrossPlatformHint')}</FieldDescription>
          <FieldDescription data-testid="cross-platform-rule">
            {t('fieldCrossPlatformRule')}
          </FieldDescription>
          {/*
            The switch records the merchant's declared permission, which is what
            D06 keeps ("同活动跨平台独立封顶仍按已批准商家许可执行"). It changes no amount
            in M1: a Submission is identified by (campaign, platform, post id) and
            carries no content identity, so the prototype cannot tell one video
            re-posted on two platforms from two different videos. Saying so beats
            letting the rule sentence promise grouping the engine cannot express.
          */}
          <FieldDescription data-testid="cross-platform-not-simulated">
            {t('fieldCrossPlatformNotSimulated')}
          </FieldDescription>
        </FieldGroup>
      </FieldSet>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" data-testid="editor-save">
          {t('save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!dirty}
          data-testid="editor-discard"
          onClick={() => {
            setValues(saved);
            setSubmitted(false);
            setFailure(null);
            toast.success(t('discarded'));
          }}
        >
          {t('discard')}
        </Button>
        <Button asChild type="button" variant="ghost" data-testid="editor-preview-link">
          <Link href={`/merchant/campaigns/${campaign.id}/preview`}>{t('goPreview')}</Link>
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href={`/merchant/campaigns/${campaign.id}`}>{tCampaigns('open')}</Link>
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Field shapes
// ---------------------------------------------------------------------------

interface FieldShellProps {
  id: string;
  testId: string;
  label: string;
  hint?: string;
  value: string;
  error: CampaignFormErrorKey | null;
  onChange: (next: string) => void;
}

function TextField({ id, testId, label, hint, value, error, onChange }: FieldShellProps) {
  const t = useTranslations('merchant.editor');
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        data-testid={testId}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      {error ? <FieldError>{t(error)}</FieldError> : null}
    </Field>
  );
}

function UnitField({
  id,
  testId,
  label,
  hint,
  unit,
  unitAtEnd,
  inputMode,
  value,
  error,
  onChange,
}: FieldShellProps & {
  unit: string;
  unitAtEnd?: boolean;
  inputMode: 'decimal' | 'numeric';
}) {
  const t = useTranslations('merchant.editor');
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupAddon align={unitAtEnd ? 'inline-end' : 'inline-start'}>{unit}</InputGroupAddon>
        <InputGroupInput
          id={id}
          data-testid={testId}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          />
      </InputGroup>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      {error ? <FieldError>{t(error)}</FieldError> : null}
    </Field>
  );
}

function MoneyField(props: FieldShellProps & { unit: string }) {
  return <UnitField {...props} inputMode="decimal" />;
}

function CountField(props: FieldShellProps & { unit: string }) {
  return <UnitField {...props} inputMode="numeric" unitAtEnd />;
}

function ReadOnlyRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Field>
      <FieldTitle>{label}</FieldTitle>
      <p className="text-inactive-foreground text-sm break-words">{children}</p>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Published: read-only
// ---------------------------------------------------------------------------

function ReadOnlyConfiguration({ campaign }: { campaign: Campaign }) {
  const t = useTranslations('merchant.editor');
  const tCampaigns = useTranslations('merchant.campaigns');
  const tPublic = useTranslations('public.campaign');
  const nowIso = useDemoState((state) => state.clock.nowIso);

  return (
    <div className="flex flex-col gap-6" data-testid="editor-read-only">
      <header className="flex flex-col gap-2">
        <StatusBadge group="campaign" code={campaign.status} />
        <h1 className="font-heading text-2xl font-semibold break-words">{campaign.title}</h1>
      </header>

      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>{t('readOnlyTitle')}</AlertTitle>
        <AlertDescription>{t('readOnlyDescription')}</AlertDescription>
      </Alert>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{tPublic('rules')}</h2>
        <CampaignRulesList campaign={campaign} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">{t('sectionControls')}</h2>
        <dl className="flex flex-col">
          <ReadOnlyDefinition label={tPublic('brief')} value={campaign.brief} />
          <ReadOnlyDefinition
            label={t('fieldSubmissionWindow')}
            value={`${campaign.rules.submissionWindowDays} ${t('unitDays')}`}
          />
          <ReadOnlyDefinition
            label={t('fieldCrossPlatform')}
            value={campaign.rules.crossPlatformIndependentCap ? t('valueOn') : t('valueOff')}
            hint={`${t('fieldCrossPlatformRule')} ${t('fieldCrossPlatformNotSimulated')}`}
          />
          <ReadOnlyDefinition
            label={t('fieldRegion')}
            value={t('fieldRegionValue')}
            hint={t('fieldRegionHint')}
          />
        </dl>
      </section>

      <CampaignCalendar campaign={campaign} nowIso={nowIso} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline">
          <Link href={`/merchant/campaigns/${campaign.id}`}>{tCampaigns('open')}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/campaigns/${campaign.id}`}>{tCampaigns('publicPage')}</Link>
        </Button>
      </div>
    </div>
  );
}

function ReadOnlyDefinition({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-muted-foreground w-full shrink-0 text-xs sm:w-56">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm break-words">{value}</span>
        {hint ? <span className="text-muted-foreground text-xs break-words">{hint}</span> : null}
      </dd>
    </div>
  );
}
