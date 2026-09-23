import type { Locale } from '@/i18n/config';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface InstantTextProps {
  /** An ISO instant from the API, or null when the fact does not exist yet. */
  iso: string | null;
  locale: Locale;
  /** The localized "unknown" word, shown for null: never a 0, a dash or an empty cell. */
  unknownLabel: string;
  className?: string;
}

/**
 * An instant in Malaysia time with the offset written out, e.g.
 * "23 Sept 2026, 14:05 (UTC+08:00)" (localization-v1; src/lib/format.ts), as a
 * `<time>` element. Rendered on the server; the machine-readable value keeps
 * the API's own instant.
 */
export function InstantText({ iso, locale, unknownLabel, className }: InstantTextProps) {
  if (iso === null) {
    return (
      <span className={cn('text-inactive-foreground', className)} data-datetime="unknown">
        {unknownLabel}
      </span>
    );
  }
  return (
    <time dateTime={iso} className={className}>
      {formatDateTime(iso, locale)}
    </time>
  );
}
