import { PublicHeader } from '@/components/app/public-header';

/**
 * Pages anyone can read without an identity: the landing page, the campaign
 * catalogue, a campaign's public detail and the single sign-in entry.
 *
 * The bottom padding keeps the fixed demo badge and the demo-tools trigger from
 * covering a primary action, including at 320px.
 */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-6 pb-24 sm:px-6">
        {children}
      </main>
    </div>
  );
}
