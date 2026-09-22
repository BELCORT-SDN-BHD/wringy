/**
 * The SQL behind the M2-01 read routes, run as the API runtime role (SELECT
 * only). Every instant comes from PostgreSQL, including "now": staleness and
 * `dataAsOf` are judged on the database clock, never the API host's.
 *
 * Columns are listed explicitly (defence in depth); the zod response schema in
 * @wringy/contracts is still the final allow-list for what leaves the API.
 */
import type {
  CampaignStatus,
  DataOrigin,
  HealthResponse,
  InternalCampaignsResponse,
  WorkerHealthResponse,
} from '@wringy/contracts';
import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE, readPgBossVersion, type Pool, type PoolClient } from '@wringy/db';

import { sqlStateOf } from './database';
import { computeQueueState, computeWorkerState } from './worker-state';

type Queryable = Pick<PoolClient, 'query'>;

interface CampaignRow {
  data_as_of: Date;
  id: string | null;
  title: string | null;
  status: CampaignStatus | null;
  org_name: string | null;
  data_origin: DataOrigin | null;
  updated_at: Date | null;
}

/**
 * Fixture campaigns with their org's name, newest first. One statement: the
 * clock row is left-joined so an empty table still yields `dataAsOf`.
 */
export async function readFixtureCampaigns(client: Queryable): Promise<InternalCampaignsResponse> {
  const { rows } = await client.query<CampaignRow>(
    `SELECT clock.data_as_of, c.id, c.title, c.status, c.org_name, c.data_origin, c.updated_at
       FROM (SELECT now() AS data_as_of) AS clock
       LEFT JOIN (
         SELECT campaign.id, campaign.title, campaign.status, org.name AS org_name,
                campaign.data_origin, campaign.updated_at
           FROM app.campaigns AS campaign
           JOIN app.orgs AS org
             ON org.id = campaign.org_id AND org.data_origin = campaign.data_origin
          WHERE campaign.data_origin = 'fixture'
       ) AS c ON true
      ORDER BY c.updated_at DESC, c.id`,
  );
  const [first] = rows;
  if (first === undefined) throw new Error('the clock row is missing');

  const items = rows.flatMap((row) =>
    row.id === null || row.title === null || row.status === null || row.org_name === null ||
    row.data_origin === null || row.updated_at === null
      ? []
      : [
          {
            id: row.id,
            title: row.title,
            status: row.status,
            orgName: row.org_name,
            dataOrigin: row.data_origin,
            updatedAt: row.updated_at.toISOString(),
          },
        ],
  );
  return { items, dataAsOf: first.data_as_of.toISOString() };
}

interface HeartbeatRow {
  db_now: Date;
  worker_id: string | null;
  started_at: Date | null;
  last_beat_at: Date | null;
  last_queue_round_trip_at: Date | null;
  image_ref: string | null;
  stopped_at: Date | null;
}

/**
 * Every worker's heartbeat row with its process state and queue state judged on
 * the database clock read in the same statement.
 */
export async function readWorkerHealth(client: Queryable): Promise<WorkerHealthResponse> {
  const { rows } = await client.query<HeartbeatRow>(
    `SELECT clock.db_now, h.worker_id, h.started_at, h.last_beat_at, h.last_queue_round_trip_at,
            h.image_ref, h.stopped_at
       FROM (SELECT now() AS db_now) AS clock
       LEFT JOIN ops.worker_heartbeat AS h ON true
      ORDER BY h.worker_id`,
  );
  const [first] = rows;
  if (first === undefined) throw new Error('the clock row is missing');
  const dbNow = first.db_now;

  const workers = rows.flatMap((row) =>
    row.worker_id === null || row.started_at === null || row.image_ref === null
      ? []
      : [
          {
            workerId: row.worker_id,
            startedAt: row.started_at.toISOString(),
            lastBeatAt: row.last_beat_at?.toISOString() ?? null,
            lastQueueRoundTripAt: row.last_queue_round_trip_at?.toISOString() ?? null,
            imageRef: row.image_ref,
            state: computeWorkerState({ lastBeatAt: row.last_beat_at, stoppedAt: row.stopped_at }, dbNow),
            queueState: computeQueueState(row.last_queue_round_trip_at, dbNow),
          },
        ],
  );
  return { workers, dbNow: dbNow.toISOString() };
}

export interface ExpectedHeads {
  /** The newest migration this build needs (EXPECTED_MIGRATION_HEAD). */
  migrationHead: string;
  /** The pg-boss schema version this build needs (EXPECTED_PGBOSS_VERSION). */
  pgbossVersion: number;
}

/** Receives the SQLSTATE (or network code) of a failed health check, never its text. */
export type HealthFailureLog = (check: keyof HealthResponse['checks'], code: string | undefined) => void;

/**
 * GET /health: one connection as the runtime role; each check fails on its
 * own. A check that cannot run reports `failing` and its code goes to the log
 * only; the body carries states, the heads read and the database clock.
 */
export async function checkHealth(pool: Pool, expected: ExpectedHeads, onFailure: HealthFailureLog): Promise<HealthResponse> {
  const report: HealthResponse = {
    status: 'unavailable',
    checks: { database: 'failing', migrations: 'failing', queueSchema: 'failing' },
    migrationHead: null,
    queueSchemaVersion: null,
    dbNow: null,
  };

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (error) {
    onFailure('database', sqlStateOf(error));
    return report;
  }

  let broken: Error | undefined;
  try {
    try {
      const { rows } = await client.query<{ alive: number; db_now: Date }>('SELECT 1 AS alive, now() AS db_now');
      report.dbNow = rows[0]?.db_now.toISOString() ?? null;
      report.checks.database = rows[0]?.alive === 1 ? 'ok' : 'failing';
    } catch (error) {
      onFailure('database', sqlStateOf(error));
      broken = error instanceof Error ? error : new Error(String(error));
      return report;
    }

    try {
      const { rows } = await client.query<{ name: string }>(
        `SELECT name FROM ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} ORDER BY id DESC LIMIT 1`,
      );
      report.migrationHead = rows[0]?.name ?? null;
      report.checks.migrations = report.migrationHead === expected.migrationHead ? 'ok' : 'failing';
    } catch (error) {
      onFailure('migrations', sqlStateOf(error));
    }

    try {
      report.queueSchemaVersion = await readPgBossVersion(client);
      report.checks.queueSchema = report.queueSchemaVersion === expected.pgbossVersion ? 'ok' : 'failing';
    } catch (error) {
      onFailure('queueSchema', sqlStateOf(error));
    }
  } finally {
    client.release(broken);
  }

  const allOk = Object.values(report.checks).every((state) => state === 'ok');
  report.status = allOk ? 'ok' : 'unavailable';
  return report;
}
