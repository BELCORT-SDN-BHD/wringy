/**
 * Localized labels for the engine's status codes, for callers that have a bare
 * code and no React.
 *
 * `StatusBadge` already translates a status when the call site knows which of the
 * four status lines it is looking at (kickoff decision 3). The audit trail does
 * not: `AuditEntry.before` / `AuditEntry.after` are `string | null` "short status
 * summaries" the engine writes, so the operations timelines rendered
 * `pending_review → rejected_appealable` and `— → processing` as raw snake_case
 * inside otherwise translated pages. That is the same defect `audit-copy.ts` was
 * written to fix for the `action` column and `reason-copy.ts` for the `reason`
 * column, left unfixed for this one; #6 asks the trail be readable and #10/P10
 * asks it in all three languages.
 *
 * This module is therefore two things:
 *
 *   1. `STATUS_CODES` — the one registry of which codes belong to which status
 *      group. `status-badge.tsx` types its icon table against it, so a code added
 *      here without an icon is a type error there (color-policy.md: every status
 *      colour is paired with an icon and a label).
 *   2. `auditStatusLabel` — a bare code plus the audit row's `targetType`, turned
 *      into the same words `StatusBadge` would show. An unrecognised code falls
 *      back to the localized "unknown" with the code in brackets, exactly as
 *      `StatusBadge` does, rather than leaking the code alone.
 *
 * Not every `before`/`after` is a status. `demo.addQualifiedViews` records view
 * counts, `demo.advanceClock` records timestamps and `demo.loadScenario` records
 * scenario ids; those are passed through (a count formatted for the locale) and
 * must never become "unknown", which would destroy the number the row exists to
 * record.
 */

import type { AuditEntry, Locale } from '@/domain/types';

import { formatCount } from './format';

/**
 * The status lines and their codes. Mirrors the engine's own unions; the
 * catalogue under `common.status.<group>.<code>` is asserted against this table
 * in `status-copy.test.ts`, so a code with no copy fails the suite.
 */
export const STATUS_CODES = {
  campaign: ['draft', 'published', 'paused', 'submissions_closed', 'settling', 'closed'],
  submission: [
    'pending_baseline',
    'baseline_unavailable',
    'metering',
    'data_unavailable',
    'metering_ended',
  ],
  content: ['pending', 'approved', 'rejected'],
  metering: ['pending', 'approved', 'held', 'rejected'],
  claim: [
    'pending_review',
    'confirmed_unpaid',
    'rejected_appealable',
    'appealing',
    'rejected_final',
    'paid',
  ],
  payout: ['processing', 'succeeded', 'failed', 'unknown'],
  connection: ['valid', 'invalid', 'unlinked'],
  appeal: ['open', 'upheld', 'rejected'],
  obligation: ['open', 'settled'],
  offer: ['open', 'stale', 'consented', 'declined'],
  waitlist: ['waiting', 'notified', 'resubmitted', 'withdrawn'],
  bankSettlement: ['unknown', 'settled'],
} as const;

export type StatusGroup = keyof typeof STATUS_CODES;

/** The codes of one group as a literal union, so an icon table can be exhaustive. */
export type StatusCodeOf<G extends StatusGroup> = (typeof STATUS_CODES)[G][number];

export const STATUS_GROUPS = Object.keys(STATUS_CODES) as StatusGroup[];

export function isStatusCode(group: StatusGroup, code: string): boolean {
  return (STATUS_CODES[group] as readonly string[]).includes(code);
}

/** `useTranslations('common')`, passed in so this module stays React-free. */
export type CommonTranslate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Which status lines a row's `targetType` can name, most specific first.
 *
 * A bare code is ambiguous — `rejected` is a content decision, a metering
 * decision and an appeal outcome; `open` is an appeal, an offer and an
 * obligation — so the target decides. The order is the one the engine actually
 * writes: an appeal row's `open` is the appeal, and its `rejected_appealable` is
 * the claim status the appeal moved off.
 */
export const AUDIT_TARGET_GROUPS: Record<AuditEntry['targetType'], readonly StatusGroup[]> = {
  campaign: ['campaign'],
  // `submission.reviewContent` writes the content decision on the submission.
  submission: ['submission', 'content'],
  // `claim.request` writes the claim status; a partial offer writes `open` /
  // `declined`; a waitlisted entry writes `waiting`; `claim.reviewMetering`
  // writes "<claim status>/<metering decision>".
  claim: ['claim', 'offer', 'waitlist', 'metering'],
  appeal: ['appeal', 'claim'],
  obligation: ['obligation'],
  payout_attempt: ['payout'],
  // `connection.connect` / `connection.reconnect` record the connection status
  // against the session.
  session: ['connection'],
  // The clock and the scenario, never a status. See `auditStatusLabel`.
  demo: [],
};

/** The label `StatusBadge` would show for this group and code. */
export function statusLabel(group: StatusGroup, code: string, t: CommonTranslate): string | null {
  return isStatusCode(group, code) ? t(`status.${group}.${code}`) : null;
}

/** The first group in `groups` that knows `code`, translated; null when none does. */
function labelIn(
  groups: readonly StatusGroup[],
  code: string,
  t: CommonTranslate,
): string | null {
  for (const group of groups) {
    const label = statusLabel(group, code, t);
    if (label !== null) return label;
  }
  return null;
}

/** Localized "unknown", with the code kept in brackets as `StatusBadge` does. */
function unknownLabel(code: string, t: CommonTranslate): string {
  return t('auditStatus.unknown', { code });
}

const INTEGER = /^\d+$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const READINESS = /^funding=(true|false),data=(true|false)$/;
const RETRY_OF = /^retry_of:(.+)$/;
const RESYNC_FAILED = /^(.+):resync_failed$/;
const PAIR = /^([a-z_]+)\/([a-z_]+)$/;

/**
 * One `AuditEntry.before` / `AuditEntry.after` value as readable words.
 *
 * `null` and an empty string return `null`, so the caller can decide what an
 * absent side of the transition looks like (the trail writes an em dash).
 */
export function auditStatusLabel(
  value: string | null | undefined,
  targetType: AuditEntry['targetType'],
  t: CommonTranslate,
  locale: Locale,
): string | null {
  if (value === null || value === undefined) return null;
  const raw = value.trim();
  if (raw === '') return null;

  const groups = AUDIT_TARGET_GROUPS[targetType] ?? [];

  // Values that are facts rather than statuses. A view count and a timestamp
  // carry the whole point of their row, so they are never replaced by "unknown".
  if (INTEGER.test(raw)) return formatCount(Number(raw), locale);
  if (ISO_DATE_TIME.test(raw)) return raw;
  // `demo` rows are the simulated clock and the scenario id; no timeline renders
  // them, and inventing copy for a scenario id here would only hide it.
  if (targetType === 'demo') return raw;

  const readiness = READINESS.exec(raw);
  if (readiness) {
    return t('auditStatus.readiness', {
      funding: t(readiness[1] === 'true' ? 'auditStatus.yes' : 'auditStatus.no'),
      data: t(readiness[2] === 'true' ? 'auditStatus.yes' : 'auditStatus.no'),
    });
  }

  const retry = RETRY_OF.exec(raw);
  if (retry) return t('auditStatus.retryOf', { id: retry[1] });

  const resync = RESYNC_FAILED.exec(raw);
  if (resync) {
    return t('auditStatus.resyncFailed', {
      status: labelIn(groups, resync[1], t) ?? unknownLabel(resync[1], t),
    });
  }

  // `claim.reviewMetering` records "<claim status>/<metering decision>".
  const pair = PAIR.exec(raw);
  if (pair) {
    const first = labelIn(groups, pair[1], t);
    const second = labelIn(groups, pair[2], t);
    if (first !== null && second !== null) {
      return t('auditStatus.pair', { first, second });
    }
  }

  return labelIn(groups, raw, t) ?? unknownLabel(raw, t);
}
