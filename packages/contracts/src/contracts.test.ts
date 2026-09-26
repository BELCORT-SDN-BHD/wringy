import { describe, expect, it } from 'vitest';

import {
  apiErrorSchema,
  healthLiveResponseSchema,
  healthResponseSchema,
  internalCampaignsResponseSchema,
  meResponseSchema,
  profileSchema,
  sessionProbeResponseSchema,
  signInResponseSchema,
  workerHealthResponseSchema,
  type HealthResponse,
  type InternalCampaignsResponse,
  type Profile,
  type WorkerHealthResponse,
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
