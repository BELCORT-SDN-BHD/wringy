'use client';

/**
 * Holds a page back until the persisted demo state has been read.
 *
 * Everything the prototype shows lives in localStorage, so rendering before
 * hydration would briefly show the seed and then replace it. The skeleton this
 * renders is also the prototype's "loading" state for acceptance purposes.
 */

import type { ReactNode } from 'react';

import { LoadingState } from '@/components/app/loading-state';
import { useHydrated } from '@/store/demo-store';

export interface HydrationGateProps {
  children: ReactNode;
  /** Replaces the default skeleton, e.g. with a narrower one for a widget. */
  fallback?: ReactNode;
}

export function HydrationGate({ children, fallback }: HydrationGateProps) {
  const hydrated = useHydrated();
  if (!hydrated) return <>{fallback ?? <LoadingState />}</>;
  return <>{children}</>;
}
