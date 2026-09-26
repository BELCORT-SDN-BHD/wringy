import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { AUDIT_ACTIONS, AuditShapeError, assertSummaryShape, sessionRefOf, writeAudit, type AuditEntry } from './audit';

/**
 * The audit writer's own guards (M2-03 code review R3, R4): the summary shape is
 * checked at run time as well as by the type, and a session is referenced only
 * by its sha256. The database half — the row, its grants, the rollback — is
 * tests/integration/audit.int.test.ts.
 */

const ENTRY: AuditEntry = {
  actorKind: 'user',
  actorUserId: '0ca70100-0000-4000-8000-000000000004',
  contextOrgId: 'a0000000-0000-4000-8000-000000000001',
  action: 'org.rename',
  targetType: 'org',
  targetId: 'a0000000-0000-4000-8000-000000000001',
  outcome: 'allowed',
  summary: { before: { name: 'Old' }, after: { name: 'New' } },
  requestId: '8c2b3d4e-0000-4000-8000-000000000001',
  sessionRef: 'f'.repeat(64),
};

describe('M2-AC03 the audit writer', () => {
  it('M2-AC03/3 the summary guard accepts before/after with role, status, capability and name only', () => {
    expect(() => assertSummaryShape(undefined)).not.toThrow();
    expect(() => assertSummaryShape({})).not.toThrow();
    expect(() =>
      assertSummaryShape({
        before: { role: 'admin', status: 'active', capability: 'review', name: 'Kopi Kita' },
        after: { role: 'member' },
      }),
    ).not.toThrow();
  });

  it('M2-AC03/3 the summary guard refuses an address, a token, an unknown key, a third side and a non-string value', () => {
    const refused: unknown[] = [
      { after: { email: 'carol@example.test' } },
      { before: { token: 'abc' } },
      { after: { name: 'x', contactEmail: 'x' } },
      { during: { role: 'admin' } },
      { after: { role: 1 } },
      { after: { name: { nested: 'x' } } },
      { after: ['role'] },
      null,
      'role',
      [],
    ];
    for (const summary of refused) {
      expect(() => assertSummaryShape(summary), JSON.stringify(summary)).toThrow(AuditShapeError);
    }
  });

  it('M2-AC03/3 the refusal message names the key and never its value', () => {
    let message = '';
    try {
      assertSummaryShape({ after: { email: 'carol@example.test' } });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('after.email');
    expect(message).not.toContain('carol@example.test');
  });

  it('M2-AC03/3 writeAudit refuses a bad summary before it sends anything', async () => {
    const sent: string[] = [];
    const client = {
      query: async (sql: string) => {
        sent.push(sql);
        return {};
      },
    };
    const bad = { ...ENTRY, summary: { after: { email: 'carol@example.test' } } } as unknown as AuditEntry;
    await expect(writeAudit(client, bad)).rejects.toThrow(AuditShapeError);
    expect(sent).toEqual([]);

    await writeAudit(client, ENTRY);
    expect(sent).toHaveLength(1);
    // No RETURNING: the runtime role has no SELECT on app.audit_log (0016).
    expect(sent[0]).not.toMatch(/returning/i);
  });

  it('M2-AC03/3 a session is referenced by the sha256 of its id, in hex, never by the id', () => {
    const sessionId = '44444444-4444-4444-8444-444444444444';
    const ref = sessionRefOf(sessionId);
    expect(ref).toMatch(/^[0-9a-f]{64}$/);
    expect(ref).toBe(createHash('sha256').update(sessionId).digest('hex'));
    expect(ref).not.toContain(sessionId);
    expect(sessionRefOf('another')).not.toBe(ref);
  });

  it('M2-AC03/3 the action list is noun.verb and stable', () => {
    for (const action of AUDIT_ACTIONS) expect(action).toMatch(/^[a-z_]+\.[a-z_]+$/);
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
  });

  it('M2-AC03/3 the entry type is closed: no bootstrap actor, no unknown action, no summary key outside the four', () => {
    // Compile-time rows: `pnpm typecheck` fails if any of these starts to compile.
    const bootstrap: AuditEntry = {
      ...ENTRY,
      // @ts-expect-error the API never writes a bootstrap row (R3)
      actorKind: 'bootstrap',
    };
    const unknownAction: AuditEntry = {
      ...ENTRY,
      // @ts-expect-error actions are the closed AUDIT_ACTIONS list
      action: 'org.delete',
    };
    const email: AuditEntry = {
      ...ENTRY,
      // @ts-expect-error a summary never carries an address
      summary: { after: { email: 'carol@example.test' } },
    };
    const code: AuditEntry = {
      ...ENTRY,
      outcome: 'denied',
      // @ts-expect-error a denial code is one of the API's error codes
      denialCode: 'org.nope',
    };
    expect([bootstrap, unknownAction, email, code]).toHaveLength(4);
  });
});
