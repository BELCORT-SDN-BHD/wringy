'use client';

/**
 * Route guard for a workspace page.
 *
 * Signed out → redirect to `/sign-in?next=…` so the person lands back where they
 * were going. Signed in as the wrong role → render `ForbiddenState`, never an
 * empty list and never a fake success. Both are labelled as simulated checks:
 * the authoritative check is the engine's own `checkPermission`, which refuses
 * the command even if a control is somehow reachable (kickoff decision 7).
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { ForbiddenState } from '@/components/app/forbidden-state';
import { LoadingState } from '@/components/app/loading-state';
import { ROLE_HOME } from '@/config/nav';
import { useActor } from '@/store/actor';
import { useHydrated } from '@/store/demo-store';
import type { Role } from '@/domain/types';

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
  const router = useRouter();

  const signedOut = hydrated && actor.role === 'guest';

  useEffect(() => {
    if (!signedOut) return;
    const target = next ?? (typeof window === 'undefined' ? '/' : window.location.pathname);
    router.replace(`/sign-in?next=${encodeURIComponent(target)}`);
  }, [signedOut, next, router]);

  if (!hydrated) return <LoadingState />;
  // The redirect is in flight; showing the page for one frame would leak it.
  if (signedOut) return <LoadingState />;

  if (!allow.includes(actor.role as Exclude<Role, 'guest'>)) {
    const home = ROLE_HOME[actor.role as Exclude<Role, 'guest'>] ?? '/';
    return <ForbiddenState homeHref={home} />;
  }

  return <>{children}</>;
}
