import { AppShell } from '@/components/app/app-shell';

/**
 * Every signed-in page: the three role workspaces plus notifications and
 * settings, all inside the same shell.
 *
 * Wave-2 role workers add their pages under this group, e.g.
 * `src/app/(workspace)/creator/submissions/page.tsx` serves `/creator/submissions`.
 * Route groups do not appear in the URL, so the paths in
 * docs/m1-prototype/kickoff.md are unchanged.
 */
export default function WorkspaceLayout({ children }: LayoutProps<'/'>) {
  return <AppShell>{children}</AppShell>;
}
