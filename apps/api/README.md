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
| `GET /health` | One connection as the runtime role: `SELECT 1` and the database clock, the newest row of `ops.pgmigrations` against `EXPECTED_MIGRATION_HEAD`, and the pg-boss schema version against `EXPECTED_PGBOSS_VERSION` (both from `@wringy/db`), read through the migrator-owned view `ops.pgboss_schema_version`: the API login has no access to schema `pgboss` (kickoff-package.md §4.11, §8.5). 200 `status: 'ok'`, or 503 `status: 'unavailable'` with each check `ok` or `failing`, the heads read and `dbNow`. A failing check's SQLSTATE goes to the log only |
| `GET /internal/campaigns` | Fixture campaigns only (`data_origin = 'fixture'`), joined to `app.orgs` for `orgName`, newest `updated_at` first; `dataAsOf` is the database clock |
| `GET /internal/worker-health` | Every `ops.worker_heartbeat` row with `state` (process liveness) and `queueState` (queue-path liveness) judged on the database clock read in the same statement; `workers: []` when no worker has ever beaten (the page shows unknown, never 0) |
| `POST /identity/sign-in` | The first-sign-in gate and the profile upsert, in one transaction: session liveness, then `SELECT ... FOR UPDATE` on `app.profiles` — whose locked row decides, so an account disabled since the hook's read is 403 `account.disabled` here, before any write — then the `app.sign_in_allowlist` lookup (first sign-in only) or the refresh of `contact_email`, `display_name` and `last_sign_in_at`, the only three columns the runtime role may update (migration 0010). The only route a verified subject with no profile row may reach |
| `GET /me` | The caller's profile and the access token's own `expiresAt`, so a page can say how long this tab stays signed in without holding the token |
| `POST /me/session/probe` | The reserved fund-sensitive stub (M2-AC02/2). It changes nothing: it opens a transaction, asks session liveness on that same connection, re-reads the account's own `status` there with `SELECT ... FOR SHARE`, and returns `{ ok: true, checkedAt }` on the database clock. A session that has ended gets 401 `session.revoked`; an account disabled since the hook's read gets 403 `account.disabled`, and a row that has gone 403 `profile.missing` |

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
| 401 | `unauthenticated` | No acceptable bearer token (see the claim table below). One message for every reason |
| 401 | `auth.expired` | The signature and the claims were fine; the token's own lifetime has passed |
| 503 | `auth_unavailable` | The project's JWKS could not be fetched, parsed or reached. **Never** "no matching key", which is the token's fault |
| 401 | `session.revoked` | The token is valid but its session is gone (signed out, or `not_after` passed) |
| 503 | `session_check_unavailable` | Whether the session is live could not be established |
| 403 | `sign_in.not_allowed` | First sign-in, and the verified address is not on `app.sign_in_allowlist` |
| 403 | `account.disabled` | An operator set `app.profiles.status = 'disabled'` (ruling D12) |
| 403 | `profile.missing` | A verified subject with no profile row called anything but `POST /identity/sign-in` |

The two 503s are deliberate. A JWKS blip, or a liveness question that cannot be
answered, must not sign every signed-in tester out of the internal build, so both
are retryable and the web treats every 503 as "unexpected, try again", never as
"your session ended" (M2-02 R9).

Every response carries `Cache-Control: private, no-store`. Responses of routes
behind the authentication hook also carry `Vary: Authorization`, because their
content depends on that header; `GET /health` and `GET /health/live` do not read
it and do not claim to (R18). There is no CORS, no cookie and no browser-facing
surface: the web server calls the API server-to-server at `API_INTERNAL_URL` with
`Authorization: Bearer <access token>`.

## Authentication

Every route but `/health` and `/health/live` runs `app.authenticate`
(src/authenticate.ts) as an `onRequest` hook. `buildApp` **requires** the hook and
the liveness adapter -- there is no default and no no-op, so a forgotten wiring
fails to compile rather than serving the internal build to anybody (M2-02 R8).
`startServer` builds both from the environment (`identityWiringFor`), and the
integration suite builds them from a key pair generated in the process.

That sentence is a property, not a promise: the hook is added inside each plugin,
so nothing at the root enforces it and a later route registered elsewhere would
simply be open. `buildApp` therefore collects every route it registers
(`app.routeTable`, an `onRoute` hook), and an API-int test injects each of them
with no `Authorization` header and asserts 401 `unauthenticated` plus
`Vary: Authorization` -- except the two health routes, which must answer and must
not claim to vary (R18). The check grows with the route table instead of with a
hard-coded list.

### What is verified

`jose` 6.2.12 verifies the bearer token against the project's published key set at
`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, with jose's own defaults (cache 10
minutes, cooldown 30 seconds, timeout 5 seconds). The key-set URL comes from
configuration and is never derived from the token's own `iss`, which is how a
forged token would otherwise choose its own key domain.

| Claim or input | Rule |
|---|---|
| signature | ES256 only. HS256 is refused, so no shared JWT secret exists anywhere |
| `iss` | Exactly `${SUPABASE_URL}/auth/v1` |
| `aud` | Exactly `authenticated` |
| `exp`, `iat` | Required; 5 seconds of clock tolerance |
| `sub` | Required. The only identity, and `app.profiles.id` |
| `session_id` | Required. The subject of the liveness question; never logged |
| `role` | Required, and must equal `authenticated`. It is a PostgreSQL role name, not a Wringy role |
| `aal` | Required; kept on the actor, not used for grants in M2 |
| `is_anonymous` | Must not be `true` |
| `client_id` | Must be absent. Its presence marks Supabase's OAuth-server feature, which stays disabled |
| `email` | The top-level claim only, the one GoTrue sets from the identity store. It decides the sign-in gate |
| `user_metadata`, `app_metadata` | Never used for authorisation. `user_metadata.full_name` (else `.name`) is the display name, for display only |
| `X-User-Id`, `X-Role`, body `userId`/`orgId`/`role` | Ignored. A valid token of A carrying B's id in every header we might be tempted to read still acts as A (tested) |

Anything not acceptable is one answer, 401 `unauthenticated`, with one fixed
message: no bearer, a bad signature, a wrong issuer or audience, an algorithm
outside the allow-list, a missing claim, a wrong role, an anonymous or
OAuth-client token, and a key id the project does not publish. Only an expired
token is told apart (`auth.expired`), because the web must sign in again rather
than report a fault.

The hook then puts `request.actor` (`userId`, `sessionId`, `email`, `displayName`,
`token`, `expiresAt`) and `request.profile` on the request, so no route has to
remember to load either. A disabled profile is refused everywhere with 403
`account.disabled`; a verified subject with no profile row reaches only
`POST /identity/sign-in`, which declares `config: { allowMissingProfile: true }`.

Nothing identifying is logged. A refusal logs one reason word, and a jose
claim-validation error is never logged as an object, because it carries the whole
decoded payload -- the session id with it. An integration row asserts that no
captured log line contains the token or the session id.

### Session liveness

A revoked session's access token stays valid until its `exp`, so the token alone
cannot answer "is this session still live?". Reads accept that and rely on the
token (they are valid for at most its lifetime); every state-changing command asks,
**inside its own transaction**, so the answer and the write cannot be separated by
a sign-out. `SESSION_LIVENESS` names the adapter (required, no default):

| Value | Asks | Works where |
|---|---|---|
| `database` | `platform.session_is_live(session_id, user_id)`, the SECURITY DEFINER function the platform bootstrap installs (packages/db/src/platform.ts). The query runs on the command's own transaction client | The application database *is* the identity store's database (staging, M2-09), or a local or CI cluster with the stub `auth.sessions` |
| `auth_server` | `GET ${SUPABASE_URL}/auth/v1/user` with the caller's own token, the publishable key as `apikey` and `X-Supabase-Api-Version: 2024-01-01`; 3 second timeout, below `API_QUERY_TIMEOUT_MS` | Anywhere, including the local internal build, whose app database is an embedded PostgreSQL while sign-in goes to a hosted project |

Both fail closed **towards retry, never towards sign-out**. Only a definite answer
is `revoked`: an absent or expired session row, or a 401/403 whose GoTrue `code`
(or `error_code`) is `session_not_found`, `user_not_found` or `user_banned`. A
5xx, a 429, an unknown code, a body that is not JSON, a timeout, a transport
failure and a database that cannot be reached are all `unavailable`, and answer
503 `session_check_unavailable`.

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
  `res.headers["set-cookie"]` wherever headers are logged (the request
  serializer logs none).
- `formatters.log` censors every key matching `/url|password|secret|token/i`,
  at any depth of a logged plain object (`{ databaseUrl }` → `[Redacted]`).
  Fastify's request object is not a plain object, so it reaches the `req`
  serializer whole.
- The `err` and `msg` serializers scrub `postgres://…` connection strings and
  `user:password@` URL credentials from messages, stacks and causes.
- The `req` serializer replaces Fastify's. It logs `method`, `url` as the path
  only (no query string or fragment), `id` and `remoteAddress`, and nothing
  else. Fastify's default logged `req.url` whole, so a request such as
  `GET /health/live?password=…` wrote the value to the log (M2-01 cross-vendor
  review).

Tests capture the real pino output and assert that neither the connection
string nor its password appears in any log line or response body.
`tests/integration/secrets.int.test.ts` ("M2-AC01/2 request logs keep the
pathname and drop the query string …") sends requests with
`?password=<canary>&token=<canary>`. It checks that neither value appears in
the log and that each request's path does.

`pnpm canary` (scripts/check-secret-canary.mjs) checks the built artefacts and
the running processes as well: it gives every variable of the five env schemas
a canary value (the database URLs carry canary passwords), builds web, api and
worker with them, searches `apps/web/.next/static`, `apps/web/.next/server`,
`apps/api/dist` and `apps/worker/dist` for every value, then runs the built api
and worker for 10 s against an unreachable database and searches their logs.
It fails on any hit, naming the file and the variable, never the value. The
canary covers secrets that come from the environment only. It sends no
request, because the api starts listening only after it has read the
environment marker (src/server.ts), which it cannot do against an unreachable
database. Secrets in request query strings are covered by the integration test
above.

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
| Each statement, on the server | 4.5 s (`API_STATEMENT_TIMEOUT_MS`) | PostgreSQL `statement_timeout`, sent by pg as a startup parameter on the API pool (src/database.ts) | A read waiting on a migration's lock, or running too long, is cancelled by the server (57014) → 503 `database_unavailable`; the backend is freed at once and the connection stays in the pool, so timed-out reads cannot pile up backends past the pool's max. `tests/integration/timeouts.int.test.ts` holds a lock on `app.campaigns` for three rounds of 10 reads and finds no backend waiting (without the setting: 10 after the first round). Whether Supavisor session mode passes the startup parameter is unverified (M2-09); the fallback is `ALTER ROLE wringy_api_login SET statement_timeout` |
| Each query, on the client | 5 s (`API_QUERY_TIMEOUT_MS`) | pg `query_timeout` on the API pool (src/database.ts) | A database that accepts the connection but never answers cannot stall `/health` or a read: pg rejects with "Query read timeout" → 503 `database_unavailable`, and the client is discarded, never returned to the pool. `/health` then stops its remaining checks (reported `failing`), so it waits one limit, not one per check; the timeouts integration test proves this through a proxy that swallows the server's replies |
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
| `SUPABASE_URL` | none | This environment's Supabase project **origin** (no path, no trailing slash). The issuer is `<origin>/auth/v1`, and the key set is fetched from it |
| `SUPABASE_PUBLISHABLE_KEY` | none | The publishable key (`sb_publishable_...`), for the `auth_server` liveness call. Never a `sb_secret_...` or service-role key: the API holds neither |
| `SESSION_LIVENESS` | none | `database` or `auth_server` (see Session liveness above). No default: the wrong answer here is a silent one |
| `PORT` | 3200 | Listen port |
| `HOST` | 127.0.0.1 | Listen address |
| `LOG_LEVEL` | info | pino level |

## Scripts

| Script | Does |
|---|---|
| `pnpm --filter api dev` | `node --watch --import tsx` on src/main.ts with `.env` (Node's watch mode with the tsx loader; `tsx watch` printed nothing under `pnpm dev` on Windows, see the root README) |
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
pool as `wringy_api_login`.

*Credentials are never needed.* `tests/integration/jwt-support.ts` generates an
ES256 key pair in the process, publishes it as a local JWKS the real hook verifies
against, and signs every token shape the hook must refuse (an unknown key,
`alg: none`, HS256 with a publishable key, a wrong issuer or audience, a missing
claim, a wrong role, an anonymous or OAuth-client token, an unknown key id, an
expired token). `fakeAuthUserServer()` stands in for `GET /auth/v1/user` with a
programmable status, body and delay, and records what it was sent as *shapes*
rather than values, so a failing assertion cannot print a token. `serveJwks()`
serves a key set over HTTP for the one test that builds the app exactly the way
`startServer` does, `createRemoteJWKSet` included. `support.ts` `signedIn()`
arranges one signed-in person: the `app.profiles` row, the stub `auth.sessions`
row and a token for both.

*Isolation: a committed clone per file, not a rolled-back transaction per test.*
Signed kickoff-package.md §6.3 says "API integration tests each run in a
transaction that is rolled back afterwards". They cannot: the app under test
reads through its own `pg.Pool` as `wringy_api_login` (that is what the tests
prove), and a transaction opened by the test on another connection is invisible
to it until committed; the rows it reads have to be committed. So each file gets
its own clone, dropped in `afterAll`, and the tests in a file share it. A test
that needs a particular state arranges it itself (for example the leak probe in
`internal-campaigns.int.test.ts` adds its own canary column), so a test run
alone (`-t`) or reordered proves the same thing. packages/db's own tests, which
query directly, use `withRollback`. This is recorded as an implementation
deviation in docs/m2-internal/acceptance-record.md. tests/integration/support.ts imports the harness
as `@wringy/db/testing`, the test-only subpath export of `@wringy/db`.
The global setup also installs packages/db/test/exit-code-guard.ts, which
restores a failing exit code: the embedded-postgres import registers
async-exit-hook, whose `beforeExit` handler calls `process.exit(0)` and would
otherwise turn a failed run into exit 0.

**Test names.** Every test here, unit and integration, carries this ticket's
key `M2-AC01` in its `describe` title (kickoff-package.md §6.1; `m2-01.md`:
"本路径测试命名含 `M2-AC01`"). Titles carrying `M2-AC01/2` prove that sub-item:
the Fastify→PostgreSQL leg of the page→Fastify→PostgreSQL read (the campaigns
and worker health on a freshly migrated database, through `app.inject()`; the
page leg is the internal Playwright suite's cold-start tests), with the response
schema as the allow-list; the
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
