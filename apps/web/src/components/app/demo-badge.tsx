'use client';

/**
 * The standing "Demo data · simulated" mark.
 *
 * Ticket #2 requires it on every page. It used to be rendered twice: inline in
 * each header AND as a fixed pill in the bottom-left corner. The fixed pill was
 * removed in wave 3 because a `position: fixed` mark cannot be laid out around —
 * all three role workers reported it covering page content, and at 1440px it sat
 * on top of the sidebar's identity line. A mark that hides the thing it is
 * marking is worse than no mark.
 *
 * So there is one mark, in the header, at every viewport: the icon and a short
 * label on narrow widths, the full sentence from `lg` up, and the long
 * explanation on the `title` in every case. The header is sticky, so it cannot
 * be scrolled away from either — which is the only property the fixed pill had
 * that the inline one lacked.
 */

import { FlaskConical } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Bottom padding every scrolling page reserves for the demo-tools trigger.
 *
 * The trigger is `fixed right-3 bottom-3` with a `size="sm"` button (2rem tall),
 * so 3.5rem clears it exactly; 6rem is used so a primary action never sits
 * directly under it either. Without this, a page whose last element is a primary
 * action — the claim button at 320px, the editor's Save — ends underneath the
 * trigger once scrolled to the bottom.
 */
export const DEMO_SAFE_AREA_CLASS = 'pb-24';

/** The mark inside a page header, where it cannot be scrolled away from. */
export function DemoBadgeInline({ className }: { className?: string }) {
  const t = useTranslations('common.app');

  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-attention-subtle text-attention-foreground max-w-full gap-1 border-transparent',
        className,
      )}
      title={t('demoBadgeDetail')}
      data-testid="demo-badge"
    >
      <FlaskConical aria-hidden="true" />
      {/* One of the two is always rendered, so the badge always has a name. */}
      <span className="truncate lg:hidden">{t('demoBadgeShort')}</span>
      <span className="hidden truncate lg:inline">{t('demoBadge')}</span>
    </Badge>
  );
}
