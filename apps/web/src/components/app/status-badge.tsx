'use client';

/**
 * Status display.
 *
 * Rules from phase-0/foundation/design-system-v2/color-policy.md and
 * state-policy.md, and they are the reason this component exists at all:
 *   - no new Badge variants: the official variants are used and the semantic
 *     colour is bound with the root variables already in globals.css;
 *   - every coloured status carries an icon AND a text label;
 *   - an unknown code renders as "unknown", never as a success;
 *   - the same status uses the same colour, icon and variant in all three
 *     languages; only the text is translated.
 *
 * The four business status lines stay separate (kickoff decision 3), which is
 * why the group has to be named at the call site: `content` approved and
 * `claim` paid are different facts and must not share a label.
 */

import {
  Banknote,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleQuestionMark,
  CircleSlash,
  Gavel,
  Hourglass,
  Info,
  ReceiptText,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { StatusCodeOf, StatusGroup } from '@/lib/status-copy';
import { cn } from '@/lib/utils';

/**
 * Tones are the allocation in color-policy.md, not new component variants.
 * `attention` means the person has to act; `info` means the system is working;
 * `unknown` means the fact is not available and must not be read as zero.
 */
export type StatusTone = 'success' | 'attention' | 'error' | 'info' | 'inactive' | 'unknown';

const TONE_CLASS: Record<StatusTone, string> = {
  success: 'bg-success-subtle text-success-foreground',
  attention: 'bg-attention-subtle text-attention-foreground',
  error: 'bg-error-subtle text-error-foreground',
  info: 'bg-info-subtle text-info-foreground',
  inactive: 'bg-inactive-subtle text-inactive-foreground',
  unknown: 'bg-inactive-subtle text-inactive-foreground',
};

/**
 * The groups and their codes are `STATUS_CODES` in `@/lib/status-copy`, which the
 * audit trail also reads; re-exported so existing call sites keep importing the
 * type from here.
 */
export type { StatusGroup };

interface StatusStyle {
  tone: StatusTone;
  icon: LucideIcon;
}

/**
 * Typed against the registry rather than `Record<string, …>`: color-policy.md
 * pairs every status colour with an icon AND a label, so a code added to
 * `STATUS_CODES` with no icon here must not compile, and an icon for a code the
 * engine cannot produce must not either.
 */
const STATUS: { [G in StatusGroup]: Record<StatusCodeOf<G>, StatusStyle> } = {
  campaign: {
    draft: { tone: 'inactive', icon: CircleDashed },
    published: { tone: 'success', icon: CircleCheck },
    paused: { tone: 'attention', icon: CirclePause },
    submissions_closed: { tone: 'inactive', icon: CircleSlash },
    settling: { tone: 'info', icon: Hourglass },
    closed: { tone: 'inactive', icon: CircleSlash },
  },
  submission: {
    pending_baseline: { tone: 'info', icon: Hourglass },
    baseline_unavailable: { tone: 'unknown', icon: CircleQuestionMark },
    metering: { tone: 'info', icon: Info },
    data_unavailable: { tone: 'unknown', icon: WifiOff },
    metering_ended: { tone: 'inactive', icon: CircleSlash },
  },
  content: {
    pending: { tone: 'info', icon: Hourglass },
    // Green is for the completion of this named review only. It is not payment.
    approved: { tone: 'success', icon: CircleCheck },
    rejected: { tone: 'error', icon: CircleAlert },
  },
  metering: {
    pending: { tone: 'info', icon: Hourglass },
    approved: { tone: 'success', icon: CircleCheck },
    held: { tone: 'attention', icon: CirclePause },
    rejected: { tone: 'error', icon: CircleAlert },
  },
  claim: {
    pending_review: { tone: 'info', icon: Hourglass },
    // Deliberately not green: an obligation exists, the money has not moved.
    confirmed_unpaid: { tone: 'info', icon: ReceiptText },
    rejected_appealable: { tone: 'error', icon: CircleAlert },
    appealing: { tone: 'attention', icon: Gavel },
    rejected_final: { tone: 'error', icon: CircleSlash },
    paid: { tone: 'success', icon: Banknote },
  },
  payout: {
    processing: { tone: 'info', icon: Hourglass },
    succeeded: { tone: 'success', icon: Banknote },
    failed: { tone: 'error', icon: CircleAlert },
    // Unknown is not failed and not paid.
    unknown: { tone: 'unknown', icon: CircleQuestionMark },
  },
  connection: {
    valid: { tone: 'success', icon: CircleCheck },
    invalid: { tone: 'attention', icon: TriangleAlert },
    unlinked: { tone: 'inactive', icon: CircleDashed },
  },
  appeal: {
    open: { tone: 'attention', icon: Gavel },
    upheld: { tone: 'success', icon: CircleCheck },
    rejected: { tone: 'error', icon: CircleAlert },
  },
  obligation: {
    open: { tone: 'info', icon: ReceiptText },
    settled: { tone: 'success', icon: Banknote },
  },
  offer: {
    open: { tone: 'attention', icon: TriangleAlert },
    stale: { tone: 'attention', icon: TriangleAlert },
    consented: { tone: 'success', icon: CircleCheck },
    declined: { tone: 'inactive', icon: CircleSlash },
  },
  waitlist: {
    waiting: { tone: 'inactive', icon: Hourglass },
    notified: { tone: 'attention', icon: TriangleAlert },
    resubmitted: { tone: 'info', icon: Info },
    withdrawn: { tone: 'inactive', icon: CircleSlash },
  },
  bankSettlement: {
    unknown: { tone: 'unknown', icon: CircleQuestionMark },
    settled: { tone: 'success', icon: CircleCheck },
  },
};

const UNKNOWN_STYLE: StatusStyle = { tone: 'unknown', icon: CircleQuestionMark };

export interface StatusBadgeProps {
  group: StatusGroup;
  /** A status code from the engine. An unrecognised code renders as unknown. */
  code: string;
  className?: string;
}

/** The style for a code the engine produced, which is a plain `string`. */
function styleFor(group: StatusGroup, code: string): StatusStyle | undefined {
  return (STATUS[group] as Record<string, StatusStyle>)[code];
}

export function StatusBadge({ group, code, className }: StatusBadgeProps) {
  const t = useTranslations('common');
  const tUnknown = useTranslations('common.state');
  const known = styleFor(group, code);
  const style = known ?? UNKNOWN_STYLE;
  const Icon = style.icon;

  const label = known ? t(`status.${group}.${code}`) : `${tUnknown('unknown')} (${code})`;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 border-transparent', TONE_CLASS[style.tone], className)}
      data-status-group={group}
      data-status-code={code}
    >
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** The tone a status maps to, for callers that need the same colour elsewhere. */
export function statusTone(group: StatusGroup, code: string): StatusTone {
  return (styleFor(group, code) ?? UNKNOWN_STYLE).tone;
}
