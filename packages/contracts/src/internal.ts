import { z } from 'zod';

import { dataOriginSchema, instantSchema } from './common';

export const CAMPAIGN_STATUSES = ['draft', 'published'] as const;
export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
export type CampaignStatus = z.output<typeof campaignStatusSchema>;

/**
 * One row of `GET /internal/campaigns`. The schema is the allow-list: a field
 * not named here never leaves the API, because `z.object` strips unknown keys.
 * Titles and statuses only; no money and no rule values.
 */
export const internalCampaignSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  status: campaignStatusSchema,
  orgName: z.string().min(1),
  dataOrigin: dataOriginSchema,
  updatedAt: instantSchema,
});
export type InternalCampaign = z.output<typeof internalCampaignSchema>;

/** `GET /internal/campaigns`. `dataAsOf` is the database clock when the list was read. */
export const internalCampaignsResponseSchema = z.object({
  items: z.array(internalCampaignSchema),
  dataAsOf: instantSchema,
});
export type InternalCampaignsResponse = z.output<typeof internalCampaignsResponseSchema>;

/**
 * Process liveness, computed by the API from `lastBeatAt` (and `stoppedAt`) on
 * the database clock (apps/api/src/worker-state.ts):
 * - `healthy`: the process beat is recent.
 * - `stale`: the process beat is overdue (STALE_AFTER_MS).
 * - `never_seen`: registered, but no beat has arrived yet (shown as "unknown").
 * - `stopped`: the worker drained and recorded a clean stop at or after its last beat.
 *
 * It says nothing about the queue path; that is `queueState`.
 */
export const WORKER_STATES = ['healthy', 'stale', 'never_seen', 'stopped'] as const;
export const workerStateSchema = z.enum(WORKER_STATES);
export type WorkerState = z.output<typeof workerStateSchema>;

/**
 * Queue-path liveness, computed by the API from `lastQueueRoundTripAt` on the
 * database clock (apps/api/src/worker-state.ts):
 * - `ok`: the last pg-boss round trip is recent.
 * - `overdue`: the last round trip is older than QUEUE_OVERDUE_AFTER_MS.
 * - `never`: no round trip has completed yet (shown as "unknown", never as 0).
 *
 * The thresholds (HEARTBEAT_INTERVAL_MS, STALE_AFTER_MS, QUEUE_OVERDUE_AFTER_MS)
 * are operational constants owned by @wringy/db (packages/db/src/heartbeat.ts),
 * not business rules.
 */
export const QUEUE_STATES = ['ok', 'overdue', 'never'] as const;
export const queueStateSchema = z.enum(QUEUE_STATES);
export type QueueState = z.output<typeof queueStateSchema>;

export const workerHealthSchema = z.object({
  workerId: z.string().min(1),
  startedAt: instantSchema,
  lastBeatAt: instantSchema.nullable(),
  lastQueueRoundTripAt: instantSchema.nullable(),
  imageRef: z.string().min(1),
  /** Process liveness, from `lastBeatAt`. */
  state: workerStateSchema,
  /** Queue-path liveness, from `lastQueueRoundTripAt`. */
  queueState: queueStateSchema,
});
export type WorkerHealth = z.output<typeof workerHealthSchema>;

/** `GET /internal/worker-health`. Staleness is computed on `dbNow`, never on a host clock. */
export const workerHealthResponseSchema = z.object({
  workers: z.array(workerHealthSchema),
  dbNow: instantSchema,
});
export type WorkerHealthResponse = z.output<typeof workerHealthResponseSchema>;
