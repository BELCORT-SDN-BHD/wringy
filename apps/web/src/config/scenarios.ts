import { SCENARIO_IDS as ENGINE_SCENARIO_IDS } from '@/domain';
import type { ScenarioId } from '@/domain/types';

/**
 * Message key for each scenario preset, keyed by id so TypeScript fails if the
 * engine adds a `ScenarioId` the demo tools have no label for. The order comes
 * from the engine's own canonical list, not from this file.
 */
const SCENARIO_LABEL_KEY: Record<ScenarioId, string> = {
  baseline: 'scenario.baseline',
  main_flow_ready: 'scenario.main_flow_ready',
  partial_budget: 'scenario.partial_budget',
  waitlist: 'scenario.waitlist',
  rejection_appeal: 'scenario.rejection_appeal',
  payout_unknown: 'scenario.payout_unknown',
  payout_failed: 'scenario.payout_failed',
  deadline_extension: 'scenario.deadline_extension',
  campaign_closure: 'scenario.campaign_closure',
  data_outage: 'scenario.data_outage',
};

export const SCENARIO_IDS: readonly ScenarioId[] = ENGINE_SCENARIO_IDS;

/** Key under the `demo` namespace. */
export function scenarioLabelKey(id: ScenarioId): string {
  return SCENARIO_LABEL_KEY[id];
}
