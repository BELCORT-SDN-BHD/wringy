import { describe, expect, it } from 'vitest';

import {
  PlatformBootstrapRefusedError,
  installPlatform,
  platformBootstrapSummary,
  type InstallPlatformResult,
  type PlatformAdminClient,
} from './platform';

/**
 * What `pnpm db:platform-bootstrap` tells the operator to do next (M2-02 R2, R3).
 *
 * The wording is the whole point of the test. A stub `auth.sessions` is written by
 * nothing but a test, so Mechanism A ("database") answers "revoked" for every real
 * Supabase session: an operator who followed a next step that said
 * `SESSION_LIVENESS=database` there would refuse every tester's sign-in with the
 * one code that means "you were signed out", and no message would point at the
 * cause.
 */
const LOCAL: InstallPlatformResult = { owner: 'wringy_platform_admin', adminIsSuperuser: true, stubbedAuth: true };
const HOSTED: InstallPlatformResult = { owner: 'postgres', adminIsSuperuser: false, stubbedAuth: false };

describe('M2-AC02/2 the platform bootstrap names the next step for the install it actually made', () => {
  it('M2-AC02/2 a stub auth.sessions keeps the api on auth_server, and says why', () => {
    const lines = platformBootstrapSummary({ WRINGY_ENV: 'local', database: 'wringy' }, LOCAL);
    const next = lines.at(-1) ?? '';

    expect(next).toContain('SESSION_LIVENESS=auth_server');
    expect(next).toContain('revoked');
    // The one thing it must never say on this branch.
    expect(next).not.toMatch(/set SESSION_LIVENESS=database/);
    expect(lines[0]).toContain('WRINGY_ENV=local');
    expect(lines.join('\n')).toContain('stub present');
  });

  it('M2-AC02/2 a real identity store is where SESSION_LIVENESS=database belongs', () => {
    const lines = platformBootstrapSummary({ WRINGY_ENV: 'staging', database: 'postgres' }, HOSTED);

    expect(lines.at(-1)).toBe('Next: set SESSION_LIVENESS=database for the api in this environment');
    expect(lines.join('\n')).toContain("the identity store's own table, left untouched");
    expect(lines.join('\n')).toContain('owner postgres');
  });

  it('M2-AC02/2 every summary states what was verified and never prints a connection', () => {
    for (const result of [LOCAL, HOSTED]) {
      const text = platformBootstrapSummary({ WRINGY_ENV: 'ci', database: 'wringy_test' }, result).join('\n');
      expect(text).toContain('verified: the function is executable');
      expect(text).toContain('wringy_api only');
      expect(text).not.toMatch(/postgres:\/\//);
    }
  });
});

/**
 * A stand-in admin connection. `PlatformAdminClient` is just `query`, so the
 * install's shape can be driven exactly — including the one failure a real cluster
 * cannot be made to show here, because the install's own GRANT would repair it.
 */
function fakeAdmin({ executable }: { executable: boolean }): { client: PlatformAdminClient; sql: string[] } {
  const sql: string[] = [];
  const client: PlatformAdminClient = {
    query: (async (text: string) => {
      sql.push(text);
      if (text.includes('rolsuper')) return { rows: [{ superuser: false }] };
      if (text.includes('pg_roles WHERE rolname')) return { rows: [{ exists: true }] };
      if (text.includes('to_regclass')) return { rows: [{ present: true }] };
      if (text.includes('CURRENT_USER AS owner')) return { rows: [{ owner: 'postgres' }] };
      if (text.includes('session_is_live($1')) {
        if (executable) return { rows: [{ session_is_live: false }] };
        // What PostgreSQL raises when the function's OWNER has no SELECT on the
        // sessions table: a SQL body's table privileges are checked at execution.
        throw Object.assign(new Error('permission denied for table sessions'), { code: '42501' });
      }
      return { rows: [] };
    }) as PlatformAdminClient['query'],
  };
  return { client, sql };
}

describe('M2-AC02/2 the platform bootstrap proves the function can read the sessions table', () => {
  it('M2-AC02/2 an install whose function cannot be executed is refused, naming the missing SELECT', async () => {
    // CREATE OR REPLACE FUNCTION accepts a body whose table the owner cannot read:
    // privileges are checked when it runs. Without this call the install prints
    // "complete", and every sign-in afterwards raises 42501 — which the api
    // deliberately does not classify as unavailable, so it becomes 500
    // internal_error, the least informative answer there is.
    const { client, sql } = fakeAdmin({ executable: false });

    const refused = await installPlatform(client, { databaseName: 'wringy', stubAuth: false }).catch(
      (error: unknown) => error,
    );

    expect(refused).toBeInstanceOf(PlatformBootstrapRefusedError);
    expect((refused as Error).message).toContain('42501');
    expect((refused as Error).message).toContain('auth.sessions');
    expect((refused as Error).message).toContain('SELECT');
    // It really did try to create the objects first: the refusal is about the call.
    expect(sql.some((text) => text.includes('CREATE OR REPLACE FUNCTION'))).toBe(true);
  });

  it('M2-AC02/2 an install that can answer returns normally, having asked once', async () => {
    const { client, sql } = fakeAdmin({ executable: true });

    await expect(installPlatform(client, { databaseName: 'wringy', stubAuth: false })).resolves.toEqual({
      owner: 'postgres',
      adminIsSuperuser: false,
      stubbedAuth: false,
    });
    expect(sql.filter((text) => text.includes('session_is_live($1'))).toHaveLength(1);
  });
});
