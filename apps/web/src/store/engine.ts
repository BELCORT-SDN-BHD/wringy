/**
 * The single import site for the demo engine's write side.
 *
 * Everything the UI mutates goes through `applyCommand`, and the store is the
 * only caller (kickoff: `src/domain` is the replaceable data access layer, so M2
 * swaps these calls for Fastify calls without touching components). Keeping the
 * imports in one module means a change in the engine's surface is reconciled
 * here and in `./selectors.ts`, and nowhere else.
 */

export {
  applyCommand,
  can,
  checkPermission,
  createSeedState,
  loadScenario,
  migrate,
  resolveActor,
  SCENARIO_IDS,
} from '@/domain';

export { SCHEMA_VERSION, LOCALES, TIMEZONE, CURRENCY } from '@/domain/types';

export type {
  Actor,
  Command,
  CommandMeta,
  CommandResult,
  DemoState,
  ErrorCode,
  Locale,
  Role,
  ScenarioId,
  Workspace,
} from '@/domain/types';
