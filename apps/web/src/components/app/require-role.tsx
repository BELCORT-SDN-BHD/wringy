'use client';

/**
 * Route guard for a workspace page.
 *
 * Signed out → redirect to `/sign-in?next=…` so the person lands back where they
 * were going. Signed in as an identity that cannot hold the route's role → render
 * `ForbiddenState`, never an empty list and never a fake success. Both are
 * labelled as simulated checks: the authoritative check is the engine's own
 * `checkPermission`, which refuses the command even if a control is somehow
 * reachable (kickoff decision 7).
 *
 * The active workspace is NOT such an identity. One simulated Google identity
 * owns both the creator workspace and the Kopi Kita org (kickoff decision 7), and
 * `resolveActor` derives the role from `session.workspace`, so "wrong role" for a
 * `/creator` or `/merchant` route can mean nothing more than "the other workspace
 * is selected". Refusing that is what the founder walk hit: with the merchant
 * workspace active, "Join campaign" on a public campaign page links to
 * `/creator/submissions/new?campaign=…` and the creator route answered "you do not
 * have access to this workspace" for a workspace this identity does own. Sign-in
 * already derives the workspace from the return path, so the guard follows the
 * route for an identity that can hold it and shows the page instead.
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { ForbiddenState } from '@/components/app/forbidden-state';
import { LoadingState } from '@/components/app/loading-state';
import { ROLE_HOME } from '@/config/nav';
import { useActor, useOpsRole } from '@/store/actor';
import { useDemoState, useDispatch, useHydrated } from '@/store/demo-store';
import type { Role, Workspace } from '@/domain/types';

export interface RequireRoleProps {
  /** Roles allowed to see the page. */
  allow: Array<Exclude<Role, 'guest'>>;
  /** Where to return after signing in. Defaults to the current path. */
  next?: string;
  children: ReactNode;
}

export function RequireRole({ allow, next, children }: RequireRoleProps) {
  const hydrated = useHydrated();
  const actor = useActor();
  const opsRole = useOpsRole();
  const dispatch = useDispatch();
  const router = useRouter();
  /** Org membership is what `resolveActor` needs before it grants a merchant role. */
  const ownsOrg = useDemoState((state) => {
    const userId = state.session.userId;
    if (userId === null) return false;
    return (state.users[userId]?.orgIds.length ?? 0) > 0;
  });

  const signedOut = hydrated && actor.role === 'guest';
  const allowed = allow.includes(actor.role as Exclude<Role, 'guest'>);

  /**
   * The workspace this route needs, when selecting it is all that stands in the
   * way. Three refusals stay refusals, because for them the check is true:
   *  - a guest (handled above by the redirect to sign-in);
   *  - an `/ops` route, since the operations identities are separate simulated
   *    users reachable only from the demo tools, and `session.switchWorkspace`
   *    clears `opsRole` — an ops identity must not be silently demoted either;
   *  - a `/merchant` route for an identity with no org (seed user Ben), which
   *    `resolveActor` gives no merchant role at all.
   */
  const switchTo: Workspace | null =
    !hydrated || signedOut || allowed || opsRole !== null
      ? null
      : allow.includes('creator')
        ? 'creator'
        : allow.includes('merchant') && ownsOrg
          ? 'merchant'
          : null;

  useEffect(() => {
    if (!signedOut) return;
    const target = next ?? (typeof window === 'undefined' ? '/' : window.location.pathname);
    router.replace(`/sign-in?next=${encodeURIComponent(target)}`);
  }, [signedOut, next, router]);

  useEffect(() => {
    if (switchTo === null) return;
    dispatch({ type: 'session.switchWorkspace', workspace: switchTo });
  }, [switchTo, dispatch]);

  if (!hydrated) return <LoadingState />;
  // The redirect is in flight; showing the page for one frame would leak it.
  if (signedOut) return <LoadingState />;
  // The workspace switch is in flight; the refusal would be both wrong and a flash.
  if (switchTo !== null) return <LoadingState />;

  if (!allowed) {
    const home = ROLE_HOME[actor.role as Exclude<Role, 'guest'>] ?? '/';
    return <ForbiddenState homeHref={home} />;
  }

  return <>{children}</>;
}
