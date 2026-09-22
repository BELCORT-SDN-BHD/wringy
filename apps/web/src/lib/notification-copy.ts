import notifications from '@/messages/en-MY/notifications.json';
import type { Locale } from '@/domain/types';

import { formatDateTime, formatSen } from './format';

/**
 * Turns an engine notification's `params` into values the copy can interpolate.
 *
 * The engine keeps money as integer sen and times as ISO strings, and the
 * message catalogue uses the engine's own parameter names (`amountSen`,
 * `claimDeadlineAt`, …). So the rule is by key and by value shape:
 *   - a numeric `…Sen` key becomes a formatted MYR amount;
 *   - an ISO timestamp becomes an absolute Malaysia-time string with its offset;
 *   - a parameter listed in `CODE_PARAMS` is an engine code and gets its localized
 *     label, because the sentence around it is translated and #10/P10 asks the whole
 *     notification and its simulated email to work in all three languages;
 *   - anything else is passed through unchanged. That is what keeps a person's own
 *     words intact: `reason` is a typed rejection reason in `content.rejected` and
 *     `claim.rejected`, so the map is keyed by (kind, parameter) and not by name.
 *
 * A placeholder the copy declares but the event did not supply is filled with
 * the localized word for unknown, so a message can never degrade into a raw key
 * path and an absent amount can never read as zero.
 */

const PLACEHOLDER = /\{(\w+)\}/g;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

type KindTree = { [key: string]: string | KindTree };

/**
 * A kind such as `claim.reserved` is stored as nested objects, because next-intl
 * treats a dot as nesting and rejects it inside a single key. This flattens the
 * tree back to `"claim.reserved" -> { title, body, emailSubject, emailBody }`.
 */
function flattenKinds(tree: KindTree, prefix: string[] = []): Record<string, string[]> {
  const values = Object.values(tree);
  const isLeafGroup = values.every((value) => typeof value === 'string');

  if (isLeafGroup && prefix.length > 0) {
    return {
      [prefix.join('.')]: [
        ...new Set(
          (values as string[]).flatMap((value) =>
            [...value.matchAll(PLACEHOLDER)].map((match) => match[1]),
          ),
        ),
      ],
    };
  }

  return Object.entries(tree).reduce<Record<string, string[]>>((acc, [key, value]) => {
    if (typeof value === 'string') return acc;
    return { ...acc, ...flattenKinds(value, [...prefix, key]) };
  }, {});
}

/** Placeholder names each kind's four messages declare, read from the catalogue. */
const DECLARED: Record<string, string[]> = flattenKinds(
  notifications.kinds as unknown as KindTree,
);

/**
 * The interpolated parameters that carry an engine code, with the `common.*` key
 * prefix their label lives under. Everything not listed here is either a number, a
 * timestamp or a person's words.
 */
const CODE_PARAMS: Record<string, Record<string, string>> = {
  'deadline.claim_deadline_extended': { reason: 'extensionReason' },
  'payout.reconciled': { outcome: 'reconcileOutcome' },
  'submission.data_unavailable': { missingReason: 'missingReason' },
};

/** `useTranslations('common')`, so this module stays React-free. */
export type CommonTranslate = (key: string, values?: Record<string, string | number>) => string;

function formatParam(key: string, value: string | number, locale: Locale): string {
  if (key.endsWith('Sen') && typeof value === 'number') return formatSen(value, locale);
  if (typeof value === 'string' && ISO_DATETIME.test(value)) return formatDateTime(value, locale);
  return String(value);
}

export function notificationValues(
  kind: string,
  params: Record<string, string | number>,
  locale: Locale,
  unknownLabel: string,
  tCommon?: CommonTranslate,
): Record<string, string> {
  const codes = CODE_PARAMS[kind] ?? {};
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const prefix = codes[key];
    if (prefix !== undefined && tCommon !== undefined && typeof value === 'string') {
      values[key] = tCommon(`${prefix}.${value}`);
      continue;
    }
    values[key] = formatParam(key, value, locale);
  }
  for (const name of DECLARED[kind] ?? []) {
    if (values[name] === undefined || values[name] === '') values[name] = unknownLabel;
  }
  return values;
}

/** True when the catalogue has copy for this kind. */
export function hasNotificationCopy(kind: string): boolean {
  return kind in DECLARED;
}
