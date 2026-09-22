/**
 * The persisted shape, kept in its own module with no React or zustand imports
 * so tooling (the Playwright helpers) can build a stored state without loading
 * the app.
 *
 * This is exactly what zustand's `persist` middleware writes: the partialized
 * store (`{ state }`) wrapped with the schema version.
 */

// A relative import, not the `@/` alias: the Playwright helpers load this file
// directly and must not depend on tsconfig path mapping.
import { SCHEMA_VERSION, type DemoState } from '../domain/types';

/** The only localStorage key the prototype writes. */
export const DEMO_STORAGE_KEY = 'wringy-demo-v1';

export interface PersistedEnvelope {
  state: { state: DemoState };
  version: number;
}

export function persistedEnvelope(state: DemoState): PersistedEnvelope {
  return { state: { state }, version: SCHEMA_VERSION };
}
