/**
 * The engine's recorded reasons as readable prose.
 *
 * `AuditEntry.reason` carries two different kinds of value. Some are text a person
 * typed — a rejection reason, an appeal, a closure reason — and localization-v1 says
 * those stay verbatim: "用户投稿、评论、店铺描述及证据保留原文，不自动翻译或覆盖". The rest
 * are codes the engine generated (`qualified_views_added`, `claimable:500`,
 * `confirmed_succeeded: …`), and those were reaching merchant, creator and operations
 * pages as English snake_case inside otherwise translated sentences — the same defect
 * `audit-copy.ts` was written to fix for the `action` column, left unfixed for this
 * one. #6 asks that the reason be readable ("理由可读"), and #10/P10 asks the same of
 * all three languages.
 *
 * So: a generated code gets copy under `common.reasons.*`; anything else is returned
 * unchanged. A structured code keeps its value and localizes only the wrapper, so the
 * money in the sentence is still the engine's own number.
 */

import type { Locale } from '@/domain/types';

import { formatSen } from './format';

/** `useTranslations('common')`, passed in so this module stays React-free. */
export type CommonTranslate = (key: string, values?: Record<string, string | number>) => string;

/** Generated reasons with no embedded value: the whole string is the code. */
const PLAIN_REASONS: ReadonlySet<string> = new Set([
  'qualified_views_added',
  'ignored_after_metering_end',
  'read_failed_source_unreachable',
  'data_outage_started',
  'data_outage_cleared',
  'readiness_set',
  'simulated_provider_success',
  'simulated_provider_timeout',
  'payout_started',
  'partial_offer_declined',
  'connection_reconnected',
  'draft_updated',
]);

export const RECONCILE_OUTCOMES = ['still_unknown', 'confirmed_succeeded', 'confirmed_failed'] as const;

export type ReconcileOutcome = (typeof RECONCILE_OUTCOMES)[number];

function isReconcileOutcome(value: string): value is ReconcileOutcome {
  return (RECONCILE_OUTCOMES as readonly string[]).includes(value);
}

/** `still_unknown` → "Still unknown". Shared by operations and the creator. */
export function reconcileOutcomeLabel(outcome: string, t: CommonTranslate): string {
  return isReconcileOutcome(outcome) ? t(`reconcileOutcome.${outcome}`) : outcome;
}

/**
 * The readable form of one recorded reason, or null when there is none.
 * A code the map does not know is returned as it stands, which is what keeps a
 * human-typed reason intact.
 */
export function reasonLabel(
  reason: string | null | undefined,
  t: CommonTranslate,
  locale: Locale,
): string | null {
  if (reason === null || reason === undefined) return null;
  const value = reason.trim();
  if (value === '') return null;
  if (PLAIN_REASONS.has(value)) return t(`reasons.${value}`);

  const post = /^post:([a-z]+):(.+)$/.exec(value);
  if (post) return t('reasons.post', { platform: post[1], postId: post[2] });

  const claimable = /^claimable:(\d+)$/.exec(value);
  if (claimable) return t('reasons.claimable', { amount: formatSen(Number(claimable[1]), locale) });

  const offer = /^offer:(\d+)\/(\d+)$/.exec(value);
  if (offer) {
    return t('reasons.offer', {
      offered: formatSen(Number(offer[1]), locale),
      full: formatSen(Number(offer[2]), locale),
    });
  }

  const waitlisted = /^waitlisted:(\d+)$/.exec(value);
  if (waitlisted) {
    return t('reasons.waitlisted', { amount: formatSen(Number(waitlisted[1]), locale) });
  }

  const consent = /^partial_consent:(.+)$/.exec(value);
  if (consent) return t('reasons.partialConsent', { offerId: consent[1] });

  // `payout.reconcile` records "<outcome>: <note>", where the note is typed.
  const reconciled = /^(\w+): ([\s\S]+)$/.exec(value);
  if (reconciled && isReconcileOutcome(reconciled[1])) {
    return t('reasons.reconciled', {
      outcome: reconcileOutcomeLabel(reconciled[1], t),
      note: reconciled[2],
    });
  }

  return value;
}
