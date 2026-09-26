import { describe, expect, it } from 'vitest';

import { messagesByLocale } from '@/i18n/messages';
import { LOCALES } from '@/i18n/config';
import type { ApiResult } from '@/lib/auth/api-client';

import { acceptLink, inviteCookieName, inviteCookieOptions } from './org-paths';
import {
  CONFIRMATION_OUTCOMES,
  END_SESSION,
  ORG_OUTCOMES,
  acceptPageState,
  outcomeFromQuery,
  refusalOutcome,
  type OrgCommand,
} from './outcomes';

/**
 * The outcome vocabulary of the org pages and the accept page's state mapping
 * (M2-03; m2-03-code-review.md R7, R9 rev 2, R12). Pure functions, so every row
 * is a direct call.
 */

/** R9's outcome list, verbatim, so this module can never silently drop one. */
const R9_OUTCOMES = [
  'created',
  'renamed',
  'invited',
  'revoked',
  'joined',
  'role_changed',
  'member_removed',
  'left',
  'forbidden',
  'admin_required',
  'last_admin',
  'already_member',
  'pending_exists',
  'invalid_email',
  'not_pending',
  'not_found',
  'session_ended',
  'unavailable',
  'unexpected',
];

const error = (status: number, code: string | null) => ({ kind: 'error' as const, status, code });

const INSTANT = '2026-10-03T01:00:00.000Z';
const PREVIEW = { org: { id: '0c0ffee0-0000-4000-8000-00000000000a', name: 'Dave Retail' }, role: 'member' as const, expiresAt: INSTANT };

describe('M2-AC03/3 outcomes: every outcome code has copy in all three languages', () => {
  it('M2-AC03/3 outcomes: the code list carries R9’s list and the accept refusals, each once', () => {
    for (const code of R9_OUTCOMES) expect(ORG_OUTCOMES, code).toContain(code);
    expect(new Set(ORG_OUTCOMES).size).toBe(ORG_OUTCOMES.length);
    expect(ORG_OUTCOMES.filter((code) => !R9_OUTCOMES.includes(code)).sort()).toEqual([
      'invitation_expired',
      'invitation_invalid',
      'invitation_mismatch',
      'invitation_used',
    ]);
  });

  it('M2-AC03/3 outcomes: internal.outcomes has exactly one sentence per code in every locale', () => {
    for (const locale of LOCALES) {
      const outcomes = (messagesByLocale[locale].internal as unknown as { outcomes: Record<string, string> }).outcomes;
      expect(Object.keys(outcomes).sort(), locale).toEqual([...ORG_OUTCOMES].sort());
      for (const code of ORG_OUTCOMES) {
        expect(typeof outcomes[code], `${locale} ${code}`).toBe('string');
        expect(outcomes[code]!.trim(), `${locale} ${code}`).not.toBe('');
      }
    }
  });

  it('M2-AC03/3 outcomes: every role has a label in every locale, and no key carries a dot', () => {
    const dotted = (tree: unknown, path: string[] = []): string[] =>
      tree !== null && typeof tree === 'object'
        ? Object.entries(tree).flatMap(([key, value]) => [
            ...(key.includes('.') ? [[...path, key].join(' › ')] : []),
            ...dotted(value, [...path, key]),
          ])
        : [];
    for (const locale of LOCALES) {
      const internal = messagesByLocale[locale].internal as unknown as { role: Record<string, string> };
      expect(Object.keys(internal.role).sort(), locale).toEqual(['admin', 'member']);
      // use-intl rejects a dotted key (m2-03-code-review.md §1).
      expect(dotted(internal), locale).toEqual([]);
    }
  });

  it('M2-AC03/3 outcomes: only the eight changes read as confirmations', () => {
    expect([...CONFIRMATION_OUTCOMES].sort()).toEqual(
      ['created', 'invited', 'joined', 'left', 'member_removed', 'renamed', 'revoked', 'role_changed'].sort(),
    );
  });
});

describe('M2-AC03/2 outcomes: the page shows only a known outcome, and only the first value', () => {
  it('M2-AC03/2 outcomes: reads ?outcome= as the first value and ignores anything unknown', () => {
    expect(outcomeFromQuery({ outcome: 'joined' })).toBe('joined');
    expect(outcomeFromQuery({ outcome: ['last_admin', 'joined'] })).toBe('last_admin');
    for (const value of [undefined, '', 'JOINED', 'joined ', 'org.forbidden', '<script>', 'toString', '__proto__']) {
      expect(outcomeFromQuery({ outcome: value }), String(value)).toBeNull();
    }
    expect(outcomeFromQuery({})).toBeNull();
  });
});

describe('M2-AC03/2 outcomes: a refused command is named from the API’s status and code', () => {
  const COMMANDS: OrgCommand[] = ['create', 'rename', 'invite', 'revoke', 'role', 'remove', 'leave', 'accept'];

  it('M2-AC03/2 outcomes: the whole mapping, identical for every command except the 400', () => {
    const rows: [Exclude<ApiResult<unknown>, { kind: 'ok' }>, string][] = [
      [error(401, 'unauthenticated'), 'session_ended'],
      [error(401, 'session.revoked'), 'session_ended'],
      [error(401, null), 'session_ended'],
      [error(403, 'account.disabled'), END_SESSION],
      [error(403, 'org.forbidden'), 'forbidden'],
      [error(403, 'org.admin_required'), 'admin_required'],
      [error(409, 'org.last_admin'), 'last_admin'],
      [error(409, 'invitation.already_member'), 'already_member'],
      [error(409, 'invitation.pending'), 'pending_exists'],
      [error(409, 'invitation.not_pending'), 'not_pending'],
      [error(403, 'invitation.invalid'), 'invitation_invalid'],
      [error(403, 'invitation.expired'), 'invitation_expired'],
      [error(403, 'invitation.used'), 'invitation_used'],
      [error(403, 'invitation.email_mismatch'), 'invitation_mismatch'],
      [error(404, 'member.not_found'), 'not_found'],
      [error(404, 'invitation.not_found'), 'not_found'],
      [error(404, null), 'not_found'],
      // A code under the wrong status is not the refusal it names.
      [error(409, 'org.forbidden'), 'unexpected'],
      [error(403, 'org.last_admin'), 'unexpected'],
      [error(403, 'profile.missing'), 'unexpected'],
      [error(403, null), 'unexpected'],
      [error(409, 'member.self'), 'unexpected'],
      [error(409, 'toString'), 'unexpected'],
      [{ kind: 'failure', failure: 'api-unavailable' }, 'unavailable'],
      [{ kind: 'failure', failure: 'api-unreachable' }, 'unexpected'],
      [{ kind: 'failure', failure: 'unexpected' }, 'unexpected'],
    ];
    for (const command of COMMANDS) {
      for (const [result, expected] of rows) {
        expect(refusalOutcome(result, command), `${command} ${JSON.stringify(result)}`).toBe(expected);
      }
    }
  });

  it('M2-AC03/2 outcomes: a 400 is an address the API would not take only on the invite command', () => {
    for (const command of COMMANDS) {
      expect(refusalOutcome(error(400, 'bad_request'), command), command).toBe(command === 'invite' ? 'invalid_email' : 'unexpected');
    }
  });
});

describe('M2-AC03/3 accept page: the addressed person sees the invitation, anybody else sees only a mismatch', () => {
  it('M2-AC03/3 accept page: the preview states and the refusals, as page states', () => {
    expect(acceptPageState(null)).toEqual({ kind: 'invalid' });

    expect(acceptPageState({ kind: 'ok', data: { state: 'pending', ...PREVIEW } })).toEqual({
      kind: 'pending',
      preview: { state: 'pending', ...PREVIEW },
    });
    expect(acceptPageState({ kind: 'ok', data: { state: 'expired', ...PREVIEW } })).toMatchObject({ kind: 'expired' });
    // The API's `accepted` is the page's `used`.
    expect(acceptPageState({ kind: 'ok', data: { state: 'accepted', ...PREVIEW } })).toMatchObject({ kind: 'used' });

    // Somebody else holding the link learns nothing about the org, the role or the expiry.
    const mismatch = acceptPageState({ kind: 'ok', data: { state: 'email_mismatch' } });
    expect(mismatch).toEqual({ kind: 'email_mismatch' });
    expect(JSON.stringify(mismatch)).not.toContain('Dave Retail');

    expect(acceptPageState(error(403, 'invitation.invalid'))).toEqual({ kind: 'invalid' });
    expect(acceptPageState(error(403, 'invitation.email_mismatch'))).toEqual({ kind: 'email_mismatch' });
    expect(acceptPageState(error(403, 'invitation.used'))).toEqual({ kind: 'invalid' });
    expect(acceptPageState(error(403, 'account.disabled'))).toEqual({ kind: 'end_session' });
    expect(acceptPageState(error(401, 'auth.expired'))).toEqual({ kind: 'session_ended' });
    expect(acceptPageState(error(400, 'bad_request'))).toEqual({ kind: 'failure', failure: 'unexpected' });
    expect(acceptPageState(error(403, 'profile.missing'))).toEqual({ kind: 'failure', failure: 'unexpected' });
    for (const failure of ['api-unavailable', 'api-unreachable', 'unexpected'] as const) {
      expect(acceptPageState({ kind: 'failure', failure }), failure).toEqual({ kind: 'failure', failure });
    }
  });
});

describe('M2-AC03/3 invitation link: where the token may live', () => {
  const TOKEN = 'inviteToken_0123456789-abcdefghijklmnopqrst';
  const ORG = '0c0ffee0-0000-4000-8000-00000000000a';
  const INVITATION = '1a000000-0000-4000-8000-000000000001';

  it('M2-AC03/3 invitation link: the accept link is APP_ORIGIN’s accept page with the token as its only query', () => {
    const link = new URL(acceptLink('https://internal.wringy.example', TOKEN));
    expect(link.origin).toBe('https://internal.wringy.example');
    expect(link.pathname).toBe('/internal/invitations/accept');
    expect([...link.searchParams]).toEqual([['token', TOKEN]]);
  });

  it('M2-AC03/3 invitation link: the cookie is httpOnly, lax, 10 minutes and scoped to the one invitation page', () => {
    expect(inviteCookieName(INVITATION)).toBe(`wringy-invite-${INVITATION}`);
    expect(inviteCookieOptions(ORG, INVITATION, true)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: `/internal/orgs/${ORG}/invitations/${INVITATION}`,
      maxAge: 600,
    });
  });
});
