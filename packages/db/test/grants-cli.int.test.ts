import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  GrantRefusedError,
  grantOrgCapability,
  grantPlatformCapability,
  listGrants,
  revokeOrgCapability,
  revokePlatformCapability,
} from '../src/grants';
import { ROLES } from '../src/roles';
import { createTestDatabase, seedFixtures, withClientAt, type TestDatabase } from './harness';

const DB_DIR = fileURLToPath(new URL('../', import.meta.url));

/** The seed's Kopi Kita and Nusantara Fit (fixtures/internal-campaigns.sql). */
const KOPI_KITA = 'a0000000-0000-4000-8000-000000000001';
const NUSANTARA_FIT = 'a0000000-0000-4000-8000-000000000002';

const CAROL = '0ca70100-0000-4000-8000-00000000e003';
const DAVE = '0da4e000-0000-4000-8000-00000000e004';
const ERIN = '0e410000-0000-4000-8000-00000000e005';
/** A well-formed user id nobody has signed in with. */
const NEVER_SIGNED_IN = '0badbad0-0000-4000-8000-00000000e0ff';

interface AuditRow {
  recorded_by: string;
  actor_kind: string;
  actor_user_id: string | null;
  actor_label: string;
  context_org_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  outcome: string;
  denial_code: string | null;
  reason: string;
  summary: unknown;
  request_id: string | null;
  session_ref: string | null;
}

/** Runs `pnpm db:grant`'s entry (src/cli/grant.ts) in a child process with only the migrator's variables. */
function runCli(args: string[], databaseUrl: string): Promise<{ code: number | null; output: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, WRINGY_ENV: 'ci', DATABASE_URL_MIGRATOR: databaseUrl };
  delete env.TEST_DATABASE_URL;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/cli/grant.ts', ...args], {
      cwd: DB_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    const timer = setTimeout(() => child.kill(), 25_000);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

/**
 * `pnpm db:grant` (packages/db/src/grants.ts, src/cli/grant.ts; M2-03 code
 * review R6): the grant and its audit row are one statement, as the migrator.
 */
describe('M2-AC03 capability grants are written only by the audited script', () => {
  let db: TestDatabase;
  let migrator: pg.Pool;

  const auditRows = async (action?: string): Promise<AuditRow[]> =>
    (
      await migrator.query<AuditRow>(
        `SELECT recorded_by::text AS recorded_by, actor_kind, actor_user_id, actor_label, context_org_id, action,
                target_type, target_id, outcome, denial_code, reason, summary, request_id, session_ref
           FROM app.audit_log WHERE $1::text IS NULL OR action = $1 ORDER BY id`,
        [action ?? null],
      )
    ).rows;

  beforeAll(async () => {
    db = await createTestDatabase();
    migrator = new pg.Pool({ connectionString: db.urls.migrator, max: 2 });
    await seedFixtures(db);
    for (const [id, name] of [
      [CAROL, 'carol'],
      [DAVE, 'dave'],
      [ERIN, 'erin'],
    ] as const) {
      await migrator.query(
        `INSERT INTO app.profiles (id, contact_email, display_name, last_sign_in_at) VALUES ($1, $2, $3, now())`,
        [id, `${name}@example.test`, name],
      );
    }
  });

  afterAll(async () => {
    await migrator?.end();
    await db?.drop();
  });

  it('M2-AC03/1 an org grant and its bootstrap audit row are written together, and a repeat changes nothing', async () => {
    const granted = await grantOrgCapability(migrator, {
      userId: CAROL,
      orgId: KOPI_KITA,
      capability: 'review',
      reason: 'first reviewer',
      by: 'founder',
    });
    expect(granted).toMatchObject({
      outcome: 'granted',
      grant: { userId: CAROL, orgId: KOPI_KITA, capability: 'review', grantedByOperator: 'founder', reason: 'first reviewer' },
    });
    expect(await auditRows('capability.grant')).toEqual([
      {
        recorded_by: ROLES.migrator,
        actor_kind: 'bootstrap',
        actor_user_id: null,
        actor_label: 'founder',
        context_org_id: KOPI_KITA,
        action: 'capability.grant',
        target_type: 'admin_scope',
        target_id: CAROL,
        outcome: 'allowed',
        denial_code: null,
        reason: 'first reviewer',
        summary: { after: { capability: 'review' } },
        request_id: null,
        session_ref: null,
      },
    ]);

    const again = await grantOrgCapability(migrator, {
      userId: CAROL,
      orgId: KOPI_KITA,
      capability: 'review',
      reason: 'again',
      by: 'operator',
    });
    expect(again).toMatchObject({ outcome: 'already_granted', grant: { reason: 'first reviewer', grantedByOperator: 'founder' } });
    expect(await auditRows('capability.grant')).toHaveLength(1);
  });

  it('M2-AC03/3 a grant cannot be written without its audit row: a planted trigger that refuses the audit insert leaves no grant and no revocation', async () => {
    await migrator.query(`CREATE FUNCTION ops.wringy_test_refuse_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit insert refused by the test';
      END
      $$`);
    await migrator.query(`CREATE TRIGGER wringy_test_refuse_audit BEFORE INSERT ON app.audit_log
                            FOR EACH ROW EXECUTE FUNCTION ops.wringy_test_refuse_audit()`);
    try {
      const options = { userId: DAVE, orgId: NUSANTARA_FIT, capability: 'finance', reason: 'r', by: 'founder' } as const;
      await expect(grantOrgCapability(migrator, options)).rejects.toThrow(/audit insert refused by the test/);
      await expect(
        grantPlatformCapability(migrator, { userId: DAVE, capability: 'ops_runtime', reason: 'r', by: 'founder' }),
      ).rejects.toThrow(/audit insert refused by the test/);
      // The review grant of the test above cannot be revoked without its audit row either.
      await expect(
        revokeOrgCapability(migrator, { userId: CAROL, orgId: KOPI_KITA, capability: 'review', reason: 'r', by: 'founder' }),
      ).rejects.toThrow(/audit insert refused by the test/);

      const { rows } = await migrator.query<{ scopes: number; platform: number; carol: number }>(
        `SELECT (SELECT count(*)::int FROM app.admin_scopes WHERE user_id = $1) AS scopes,
                (SELECT count(*)::int FROM app.platform_grants WHERE user_id = $1) AS platform,
                (SELECT count(*)::int FROM app.admin_scopes WHERE user_id = $2) AS carol`,
        [DAVE, CAROL],
      );
      expect(rows[0]).toEqual({ scopes: 0, platform: 0, carol: 1 });
    } finally {
      await migrator.query('DROP TRIGGER wringy_test_refuse_audit ON app.audit_log');
      await migrator.query('DROP FUNCTION ops.wringy_test_refuse_audit()');
    }
  });

  it('M2-AC03/3 a revocation deletes the grant and writes its own row; revoking nothing writes nothing', async () => {
    await grantOrgCapability(migrator, { userId: ERIN, orgId: NUSANTARA_FIT, capability: 'finance', reason: 'close', by: 'founder' });
    const revoked = await revokeOrgCapability(migrator, {
      userId: ERIN,
      orgId: NUSANTARA_FIT,
      capability: 'finance',
      reason: 'rotation',
      by: 'founder',
    });
    expect(revoked).toMatchObject({ outcome: 'revoked', grant: { userId: ERIN, capability: 'finance', reason: 'close' } });
    expect(await auditRows('capability.revoke')).toEqual([
      expect.objectContaining({
        recorded_by: ROLES.migrator,
        actor_kind: 'bootstrap',
        actor_label: 'founder',
        context_org_id: NUSANTARA_FIT,
        target_type: 'admin_scope',
        target_id: ERIN,
        reason: 'rotation',
        summary: { before: { capability: 'finance' } },
      }),
    ]);
    expect(
      await revokeOrgCapability(migrator, { userId: ERIN, orgId: NUSANTARA_FIT, capability: 'finance', reason: 'r', by: 'b' }),
    ).toEqual({ outcome: 'absent' });
    expect(await auditRows('capability.revoke')).toHaveLength(1);
  });

  it('M2-AC03/3 a platform grant is audited without an org, and review and finance are separate rows', async () => {
    await grantPlatformCapability(migrator, { userId: ERIN, capability: 'ops_runtime', reason: 'on call', by: 'founder' });
    await grantOrgCapability(migrator, { userId: ERIN, orgId: KOPI_KITA, capability: 'review', reason: 'r', by: 'founder' });
    const listed = await listGrants(migrator, ERIN);
    expect(listed.platform.map((grant) => grant.capability)).toEqual(['ops_runtime']);
    // A review grant is not a finance grant.
    expect(listed.org.map((grant) => [grant.orgId, grant.capability])).toEqual([[KOPI_KITA, 'review']]);
    const platformRows = (await auditRows('capability.grant')).filter((row) => row.target_type === 'platform_grant');
    expect(platformRows).toEqual([
      expect.objectContaining({
        actor_kind: 'bootstrap',
        context_org_id: null,
        target_id: ERIN,
        summary: { after: { capability: 'ops_runtime' } },
      }),
    ]);
    expect(await revokePlatformCapability(migrator, { userId: ERIN, capability: 'ops_runtime', reason: 'r', by: 'b' })).toMatchObject({
      outcome: 'revoked',
    });
    expect((await listGrants(migrator, ERIN)).platform).toEqual([]);
  });

  it('M2-AC03/1 a subject that has never signed in, an unknown org, or an address in --by or --reason is refused and nothing is written', async () => {
    const before = (await auditRows()).length;
    await expect(
      grantOrgCapability(migrator, { userId: NEVER_SIGNED_IN, orgId: KOPI_KITA, capability: 'review', reason: 'r', by: 'founder' }),
    ).rejects.toThrow(/this subject has never signed in/);
    await expect(
      grantPlatformCapability(migrator, { userId: NEVER_SIGNED_IN, capability: 'ops_runtime', reason: 'r', by: 'founder' }),
    ).rejects.toThrow(/this subject has never signed in/);
    await expect(
      grantOrgCapability(migrator, {
        userId: DAVE,
        orgId: 'a0000000-0000-4000-8000-0000000000ff',
        capability: 'review',
        reason: 'r',
        by: 'founder',
      }),
    ).rejects.toThrow(/No organisation has this org id/);
    for (const author of [
      { reason: 'r', by: 'founder@example.test' },
      { reason: 'asked by dave@example.test', by: 'founder' },
    ]) {
      await expect(
        grantOrgCapability(migrator, { userId: DAVE, orgId: KOPI_KITA, capability: 'review', ...author }),
      ).rejects.toBeInstanceOf(GrantRefusedError);
    }
    await expect(
      grantOrgCapability(migrator, {
        userId: DAVE,
        orgId: KOPI_KITA,
        // @ts-expect-error — the CHECK's domain is review|finance; ops_runtime is a platform capability.
        capability: 'ops_runtime',
        reason: 'r',
        by: 'founder',
      }),
    ).rejects.toThrow(/Unknown org capability/);
    expect((await auditRows()).length).toBe(before);
    expect((await listGrants(migrator, DAVE)).org).toEqual([]);
  });

  it('M2-AC03/1 the runtime login cannot use the grant functions: it has SELECT only on the grant tables (42501)', async () => {
    await expect(
      withClientAt(db.urls.api, (client) =>
        grantOrgCapability(client, { userId: DAVE, orgId: KOPI_KITA, capability: 'finance', reason: 'self', by: 'api' }),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    // It may read them, which is all a capability check needs.
    const seen = await withClientAt(db.urls.api, (client) => listGrants(client, CAROL));
    expect(seen.org.map((grant) => grant.capability)).toEqual(['review']);
  });

  it('M2-AC03/1 pnpm db:grant runs end to end as the migrator: grant, list, revoke, and a refusal for a subject that never signed in', async () => {
    const url = db.urls.migrator;
    const password = new URL(url).password;
    const author = ['--reason', 'cli walk', '--by', 'founder'];

    const granted = await runCli(['grant', 'org', DAVE, KOPI_KITA, 'review', ...author], url);
    expect(granted).toEqual({
      code: 0,
      output: `Granted review on org ${KOPI_KITA} for ${DAVE} (by founder: cli walk); audited.\n`,
    });

    const listed = await runCli(['list', DAVE], url);
    expect(listed.code).toBe(0);
    expect(listed.output).toMatch(/^Capability grants: 1 org, 0 platform\.\n/);
    expect(listed.output).toContain(`${DAVE}  review on org ${KOPI_KITA}  granted `);
    expect(listed.output).toContain('by founder: cli walk');

    const revoked = await runCli(['revoke', 'org', DAVE, KOPI_KITA, 'review', ...author], url);
    expect(revoked).toEqual({
      code: 0,
      output: `Revoked review on org ${KOPI_KITA} for ${DAVE} (by founder: cli walk); audited.\n`,
    });

    const refused = await runCli(['grant', 'platform', NEVER_SIGNED_IN, 'ops_runtime', ...author], url);
    expect(refused.code).toBe(1);
    expect(refused.output).toMatch(/this subject has never signed in/);

    const withAddress = await runCli(['grant', 'org', DAVE, KOPI_KITA, 'review', '--reason', 'r', '--by', 'me@example.test'], url);
    expect(withAddress.code).toBe(1);
    expect(withAddress.output).toMatch(/--by may not contain "@"/);

    for (const run of [granted, listed, revoked, refused, withAddress]) {
      expect(run.output).not.toContain(password);
      expect(run.output).not.toContain('postgres://');
    }
    const cliRows = (await auditRows()).filter((row) => row.reason === 'cli walk');
    expect(cliRows.map((row) => [row.action, row.target_id, row.recorded_by])).toEqual([
      ['capability.grant', DAVE, ROLES.migrator],
      ['capability.revoke', DAVE, ROLES.migrator],
    ]);
  });
});
