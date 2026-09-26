/**
 * `pnpm db:grant`'s argument rule, as a pure function (ruling D4; M2-03 code
 * review R6).
 *
 * Kept apart from `cli/grant.ts` for the reason `allowlist-args.ts` is kept apart
 * from its CLI: that module runs `main()` at import, so importing it to test the
 * parser would run the CLI against the test process's own `process.argv`. This
 * rule is the grant's audit gate: `--reason` and `--by` are required for every
 * change, and both are refused when they contain `@`, because they are stored in
 * the audit log and the audit log never holds an address (R3).
 */
import {
  ORG_GRANT_CAPABILITIES,
  PLATFORM_GRANT_CAPABILITIES,
  type OrgGrantCapability,
  type PlatformGrantCapability,
} from './grants';

export const GRANT_USAGE = [
  'Usage:',
  '  pnpm db:grant grant org <userId> <orgId> review|finance --reason "<text>" --by "<name>"',
  '  pnpm db:grant grant platform <userId> ops_runtime --reason "<text>" --by "<name>"',
  '  pnpm db:grant revoke org <userId> <orgId> review|finance --reason "<text>" --by "<name>"',
  '  pnpm db:grant revoke platform <userId> ops_runtime --reason "<text>" --by "<name>"',
  '  pnpm db:grant list [<userId>]',
].join('\n');

export type ParsedGrantArgs =
  | { command: 'list'; userId?: string }
  | {
      command: 'grant' | 'revoke';
      scope: 'org';
      userId: string;
      orgId: string;
      capability: OrgGrantCapability;
      reason: string;
      by: string;
    }
  | {
      command: 'grant' | 'revoke';
      scope: 'platform';
      userId: string;
      capability: PlatformGrantCapability;
      reason: string;
      by: string;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refuse(message: string): never {
  throw new Error(`${message}\n${GRANT_USAGE}`);
}

function uuidOf(value: string | undefined, what: string): string {
  if (value === undefined || !UUID.test(value)) refuse(`${what} must be a UUID.`);
  return value.toLowerCase();
}

/**
 * Parses argv. `--reason`/`--by` take the next argument; any other `--option`,
 * and a value that itself starts with `--`, is refused: without that, a
 * mistyped flag would be swallowed and the command would act on the wrong row,
 * or record an empty reason, while looking like it worked.
 */
export function parseGrantArgs(argv: readonly string[]): ParsedGrantArgs {
  const [command, ...rest] = argv;
  if (command !== 'grant' && command !== 'revoke' && command !== 'list') {
    refuse(`Unknown command "${command ?? ''}".`);
  }

  const positional: string[] = [];
  const named: Partial<Record<'reason' | 'by', string>> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]!;
    if (argument === '--reason' || argument === '--by') {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith('--')) refuse(`${argument} needs a value.`);
      named[argument === '--reason' ? 'reason' : 'by'] = value;
      index += 1;
    } else if (argument.startsWith('--')) {
      refuse(`Unknown option "${argument}".`);
    } else {
      positional.push(argument);
    }
  }

  if (command === 'list') {
    if (Object.keys(named).length > 0 || positional.length > 1) refuse('list takes at most one user id.');
    return positional.length === 0 ? { command } : { command, userId: uuidOf(positional[0], 'The user id') };
  }

  const values = { reason: '', by: '' };
  for (const option of ['reason', 'by'] as const) {
    const value = named[option];
    if (value === undefined || value.trim() === '') refuse(`${command} requires --${option} with a non-empty value.`);
    if (value.includes('@')) {
      refuse(`--${option} may not contain "@": the audit log never stores an address. Name the operator instead.`);
    }
    values[option] = value.trim();
  }

  const [scope, ...args] = positional;
  if (scope === 'org') {
    if (args.length !== 3) refuse(`${command} org takes <userId> <orgId> <capability>.`);
    const capability = args[2]!;
    if (!(ORG_GRANT_CAPABILITIES as readonly string[]).includes(capability)) {
      refuse(`Unknown org capability "${capability}"; expected ${ORG_GRANT_CAPABILITIES.join(' or ')}.`);
    }
    return {
      command,
      scope,
      userId: uuidOf(args[0], 'The user id'),
      orgId: uuidOf(args[1], 'The org id'),
      capability: capability as OrgGrantCapability,
      ...values,
    };
  }
  if (scope === 'platform') {
    if (args.length !== 2) refuse(`${command} platform takes <userId> <capability>.`);
    const capability = args[1]!;
    if (!(PLATFORM_GRANT_CAPABILITIES as readonly string[]).includes(capability)) {
      refuse(`Unknown platform capability "${capability}"; expected ${PLATFORM_GRANT_CAPABILITIES.join(' or ')}.`);
    }
    return {
      command,
      scope,
      userId: uuidOf(args[0], 'The user id'),
      capability: capability as PlatformGrantCapability,
      ...values,
    };
  }
  return refuse(`${command} needs a scope: org or platform (got "${scope ?? ''}").`);
}
