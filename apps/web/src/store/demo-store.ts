'use client';

/**
 * The demo store: one zustand store holding one `DemoState`, persisted to
 * localStorage under one versioned key.
 *
 * Contract with the rest of the app:
 *   - components read state only through selectors (`src/store/selectors.ts`);
 *   - components mutate state only through `dispatch(command)`, which is the
 *     only caller of the engine's `applyCommand`;
 *   - `dispatch` returns the engine's `CommandResult` so the caller can render
 *     the error code instead of pretending the action succeeded;
 *   - nothing renders real data before `hydrated` is true (see `useHydrated`).
 *
 * Persistence rules (kickoff decision 9): demo records only, this browser only,
 * one key with a schema version, and an explicit reset instead of a silent
 * failure when the stored copy cannot be used.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { persist, type PersistStorage } from 'zustand/middleware';

import { newCommandId } from './command-id';
import {
  DEMO_STORAGE_KEY,
  persistedEnvelope,
  type PersistedEnvelope,
} from './persistence';
import {
  SCHEMA_VERSION,
  applyCommand,
  createSeedState,
  migrate,
  type Command,
  type CommandResult,
  type DemoState,
  type ScenarioId,
} from './engine';

const PROBE_KEY = `${DEMO_STORAGE_KEY}-probe`;

// Re-exported so components and tests have one import site.
export { DEMO_STORAGE_KEY, persistedEnvelope };
export type { PersistedEnvelope };

export interface DemoStore {
  /** The single demo record set. Read it through the selector hooks. */
  state: DemoState;
  /** False until the persisted copy has been read. Render a skeleton until then. */
  hydrated: boolean;
  /** True when a stored copy existed but could not be migrated: the seed is in use. */
  needsReset: boolean;
  /** True when this browser refuses to store anything: the demo runs but forgets. */
  storageBlocked: boolean;

  /**
   * Applies a command through the engine and keeps the result.
   * A fresh `commandId` is minted unless the caller passes one, so a retry of the
   * same user intent replays instead of applying twice.
   */
  dispatch: (command: Command, commandId?: string) => CommandResult;
  /** Back to the baseline seed. */
  reset: () => CommandResult;
  /** Rebuilds every record for a scenario preset. */
  loadScenario: (scenarioId: ScenarioId) => CommandResult;
  /** Dismisses the "stored data could not be read" notice without resetting. */
  acknowledgeNeedsReset: () => void;
}

/**
 * localStorage wrapped so a private window, a blocked origin or a full quota
 * degrades to "the demo forgets" instead of throwing inside a click handler.
 */
let storageRefused = false;

const demoStorage: PersistStorage<{ state: DemoState }> = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(name);
      return raw ? (JSON.parse(raw) as PersistedEnvelope) : null;
    } catch {
      storageRefused = true;
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(name, JSON.stringify(value));
    } catch {
      storageRefused = true;
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      storageRefused = true;
    }
  },
};

function storageWorks(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(PROBE_KEY, '1');
    const readBack = window.localStorage.getItem(PROBE_KEY);
    window.localStorage.removeItem(PROBE_KEY);
    return readBack === '1';
  } catch {
    return false;
  }
}

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      state: createSeedState(),
      hydrated: false,
      needsReset: false,
      storageBlocked: false,

      dispatch: (command, commandId) => {
        const result = applyCommand(get().state, command, {
          commandId: commandId ?? newCommandId(),
        });
        set({ state: result.state });
        return result;
      },

      reset: () => {
        const result = get().dispatch({ type: 'demo.reset' });
        set({ needsReset: false });
        return result;
      },

      loadScenario: (scenarioId) => get().dispatch({ type: 'demo.loadScenario', scenarioId }),

      acknowledgeNeedsReset: () => set({ needsReset: false }),
    }),
    {
      name: DEMO_STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: demoStorage,
      // Only demo records are stored. The hydration flags are runtime state.
      partialize: (store) => ({ state: store.state }),
      // Hydration is started explicitly from a client effect so the server and
      // the first client render agree (see `hydrateDemoStore`).
      skipHydration: true,
      // Version changes are handed to the engine's own `migrate` in `merge`,
      // which is the single authority on whether a stored copy is usable.
      migrate: (persisted) => persisted as { state: DemoState },
      merge: (persisted, current) => {
        if (!persisted) return current;
        const migrated = migrate((persisted as { state?: unknown }).state);
        if (!migrated) {
          // Keep the seed rather than a half-understood record set, and tell the
          // UI to offer a reset instead of failing silently.
          return { ...current, needsReset: true };
        }
        return { ...current, state: migrated, needsReset: false };
      },
      onRehydrateStorage: () => (_store, error) => {
        useDemoStore.setState({
          hydrated: true,
          storageBlocked: storageRefused || !storageWorks(),
          ...(error ? { needsReset: true } : null),
        });
      },
    },
  ),
);

let hydrationStarted = false;

/**
 * Starts hydration once per page load. Safe to call from several components:
 * the second call is a no-op.
 */
export function hydrateDemoStore(): void {
  if (hydrationStarted) return;
  hydrationStarted = true;
  try {
    const pending = useDemoStore.persist.rehydrate();
    if (pending === undefined) {
      // No usable storage at all: nothing to wait for.
      useDemoStore.setState({ hydrated: true, storageBlocked: true });
      return;
    }
    void Promise.resolve(pending).catch(() => {
      useDemoStore.setState({ hydrated: true, needsReset: true });
    });
  } catch {
    useDemoStore.setState({ hydrated: true, storageBlocked: true });
  }
}

/**
 * Reads a slice of the demo state.
 *
 * Shallow comparison means a selector may return a fresh object of primitives
 * (a budget, a reward view) without re-rendering on every dispatch. A selector
 * that builds a fresh array of fresh objects must use `useDemoSnapshot` with
 * `useMemo` instead, because shallow comparison cannot see through it.
 */
export function useDemoState<T>(selector: (state: DemoState) => T): T {
  return useDemoStore(useShallow((store) => selector(store.state)));
}

/**
 * The whole state by reference. The reference changes only when a command is
 * applied, so `useMemo(() => select(state), [state])` recomputes exactly then.
 */
export function useDemoSnapshot(): DemoState {
  return useDemoStore((store) => store.state);
}

export function useDispatch(): DemoStore['dispatch'] {
  return useDemoStore((store) => store.dispatch);
}

export function useHydrated(): boolean {
  return useDemoStore((store) => store.hydrated);
}

export function useNeedsReset(): boolean {
  return useDemoStore((store) => store.needsReset);
}

export function useStorageBlocked(): boolean {
  return useDemoStore((store) => store.storageBlocked);
}

export function useDemoActions(): Pick<
  DemoStore,
  'reset' | 'loadScenario' | 'acknowledgeNeedsReset'
> {
  return useDemoStore(
    useShallow((store) => ({
      reset: store.reset,
      loadScenario: store.loadScenario,
      acknowledgeNeedsReset: store.acknowledgeNeedsReset,
    })),
  );
}
