# api

The Fastify business API for the M2 internal build (kickoff-package.md §8.3,
§8.5, §8.7). In M2-01 it serves the narrow loop: the `/internal` page's server
components call it, and it reads PostgreSQL as the runtime login
`wringy_api_login` (group `wringy_api`, SELECT only). Fastify 5.12.5 with
`@fastify/type-provider-zod` 1.0.0 and zod 4.6.5; `pg` 8.23.0 through
`@wringy/db`; no ORM.

## Routes

| Route | Behaviour |
|---|---|
| `GET /health/live` | 200 `{ status: 'ok' }`; the process only, no database |
| `GET /health` | One connection as the runtime role: `SELECT 1` and the database clock, the newest row of `ops.pgmigrations` against `EXPECTED_MIGRATION_HEAD`, and `pgboss.version` against `EXPECTED_PGBOSS_VERSION` (both from `@wringy/db`). 200 `status: 'ok'`, or 503 `status: 'unavailable'` with each check `ok` or `failing`, the heads read and `dbNow`. A failing check's SQLSTATE goes to the log only |
| `GET /internal/campaigns` | Fixture campaigns only (`data_origin = 'fixture'`), joined to `app.orgs` for `orgName`, newest `updated_at` first; `dataAsOf` is the database clock |
| `GET /internal/worker-health` | Every `ops.worker_heartbeat` row with `state` (process liveness) and `queueState` (queue-path liveness) judged on the database clock read in the same statement; `workers: []` when no worker has ever beaten (the page shows unknown, never 0) |

Response bodies are the zod schemas in `@wringy/contracts`. They are the
allow-list: the type provider serialises the schema's encoded output and
`z.object` drops every key the contract does not name, so an added column or an
over-selecting handler cannot leak a field (tested on real rows). The SQL still
names its columns.

Errors are `{ error: { code, message } }` with a fixed English message and no
stack, SQL text or connection string:

| Status | `code` | When |
|---|---|---|
| 503 | `database_unavailable` | No connection could be obtained or it was lost (network codes, SQLSTATE class 08, 57P01–57P03, 53300, 3D000, 28000/28P01, pg's connection messages) |
| 404 | `not_found` | No route matches |
| 4xx | `bad_request` | Fastify rejected the request |
| 500 | `internal_error` | Anything else; the scrubbed stack is logged |

Every response carries `Cache-Control: private, no-store`. There is no CORS, no
cookie and no browser-facing surface: the web server calls the API
server-to-server at `API_INTERNAL_URL`.

## Authentication: the M2-02 hook point

There is no sign-in in M2-01. Every `/internal/*` route already runs
`app.authenticate` (src/authenticate.ts) as an `onRequest` hook, and today it
is a no-op with a `TODO(M2-02)`. M2-02 replaces it with Supabase access-token
verification (kickoff-package.md §4.4); M2-03 puts `/internal/*` behind an ops
capability. `buildApp({ authenticate })` accepts the replacement, and a test
proves both internal routes stop at a refusing hook while `/health/live` does
not.

## Startup

`src/main.ts` loads the API's variables with `loadApiEnv()` from
`@wringy/config/api` (fail fast; the message names variables, never values),
then `src/server.ts`:

1. creates one pool as `DATABASE_URL`'s login with `application_name`
   `wringy-api`;
2. reads `ops.environment` and **refuses to start** (exit 1) unless its name
   equals `WRINGY_ENV`, or when the marker row or table is missing. The message
   names both environments, never the URL. While the database is unreachable it
   retries with backoff (8 attempts, 0.5 s doubling to 8 s, about 45 s), so
   `pnpm dev` can start everything at once;
3. listens on `HOST:PORT` (default `127.0.0.1:3200`).

SIGTERM and SIGINT close the server (in-flight requests finish) and then end the
pool. Migrations never run here (kickoff-package.md §4.10).

## Logs and secrets

pino through Fastify's `logger` option, at `LOG_LEVEL` (src/logger.ts). One
JSON object per line on stdout; `time` is an ISO 8601 UTC string
(`pino.stdTimeFunctions.isoTime`, `2026-09-23T08:29:00.123Z`), the same format
apps/worker writes (`src/logger.test.ts`, "M2-AC01 API log line format").
`pino` is a declared dependency for that one function; Fastify already
resolves the same 10.3.1.

- `redact` censors `req.headers.authorization`, `req.headers.cookie` and
  `res.headers["set-cookie"]` wherever headers are logged (the default request
  serializer logs none).
- `formatters.log` censors every key matching `/url|password|secret|token/i`,
  at any depth of a logged plain object (`{ databaseUrl }` → `[Redacted]`).
  Fastify's request object is not a plain object, so request logs keep the path.
- The `err` and `msg` serializers scrub `postgres://…` connection strings and
  `user:password@` URL credentials from messages, stacks and causes.

Tests capture the real pino output and assert that neither the connection
string nor its password appears in any log line or response body.

`pnpm canary` (scripts/check-secret-canary.mjs) checks the built artefacts and
the running processes as well: it gives every variable of the five env schemas
a canary value (the database URLs carry canary passwords), builds web, api and
worker with them, searches `apps/web/.next/static`, `apps/web/.next/server`,
`apps/api/dist` and `apps/worker/dist` for every value, then runs the built api
and worker for 10 s against an unreachable database and searches their logs.
It fails on any hit, naming the file and the variable, never the value.

## Worker state thresholds (operational, not business rules)

Each worker row gets two independent judgements on the **database clock**
(src/worker-state.ts), with the heartbeat protocol's operational constants from
`@wringy/db` (packages/db/src/heartbeat.ts), the same ones the worker beats by:

| Field | From | Values |
|---|---|---|
| `state` (process liveness) | `last_beat_at`, `stopped_at` | `stopped` when a graceful stop was recorded at or after the last beat; `stale` when the last beat is more than `STALE_AFTER_MS` (45 s, three missed 15 s beats) old; `never_seen` for a row without a beat (the column is NOT NULL, so in practice the empty list stands for it); otherwise `healthy` |
| `queueState` (queue path) | `last_queue_round_trip_at` | `never` before the first pg-boss round trip; `overdue` when the last one is more than `QUEUE_OVERDUE_AFTER_MS` (3 min, three missed one-minute schedules) old; otherwise `ok` |

`queueState` never changes `state`: a worker can beat while its queue path is
dead, and the card shows both. Business defaults (rates, thresholds, durations,
rounding) live only in `phase-0/foundation/campaign-defaults-v1.md` and never here.

## Timeouts

| Limit | Value | Where | Effect |
|---|---|---|---|
| Connection checkout | 5 s | `createPool` default `connectionTimeoutMillis` (@wringy/db) | pg's "timeout exceeded when trying to connect" → 503 `database_unavailable` |
| Each query | 5 s (`API_QUERY_TIMEOUT_MS`) | pg `query_timeout` on the API pool (src/database.ts; unit-tested) | A database that accepts the connection but never answers cannot stall `/health` or a read: pg rejects with "Query read timeout" → 503 `database_unavailable` (the `/health` check reports `failing`) |
| Startup wait for the database | about 45 s | `STARTUP_RETRY` (src/server.ts) | then exit 1 |

All three are operational limits, not business rules.

## Environment

`apps/api/.env.example` lists the names; copy it to `apps/api/.env`, which
`pnpm dev` and `pnpm start` load with `--env-file-if-exists` (the process
environment wins over the file). `apps/api/.env` is gitignored by the root
`.gitignore` rule `.env` (`git check-ignore -v apps/api/.env` prints
`.gitignore:7:.env`); the API does not read the repository-root `.env`, which
belongs to the packages/db scripts. For the local embedded cluster
(`pnpm db:start`), the API login's development URL is the `wringy_api_login` line
that `pnpm db:start` prints (`localUrls().api` in `packages/db/src/local-dev.ts`),
with `WRINGY_ENV=local`.

| Variable | Default | Meaning |
|---|---|---|
| `WRINGY_ENV` | none | `local`, `ci`, `staging` or `production`; must equal `ops.environment.name` |
| `DATABASE_URL` | none | The API runtime login (`wringy_api_login`) |
| `PORT` | 3200 | Listen port |
| `HOST` | 127.0.0.1 | Listen address |
| `LOG_LEVEL` | info | pino level |

## Scripts

| Script | Does |
|---|---|
| `pnpm --filter api dev` | `tsx watch` on src/main.ts with `.env` |
| `pnpm --filter api build` | scripts/build.mjs: esbuild bundles src/main.ts to dist/main.js (ESM, node24, sourcemap) |
| `pnpm --filter api start` | `node --env-file-if-exists=.env dist/main.js` |
| `pnpm --filter api lint` / `typecheck` | ESLint (typescript-eslint recommended) / `tsc --noEmit` |
| `pnpm --filter api test` | Unit tests (src/*.test.ts): worker state, redaction, 503-versus-500 classification, config |
| `pnpm --filter api test:int` | Integration tests (tests/integration) on a real PostgreSQL 17 through the `@wringy/db` harness |

**Build.** The workspace packages (`@wringy/*`) ship TypeScript source and are
bundled; every other bare import stays external and loads from this package's
own `node_modules` at run time. External imports reached only through a
workspace package are marked free of side effects, so `@wringy/db`'s migration
tooling (`node-pg-migrate`), which the API never calls, is dropped; without that
the bundle imports `node-pg-migrate`, which `api` does not declare. The build
fails if any external outside `dependencies` (or a Node built-in) survives.

**Integration tests.** `vitest.int.config.ts` runs the harness's global setup
(`@wringy/db/testing/global-setup`, packages/db/test/global-setup.ts:
`TEST_DATABASE_URL`, or a throwaway embedded cluster, roles bootstrapped, a
template migrated from zero and marked `ci`).
Each file clones the template with `createTestDatabase()`, seeds it with
`seedFixtures()` where needed, and drives `buildApp()` with `app.inject()` on a
pool as `wringy_api_login`. tests/integration/support.ts imports the harness
as `@wringy/db/testing`, the test-only subpath export of `@wringy/db`.
The global setup also installs packages/db/test/exit-code-guard.ts, which
restores a failing exit code: the embedded-postgres import registers
async-exit-hook, whose `beforeExit` handler calls `process.exit(0)` and would
otherwise turn a failed run into exit 0.

**Test names.** Every test here, unit and integration, carries this ticket's
key `M2-AC01` in its `describe` title (kickoff-package.md §6.1; `m2-01.md`:
"本路径测试命名含 `M2-AC01`"). Titles carrying `M2-AC01/2` prove that sub-item:
the page→Fastify→PostgreSQL read of the campaigns and of worker health on a
freshly migrated database, with the response schema as the allow-list; the
runtime role unable to write; and no secret in bodies or logs (the secrets,
outage and startup tests, and the log scrubber's unit tests).

## Docker image

`apps/api/Dockerfile` (kickoff-package.md §8.9), built from the repository root:
`docker build -f apps/api/Dockerfile -t wringy-api:<git-sha> .`. The build stage installs
`api...` frozen, runs `pnpm --filter api build` and `pnpm --filter @wringy/db build`, then
`pnpm --filter api --prod deploy --legacy /out/api` (pnpm 10 deploys workspace dependencies only
with `--legacy` or `inject-workspace-packages`, [pnpm deploy](https://pnpm.io/cli/deploy)). The
runtime stage, `node:24-bookworm-slim` pinned by digest (Node 24.21.0), holds `package.json`,
the production `node_modules` and `dist/`, and runs `node dist/main.js` as `USER node` with
`HOST=0.0.0.0` and `PORT=3200` (Render sets `PORT` and needs the host `0.0.0.0`,
[render.com/docs/web-services](https://render.com/docs/web-services)).

```sh
docker run --rm -p 3200:3200 -e WRINGY_ENV=<env> -e DATABASE_URL=<wringy_api_login URL> wringy-api:<git-sha>
```

**Migrate step.** The same image carries `/migrate`: the `@wringy/db` production deploy,
`packages/db/migrations` and `dist/migrate.js`, the `pnpm db:migrate` CLI bundled by
`pnpm --filter @wringy/db build`. Run it once per release, before the new api and worker start,
as the migrator (never a runtime login):

```sh
docker run --rm -e WRINGY_ENV=<env> -e DATABASE_URL_MIGRATOR=<wringy_migrator URL>   wringy-api:<git-sha> node /migrate/dist/migrate.js
```

It installs or upgrades the pg-boss schema, applies the pending SQL migrations and checks the
head; a second run changes nothing. The roles (`pnpm db:bootstrap`) and the environment marker
(`pnpm db:env`) are one-time steps per environment run from a checkout
(`packages/db/README.md`). Whether Render's pre-deploy command can run it on the chosen plan is
unverified (kickoff-package.md §8.9, §10 G18; M2-09).

No Docker on the development machine: CI's `images` job (`.github/workflows/app.yml`) builds the
image with `push: false` and checks that `node dist/main.js` and `node /migrate/dist/migrate.js`
reach their environment checks (every import resolved) as the `node` user. Locally, the same
`pnpm deploy` output ran on Node 24.21.0 against a freshly migrated database and answered
`/health` "ok" (2026-09-23).

## Dependencies

Pinned per kickoff-package.md §5.3. `@fastify/type-provider-zod` 1.0.0 declares
`@fastify/swagger` and `openapi-types` as peers, but its runtime imports only
zod and `@fastify/error`; the root `pnpm-workspace.yaml` marks the two optional
(`packageExtensions`) so no swagger generator is installed.

`pnpm depcruise` (rule `api-not-to-other-apps`) keeps this app to
`@wringy/*` packages and npm dependencies; it may not import `apps/web` or
`apps/worker`, nor the demo engine (`server-not-to-demo-engine`).
