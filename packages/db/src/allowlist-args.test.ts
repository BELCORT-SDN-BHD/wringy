import { describe, expect, it } from 'vitest';

import { parseAllowlistArgs } from './allowlist-args';

/**
 * The audited CLI's argument rule (ruling D13; M2-02 R5). Every case here is one
 * an operator can type, and each refusal is the difference between an audit row
 * and a silent change: a missing `--reason`, a mistyped flag, an address that
 * begins with `--`, or `list` given something to act on.
 */
describe('M2-AC02/2 the allow-list CLI refuses an unaudited or ambiguous change', () => {
  it('M2-AC02/2 add and remove carry the email, the reason and the author', () => {
    expect(parseAllowlistArgs(['add', 'tester@example.com', '--reason', 'new tester', '--by', 'operator'])).toEqual({
      command: 'add',
      email: 'tester@example.com',
      reason: 'new tester',
      by: 'operator',
    });
    expect(parseAllowlistArgs(['remove', 'tester@example.com', '--by', 'operator', '--reason', 'left'])).toEqual({
      command: 'remove',
      email: 'tester@example.com',
      reason: 'left',
      by: 'operator',
    });
    expect(parseAllowlistArgs(['list'])).toEqual({ command: 'list' });
  });

  it('M2-AC02/2 both changes require --reason and --by, with a value that is not blank', () => {
    for (const command of ['add', 'remove'] as const) {
      const email = 'tester@example.com';
      expect(() => parseAllowlistArgs([command, email])).toThrow(/--reason/);
      expect(() => parseAllowlistArgs([command, email, '--reason', 'r'])).toThrow(/--by/);
      expect(() => parseAllowlistArgs([command, email, '--by', 'operator'])).toThrow(/--reason/);
      expect(() => parseAllowlistArgs([command, email, '--reason', '   ', '--by', 'operator'])).toThrow(/--reason/);
      expect(() => parseAllowlistArgs([command, email, '--reason', 'r', '--by', '  '])).toThrow(/--by/);
      // A flag swallowing the next flag would leave the audit field empty.
      expect(() => parseAllowlistArgs([command, email, '--reason', '--by', 'operator'])).toThrow(
        /--reason needs a value/,
      );
    }
  });

  it('M2-AC02/2 an address that looks like an option is refused, never acted on as one', () => {
    // Without this an address beginning with `--` would be parsed as an unknown
    // flag and the command would act on nothing while appearing to work.
    expect(() =>
      parseAllowlistArgs(['add', '--evil@example.com', '--reason', 'r', '--by', 'operator']),
    ).toThrow(/Unknown option "--evil@example.com"/);
    expect(() => parseAllowlistArgs(['add', 'tester@example.com', '--force', '--reason', 'r', '--by', 'b'])).toThrow(
      /Unknown option "--force"/,
    );
  });

  it('M2-AC02/2 exactly one address per change, and none for list', () => {
    expect(() => parseAllowlistArgs(['add', '--reason', 'r', '--by', 'b'])).toThrow(/exactly one email address/);
    expect(() =>
      parseAllowlistArgs(['add', 'a@example.com', 'b@example.com', '--reason', 'r', '--by', 'b']),
    ).toThrow(/exactly one email address/);
    expect(() => parseAllowlistArgs(['list', 'tester@example.com'])).toThrow(/list takes no arguments/);
    expect(() => parseAllowlistArgs(['list', '--reason', 'r'])).toThrow(/list takes no arguments/);
  });

  it('M2-AC02/2 an unknown or missing command prints the usage instead of guessing', () => {
    expect(() => parseAllowlistArgs([])).toThrow(/Unknown command ""/);
    expect(() => parseAllowlistArgs(['delete', 'tester@example.com'])).toThrow(/Unknown command "delete"/);
    expect(() => parseAllowlistArgs(['ADD', 'tester@example.com'])).toThrow(/Unknown command "ADD"/);
    // Every refusal names the three commands, so the terminal is enough to recover.
    expect(() => parseAllowlistArgs(['delete'])).toThrow(/pnpm db:allowlist add <email>/);
  });
});
