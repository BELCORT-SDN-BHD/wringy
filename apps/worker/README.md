# worker

The pg-boss background worker for the internal build (M2-01; kickoff-package.md
§8.1, §8.3, §8.5, §8.9). In M2-01 it does one job: it proves it is alive, twice
over, so the `/internal` page can show a healthy, stale or stopped worker through
the API. It serves no HTTP, reads no business table and runs no DDL.

## Scripts

| Script | Does |
|---|---|
| `pnpm --filter worker dev` | `tsx watch src/main.ts`, loading `apps/worker/.env` when present |
| `pnpm --filter worker build` | esbuild bundle `src/main.ts` → `dist/main.js` (see Build) |
| `pnpm --filter worker start` | `node dist/main.js`, loading `apps/worker/.env` when present |
| `pnpm --filter worker lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `pnpm --filter worker test` | Unit tests (`src/**/*.test.ts`), no database |
| `pnpm --filter worker test:int` | Integration tests on a real PostgreSQL 17 (`test/**/*.int.test.ts`) |

## Environment

Names only; copy `.env.example` to `apps/worker/.env`, which `dev` and `start`
load with `--env-file-if-exists` (the process environment wins over the file). It
is gitignored by the root `.gitignore` rule `.env` (`git check-ignore -v
apps/worker/.env` prints `.gitignore:7:.env`); the worker does not read the
repository-root `.env`, which belongs to the packages/db scripts. The worker
reads exactly these through `@wringy/config/worker`, which fails fast and names a
missing or invalid variable without echoing its value.

| Variable | Meaning |
|---|---|
| `WRINGY_ENV` | `local` \| `ci` \| `staging` \| `production`. Must equal `ops.environment.name`, or the worker refuses to start |
| `DATABASE_URL` | The **worker** runtime login, `wringy_worker_login` (never the API's or the migrator's) |
| `WORKER_ID` | This instance's id: the primary key of its `ops.worker_heartbeat` row |
| `IMAGE_REF` | The image (git SHA tag or digest) it runs; shown on the health card |
| `LOG_LEVEL` | pino level, default `info` |

Locally: `pnpm db:start` prints the worker URL; `WRINGY_ENV=local` matches the
marker `pnpm db:env` writes.

## What it does

**Start** (`src/worker.ts`, `createWorker().start()`):

1. Reads `ops.environment` and refuses unless it names `WRINGY_ENV`
   (Implementation Decision 5). An unmarked database is refused too.
2. Starts pg-boss with `migrate: false` (`src/connections.ts`). pg-boss then only
   checks the schema: it throws `pg-boss is not installed` when `pgboss.version`
   is absent and `pg-boss database requires migrations` when the version differs
   from what pg-boss 12.33.5 expects (42), in either direction
   (`dist/contractor.js` `check()`; [constructor.md](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/constructor.md):
   "If schema migrations exist, `start()` will throw"). The worker reports that as
   a `pgboss_schema` refusal. `pnpm db:migrate` is the only thing that installs or
   upgrades `pgboss`.
3. Creates the queue `system.heartbeat` with `partition: false` if absent. pg-boss's
   `create_queue()` is an `INSERT … ON CONFLICT DO NOTHING` when not partitioned,
   so this is DML under the 0005 grants: ruling D33 (ii) holds, the migrator owns
   `pgboss` and the worker needs no CREATE (`test/roles.int.test.ts`).
4. Writes the first process beat, registers the round-trip handler
   (`work`, `batchSize: 1`, `pollingIntervalSeconds: 2`), schedules the job, and
   starts the beat interval.

**Two beats** (`src/jobs/heartbeat.ts`), both stamped with the database clock
(`now()`), never the process clock:

| Beat | Cadence (operational constants) | Writes |
|---|---|---|
| A, process | every 15 s (`BEAT_INTERVAL_MS`) | upserts its row: `last_beat_at`, `image_ref`, clears `stopped_at`; the first beat of a process also resets `started_at` |
| B, queue round trip | cron `* * * * *` (`HEARTBEAT_CRON`); pg-boss checks schedules every 30 s at minute precision ([scheduling.md](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/scheduling.md)) | the handler sets `last_queue_round_trip_at` on **its own** row |

The API derives the state on the database clock: `stopped` when
`stopped_at >= last_beat_at`, `stale` after 45 s without a beat (three missed
beats), otherwise `healthy`; no row means never seen. Two beats catch a worker
that is stuck without throwing: the process can beat while the queue path is dead.
With several workers, the round-trip stamp lands on whichever worker ran the job.

**Stop and drain** (`src/shutdown.ts`, `createWorker().stop()`): SIGTERM or
SIGINT (or the IPC message `shutdown`, below) runs one graceful stop:

1. stop the beat interval and wait for a beat in flight;
2. `boss.stop({ graceful: true, timeout: 20000, close: true })`: running jobs may
   finish for up to 20 s (`DRAIN_TIMEOUT_MS`); pg-boss then fails whatever is still
   active ("pg-boss shut down while active") and closes its pool
   ([ops.md](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/ops.md) `stop()`: `graceful`, `close`, `timeout`);
3. set `stopped_at = now()` (only if this process wrote a beat);
4. end the pool and exit 0.

A second signal while stopping is ignored. If the whole stop takes longer than
30 s (drain + 10 s), the process exits 1. The schedule stays in `pgboss.schedule`
for the next worker. Exit codes: 0 after a graceful stop; 1 for an invalid
environment, a startup refusal, an unreachable database (after about 30 s of
backoff, 0.5 s doubling to 8 s; a refused login is not retried) or a failed stop.

**Windows.** Windows has no POSIX signals: Node's `subprocess.kill('SIGTERM')`
terminates the process abruptly, so no handler runs and `stopped_at` stays NULL
(observed on this machine, 2026-09-23). A parent process on Windows sends the IPC
message `shutdown` instead (`child.send('shutdown')` on a child spawned with an
`ipc` stdio slot), which takes the same path as SIGTERM. Containers (Linux) get
the real SIGTERM.

## Connections and rights

| Pool | `application_name` | Max | Used for |
|---|---|---|---|
| The worker's own (`createWorkerPool`) | `wringy-worker` | 2 | environment check, beats, `stopped_at` |
| pg-boss's (`createBoss`) | `wringy-worker-pgboss` | 4 | queue, schedule, maintenance |

Both log in as `wringy_worker_login` (group `wringy_worker`): SELECT on
`ops.environment`; SELECT, INSERT, UPDATE on `ops.worker_heartbeat`; pg-boss DML
and EXECUTE. Nothing in `app`, no CREATE anywhere (`packages/db/README.md`,
migration 0005). pg-boss options: `schema: 'pgboss'`, `migrate: false`,
`createSchema: false`, `reindex: false` (the runtime role owns no pg-boss index,
so it only reports bloat; rebuilding is a migrator task), `supervise` and
`schedule` left on. M2-09 sizes the pools against the connection budget.

## Logs

JSON lines from pino on stdout, one object per line with `service`, `workerId`,
`imageRef` and `wringyEnv`. No line may carry a connection string or password:
pino `redact` censors known secret keys, and every serialised line passes through
`scrubSecrets()` (`src/logger.ts`), which replaces any `postgres://…` URL and
`password=…` pair, including inside errors pg-boss emits. A routine beat logs at
`debug`; the first beat, a recovery, start and stop at `info`; a failed beat at
`warn`.

## Build

`build.mjs` bundles with esbuild 0.28.2 (ESM, `node24`). `@wringy/*` workspace
packages ship TypeScript and are inlined, together with anything reached only
through them (zod); the packages this app declares in `dependencies` (`pg`,
`pg-boss`, `pino`) stay external for `pnpm --filter worker --prod deploy` to
supply. The build fails if the bundle would import any other package. It relies
on `"sideEffects": false` in `packages/db/package.json`, so the bundle carries
only the db modules the worker uses (pool, environment marker, role names), not
the migration runner or the local-development passwords.

## Tests

Unit (`pnpm --filter worker test`): the heartbeat SQL (database clock, parameters),
the beat state and its log policy, the shutdown wiring (SIGTERM, SIGINT, IPC,
failure, deadline), the connection backoff, the log scrubber, and a drift guard on
the pg-boss refusal messages.

Integration (`pnpm --filter worker test:int`), on a real PostgreSQL 17 through the
`@wringy/db` harness (`packages/db/test/harness.ts`; its global setup migrates a
template from zero, and every test clones it), connecting as
`wringy_worker_login`; nothing is mocked:

| File | Tests |
|---|---|
| `test/roles.int.test.ts` | `M2-AC01/2 the worker runs as the runtime role and cannot read app.campaigns`; pg-boss under the runtime role with DML only |
| `test/heartbeat.int.test.ts` | `worker heartbeat row appears within one beat and uses the database clock`; `queue round trip: a sent system.heartbeat job updates last_queue_round_trip_at`; `graceful stop drains and sets stopped_at` |
| `test/startup.int.test.ts` | `startup refuses an environment mismatch`; an unmarked database; `start() refuses when pgboss schema is missing/behind (migrate:false)` |
| `test/process.int.test.ts` | the real `src/main.ts` process: start, beat, drain, exit 0; exit 1 on a mismatch, a refused login and a missing variable; `no secret in logs` |

`createWorker()` takes the pg-boss instance and pool from its caller and returns
`{ start, stop, beatOnce, triggerRoundTrip }`, so tests do not wait a minute for
cron: `triggerRoundTrip()` sends one `system.heartbeat` job carrying a probe token
and resolves when this worker's handler has stamped it.

## What later tickets add

- **M2-08**: the outbox relay (one path from `app.outbox` into pg-boss, deduplicated
  by event key), notification and email-delivery jobs with dead letters, rights on
  `app.outbox` and the notification tables for `wringy_worker`, and
  `packages/modules/<m>` once the worker needs a command it shares with the API;
  the kill-point tests (between the outbox write and consumption) in
  `apps/worker/tests/integration`.
- **M2-09**: the staging image (`apps/worker/Dockerfile`, drains on SIGTERM), the
  connection budget and pool sizes, whether LISTEN/NOTIFY works through the
  Supavisor session pooler, backlog-age monitoring, and the drain-and-re-claim
  rollback drill (M2-AC09/3).
