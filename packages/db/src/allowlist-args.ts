/**
 * `pnpm db:allowlist`'s argument rule, as a pure function (ruling D13; M2-02 R5).
 *
 * Kept apart from `cli/allowlist.ts` for the reason `bootstrap-plan.ts` is kept
 * apart from the bootstrap script: that module runs `main()` at import, so
 * importing it to test the parser would run the CLI against the test process's
 * own `process.argv` (and open a database connection). A rule that cannot be
 * imported cannot be tested, and this one is the audit trail's own gate — the
 * required `--reason` and `--by` are what makes a change to who may sign in
 * recorded rather than anonymous. Since M2-03 both are written to
 * `app.audit_log`, which never holds an address, so a value containing `@` is
 * refused too (M2-03 code review R3, R6).
 */

export const ALLOWLIST_USAGE = [
  'Usage:',
  '  pnpm db:allowlist add <email> --reason "<text>" --by "<name>"',
  '  pnpm db:allowlist remove <email> --reason "<text>" --by "<name>"',
  '  pnpm db:allowlist list',
].join('\n');

export interface ParsedAllowlistArgs {
  command: 'add' | 'remove' | 'list';
  email?: string;
  reason?: string;
  by?: string;
}

/**
 * Parses argv. `--reason`/`--by` take the next argument; anything else is
 * refused.
 *
 * Refusing an unknown `--option` is not tidiness: without it an address that
 * begins with `--` (or a mistyped flag) would be swallowed as an option and the
 * command would act on the wrong row, or on none, while looking like it worked.
 */
export function parseAllowlistArgs(argv: readonly string[]): ParsedAllowlistArgs {
  const [command, ...rest] = argv;
  if (command !== 'add' && command !== 'remove' && command !== 'list') {
    throw new Error(`Unknown command "${command ?? ''}".\n${ALLOWLIST_USAGE}`);
  }

  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]!;
    if (argument === '--reason' || argument === '--by') {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${argument} needs a value.\n${ALLOWLIST_USAGE}`);
      }
      named[argument.slice(2)] = value;
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown option "${argument}".\n${ALLOWLIST_USAGE}`);
    } else {
      positional.push(argument);
    }
  }

  if (command === 'list') {
    if (positional.length > 0 || Object.keys(named).length > 0) {
      throw new Error(`list takes no arguments.\n${ALLOWLIST_USAGE}`);
    }
    return { command };
  }
  if (positional.length !== 1) throw new Error(`${command} takes exactly one email address.\n${ALLOWLIST_USAGE}`);
  const values: Record<'reason' | 'by', string> = { reason: '', by: '' };
  for (const option of ['reason', 'by'] as const) {
    const value = named[option];
    if (value === undefined || value.trim() === '') {
      throw new Error(`${command} requires --${option} with a non-empty value.\n${ALLOWLIST_USAGE}`);
    }
    if (value.includes('@')) {
      throw new Error(
        `--${option} may not contain "@": the audit log never stores an address. Name the operator instead.\n${ALLOWLIST_USAGE}`,
      );
    }
    values[option] = value;
  }
  return { command, email: positional[0], reason: values.reason, by: values.by };
}
