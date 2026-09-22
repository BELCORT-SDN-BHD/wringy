// Scenario loading. `loadScenario(seed, id)` replays the scenario's commands through
// `applyCommand`, so a scenario is reachable by exactly the rules the UI obeys and
// is reproducible after a reset (ticket #9 / P11).

import { applyCommand } from './engine';
import { SCENARIO_STEPS, replayScenario } from './scenario-steps';
import { createSeedState } from './seed';
import type { DemoState, ScenarioId } from './types';

/** Canonical order for the demo entry list. */
export const SCENARIO_IDS: readonly ScenarioId[] = [
  'baseline',
  'main_flow_ready',
  'partial_budget',
  'waitlist',
  'rejection_appeal',
  'payout_unknown',
  'payout_failed',
  'deadline_extension',
  'campaign_closure',
  'data_outage',
];

/**
 * Builds a scenario state, by default from a fresh seed. Pure: safe to call outside
 * React (the Playwright helpers inject the result straight into localStorage) and
 * equivalent to the `demo.loadScenario` command, which replays the same steps.
 *
 * Throws with the failing step when a scenario is no longer reachable — a scenario
 * that needs a rule bent is a defect, not a demo state.
 */
export function loadScenario(
  scenarioId: ScenarioId,
  seed: DemoState = createSeedState(),
): DemoState {
  return replayScenario(seed, scenarioId, applyCommand);
}

export { SCENARIO_STEPS, replayScenario };
export type { ApplyCommandFn, ScenarioStep } from './scenario-steps';
