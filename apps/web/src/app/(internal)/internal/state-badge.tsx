/**
 * Server-rendered status badges for the internal page, following the M1
 * StatusBadge rules (src/components/app/status-badge.tsx,
 * design-system-v2 color-policy.md): the official `Badge` with the shared
 * tone classes, an icon AND a text label for every state, and an unknown
 * value shown as the localized "unknown" word, never as a success, a zero or
 * a dash. No client JavaScript: labels come from the caller's server-side
 * translations.
 */
import {
  CircleCheck,
  CircleDashed,
  CircleQuestionMark,
  CircleStop,
  Database,
  FlaskConical,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { TONE_CLASS, type StatusTone } from '@/components/app/status-tone';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface StateStyle {
  tone: StatusTone;
  icon: LucideIcon;
}

/** The unknown style: neutral, with a question mark; never read as zero or success. */
export const UNKNOWN_STATE: StateStyle = { tone: 'unknown', icon: CircleQuestionMark };

/** Campaign status, as the M1 StatusBadge shows the same two codes. */
export const CAMPAIGN_STATUS_STYLE: Record<string, StateStyle> = {
  draft: { tone: 'inactive', icon: CircleDashed },
  published: { tone: 'success', icon: CircleCheck },
};

/** Worker process liveness (`state`). `never_seen` is unknown. */
export const PROCESS_STATE_STYLE: Record<string, StateStyle> = {
  healthy: { tone: 'success', icon: CircleCheck },
  stale: { tone: 'attention', icon: TriangleAlert },
  stopped: { tone: 'inactive', icon: CircleStop },
  never_seen: UNKNOWN_STATE,
};

/** Worker queue-path liveness (`queueState`). `never` is unknown. */
export const QUEUE_STATE_STYLE: Record<string, StateStyle> = {
  ok: { tone: 'success', icon: CircleCheck },
  overdue: { tone: 'attention', icon: TriangleAlert },
  never: UNKNOWN_STATE,
};

/** Where a record came from: fixture rows are demonstration data. */
export const DATA_ORIGIN_STYLE: Record<string, StateStyle> = {
  fixture: { tone: 'attention', icon: FlaskConical },
  live: { tone: 'info', icon: Database },
};

/** A style for `code`, or the unknown style for a code this page does not know. */
export function styleOf(styles: Record<string, StateStyle>, code: string): StateStyle {
  return Object.hasOwn(styles, code) ? styles[code]! : UNKNOWN_STATE;
}

export interface StateBadgeProps {
  style: StateStyle;
  label: string;
  /** Which fact this badge states, e.g. `process`, `queue`, `campaign-status`. */
  kind: string;
  code: string;
  className?: string;
}

export function StateBadge({ style, label, kind, code, className }: StateBadgeProps) {
  const Icon = style.icon;
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 border-transparent', TONE_CLASS[style.tone], className)}
      data-state-kind={kind}
      data-state-code={code}
      data-state-tone={style.tone}
    >
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
