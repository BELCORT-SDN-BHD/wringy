import { describe, expect, it } from 'vitest';

import {
  apiErrorSchema,
  healthLiveResponseSchema,
  healthResponseSchema,
  internalCampaignsResponseSchema,
  workerHealthResponseSchema,
  type HealthResponse,
  type InternalCampaignsResponse,
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

describe('sample payloads round-trip', () => {
  it.each([
    ['GET /health/live', healthLiveResponseSchema, { status: 'ok' }],
    ['GET /health', healthResponseSchema, health],
    ['GET /internal/campaigns', internalCampaignsResponseSchema, campaigns],
    ['GET /internal/worker-health', workerHealthResponseSchema, workers],
    ['error body', apiErrorSchema, { error: { code: 'database_unavailable', message: 'Database unavailable' } }],
  ] as const)('%s', (_route, schema, payload) => {
    const parsed = schema.parse(payload);
    expect(parsed).toEqual(payload);
    // Through JSON and back, as the web server receives it.
    expect(schema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(payload);
  });
});

describe('the response schema is the allow-list', () => {
  it('strips unknown keys at every level of the campaign list', () => {
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

  it('strips unknown keys from worker health and the health body', () => {
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

describe('enums and formats are enforced', () => {
  it('rejects a status, origin or worker state outside the contract', () => {
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
  });

  it('rejects an instant without an offset and an id that is not a UUID', () => {
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
