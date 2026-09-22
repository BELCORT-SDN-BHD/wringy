'use client';

/**
 * Who is acting right now, and what the engine would let them do.
 *
 * The identity is simulated and switching it is a demo tool, not authorisation
 * (kickoff decision 7). Permission answers come from the engine's own
 * `selectPermissions`, so a hidden control and a refused command always agree;
 * hiding a control is a convenience, never the check.
 */

import { useMemo } from 'react';

import type { Command, Locale, Role, Workspace } from '@/domain/types';

import { useDemoSnapshot, useDemoState } from './demo-store';
import { can, resolveActor, type Actor } from './engine';
import { selectPermissions, selectUser, type PermissionFlags } from './selectors';

export type { Actor, PermissionFlags };

/** The resolved actor. All three fields are primitives, so a shallow read works. */
export function useActor(): Actor {
  return useDemoState(resolveActor);
}

export function useRole(): Role {
  return useDemoState((state) => resolveActor(state).role);
}

export function useIsSignedIn(): boolean {
  return useDemoState((state) => state.session.userId !== null);
}

export function useSessionLocale(): Locale {
  return useDemoState((state) => state.session.locale);
}

export function useWorkspace(): Workspace {
  return useDemoState((state) => state.session.workspace);
}

export function useOpsRole(): 'ops_reviewer' | 'ops_finance' | null {
  return useDemoState((state) => state.session.opsRole);
}

/** The signed-in user record, or null for a guest. */
export function useCurrentUser(): ReturnType<typeof selectUser> {
  const state = useDemoSnapshot();
  return useMemo(() => selectUser(state, state.session.userId), [state]);
}

/** The engine's permission flags for the current actor. */
export function usePermissions(): PermissionFlags {
  const state = useDemoSnapshot();
  return useMemo(() => selectPermissions(state), [state]);
}

/**
 * One-off check for a concrete command, when a flag from `usePermissions` is not
 * specific enough (e.g. a particular campaign's org membership).
 */
export function useCan(): (command: Command) => boolean {
  const state = useDemoSnapshot();
  const actor = useActor();
  return useMemo(() => (command: Command) => can(actor, command, state), [actor, state]);
}
