import { describe, expect, it } from 'vitest';

import { parseGrantArgs } from './grants-args';

const USER = '0ca70100-0000-4000-8000-000000000004';
const ORG = 'a0000000-0000-4000-8000-000000000001';

/**
 * The grant CLI's argument rule (ruling D4; M2-03 code review R6). A capability
 * is granted only by this script, so every refusal here is the difference
 * between an audited change and a silent or anonymous one.
 */
describe('M2-AC03/1 the grant CLI refuses an unaudited or ambiguous change', () => {
  it('M2-AC03/1 grant and revoke carry the scope, the subject, the capability, the reason and the author', () => {
    expect(parseGrantArgs(['grant', 'org', USER, ORG, 'review', '--reason', 'first reviewer', '--by', 'founder'])).toEqual({
      command: 'grant',
      scope: 'org',
      userId: USER,
      orgId: ORG,
      capability: 'review',
      reason: 'first reviewer',
      by: 'founder',
    });
    expect(parseGrantArgs(['revoke', 'org', USER, ORG, 'finance', '--by', 'founder', '--reason', 'left'])).toEqual({
      command: 'revoke',
      scope: 'org',
      userId: USER,
      orgId: ORG,
      capability: 'finance',
      reason: 'left',
      by: 'founder',
    });
    expect(parseGrantArgs(['grant', 'platform', USER, 'ops_runtime', '--reason', 'on call', '--by', 'founder'])).toEqual({
      command: 'grant',
      scope: 'platform',
      userId: USER,
      capability: 'ops_runtime',
      reason: 'on call',
      by: 'founder',
    });
    // Ids are compared in lower case, as PostgreSQL prints them.
    expect(parseGrantArgs(['revoke', 'platform', USER.toUpperCase(), 'ops_runtime', '--reason', 'r', '--by', 'b'])).toMatchObject({
      userId: USER,
    });
  });

  it('M2-AC03/1 list takes nothing or one user id', () => {
    expect(parseGrantArgs(['list'])).toEqual({ command: 'list' });
    expect(parseGrantArgs(['list', USER])).toEqual({ command: 'list', userId: USER });
    expect(() => parseGrantArgs(['list', USER, ORG])).toThrow(/list takes at most one user id/);
    expect(() => parseGrantArgs(['list', '--reason', 'r'])).toThrow(/list takes at most one user id/);
    expect(() => parseGrantArgs(['list', 'alice'])).toThrow(/The user id must be a UUID/);
  });

  it('M2-AC03/1 every change requires --reason and --by, not blank, and never swallows the next flag', () => {
    for (const argv of [
      ['grant', 'org', USER, ORG, 'review'],
      ['revoke', 'platform', USER, 'ops_runtime'],
    ]) {
      expect(() => parseGrantArgs(argv)).toThrow(/--reason/);
      expect(() => parseGrantArgs([...argv, '--reason', 'r'])).toThrow(/--by/);
      expect(() => parseGrantArgs([...argv, '--reason', '  ', '--by', 'b'])).toThrow(/--reason/);
      expect(() => parseGrantArgs([...argv, '--reason', 'r', '--by', ' '])).toThrow(/--by/);
      expect(() => parseGrantArgs([...argv, '--reason', '--by', 'founder'])).toThrow(/--reason needs a value/);
    }
  });

  it('M2-AC03/3 --reason and --by may not carry an address into the audit log', () => {
    const argv = ['grant', 'org', USER, ORG, 'review'];
    expect(() => parseGrantArgs([...argv, '--reason', 'r', '--by', 'founder@example.test'])).toThrow(
      /--by may not contain "@"/,
    );
    expect(() => parseGrantArgs([...argv, '--reason', 'asked by carol@example.test', '--by', 'founder'])).toThrow(
      /--reason may not contain "@"/,
    );
  });

  it('M2-AC03/1 unknown options, option-shaped values and malformed ids are refused, never guessed', () => {
    expect(() =>
      parseGrantArgs(['grant', 'org', USER, ORG, 'review', '--force', '--reason', 'r', '--by', 'b']),
    ).toThrow(/Unknown option "--force"/);
    expect(() =>
      parseGrantArgs(['grant', 'org', `--${USER}`, ORG, 'review', '--reason', 'r', '--by', 'b']),
    ).toThrow(/Unknown option/);
    expect(() => parseGrantArgs(['grant', 'org', 'carol', ORG, 'review', '--reason', 'r', '--by', 'b'])).toThrow(
      /The user id must be a UUID/,
    );
    expect(() => parseGrantArgs(['grant', 'org', USER, 'kopi-kita', 'review', '--reason', 'r', '--by', 'b'])).toThrow(
      /The org id must be a UUID/,
    );
  });

  it('M2-AC03/3 review and finance are org capabilities, ops_runtime a platform one, and nothing else is', () => {
    const author = ['--reason', 'r', '--by', 'b'];
    expect(() => parseGrantArgs(['grant', 'org', USER, ORG, 'ops_runtime', ...author])).toThrow(
      /Unknown org capability "ops_runtime"/,
    );
    expect(() => parseGrantArgs(['grant', 'platform', USER, 'review', ...author])).toThrow(
      /Unknown platform capability "review"/,
    );
    expect(() => parseGrantArgs(['grant', 'org', USER, ORG, 'admin', ...author])).toThrow(/Unknown org capability/);
    expect(() => parseGrantArgs(['grant', 'org', USER, 'review', ...author])).toThrow(/org takes <userId> <orgId>/);
    expect(() => parseGrantArgs(['grant', 'platform', USER, ORG, 'ops_runtime', ...author])).toThrow(
      /platform takes <userId> <capability>/,
    );
    expect(() => parseGrantArgs(['grant', 'workspace', USER, ...author])).toThrow(/needs a scope: org or platform/);
  });

  it('M2-AC03/1 an unknown or missing command prints the usage instead of guessing', () => {
    expect(() => parseGrantArgs([])).toThrow(/Unknown command ""/);
    expect(() => parseGrantArgs(['add', 'org'])).toThrow(/Unknown command "add"/);
    expect(() => parseGrantArgs(['GRANT'])).toThrow(/pnpm db:grant grant org <userId> <orgId>/);
  });
});
