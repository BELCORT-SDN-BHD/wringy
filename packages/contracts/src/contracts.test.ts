import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  INVITATION_LIFETIME_DAYS,
  acceptInvitationResponseSchema,
  apiErrorSchema,
  changeRoleBodySchema,
  changeRoleResponseSchema,
  createInvitationBodySchema,
  createInvitationResponseSchema,
  createOrgBodySchema,
  createOrgResponseSchema,
  healthLiveResponseSchema,
  healthResponseSchema,
  internalCampaignsResponseSchema,
  invitationPreviewResponseSchema,
  invitationTokenBodySchema,
  leaveOrgResponseSchema,
  meResponseSchema,
  orgDetailResponseSchema,
  orgInvitationParamsSchema,
  orgMemberParamsSchema,
  orgMemberSchema,
  orgNameSchema,
  orgParamsSchema,
  profileSchema,
  removeMemberResponseSchema,
  renameOrgBodySchema,
  renameOrgResponseSchema,
  revokeInvitationResponseSchema,
  sessionProbeResponseSchema,
  signInResponseSchema,
  workerHealthResponseSchema,
  workspacesResponseSchema,
  type HealthResponse,
  type InternalCampaignsResponse,
  type Membership,
  type OrgMember,
  type OrgSummary,
  type PendingInvitation,
  type Profile,
  type WorkerHealthResponse,
  type WorkspacesResponse,
} from './index';

const campaigns: InternalCampaignsResponse = {
  items: [
    {
      id: '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
      title: 'Fixture campaign',
      status: 'published',
      orgName: 'Fixture org',
      dataOrigin: 'fixture',
      updatedAt: '2026-09-23T01:02:03.456Z',
    },
  ],
  dataAsOf: '2026-09-23T01:02:04.000Z',
};

const workers: WorkerHealthResponse = {
  workers: [
    {
      workerId: 'worker-local-1',
      startedAt: '2026-09-23T01:00:00.000Z',
      lastBeatAt: '2026-09-23T01:02:00.000Z',
      lastQueueRoundTripAt: null,
      imageRef: 'ghcr.io/belcort-sdn-bhd/wringy-worker:0123abc',
      state: 'never_seen',
      queueState: 'never',
    },
  ],
  dbNow: '2026-09-23T01:02:05.000Z',
};

const health: HealthResponse = {
  status: 'unavailable',
  checks: { database: 'ok', migrations: 'failing', queueSchema: 'ok' },
  migrationHead: '0001_schemas_roles',
  queueSchemaVersion: 26,
  dbNow: '2026-09-23T01:02:05.000Z',
};

describe('M2-AC01 sample payloads round-trip', () => {
  it.each([
    ['GET /health/live', healthLiveResponseSchema, { status: 'ok' }],
    ['GET /health', healthResponseSchema, health],
    ['GET /internal/campaigns', internalCampaignsResponseSchema, campaigns],
    ['GET /internal/worker-health', workerHealthResponseSchema, workers],
    ['error body', apiErrorSchema, { error: { code: 'database_unavailable', message: 'Database unavailable' } }],
  ] as const)('M2-AC01 %s', (_route, schema, payload) => {
    const parsed = schema.parse(payload);
    expect(parsed).toEqual(payload);
    // Through JSON and back, as the web server receives it.
    expect(schema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(payload);
  });
});

describe('M2-AC01 the response schema is the allow-list', () => {
  it('M2-AC01 strips unknown keys at every level of the campaign list', () => {
    const leaky = {
      ...campaigns,
      debugSql: 'select * from app.campaigns',
      items: campaigns.items.map((item) => ({ ...item, orgId: 'secret-org-id', budgetSen: 500000 })),
    };
    const parsed = internalCampaignsResponseSchema.parse(leaky);
    expect(parsed).toEqual(campaigns);
    expect(JSON.stringify(parsed)).not.toContain('secret-org-id');
    expect(JSON.stringify(parsed)).not.toContain('debugSql');
  });

  it('M2-AC01 strips unknown keys from worker health and the health body', () => {
    const parsed = workerHealthResponseSchema.parse({
      ...workers,
      workers: workers.workers.map((worker) => ({ ...worker, databaseUrl: 'postgres://x:y@z/w' })),
    });
    expect(JSON.stringify(parsed)).not.toContain('postgres://');
    expect(healthResponseSchema.parse({ ...health, connectionString: 'postgres://x:y@z/w' })).toEqual(
      health,
    );
  });
});

describe('M2-AC01 enums and formats are enforced', () => {
  it('M2-AC01 rejects a status, origin, worker state or queue state outside the contract', () => {
    const [item] = campaigns.items;
    expect(
      internalCampaignsResponseSchema.safeParse({ ...campaigns, items: [{ ...item, status: 'archived' }] })
        .success,
    ).toBe(false);
    expect(
      internalCampaignsResponseSchema.safeParse({ ...campaigns, items: [{ ...item, dataOrigin: 'demo' }] })
        .success,
    ).toBe(false);
    const [worker] = workers.workers;
    expect(
      workerHealthResponseSchema.safeParse({ ...workers, workers: [{ ...worker, state: 'unknown' }] }).success,
    ).toBe(false);
    expect(
      workerHealthResponseSchema.safeParse({ ...workers, workers: [{ ...worker, queueState: 'unknown' }] }).success,
    ).toBe(false);
    // queueState is required: an API that forgot it must not look like "ok".
    const withoutQueueState: Partial<NonNullable<typeof worker>> = { ...worker };
    delete withoutQueueState.queueState;
    expect(
      workerHealthResponseSchema.safeParse({ ...workers, workers: [withoutQueueState] }).success,
    ).toBe(false);
  });

  it('M2-AC01 rejects an instant without an offset and an id that is not a UUID', () => {
    const [item] = campaigns.items;
    expect(
      internalCampaignsResponseSchema.safeParse({
        ...campaigns,
        items: [{ ...item, updatedAt: '2026-09-23 01:02:03' }],
      }).success,
    ).toBe(false);
    expect(
      internalCampaignsResponseSchema.safeParse({ ...campaigns, items: [{ ...item, id: 'cmp-1' }] }).success,
    ).toBe(false);
  });
});

const profile = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  displayName: 'Tester',
  contactEmail: 'tester@example.com',
  status: 'active',
  lastSignInAt: '2026-09-25T02:03:04.000Z',
  createdAt: '2026-09-20T08:00:00.000Z',
} satisfies Profile;

describe('M2-AC02/2 identity responses are allow-lists', () => {
  it('M2-AC02/2 sample identity payloads round-trip through JSON', () => {
    for (const [schema, payload] of [
      [signInResponseSchema, { profile }],
      [meResponseSchema, { profile, session: { expiresAt: '2026-09-25T03:03:04.000Z' } }],
      [sessionProbeResponseSchema, { ok: true, checkedAt: '2026-09-25T02:05:00.000Z' }],
    ] as const) {
      const parsed = schema.parse(payload);
      expect(parsed).toEqual(payload);
      expect(schema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(payload);
    }
  });

  it('M2-AC02/2 strips unknown keys, so no token, session id or locale row leaks out', () => {
    const leaky = {
      profile: {
        ...profile,
        accessToken: 'eyJ-DO-NOT-LEAK',
        sessionId: 'b7c8d9ea-1234-4567-89ab-cdef01234567',
        localePref: 'zh-Hans-MY',
      },
      session: { expiresAt: '2026-09-25T03:03:04.000Z', refreshToken: 'rt-DO-NOT-LEAK' },
      debugSql: 'select * from app.profiles',
    };
    const parsed = meResponseSchema.parse(leaky);
    expect(parsed).toEqual({ profile, session: { expiresAt: '2026-09-25T03:03:04.000Z' } });
    const text = JSON.stringify(parsed);
    for (const secret of ['DO-NOT-LEAK', 'sessionId', 'localePref', 'debugSql']) {
      expect(text).not.toContain(secret);
    }
  });

  it('M2-AC02/2 profileSchema alone names six fields and nothing else', () => {
    expect(Object.keys(profileSchema.shape).sort()).toEqual([
      'contactEmail',
      'createdAt',
      'displayName',
      'id',
      'lastSignInAt',
      'status',
    ]);
    expect(profileSchema.parse({ ...profile, localePref: 'ms-MY' })).toEqual(profile);
  });

  it('M2-AC02/2 rejects a missing field, a status outside the domain and an id that is not a UUID', () => {
    const withoutStatus: Partial<Profile> = { ...profile };
    delete withoutStatus.status;
    expect(signInResponseSchema.safeParse({ profile: withoutStatus }).success).toBe(false);
    const withoutSession: Record<string, unknown> = { profile };
    expect(meResponseSchema.safeParse(withoutSession).success).toBe(false);
    expect(signInResponseSchema.safeParse({ profile: { ...profile, status: 'suspended' } }).success).toBe(false);
    expect(signInResponseSchema.safeParse({ profile: { ...profile, id: 'user-1' } }).success).toBe(false);
    // displayName may be null, contactEmail may not.
    expect(signInResponseSchema.safeParse({ profile: { ...profile, displayName: null } }).success).toBe(true);
    expect(signInResponseSchema.safeParse({ profile: { ...profile, contactEmail: null } }).success).toBe(false);
    // The probe's `ok` is the literal true: a falsy answer can never look like a pass.
    expect(sessionProbeResponseSchema.safeParse({ ok: false, checkedAt: profile.lastSignInAt }).success).toBe(false);
  });
});

// --- M2-03: organisations, memberships, invitations -------------------------

const orgId = '5b0c1d2e-3f40-4a51-8b62-73c4d5e6f708';
const userId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const invitationId = 'c3d4e5f6-0718-4293-a4b5-c6d7e8f90a1b';
const token = 'Ab3_-xYz0123456789abcdefghijklmnopqrstuvwxy';

const org = {
  id: orgId,
  name: 'Carol Studio',
  dataOrigin: 'live',
  createdAt: '2026-09-26T01:00:00.000Z',
} satisfies OrgSummary;

const membership = {
  orgId,
  userId,
  role: 'admin',
  status: 'active',
  grantBasis: 'org_created',
  grantedAt: '2026-09-26T01:00:00.000Z',
} satisfies Membership;

const invitation = {
  id: invitationId,
  inviteeEmailNorm: 'dave@example.test',
  role: 'member',
  expiresAt: '2026-10-03T01:00:00.000Z',
  createdAt: '2026-09-26T01:00:00.000Z',
} satisfies PendingInvitation;

const member = {
  userId,
  displayName: 'Carol Wong',
  role: 'admin',
  grantedAt: '2026-09-26T01:00:00.000Z',
} satisfies OrgMember;

const workspaces = {
  personal: { userId },
  orgs: [{ orgId, name: 'Carol Studio', role: 'admin', dataOrigin: 'live' }],
  grants: { org: [{ orgId, capability: 'review' }], platform: ['ops_runtime'] },
} satisfies WorkspacesResponse;

const orgResponses = [
  ['GET /me/workspaces', workspacesResponseSchema, workspaces],
  [
    'GET /orgs/:orgId (admin)',
    orgDetailResponseSchema,
    { org, self: { userId, role: 'admin' }, members: [member], invitations: [invitation] },
  ],
  ['GET /orgs/:orgId (member)', orgDetailResponseSchema, { org, self: { userId, role: 'member' }, members: [member] }],
  ['POST /orgs', createOrgResponseSchema, { org, membership }],
  ['POST /orgs/:orgId/rename', renameOrgResponseSchema, { org }],
  ['POST /orgs/:orgId/invitations', createInvitationResponseSchema, { invitation, token }],
  [
    'POST /orgs/:orgId/invitations/:invitationId/revoke',
    revokeInvitationResponseSchema,
    { invitation: { id: invitationId, status: 'revoked' } },
  ],
  ['POST /invitations/preview (mismatch)', invitationPreviewResponseSchema, { state: 'email_mismatch' }],
  [
    'POST /invitations/preview (addressed)',
    invitationPreviewResponseSchema,
    { state: 'pending', org: { id: orgId, name: 'Carol Studio' }, role: 'member', expiresAt: invitation.expiresAt },
  ],
  [
    'POST /invitations/accept',
    acceptInvitationResponseSchema,
    { org, membership: { ...membership, role: 'member', grantBasis: 'invitation' } },
  ],
  [
    'POST /orgs/:orgId/members/:userId/role',
    changeRoleResponseSchema,
    { membership: { ...membership, role: 'member' } },
  ],
  [
    'POST /orgs/:orgId/members/:userId/remove',
    removeMemberResponseSchema,
    { membership: { ...membership, status: 'removed' } },
  ],
  ['POST /orgs/:orgId/leave', leaveOrgResponseSchema, { membership: { ...membership, status: 'removed' } }],
] as const;

/** Plant leaky keys beside every object of a payload, however deep. */
function plantLeaks(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(plantLeaks);
  if (value !== null && typeof value === 'object') {
    return {
      ...Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, plantLeaks(inner)])),
      contactEmail: 'leak@example.test',
      tokenHash: 'f'.repeat(64),
    };
  }
  return value;
}

describe('M2-AC03/3 org responses are allow-lists', () => {
  it.each(orgResponses)('M2-AC03/3 %s round-trips through JSON', (_route, schema, payload) => {
    const parsed = schema.parse(payload);
    expect(parsed).toEqual(payload);
    expect(schema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(payload);
  });

  it.each(orgResponses)('M2-AC03/3 %s strips unknown keys at every level', (_route, schema, payload) => {
    const parsed = schema.parse(plantLeaks(payload));
    expect(parsed).toEqual(payload);
    const text = JSON.stringify(parsed);
    expect(text).not.toContain('leak@example.test');
    expect(text).not.toContain('tokenHash');
  });

  it('M2-AC03/3 a member shape names no address of any kind', () => {
    expect(Object.keys(orgMemberSchema.shape).sort()).toEqual(['displayName', 'grantedAt', 'role', 'userId']);
    expect(
      orgMemberSchema.parse({ ...member, email: 'carol@example.test', contactEmail: 'carol@example.test' }),
    ).toEqual(member);
  });

  it('M2-AC03/3 a member-only org answer carries no invitations key', () => {
    const parsed = orgDetailResponseSchema.parse({ org, self: { userId, role: 'member' }, members: [member] });
    expect('invitations' in parsed).toBe(false);
  });

  it('M2-AC03/2 an org answer names the caller: self carries the caller’s own id beside the role', () => {
    expect(Object.keys(orgDetailResponseSchema.shape.self.shape).sort()).toEqual(['role', 'userId']);
    expect(orgDetailResponseSchema.safeParse({ org, self: { role: 'member' }, members: [member] }).success).toBe(false);
  });

  it('M2-AC03/1 rejects a role, status, grant basis or capability outside the contract', () => {
    expect(changeRoleResponseSchema.safeParse({ membership: { ...membership, role: 'owner' } }).success).toBe(false);
    expect(
      changeRoleResponseSchema.safeParse({ membership: { ...membership, status: 'suspended' } }).success,
    ).toBe(false);
    expect(
      createOrgResponseSchema.safeParse({ org, membership: { ...membership, grantBasis: 'self' } }).success,
    ).toBe(false);
    expect(
      workspacesResponseSchema.safeParse({
        ...workspaces,
        grants: { org: [{ orgId, capability: 'ops_runtime' }], platform: [] },
      }).success,
    ).toBe(false);
    expect(
      workspacesResponseSchema.safeParse({ ...workspaces, grants: { org: [], platform: ['review'] } }).success,
    ).toBe(false);
  });
});

describe('M2-AC03/3 the invitation preview says nothing to the wrong account', () => {
  it('M2-AC03/3 an email_mismatch answer drops the org, the role and the expiry', () => {
    const parsed = invitationPreviewResponseSchema.parse({
      state: 'email_mismatch',
      org: { id: orgId, name: 'Carol Studio' },
      role: 'admin',
      expiresAt: invitation.expiresAt,
    });
    expect(parsed).toEqual({ state: 'email_mismatch' });
  });

  it('M2-AC03/3 the addressed states need the org, the role and the expiry', () => {
    for (const state of ['pending', 'expired', 'accepted'] as const) {
      expect(invitationPreviewResponseSchema.safeParse({ state }).success).toBe(false);
      expect(
        invitationPreviewResponseSchema.safeParse({
          state,
          org: { id: orgId, name: 'Carol Studio' },
          role: 'member',
          expiresAt: invitation.expiresAt,
        }).success,
      ).toBe(true);
    }
    // A revoked or unknown token is a 403, never a preview state.
    expect(
      invitationPreviewResponseSchema.safeParse({
        state: 'revoked',
        org: { id: orgId, name: 'Carol Studio' },
        role: 'member',
        expiresAt: invitation.expiresAt,
      }).success,
    ).toBe(false);
  });
});

describe('M2-AC03/1 an org name is one schema for create and rename', () => {
  it('M2-AC03/1 accepts a normal name and trims it', () => {
    expect(orgNameSchema.parse('Kopi Kita')).toBe('Kopi Kita');
    expect(orgNameSchema.parse('  Kopi Kita \n')).toBe('Kopi Kita');
    expect(createOrgBodySchema.parse({ name: ' 咖啡 Kita ' })).toEqual({ name: '咖啡 Kita' });
    expect(renameOrgBodySchema.parse({ name: ' Nusantara Fit ' })).toEqual({ name: 'Nusantara Fit' });
  });

  it('M2-AC03/1 composes to NFC', () => {
    const parsed = orgNameSchema.parse('Cafe\u0301 Kita');
    expect(parsed).toBe('Caf\u00e9 Kita');
    expect(parsed.normalize('NFC')).toBe(parsed);
  });

  it('M2-AC03/1 refuses an empty, blank or 101-character name and accepts 100', () => {
    expect(orgNameSchema.safeParse('').success).toBe(false);
    expect(orgNameSchema.safeParse('   ').success).toBe(false);
    expect(orgNameSchema.safeParse('a'.repeat(100)).success).toBe(true);
    expect(orgNameSchema.safeParse('a'.repeat(101)).success).toBe(false);
    // Trimmed first: surrounding spaces do not count toward the limit.
    expect(orgNameSchema.safeParse(` ${'a'.repeat(100)} `).success).toBe(true);
  });

  it('M2-AC03/1 refuses control and bidi-format characters', () => {
    // C0, ESC, DEL and C1 controls; LRM, RLM, an embedding, an override and two isolates.
    const unsafe = ['\u0000', '\u0007', '\u001b', '\u007f', '\u0085'];
    unsafe.push('\u200e', '\u200f', '\u202a', '\u202e', '\u2066', '\u2069');
    for (const character of unsafe) {
      expect(orgNameSchema.safeParse(`Kopi${character}Kita`).success, JSON.stringify(character)).toBe(false);
    }
  });
});

describe('M2-AC03/2 params and bodies', () => {
  it('M2-AC03/2 path ids must be UUIDs', () => {
    expect(orgParamsSchema.safeParse({ orgId }).success).toBe(true);
    expect(orgParamsSchema.safeParse({ orgId: 'x/../..' }).success).toBe(false);
    expect(orgMemberParamsSchema.safeParse({ orgId, userId }).success).toBe(true);
    expect(orgMemberParamsSchema.safeParse({ orgId, userId: 'me' }).success).toBe(false);
    expect(orgInvitationParamsSchema.safeParse({ orgId, invitationId }).success).toBe(true);
    expect(orgInvitationParamsSchema.safeParse({ orgId, invitationId: '1' }).success).toBe(false);
  });

  it('M2-AC03/2 path ids come out in one spelling, lower case, however the caller cased them', () => {
    const upper = (id: string) => id.toUpperCase();
    expect(orgParamsSchema.parse({ orgId: upper(orgId) })).toEqual({ orgId: orgId.toLowerCase() });
    expect(orgMemberParamsSchema.parse({ orgId: upper(orgId), userId: upper(userId) })).toEqual({
      orgId: orgId.toLowerCase(),
      userId: userId.toLowerCase(),
    });
    expect(orgInvitationParamsSchema.parse({ orgId, invitationId: upper(invitationId) })).toEqual({
      orgId: orgId.toLowerCase(),
      invitationId: invitationId.toLowerCase(),
    });
    // Still a plain string schema: the type provider can describe it.
    expect(z.toJSONSchema(orgMemberParamsSchema)).toMatchObject({ properties: { userId: { type: 'string', format: 'uuid' } } });
  });

  it('M2-AC03/2 a body cannot carry an orgId: plain objects strip it', () => {
    expect(renameOrgBodySchema.parse({ name: 'Kopi Kita', orgId })).toEqual({ name: 'Kopi Kita' });
    expect(changeRoleBodySchema.parse({ role: 'member', orgId, userId })).toEqual({ role: 'member' });
    expect(createInvitationBodySchema.parse({ email: 'dave@example.test', role: 'member', orgId })).toEqual({
      email: 'dave@example.test',
      role: 'member',
    });
  });

  it('M2-AC03/1 an invitation body is bounded and names a known role', () => {
    expect(createInvitationBodySchema.safeParse({ email: '', role: 'member' }).success).toBe(false);
    expect(createInvitationBodySchema.safeParse({ email: 'a'.repeat(321), role: 'member' }).success).toBe(false);
    expect(createInvitationBodySchema.safeParse({ email: 'dave@example.test', role: 'owner' }).success).toBe(false);
    expect(changeRoleBodySchema.safeParse({ role: 'finance' }).success).toBe(false);
  });

  it('M2-AC03/1 an invitation token is exactly 43 base64url characters', () => {
    expect(token).toHaveLength(43);
    expect(invitationTokenBodySchema.safeParse({ token }).success).toBe(true);
    expect(invitationTokenBodySchema.safeParse({ token: token.slice(1) }).success).toBe(false);
    expect(invitationTokenBodySchema.safeParse({ token: `${token}A` }).success).toBe(false);
    expect(invitationTokenBodySchema.safeParse({ token: `+${token.slice(1)}` }).success).toBe(false);
    expect(invitationTokenBodySchema.safeParse({ token: `/${token.slice(1)}` }).success).toBe(false);
    expect(invitationTokenBodySchema.safeParse({ token: `${token.slice(1)}=` }).success).toBe(false);
  });

  it('M2-AC03/1 an invitation lasts 7 days (ruling D2)', () => {
    expect(INVITATION_LIFETIME_DAYS).toBe(7);
  });
});
