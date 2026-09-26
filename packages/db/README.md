# @wringy/db

PostgreSQL access for the API and the worker: connection pools, the versioned SQL
migrations and their runner, the pg-boss schema install, the per-environment
bootstrap and environment marker, the internal-build fixture seed, local
PostgreSQL without Docker, and the integration-test harness
(kickoff-package.md §4.10–§4.11, §6.2–§6.3, §8.1, §8.4–§8.5). No ORM.

## What it owns

| Path | Role |
|---|---|
| `src/pool.ts` | `createPool({ connectionString, applicationName, max, connectionTimeoutMillis, queryTimeoutMillis, statementTimeoutMillis })` on `pg` 8, one pool per role and process (`queryTimeoutMillis` sets pg's client-side `query_timeout`, `statementTimeoutMillis` the server-side `statement_timeout`; the API uses 5 s and 4.5 s); `withClient` and `withTransaction` |
| `src/heartbeat.ts` | The worker heartbeat protocol's **operational** constants, in the one package both apps may import: `HEARTBEAT_INTERVAL_MS` (15 s, the worker's process beat), `STALE_AFTER_MS` (45 s, three missed beats), `QUEUE_OVERDUE_AFTER_MS` (3 min, three missed one-minute round trips). Not business rules; `src/heartbeat.test.ts` pins `STALE_AFTER_MS = 3 × HEARTBEAT_INTERVAL_MS` |
| `src/migrate.ts` | `migrateDatabase()` (what `pnpm db:migrate` runs: pg-boss schema, then SQL migrations, then a head check) and `runMigrations()` on node-pg-migrate 9: SQL files, one transaction per batch, session advisory lock (a concurrent run fails), order check, `search_path` = `app` |
| `src/pgboss.ts` | `installPgBossSchema()`: runs the pg-boss CLI's `migrate` as the migrator; `readPgBossVersion()` |
| `src/expected-head.ts` | `EXPECTED_MIGRATION_HEAD` and `EXPECTED_PGBOSS_VERSION`, which GET /health compares the database with; unit-tested against the migrations directory and the installed pg-boss |
| `src/environment.ts`, `src/cli/env.ts` | The environment marker `ops.environment` and `pnpm db:env` |
| `src/fixtures.ts`, `src/cli/seed-fixtures.ts`, `fixtures/internal-campaigns.sql` | `pnpm db:seed:fixtures` |
| `src/allowlist.ts`, `src/cli/allowlist.ts` | `normalizeEmail()` (the one normal form for a sign-in address) and `pnpm db:allowlist add\|remove\|list` over `app.sign_in_allowlist` |
| `src/platform.ts`, `src/cli/platform-bootstrap.ts` | The platform bootstrap: the SQL for the stub `auth.sessions`, the non-superuser `wringy_platform_admin` and `platform.session_is_live`, plus `installPlatform()` and `pnpm db:platform-bootstrap` |
| `migrations/NNNN_name.sql` | The migrations, applied as the migration owner. SQL files only, `-- Up Migration` / `-- Down Migration` markers ([node-pg-migrate "Legacy SQL migrations"](https://github.com/salsita/node-pg-migrate/blob/v9.0.0/docs/src/migration-loading-strategies.md)) |
| `src/roles.ts` | Role and schema names |
| `src/bootstrap.ts`, `scripts/bootstrap.mjs` | `pnpm db:bootstrap` |
| `scripts/local-pg.mjs`, `src/local-dev.ts` | `pnpm db:start` / `db:stop` / `db:status`, and the fixed local development values |
| `test/` | The integration-test harness, the reviewed grant manifest (`test/grant-manifest.ts`) and the integration tests (`pnpm test:int`). Exported for other workspaces' **tests only** (below) |

**Test-only exports.** `package.json` exports four subpaths next to `.`:

| Import | File | For |
|---|---|---|
| `@wringy/db/testing` | `test/harness.ts` | Vitest integration suites (apps/api, apps/worker): `createTestDatabase()`, `seedFixtures()`, `setTestEnvironment()`, `withRollback()`, `sqlState()`, `failureIn()`, `withClientAt()`, `TEST_WRINGY_ENV`, and for identity `insertLiveSession(db, { sessionId, userId, notAfter? })`, `endSession(db, sessionId)`, `allowlistAdd(db, { email, reason?, addedBy? })` and `withDatabaseAdmin(db, fn)`; the cluster comes from Vitest's `inject('wringyCluster')` |
| `@wringy/db/testing/global-setup` | `test/global-setup.ts` | The `globalSetup` of every `vitest.int.config.ts` (resolved with `createRequire(import.meta.url).resolve(…)`) |
| `@wringy/db/testing/cluster` | `test/cluster.ts` | Code without a Vitest runtime, run with tsx (the Playwright internal suite's database process, `apps/web/tests/e2e-internal/database-server.mts`): `startTestCluster()`, `bootstrapTestRoles()`, `bootstrapTestPlatform()`, `createDatabaseIn()`, `seedFixturesIn()`, `setEnvironmentIn()`, `withClientAt()`, `withDatabaseAdminAt()` |
| `@wringy/db/testing/connect` | `test/connect.ts` | Runners that load test files as CommonJS (Playwright in apps/web): `loginUrlsAt(host, port, database)`, `withClientAt(url, fn)`, `allowlistAddAt(migratorUrl, email)`, `insertLiveSessionAt(adminUrl, session)` and `endSessionAt(adminUrl, sessionId)`, importing only `pg` and constants. cluster.ts cannot load there, because `src/migrate.ts` and `src/fixtures.ts` use `import.meta.url` |

No product module imports them: the dependency rules cruise `apps/*/src` and
`packages/*/src` only, and these files live under `test/`.

The migrations table is `ops.pgmigrations` (the tool's default name, in the `ops`
schema). The runner creates `ops` and that table before the first migration runs.

`package.json` declares `"sideEffects": false`: no module in `src/` runs code at
import time, so a bundler keeps only what an app uses. `apps/worker`'s esbuild
bundle relies on it to leave out the migration runner (node-pg-migrate) and
`src/local-dev.ts`; keep new modules free of import-time effects.

## Schema (M2-01, M2-02)

| Migration | Creates | Rights |
|---|---|---|
| `0001_schemas_roles` | Schemas `app`, `ops`; NOLOGIN groups when absent; default privileges | See Roles |
| `0002_environment_marker` | `ops.environment` (at most one row; a production marker can never allow fixtures), `ops.touch_updated_at()`, `ops.assert_fixture_allowed()` | api and worker: SELECT |
| `0003_orgs_campaigns` | `app.orgs`, `app.campaigns` (`data_origin` `fixture`/`live`, composite FK `(org_id, data_origin)` → `app.orgs(id, data_origin)`, fixture trigger on both, `updated_at` trigger) | api: SELECT; worker: nothing |
| `0004_worker_heartbeat` | `ops.worker_heartbeat` (one row per worker; timestamps from the database clock) | worker: SELECT, INSERT, UPDATE; api: SELECT |
| `0005_pgboss_grants` | Rights on schema `pgboss`, which `pnpm db:migrate` installs first | worker: USAGE, table DML, sequence use, EXECUTE (plus default privileges for later pg-boss objects); api: SELECT on `ops.pgmigrations` (and, until 0006, USAGE on `pgboss` and SELECT on `pgboss.version`) |
| `0006_pgboss_runtime_bounds` | `ops.pgboss_schema_version` (a migrator-owned, non-updatable view of the pg-boss schema version); CHECK `wringy_queue_shared_table_only` on `pgboss.queue` (every queue unpartitioned, on the shared `job_common` table) | worker: `pgboss.version` SELECT plus UPDATE of the five run-time timestamps only, never `version`; nothing on the view. api: SELECT on the view; its USAGE on `pgboss` and SELECT on `pgboss.version` are revoked, so the API has no `pgboss` access (kickoff-package.md §4.11, §8.5) |
| `0007_data_origin_immutable` | `ops.assert_data_origin_unchanged()` and a BEFORE UPDATE trigger on `app.orgs` and `app.campaigns`: a row's `data_origin` never changes (23514, constraint `data_origin_immutable`) | None |
| `0008_profiles` | `app.profiles`: `id` = the verified token subject (no foreign key to the identity store, IT1), `display_name`, `contact_email`, `locale_pref` (CHECK `en-MY`/`ms-MY`/`zh-Hans-MY`) with `locale_pref_set_at`, `status` (CHECK `active`/`disabled`, default `active`), `last_sign_in_at`, `created_at`, `updated_at` with the shared `ops.touch_updated_at()` trigger. **No `data_origin` and no fixture trigger**: every user is a real identity (§3.5) | api: SELECT, INSERT, UPDATE (it upserts at each sign-in), narrowed to four columns by 0010; never DELETE. worker: nothing |
| `0009_sign_in_allowlist` | `app.sign_in_allowlist(email_norm PK CHECK non-empty and already lower-cased, reason NOT NULL, added_by NOT NULL, added_at)`: who may sign in for the first time (ruling D13) | api: SELECT. Written only by the migrator, through `pnpm db:allowlist` |
| `0010_profiles_column_grants` | No new object: 0008's table-level INSERT and UPDATE on `app.profiles` become **column** grants, so the runtime role cannot write `status` (ruling D12: only an operator disables an account) or the locale columns M2-04 owns | api: SELECT on the table; INSERT (`id`, `contact_email`, `display_name`, `last_sign_in_at`) and UPDATE (`contact_email`, `display_name`, `last_sign_in_at`) only; never DELETE. worker: nothing |

`app.profiles` and `app.sign_in_allowlist` carry no `data_origin`: a user is
never a fixture, and the allow-list names real testers' addresses, so there is no
fixture form of either. `profiles.status = 'disabled'` is the one lever that ends
someone's access (ruling D12); removing an address from the allow-list signs
nobody out, because the list is read at the first sign-in only.

Fixture and live data stay apart twice (Implementation Decision 5): the marker
says whether an environment allows fixture rows, and `ops.assert_fixture_allowed()`
refuses a fixture row (SQLSTATE 23514, constraint `ops_environment_fixtures_allowed`)
where it does not or where no marker exists; the composite foreign key refuses a
campaign whose data origin differs from its org's (23503); and a row's data origin
is fixed at creation (0007: 23514, constraint `data_origin_immutable`), so no
UPDATE can pass a fixture row off as live or the reverse. To move data between
origins, delete the row and insert a new one.

## Roles

| Role | Kind | Rights |
|---|---|---|
| `wringy_migrator` | login | Owns the database, `app`, `ops` and `pgboss`; runs all DDL and writes the marker and the fixture seed. On Supabase possibly `postgres` (unverified) |
| `wringy_api` | NOLOGIN group | `USAGE` on `app` and `ops`; SELECT on the tables in `test/grant-manifest.ts`, the pg-boss schema version through `ops.pgboss_schema_version`. No writes in M2-01, no CREATE, nothing in `pgboss` |
| `wringy_worker` | NOLOGIN group | `USAGE` on `ops` and `pgboss`; SELECT on `ops.environment`; SELECT/INSERT/UPDATE on `ops.worker_heartbeat`; pg-boss DML and EXECUTE, except that `pgboss.version` is read-only apart from its run-time timestamps. Nothing in `app`, no CREATE, no TRUNCATE |
| `wringy_api_login` | login, member of `wringy_api` | API process |
| `wringy_worker_login` | login, member of `wringy_worker` | Worker process |
| `wringy_platform_admin` | NOLOGIN, **not** a superuser | Owns schema `platform` and `platform.session_is_live` locally and in CI. Holds only `USAGE` on `auth` with `SELECT` on `auth.sessions`, and `CREATE` on the database. Created by the platform bootstrap, never by a migration |

## Session liveness: the platform bootstrap

`platform.session_is_live(session_id uuid, user_id uuid) RETURNS boolean` answers
whether the hosted identity store still holds that session (kickoff-package.md
§4.6 "Mechanism A"; M2-02 R3). It is what the api calls with
`SESSION_LIVENESS=database`.

It is **not** an app migration. The migrator has no business in the `auth`
schema, and the function must be owned by a role that can read `auth.sessions`
and nothing more. So `src/platform.ts` exports the SQL once — `authStubSql()`,
`platformAdminRoleSql(database)`, `platformObjectsSql()` — and `installPlatform()`
applies it:

| Admin connection | What happens |
|---|---|
| A superuser (the embedded local cluster, CI's `postgres:17` service) | With `stubAuth`, the three-column stub `auth.sessions(id, user_id, not_after)` owned by the admin and granted to nobody. Then `wringy_platform_admin` with `USAGE` on `auth`, `SELECT` on `auth.sessions` and `CREATE` on the database. Then `SET ROLE wringy_platform_admin` for schema `platform` and the function, so a **non-superuser** owns them and the `SECURITY DEFINER` privilege shape matches a hosted project; then `RESET ROLE` |
| Not a superuser (a hosted project's `postgres`) | `stubAuth` is refused — the real `auth.sessions` must not be shadowed — and the platform objects are created as the admin itself, which already has `SELECT` on that table |

The function is `STABLE`, `SECURITY DEFINER`, `SET search_path = ''`, and it is
true only when the row matches **both** ids and `not_after` is null or in the
future. `EXECUTE` is revoked from PUBLIC and granted to `wringy_api` only,
together with `USAGE` on schema `platform`: the API can ask the question and can
read nothing in `auth` (`grants.int.test.ts`, `M2-AC02/2`: no `USAGE` on `auth`,
`SELECT FROM auth.sessions` fails 42501, and the owner is a non-superuser).
Everything is idempotent, so a second run changes nothing. The install ends by
calling the function once with an all-zero id: `CREATE OR REPLACE FUNCTION`
accepts a body whose table the owner cannot read (a SQL body's privileges are
checked when it runs), so without that call a project whose owner lacks `SELECT`
on `auth.sessions` installs cleanly and then raises 42501 on every sign-in — which
the api answers 500 `internal_error`, not 503. The call turns that into a named
bootstrap refusal.

**A stub `auth.sessions` is not an identity store.** Nothing outside the tests
ever writes a row into it, so `platform.session_is_live` answers false for every
real Supabase session: on a local or CI cluster the api must keep
`SESSION_LIVENESS=auth_server`, and `SESSION_LIVENESS=database` belongs only where
the application database **is** the identity store's own database (staging, M2-09;
M2-02 R2). `pnpm db:platform-bootstrap` prints whichever of the two applies to the
install it just made.

Who installs it:

| Command | When |
|---|---|
| `pnpm db:bootstrap` | The embedded local cluster only (`WRINGY_ENV=local` with the admin URL unset or at the `db:start` port) installs it with the stub automatically, so `pnpm db:start && pnpm db:bootstrap && pnpm db:migrate` yields a database where `platform.session_is_live` exists — and the api still uses `SESSION_LIVENESS=auth_server` there (see below) |
| `pnpm db:platform-bootstrap [--stub-auth]` | Every other environment, as an explicit step after `pnpm db:bootstrap`. `--stub-auth` is accepted only when `WRINGY_ENV` is `local` or `ci`, and `installPlatform()` refuses it again whenever the admin is not a superuser |
| `test/cluster.ts` `prepareTemplate()` | The integration-test template, after the migrations and the marker, through the same `installPlatform()`. The role is cluster-wide, so it shares the advisory lock `bootstrapTestRoles()` takes; the clones inherit the objects with their owners and ACLs |

## The sign-in allow-list

`pnpm db:allowlist add <email> --reason "<text>" --by "<name>"`,
`pnpm db:allowlist remove <email> --reason "<text>" --by "<name>"` and
`pnpm db:allowlist list` are the only way `app.sign_in_allowlist` changes
(ruling D13). `--reason` and `--by` are required for both changes, because the
row is the audit record until `app.audit_log` arrives with M2-03, and each change
prints one line. The CLI runs as the migrator and never prints a connection
string.

`normalizeEmail()` (`src/allowlist.ts`) is the one normal form: Unicode **NFC**,
trimmed, lower-cased, with **no dot or plus rewriting** (`a.b@x` and `a+t@x` are
different addresses to their providers). The CLI and the API's first-sign-in gate
both call it, so the gate cannot disagree with the list about what an address is,
and the table's CHECK re-states the lower-case part for a row written by hand.
Removing an address signs nobody out: the list is read at the first sign-in only.

**NFC, not NFKC.** NFC composes, so the two spellings of one accented letter
(`ä` as U+00E4, and `a` plus U+0308) are one key. It does **not**
compatibility-fold, which NFKC would: `ﬁ` (U+FB01) would become `fi` and a
full-width letter would become its ASCII form, so two distinct mailboxes would
share one key and listing one would admit the other. Under NFC a listed ASCII
address admits exactly that address; a look-alike non-ASCII mailbox is simply
not listed, and is refused (`known-issues.md`, M2-02). A full-width `＠` is not
an `@` either, so such a value is refused rather than rewritten.

Migration `0001_schemas_roles.sql` creates the schemas, revokes everything from
PUBLIC, grants the schema usage and sets the default privileges; functions the
migrator creates are not executable by PUBLIC (0005 also revokes PUBLIC's
EXECUTE from the pg-boss functions installed before that default existed).
Later migrations grant per table, and `test/grant-manifest.ts` lists every right
a runtime login ends up with: schema, table, column (a column-level grant), sequence
and function privileges in every non-system schema, `public` included, so a grant
on a new schema or on one column fails the manifest test until it is reviewed. Nothing goes in `public`, and nothing is granted to
`anon`, `authenticated` or `service_role`. Login roles and passwords come only
from `pnpm db:bootstrap`, never from a migration. Only the two runtime groups
(and the owner) have CONNECT on the application database.

## pg-boss schema

`pnpm db:migrate` first runs `pg-boss migrate --schema pgboss` from the pinned
pg-boss 12.33.5 CLI as the migrator, then node-pg-migrate
([CLI reference](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/cli.md),
checked against the installed `dist/cli.js`). The CLI reads the connection from
`PGBOSS_DATABASE_URL`, which `src/pgboss.ts` sets in the child's environment
(never its argv, never a log line). It creates the schema when absent, runs any
pending pg-boss migrations in its own advisory-locked transaction, and does
nothing when the schema is current. The run fails unless `pgboss.version` ends at
`EXPECTED_PGBOSS_VERSION` (42 for 12.33.5).

The CLI builds DDL from two tables a runtime role can write: it reruns every
pg-boss migration newer than `pgboss.version`, and pastes the `table_name` of
every `partition = true` queue, unquoted, into index builds
(`dist/cli.js` `cmdMigrate`, `dist/migrationStore.js` `formatJobTable`).
Migration 0006 keeps both out of the worker's reach (no UPDATE of `version`, a
CHECK that pins every queue to the shared `job_common` table), and
`installPgBossSchema()` refuses to start the CLI while any queue row is
partitioned or names another table (`PgBossQueueRefusedError`, which gives a
count and never the rows' text), for a database migrated before 0006.
`test/pgboss-bounds.int.test.ts` replays the attack. pg-boss is a runtime dependency of
this package because the migration step ships with the migrations. The worker
is to start PgBoss with `migrate: false` against this schema
(kickoff-package.md §8.3), so it never needs DDL.
`down` never touches `pgboss`; pg-boss owns that lifecycle (`pg-boss rollback`).

## Local run (no Docker; ruling D29)

```sh
pnpm db:start           # embedded PostgreSQL 17.10 on 127.0.0.1:54329, data in .local/pg, TimeZone=UTC; prints the URLs
# put WRINGY_ENV=local and the printed DATABASE_URL_MIGRATOR in the root .env
pnpm db:bootstrap       # once: groups, logins, database `wringy` (development passwords: WRINGY_ENV=local on the embedded cluster),
                        # plus the platform bootstrap with the auth stub, because this is the embedded cluster
pnpm db:migrate         # pg-boss schema, then all pending SQL migrations, as the migrator; rerunning changes nothing
pnpm db:env             # the ops.environment marker for WRINGY_ENV (fixtures allowed except in production)
pnpm db:seed:fixtures   # two fixture orgs and three fixture campaigns; refused unless the marker allows fixtures
pnpm db:allowlist list  # who may sign in for the first time; `add`/`remove` need --reason and --by
# api and worker: copy apps/api/.env.example to apps/api/.env and apps/worker/.env.example
# to apps/worker/.env (both gitignored), with WRINGY_ENV=local and the api / worker URL
# that db:start printed; then `pnpm dev`, or `pnpm --filter api dev` and `pnpm --filter worker dev`
pnpm db:stop
```

The order matters: `db:env` needs the table 0002 creates, so it is a separate
step after `db:migrate` rather than part of `db:bootstrap` (which runs before any
migration exists, as the cluster admin). `db:env` refuses to re-mark a database
that already names another environment; `pnpm db:env --relabel` does it on
purpose. Marking a database production (first mark or relabel) is refused while
any `app` table with a `data_origin` column holds fixture rows
(`FixturesPresentError`, with a count per table): delete them as the migrator
first, campaigns before orgs. `pnpm --filter @wringy/db migrate down [n]` reverts SQL migrations
locally or in CI only.

`db:env` holds a lock so that no fixture row can be written between its check
and the marker update. It runs in one transaction (`setEnvironment`,
`src/environment.ts`). When the marker would forbid fixtures, it first runs
`LOCK TABLE … IN SHARE MODE` on every `app` table with a `data_origin` column
(found in the catalog, in creation order), then counts the fixture rows, then
writes the marker and commits. SHARE conflicts with the ROW EXCLUSIVE lock that
every INSERT, UPDATE and DELETE takes, and not with the lock a SELECT takes, so
the API keeps reading while writes wait. The two possible orders therefore
both end safely, in PostgreSQL itself rather than only in our scripts:

- A fixture write already in flight (for example `pnpm db:seed:fixtures`) makes
  the relabel wait until it commits; the count then includes its rows and the
  relabel is refused.
- A fixture write that starts after the lock waits until the relabel commits.
  `ops.assert_fixture_allowed()` then reads the new marker, because the function
  is VOLATILE and reads the marker again for every row, and refuses the write
  (23514).

A writer that takes the tables in another order than the seed (orgs, then
campaigns) can deadlock with the relabel. PostgreSQL then aborts one of the
two (40P01), and neither outcome leaves fixture rows under a production marker.
`environment.int.test.ts` ("M2-AC01/2 the production relabel is serialised with
fixture writes") reproduces both orders.

`embedded-postgres` and its platform binaries are pinned to `17.10.0-beta.17`
(every published build is a `-beta`; the root `pnpm-workspace.yaml` pins the
binaries). `db:start` initialises the cluster with embedded-postgres's
`initialise()` and starts and stops it with the bundled `pg_ctl`, so the server
outlives the command ([embedded-postgres README](https://github.com/leinelissen/embedded-postgres#readme)).
The db scripts read the repository-root `.env` when it exists.

**Windows: keep the checkout path short.** The Windows binaries load their DLLs from
`node_modules/.pnpm/@embedded-postgres+windows-x64@17.10.0-beta.17/node_modules/@embedded-postgres/windows-x64/native/bin/`,
about 120 characters below the repository root. In a clone whose deepest DLL path came to
278 characters, `initdb.exe --version` exited 127 while the identical file under
`C:\Users\<you>\Desktop\wringy` printed `initdb (PostgreSQL) 17.10`, and `pnpm test:int`
failed with `Postgres init script failed (code: 3221225734)` (0xC0000135, DLL not found).
The 260-character Windows path limit is the likely cause (inferred, not confirmed). Use a
short checkout path, or point `TEST_DATABASE_URL` at another PostgreSQL 17.

## Supabase (unverified)

Nothing here has run against Supabase yet (kickoff-package.md §10 G17; M2-02 and
M2-09 verify it). Unverified: whether a custom `wringy_migrator` can own `app`,
`ops` and `pgboss` there or `postgres` must act as the migrator; whether the
pg-boss CLI and node-pg-migrate's session advisory lock work through the
Supavisor session pooler; and whether `pnpm db:bootstrap` can create the logins
as Supabase's non-superuser `postgres`.

## Environment

| Command | Variables (names in the root `.env.example`) |
|---|---|
| `pnpm db:migrate`, `pnpm db:env`, `pnpm db:seed:fixtures`, `pnpm db:allowlist` | `WRINGY_ENV`, `DATABASE_URL_MIGRATOR` |
| `pnpm db:bootstrap` | `WRINGY_ENV`, `PG_BOOTSTRAP_ADMIN_URL`, `PG_BOOTSTRAP_DATABASE`, `PG_BOOTSTRAP_MIGRATOR_PASSWORD`, `PG_BOOTSTRAP_API_PASSWORD`, `PG_BOOTSTRAP_WORKER_PASSWORD`. The admin URL and passwords are required unless `WRINGY_ENV=local` and the admin URL is unset or the embedded cluster (a loopback host at port 54329); anywhere else a development password is refused (`src/bootstrap-plan.ts`) |
| `pnpm db:platform-bootstrap` | `WRINGY_ENV`, `PG_BOOTSTRAP_ADMIN_URL`, `PG_BOOTSTRAP_DATABASE` (the same admin connection, opened on the application database). Those three only: it creates no login role and sets no password, so none of the `PG_BOOTSTRAP_*_PASSWORD` values is read or required (`loadPlatformBootstrapEnv`). The admin URL may be left unset only when `WRINGY_ENV=local`, where the embedded cluster's superuser is used |
| `pnpm test:int` | `TEST_DATABASE_URL` (optional admin URL of an existing, throwaway PostgreSQL 17 on this machine; see "Throwaway clusters only") |

The bootstrap sends passwords to the server as SCRAM-SHA-256 verifiers computed
locally (`src/scram.ts`), so the plaintext is never in a statement a server log
could record. Passwords must be printable ASCII. No command prints a connection
string or password.

## Tests

| Script | Does |
|---|---|
| `pnpm --filter @wringy/db test` | Unit tests: migration file rules (SQL only, numbering, markers, no `public`, no login or password), SCRAM verifier, the expected-head drift guards (newest migration file; installed pg-boss schema version and exact pin), the heartbeat constants, and `normalizeEmail()` (`M2-AC02/2`) |
| `pnpm --filter @wringy/db test:int` / root `pnpm test:int` | Integration tests on a real PostgreSQL 17: `TEST_DATABASE_URL` when set, otherwise a throwaway embedded cluster on a free port. The global setup (`startTestCluster()` in `test/cluster.ts`) bootstraps the roles, migrates a template database from zero with `migrateDatabase()` as the migrator and marks it `ci` (`TEST_WRINGY_ENV`, fixtures allowed); `createTestDatabase()` clones it per file, `withRollback(pool, fn)` isolates each test, `seedFixtures(db)` applies the fixture seed, `setTestEnvironment(db, name)` re-marks a clone, and `failureIn(client, fn)` asserts a refusal inside a savepoint. The global setup installs `test/exit-code-guard.ts`: embedded-postgres registers async-exit-hook, whose `beforeExit` handler calls `process.exit(0)` and would report a failed run as exit 0 (seen with `TEST_DATABASE_URL` set as well); apps/api and apps/worker get the guard through the same global setup |
| `pnpm --filter @wringy/db lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `pnpm --filter @wringy/db build` | `scripts/build-migrate.mjs`: esbuild bundles `src/cli/migrate.ts` (what `pnpm db:migrate` runs through tsx) into `dist/migrate.js`, with `@wringy/config` and zod inlined and the declared dependencies (`node-pg-migrate`, `pg`, `pg-boss`) external; the build fails on any other external. `dist/` sits beside `migrations/` as `src/` does, so the `import.meta.url` lookups of the migrations directory and the pg-boss CLI hold. The api image runs it as its one-off migrate step (`apps/api/README.md`, "Docker image") |

**One cluster, several runs.** With `TEST_DATABASE_URL` set, every suite `pnpm test:int` starts
uses that one cluster, and pnpm runs the apps/api and apps/worker suites at the same time (CI's
`integration` job does exactly this against its `postgres:17` service). Roles are cluster-wide, so
`bootstrapTestRoles()` takes a session advisory lock around the role bootstrap: without it, two
global setups altering the same role failed with `tuple concurrently updated` (XX000) in one of
two local runs against the `pnpm db:start` cluster on 2026-09-23, and
`test/cluster.int.test.ts` failed 3 of 3 times before the lock and passed 3 of 3 after. Each run
still gets its own template and clones (`wringy_tpl_<run>`, `wringy_t_<run>_*`), dropped at
teardown, and also when the setup itself fails.

**Throwaway clusters only.** The bootstrap ALTERs the cluster-wide `wringy_*` logins to the
committed development passwords and the harness creates and drops databases, so
`startTestCluster()` refuses (`TestClusterRefusedError`) a `TEST_DATABASE_URL` whose host is not
this machine, unless `WRINGY_TEST_CLUSTER_IS_THROWAWAY=1` is set for a disposable remote cluster,
and any cluster where a database other than the harness's own is marked as an environment other
than `local` or `ci` (a tunnel to staging on a loopback port is caught there).
`test/cluster.int.test.ts` covers both refusals.

Every test title carries this ticket's key `M2-AC01` (kickoff-package.md §6.1).
Integration test titles carry `M2-AC01/2` where they prove that sub-item: a fresh
migration from zero (pg-boss schema, then every SQL migration) that a second run
leaves unchanged; the API login reading the migration head and pg-boss version
afterwards; SQL migrations refusing to pass 0005 before pg-boss exists; every
migration after 0001 reverted and applied again leaving an identical catalog
snapshot (column ACLs included); the migrator owning
`app`, `ops` and `pgboss`; "runtime role privileges match reviewed grant
manifest"; the worker login refused `app.campaigns` and the API login refused
`ops.worker_heartbeat` writes and `pgboss.job` (42501); the worker login unable to
change `pgboss.version` or plant a partitioned queue, and `pnpm db:migrate`
refusing a database where such a queue was planted before 0006; the fixture trigger, the
composite foreign key and the marker's constraints; and the seed being
idempotent and refused where fixtures are not allowed.

Integration titles carry `M2-AC02/2` for the identity objects: `app.profiles`
inserted and updated by the API login and never deleted (42501), its locale and
status CHECKs, its `updated_at` trigger, an insert succeeding where fixtures are
not allowed (it has no `data_origin`), and a catalog scan showing no such column
and no fixture trigger (`profiles.int.test.ts`); the allow-list readable by the
API and writable only by the migrator, its `email_norm` CHECK, a decomposed
accented spelling becoming the same row as the composed one, and a full-width or
ligature look-alike being its own row that never matches a listed ASCII address
(`allowlist.int.test.ts`);
`platform.session_is_live` answering true, false for a missing session, false for
a past `not_after` and true for a future one, while no Wringy role can read
`auth.sessions` (`platform.int.test.ts`); and, in `grants.int.test.ts`, the
function's non-superuser owner, its grantees, and the API login's lack of any
privilege on `auth`. Unit tests carry it for
the installed pg-boss matching its exact pin, migration files that grant nothing
to PUBLIC or the Supabase API roles and create no login role or password, and a
SCRAM verifier that never contains the password.
