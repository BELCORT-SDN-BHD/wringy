'use client';

/**
 * The standing "Demo data · simulated" mark.
 *
 * Ticket #2 requires it on every page, so it is rendered once in the root layout
 * as a fixed pill and again inline in each header. It is deliberately small and
 * clamped in width: at 320px it must not cover a primary action, and the page
 * containers reserve bottom padding for it.
 */

import { FlaskConical } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Fixed, always on screen. Mounted once by the root layout. */
export function DemoBadge() {
  const t = useTranslations('common.app');

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-50 flex max-w-[58vw] sm:bottom-4 sm:left-4 sm:max-w-none">
      <Badge
        variant="outline"
        className="bg-attention-subtle text-attention-foreground pointer-events-auto max-w-full gap-1 border-transparent shadow-sm"
        title={t('demoBadgeDetail')}
        data-testid="demo-badge"
      >
        <FlaskConical aria-hidden="true" />
        <span className="truncate">{t('demoBadge')}</span>
      </Badge>
    </div>
  );
}

/** The same mark inside a page header, where it cannot be scrolled away from. */
export function DemoBadgeInline({ className }: { className?: string }) {
  const t = useTranslations('common.app');

  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-attention-subtle text-attention-foreground gap-1 border-transparent',
        className,
      )}
      title={t('demoBadgeDetail')}
    >
      <FlaskConical aria-hidden="true" />
      <span className="truncate">{t('demoBadge')}</span>
    </Badge>
  );
}
