/**
 * The merchant editor's form model.
 *
 * Pure TypeScript, no React: the editor holds these values as strings because a
 * half-typed amount is not a number, and the engine only ever receives whole sen
 * and whole days. Keeping the conversion and the validation here means the same
 * ladder decides what the Save button does, what `FieldError` says and what the
 * readiness check reports as "the configuration has errors" — the page and the
 * engine cannot disagree about whether a draft is publishable.
 *
 * Rule sources (not redefined here):
 *   phase-0/foundation/campaign-defaults-v1.md — the approved defaults, and
 *     "单条上限不能低于最低申请金额" (a minimum above the cap can never be met),
 *     plus "达10万观看，奖励封顶RM100" (a high threshold with a low cap is a legal
 *     configuration that must be explained, not refused).
 *   phase-0/foundation/campaign-configuration-v1.md — which fields a merchant sets.
 * The engine re-validates every value in `validateRulesPatch`; this module exists
 * so the person sees the refusal on the field instead of after the command.
 */

import { DEFAULT_RULES } from '@/domain';
import { capAtThreshold, type CapAtThreshold } from '@/domain/money';
import type {
  Campaign,
  CampaignRules,
  ContentLanguage,
  Platform,
  Sen,
} from '@/domain/types';

export const PLATFORM_OPTIONS: readonly Platform[] = ['tiktok', 'instagram', 'youtube'];
export const LANGUAGE_OPTIONS: readonly ContentLanguage[] = ['en', 'ms', 'zh'];

/** Every editable value, exactly as it sits in the inputs. */
export interface CampaignFormValues {
  title: string;
  brief: string;
  platforms: Platform[];
  contentLanguages: ContentLanguage[];
  /** Ringgit with up to two decimals, e.g. "2000.00". */
  pool: string;
  ratePerThousand: string;
  minClaim: string;
  capPerSubmission: string;
  /** Whole qualified views, or "" for no extra threshold. */
  viewThreshold: string;
  submissionWindowDays: string;
  meteringDays: string;
  claimGraceDays: string;
  retentionDays: string;
  crossPlatformIndependentCap: boolean;
}

export type CampaignFormField = keyof CampaignFormValues;

/**
 * Message keys under the `merchant.editor` namespace. The form never carries a
 * sentence, so a language switch re-renders the same error in the new language.
 */
export type CampaignFormErrorKey =
  | 'errorTitleRequired'
  | 'errorMoney'
  | 'errorMoneyPositive'
  | 'errorDays'
  | 'errorThreshold'
  | 'errorMinAboveCap'
  | 'errorPlatforms'
  | 'errorLanguages';

export type CampaignFormErrors = Partial<Record<CampaignFormField, CampaignFormErrorKey>>;

// ---------------------------------------------------------------------------
// Money in ringgit, state in sen
// ---------------------------------------------------------------------------

/** Integer sen to the editable ringgit string, always with two decimals. */
export function senToRinggitInput(sen: Sen): string {
  const negative = sen < 0;
  const absolute = Math.abs(Math.trunc(sen));
  const whole = Math.floor(absolute / 100);
  const fraction = absolute % 100;
  return `${negative ? '-' : ''}${whole}.${String(fraction).padStart(2, '0')}`;
}

const RINGGIT = /^(\d{1,12})(?:\.(\d{1,2}))?$/;

/**
 * Ringgit text to integer sen. Digit arithmetic, never `parseFloat`: 0.1 + 0.2
 * has no place anywhere near a reward pool. Thousands separators and spaces are
 * accepted because people paste them; anything else is refused.
 */
export function ringgitToSen(input: string): { ok: true; sen: Sen } | { ok: false } {
  const cleaned = input.replace(/[\s,_]/g, '');
  const match = RINGGIT.exec(cleaned);
  if (!match) return { ok: false };
  const whole = Number.parseInt(match[1], 10);
  const fraction = Number.parseInt((match[2] ?? '').padEnd(2, '0') || '0', 10);
  return { ok: true, sen: whole * 100 + fraction };
}

const WHOLE_NUMBER = /^\d{1,12}$/;

export function parseWholeNumber(input: string): { ok: true; value: number } | { ok: false } {
  const cleaned = input.replace(/[\s,_]/g, '');
  if (!WHOLE_NUMBER.test(cleaned)) return { ok: false };
  return { ok: true, value: Number.parseInt(cleaned, 10) };
}

// ---------------------------------------------------------------------------
// Campaign ⇄ form
// ---------------------------------------------------------------------------

export function formFromRules(title: string, brief: string, rules: CampaignRules): CampaignFormValues {
  return {
    title,
    brief,
    platforms: [...rules.platforms],
    contentLanguages: [...rules.contentLanguages],
    pool: senToRinggitInput(rules.poolSen),
    ratePerThousand: senToRinggitInput(rules.ratePerThousandSen),
    minClaim: senToRinggitInput(rules.minClaimSen),
    capPerSubmission: senToRinggitInput(rules.capPerSubmissionSen),
    viewThreshold: rules.viewThreshold === null ? '' : String(rules.viewThreshold),
    submissionWindowDays: String(rules.submissionWindowDays),
    meteringDays: String(rules.meteringDays),
    claimGraceDays: String(rules.claimGraceDays),
    retentionDays: String(rules.retentionDays),
    crossPlatformIndependentCap: rules.crossPlatformIndependentCap,
  };
}

export function formFromCampaign(campaign: Campaign): CampaignFormValues {
  return formFromRules(campaign.title, campaign.brief, campaign.rules);
}

/** The values a brand-new draft shows before anything is typed. */
export function defaultFormValues(title: string, brief: string): CampaignFormValues {
  return formFromRules(title, brief, DEFAULT_RULES);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface CampaignFormResult {
  errors: CampaignFormErrors;
  /** Present only when every field parses; this is what `campaign.updateDraft` gets. */
  patch: { title: string; brief: string; rules: CampaignRules } | null;
}

const MONEY_FIELDS = [
  ['pool', 'poolSen'],
  ['ratePerThousand', 'ratePerThousandSen'],
  ['minClaim', 'minClaimSen'],
  ['capPerSubmission', 'capPerSubmissionSen'],
] as const;

const DAY_FIELDS = [
  ['submissionWindowDays', 'submissionWindowDays'],
  ['meteringDays', 'meteringDays'],
  ['claimGraceDays', 'claimGraceDays'],
  ['retentionDays', 'retentionDays'],
] as const;

/**
 * Parses and checks the whole form at once.
 *
 * Field-shape failures win over the cross-field rule: an unreadable cap cannot be
 * compared with a minimum. `minClaim > cap` is reported on both fields, because
 * either one is the thing the merchant may want to change.
 *
 * The pool is allowed to be zero-or-more by the engine's `validateRulesPatch` but
 * `campaign.publish` refuses a pool or rate of zero, so both are required to be
 * positive here — the editor must not build a draft the readiness check will
 * reject for a reason it never showed.
 */
export function validateCampaignForm(values: CampaignFormValues): CampaignFormResult {
  const errors: CampaignFormErrors = {};

  if (values.title.trim() === '') errors.title = 'errorTitleRequired';
  if (values.platforms.length === 0) errors.platforms = 'errorPlatforms';
  if (values.contentLanguages.length === 0) errors.contentLanguages = 'errorLanguages';

  const money: Partial<Record<(typeof MONEY_FIELDS)[number][1], Sen>> = {};
  for (const [field, ruleKey] of MONEY_FIELDS) {
    const parsed = ringgitToSen(values[field]);
    if (!parsed.ok) {
      errors[field] = 'errorMoney';
      continue;
    }
    // A minimum claim of zero would mean "any amount"; the approved rule is a
    // real floor, so zero is refused on every money field alike.
    if (parsed.sen <= 0) {
      errors[field] = 'errorMoneyPositive';
      continue;
    }
    money[ruleKey] = parsed.sen;
  }

  const days: Partial<Record<(typeof DAY_FIELDS)[number][1], number>> = {};
  for (const [field, ruleKey] of DAY_FIELDS) {
    const parsed = parseWholeNumber(values[field]);
    if (!parsed.ok || parsed.value <= 0) {
      errors[field] = 'errorDays';
      continue;
    }
    days[ruleKey] = parsed.value;
  }

  let viewThreshold: number | null = null;
  if (values.viewThreshold.trim() !== '') {
    const parsed = parseWholeNumber(values.viewThreshold);
    if (!parsed.ok || parsed.value <= 0) {
      errors.viewThreshold = 'errorThreshold';
    } else {
      viewThreshold = parsed.value;
    }
  }

  const minClaimSen = money.minClaimSen;
  const capSen = money.capPerSubmissionSen;
  if (minClaimSen !== undefined && capSen !== undefined && minClaimSen > capSen) {
    errors.minClaim = 'errorMinAboveCap';
    errors.capPerSubmission = 'errorMinAboveCap';
  }

  if (Object.keys(errors).length > 0) return { errors, patch: null };

  return {
    errors,
    patch: {
      title: values.title.trim(),
      brief: values.brief,
      rules: {
        poolSen: money.poolSen as Sen,
        ratePerThousandSen: money.ratePerThousandSen as Sen,
        minClaimSen: minClaimSen as Sen,
        capPerSubmissionSen: capSen as Sen,
        viewThreshold,
        submissionWindowDays: days.submissionWindowDays as number,
        meteringDays: days.meteringDays as number,
        claimGraceDays: days.claimGraceDays as number,
        retentionDays: days.retentionDays as number,
        crossPlatformIndependentCap: values.crossPlatformIndependentCap,
        platforms: [...values.platforms],
        contentLanguages: [...values.contentLanguages],
        audienceRegion: 'global',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// The threshold / cap explanation
// ---------------------------------------------------------------------------

export type CapExplanation = CapAtThreshold;

/**
 * "达10万观看，奖励封顶RM100": when a view threshold is set and the reward it earns
 * is already at or above the cap, the configuration is legal and the ceiling must
 * be shown rather than the threshold being refused. Returns null when the
 * threshold is unset or does not reach the cap, because then there is nothing to
 * explain.
 *
 * The arithmetic itself is `capAtThreshold` in the engine, the same function the
 * shared public rule sheet renders from, so the editor's live explanation and the
 * saved campaign's rule sheet cannot state different amounts. This wrapper only
 * adds "the form is still half-typed" handling.
 */
export function capExplanation(values: CampaignFormValues): CapExplanation | null {
  if (values.viewThreshold.trim() === '') return null;
  const views = parseWholeNumber(values.viewThreshold);
  const rate = ringgitToSen(values.ratePerThousand);
  const cap = ringgitToSen(values.capPerSubmission);
  if (!views.ok || !rate.ok || !cap.ok) return null;
  return capAtThreshold({
    viewThreshold: views.value,
    ratePerThousandSen: rate.sen,
    capPerSubmissionSen: cap.sen,
  });
}

/** True when nothing in the form differs from the saved campaign. */
export function isSameForm(a: CampaignFormValues, b: CampaignFormValues): boolean {
  return (
    a.title === b.title &&
    a.brief === b.brief &&
    a.pool === b.pool &&
    a.ratePerThousand === b.ratePerThousand &&
    a.minClaim === b.minClaim &&
    a.capPerSubmission === b.capPerSubmission &&
    a.viewThreshold === b.viewThreshold &&
    a.submissionWindowDays === b.submissionWindowDays &&
    a.meteringDays === b.meteringDays &&
    a.claimGraceDays === b.claimGraceDays &&
    a.retentionDays === b.retentionDays &&
    a.crossPlatformIndependentCap === b.crossPlatformIndependentCap &&
    a.platforms.join(',') === b.platforms.join(',') &&
    a.contentLanguages.join(',') === b.contentLanguages.join(',')
  );
}

/** Adds or removes one value, keeping the canonical option order. */
export function toggleOption<T>(current: readonly T[], option: T, order: readonly T[]): T[] {
  const next = current.includes(option)
    ? current.filter((entry) => entry !== option)
    : [...current, option];
  return order.filter((entry) => next.includes(entry));
}
