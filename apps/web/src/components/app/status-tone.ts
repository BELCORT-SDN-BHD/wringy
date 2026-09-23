/**
 * The status tones and their classes (phase-0/foundation/design-system-v2/
 * color-policy.md), shared by the client `StatusBadge` and by server-rendered
 * badges such as the internal build's (src/app/(internal)/internal).
 *
 * Kept in a module without `'use client'` so a server component can read the
 * values: exports of a client module reach a server component only as client
 * references, not as values.
 *
 * Tones are the allocation in color-policy.md, not new component variants.
 * `attention` means the person has to act; `info` means the system is working;
 * `unknown` means the fact is not available and must not be read as zero.
 */
export type StatusTone = 'success' | 'attention' | 'error' | 'info' | 'inactive' | 'unknown';

export const TONE_CLASS: Record<StatusTone, string> = {
  success: 'bg-success-subtle text-success-foreground',
  attention: 'bg-attention-subtle text-attention-foreground',
  error: 'bg-error-subtle text-error-foreground',
  info: 'bg-info-subtle text-info-foreground',
  inactive: 'bg-inactive-subtle text-inactive-foreground',
  unknown: 'bg-inactive-subtle text-inactive-foreground',
};
