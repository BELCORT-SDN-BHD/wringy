import { DEMO_SAFE_AREA_CLASS } from '@/components/app/demo-badge';
import { PublicHeader } from '@/components/app/public-header';
import { cn } from '@/lib/utils';

/**
 * Pages anyone can read without an identity: the landing page, the campaign
 * catalogue, a campaign's public detail and the single sign-in entry.
 *
 * The bottom padding is the demo-tools trigger's safe area, so a primary action
 * at the end of the page is never underneath it, including at 320px.
 */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader />
      <main
        className={cn(
          'mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-6 sm:px-6',
          DEMO_SAFE_AREA_CLASS,
        )}
      >
        {children}
      </main>
    </div>
  );
}
