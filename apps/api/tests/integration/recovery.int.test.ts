/**
 * Recovery, as M2-03 defines it: "回退撤销新增授权而保留业务记录" (the ticket's
 * Verification line; m2-03-code-review.md R15 rev 2). Revoking everything this
 * ticket adds — a membership, a capability, an invitation — removes the access
 * and keeps every business record and every audit row, and the runtime role
 * cannot delete any of them by privilege.
 *
 * The arrangement, and why (R15 leaves the choice to the builder): the seeded
 * Kopi Kita org cannot be given an admin honestly. Its `created_by` is NULL, so
 * no `org_created` membership can pass `org_members_creator_fkey`; and an
 * `invitation` membership needs an accepted invitation whose inviter is already a
 * member (`org_invitations_inviter_fkey`), with neither foreign key deferrable,
 * so the first member of a creator-less org cannot be written at all. The
 * membership half therefore runs on a fresh org created through the API, the
 * product's own path; the capability is granted on **Kopi Kita**, whose three
 * fixture campaigns (with Nusantara Fit's) are what the business-record
 * assertion is about. A capability needs no membership (R5), so this is the grant
 * an operator would write for a Kopi Kita reviewer.
 *
 * The grant is written with `@wringy/db`'s function and revoked ONCE through the
 * `pnpm db:grant` entry (src/cli/grant.ts, spawned as
 * packages/db/test/grants-cli.int.test.ts does), because that entry is the
 * operator's revoke path (R15 b). The identities are simulated: tokens signed in
 * the process and verified by the real hook (jwt-support.ts).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestIdentity, type TestIdentity } from './jwt-support';
import {
  asMigrator,
  asOrgMember,
  auditRows,
  buildTestApi,
  createOrgAs,
  createTestDatabase,
  grantCapability,
  inviteAs,
  person,
  seedFixtures,
  sqlState,
  withClientAt,
  type PersonSpec,
  type SignedIn,
  type TestApi,
  type TestDatabase,
} from './support';

const DB_PACKAGE_DIR = fileURLToPath(new URL('../../../../packages/db/', import.meta.url));

/** The seed's orgs and campaigns (packages/db/fixtures/internal-campaigns.sql). */
const KOPI_KITA = 'a0000000-0000-4000-8000-000000000001';
const NUSANTARA_FIT = 'a0000000-0000-4000-8000-000000000002';
const FIXTURE_CAMPAIGNS = [
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003',
];

const CAROL: PersonSpec = {
  userId: '0ca70100-0000-4000-8000-000000000004',
  sessionId: '5e550000-0000-4000-8000-00000000c104',
  email: 'carol@example.test',
  name: 'Carol Wong',
};
const DAVE: PersonSpec = {
  userId: '0da4e000-0000-4000-8000-000000000005',
  sessionId: '5e550000-0000-4000-8000-00000000d105',
  email: 'dave@example.test',
  name: 'Dave Raj',
};
const ERIN_EMAIL = 'erin@example.test';

/** Runs the `pnpm db:grant` entry in a child process with only the migrator's variables, as the operator would. */
function runGrantCli(args: string[], databaseUrl: string): Promise<{ code: number | null; output: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, WRINGY_ENV: 'ci', DATABASE_URL_MIGRATOR: databaseUrl };
  delete env.TEST_DATABASE_URL;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/cli/grant.ts', ...args], {
      cwd: DB_PACKAGE_DIR,
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

interface CampaignRow {
  id: string;
  org_id: string;
  title: string;
  status: string;
  data_origin: string;
}

describe('M2-AC03 recovery: revoking what M2-03 adds keeps the business records', () => {
  let db: TestDatabase;
  let identity: TestIdentity;
  let api: TestApi;
  let carol: SignedIn;
  let dave: SignedIn;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedFixtures(db);
    identity = await createTestIdentity();
    api = await buildTestApi(db.urls.api, { identity });
    carol = await person(db, identity, CAROL);
    dave = await person(db, identity, DAVE);
  });

  afterAll(async () => {
    await api?.close();
    await db?.drop();
  });

  it('M2-AC03/1 recovery: removing a member, revoking a capability through pnpm db:grant and revoking an invitation keep the orgs, the fixture campaigns, the membership row and every audit row, and the runtime role can delete none of them (42501)', async () => {
    const campaignsBefore = await asMigrator<CampaignRow>(
      db,
      'SELECT id, org_id, title, status, data_origin FROM app.campaigns WHERE id = ANY($1::uuid[]) ORDER BY id',
      [FIXTURE_CAMPAIGNS],
    );
    expect(campaignsBefore.map((row) => row.id)).toEqual(FIXTURE_CAMPAIGNS);
    const auditBefore = (await asMigrator<{ max: string | null }>(db, 'SELECT max(id)::text AS max FROM app.audit_log'))[0]?.max ?? '0';

    // What M2-03 adds: an org with its creator admin, a member by invitation, a
    // pending invitation, and a review scope on Kopi Kita.
    const orgId = await createOrgAs(api, carol, 'Recovery Studio');
    await asOrgMember(api, carol, orgId, dave, 'member');
    const pending = await inviteAs(api, carol, orgId, ERIN_EMAIL, 'member');
    await grantCapability(db, { userId: DAVE.userId, orgId: KOPI_KITA, capability: 'review' });
    expect(
      await asMigrator(db, 'SELECT capability FROM app.admin_scopes WHERE user_id = $1 AND org_id = $2', [DAVE.userId, KOPI_KITA]),
    ).toEqual([{ capability: 'review' }]);

    // Recovery, each through its own path: the admin removes the member, the
    // operator revokes the grant with `pnpm db:grant`, the admin revokes the
    // pending invitation.
    const removed = await api.app.inject({
      method: 'POST',
      url: `/orgs/${orgId}/members/${DAVE.userId}/remove`,
      headers: carol.headers,
    });
    expect(removed.statusCode).toBe(200);

    const cli = await runGrantCli(
      ['revoke', 'org', DAVE.userId, KOPI_KITA, 'review', '--reason', 'recovery drill', '--by', 'wringy-test'],
      db.urls.migrator,
    );
    expect(cli.code, 'pnpm db:grant revoke exits 0').toBe(0);
    expect(cli.output).not.toContain('postgres://');

    const revoked = await api.app.inject({
      method: 'POST',
      url: `/orgs/${orgId}/invitations/${pending.invitationId}/revoke`,
      headers: carol.headers,
    });
    expect(revoked.statusCode).toBe(200);

    // The access is gone.
    expect(
      await asMigrator(db, 'SELECT 1 FROM app.admin_scopes WHERE user_id = $1 AND org_id = $2', [DAVE.userId, KOPI_KITA]),
    ).toEqual([]);
    const daveAfter = await api.app.inject({ method: 'GET', url: `/orgs/${orgId}`, headers: dave.headers });
    expect(daveAfter.statusCode).toBe(403);

    // Every business record is still there: both fixture orgs and the new one, the
    // three fixture campaigns unchanged, the membership row (now removed) and both
    // invitations with their final state.
    const orgs = await asMigrator<{ id: string }>(db, 'SELECT id FROM app.orgs WHERE id = ANY($1::uuid[]) ORDER BY id', [
      [KOPI_KITA, NUSANTARA_FIT, orgId],
    ]);
    expect(orgs.map((row) => row.id).sort()).toEqual([KOPI_KITA, NUSANTARA_FIT, orgId].sort());
    expect(
      await asMigrator<CampaignRow>(
        db,
        'SELECT id, org_id, title, status, data_origin FROM app.campaigns WHERE id = ANY($1::uuid[]) ORDER BY id',
        [FIXTURE_CAMPAIGNS],
      ),
    ).toEqual(campaignsBefore);
    expect(
      await asMigrator(
        db,
        'SELECT user_id, role, status, grant_basis, removed_by, removal_basis FROM app.org_members WHERE org_id = $1 ORDER BY granted_at',
        [orgId],
      ),
    ).toEqual([
      { user_id: CAROL.userId, role: 'admin', status: 'active', grant_basis: 'org_created', removed_by: null, removal_basis: null },
      {
        user_id: DAVE.userId,
        role: 'member',
        status: 'removed',
        grant_basis: 'invitation',
        removed_by: CAROL.userId,
        removal_basis: 'removed_by_admin',
      },
    ]);
    expect(
      await asMigrator(db, 'SELECT invitee_email_norm, status FROM app.org_invitations WHERE org_id = $1 ORDER BY created_at', [orgId]),
    ).toEqual([
      { invitee_email_norm: DAVE.email, status: 'accepted' },
      { invitee_email_norm: ERIN_EMAIL, status: 'revoked' },
    ]);

    // Every audit row written since the start is still there, in order: the
    // additions and the revocations alike.
    const written = await asMigrator<{ action: string; outcome: string; context_org_id: string | null; recorded_by: string }>(
      db,
      'SELECT action, outcome, context_org_id, recorded_by::text AS recorded_by FROM app.audit_log WHERE id > $1::bigint ORDER BY id',
      [auditBefore],
    );
    expect(written).toEqual([
      { action: 'org.create', outcome: 'allowed', context_org_id: orgId, recorded_by: 'wringy_api_login' },
      { action: 'invitation.create', outcome: 'allowed', context_org_id: orgId, recorded_by: 'wringy_api_login' },
      { action: 'invitation.accept', outcome: 'allowed', context_org_id: orgId, recorded_by: 'wringy_api_login' },
      { action: 'invitation.create', outcome: 'allowed', context_org_id: orgId, recorded_by: 'wringy_api_login' },
      { action: 'capability.grant', outcome: 'allowed', context_org_id: KOPI_KITA, recorded_by: 'wringy_migrator' },
      { action: 'member.remove', outcome: 'allowed', context_org_id: orgId, recorded_by: 'wringy_api_login' },
      { action: 'capability.revoke', outcome: 'allowed', context_org_id: KOPI_KITA, recorded_by: 'wringy_migrator' },
      { action: 'invitation.revoke', outcome: 'allowed', context_org_id: orgId, recorded_by: 'wringy_api_login' },
      // The removed member's read above, refused and audited like any outsider's.
      { action: 'org.read', outcome: 'denied', context_org_id: orgId, recorded_by: 'wringy_api_login' },
    ]);
    const [cliRow] = await auditRows(db, { action: 'capability.revoke', contextOrgId: KOPI_KITA });
    expect(cliRow).toMatchObject({ actor_kind: 'bootstrap', target_type: 'admin_scope', target_id: DAVE.userId, reason: 'recovery drill' });

    // And by privilege, the runtime role could not have deleted any of it.
    await withClientAt(db.urls.api, async (client) => {
      for (const [table, id] of [
        ['app.org_members', `org_id = '${orgId}'`],
        ['app.org_invitations', `org_id = '${orgId}'`],
        ['app.audit_log', 'true'],
        ['app.orgs', `id = '${orgId}'`],
      ] as const) {
        expect(await sqlState(client.query(`DELETE FROM ${table} WHERE ${id}`)), `DELETE FROM ${table} as wringy_api_login`).toBe('42501');
      }
    });
  });
});
