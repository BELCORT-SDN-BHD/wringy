'use client';

/**
 * Switching the simulated identity, in one place.
 *
 * Reaching a role is not a single command: the creator and merchant workspaces
 * belong to the same simulated Google identity and are a workspace switch, while
 * the two operations capabilities are separate simulated users who have to be
 * signed in as. Getting that order wrong leaves a stale `opsRole` overriding the
 * workspace, which is how a "go to the merchant page" button ends up showing the
 * operations queue.
 *
 * Both the demo tools panel and the `/demo` guide need it, so it lives next to
 * the store rather than inside either of them. Switching identity is a demo
 * tool, not authorisation (kickoff decision 7): the engine still runs its own
 * permission check on every command afterwards.
 */

import { useCallback } from 'react';

import type { CommandResult, Role } from '@/domain/types';

import { useDemoStore, useDispatch } from './demo-store';

/** The four identities the demo can act as. `guest` is reached by signing out. */
export type DemoRole = Exclude<Role, 'guest'>;

export interface BecomeRoleResult {
  ok: boolean;
  /** The first refusal, when one of the steps was refused. */
  failure: Extract<CommandResult, { ok: false }> | null;
  /** Who the demo is now acting as, which is the old role when it failed. */
  role: DemoRole | null;
}

/**
 * Returns a function that makes the demo act as `role`.
 *
 * It reads the store imperatively rather than through a hook subscription: the
 * steps have to see each other's result, and a subscribed snapshot would still
 * be the pre-click one for the second command.
 */
export function useBecomeRole(): (role: DemoRole) => BecomeRoleResult {
  const dispatch = useDispatch();

  return useCallback(
    (role: DemoRole): BecomeRoleResult => {
      const steps: Array<() => CommandResult> = [];
      const state = useDemoStore.getState().state;

      if (role === 'ops_reviewer' || role === 'ops_finance') {
        const opsUser = Object.values(state.users).find(
          (candidate) => candidate.opsCapability === role,
        );
        if (!opsUser) {
          return { ok: false, failure: null, role: null };
        }
        // Sign in first: `session.setOpsRole` is refused for a user without the
        // capability, so the order is what makes it legal rather than lucky.
        if (state.session.userId !== opsUser.id) {
          steps.push(() => dispatch({ type: 'session.signIn', userId: opsUser.id }));
        }
        steps.push(() => dispatch({ type: 'session.setOpsRole', role }));
      } else {
        const workspaceUser = Object.values(state.users).find(
          (candidate) => candidate.opsCapability === null && candidate.orgIds.length > 0,
        );
        const userId = workspaceUser?.id ?? null;
        if (userId === null) return { ok: false, failure: null, role: null };
        if (state.session.userId !== userId) {
          steps.push(() => dispatch({ type: 'session.signIn', userId }));
        }
        // Clearing the operations override before the workspace switch, not
        // after: while it is set it wins over the workspace.
        if (state.session.opsRole !== null) {
          steps.push(() => dispatch({ type: 'session.setOpsRole', role: null }));
        }
        steps.push(() => dispatch({ type: 'session.switchWorkspace', workspace: role }));
      }

      for (const step of steps) {
        const result = step();
        if (!result.ok) return { ok: false, failure: result, role: null };
      }
      return { ok: true, failure: null, role };
    },
    [dispatch],
  );
}
