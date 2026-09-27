'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while the server renders and while the client hydrates, true after
 * (M2-04; m2-04-code-review.md R5, R8): what hides the header switcher's no-JS
 * Apply button, and what lets a request key be shown only once it was minted on
 * the client. `useSyncExternalStore` with a different server snapshot is React's
 * own way to render one thing for hydration and another right after, with no
 * state set inside an effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
