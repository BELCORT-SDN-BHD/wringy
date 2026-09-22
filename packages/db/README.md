# @wringy/db

PostgreSQL access for the API and the worker: connection pools, the versioned SQL
migrations and their runner, the per-environment bootstrap, local PostgreSQL
without Docker, and the integration-test harness (kickoff-package.md §4.10–§4.11,
§6.2–§6.3, §8.1, §8.4–§8.5). No ORM.

## What it owns

| Path | Role |
|---|---|
| `src/pool.ts` | `createPool({ connectionString, applicationName, max })` on `pg` 8, one pool per role and process; `withClient` and `withTransaction` |
| `src/migrate.ts` | `runMigrations()` on node-pg-migrate 9: SQL files, one transaction per batch, session advisory lock (a concurrent run fails), order check, `search_path` = `app` |
| `migrations/NNNN_name.sql` | The migrations, applied as the migration owner. SQL files only, `-- Up Migration` / `-- Down Migration` markers ([node-pg-migrate "Legacy SQL migrations"](https://github.com/salsita/node-pg-migrate/blob/v9.0.0/docs/src/migration-loading-strategies.md)) |
| `src/roles.ts` | Role and schema names |
| `src/bootstrap.ts`, `scripts/bootstrap.mjs` | `pnpm db:bootstrap` |
| `scripts/local-pg.mjs`, `src/local-dev.ts` | `pnpm db:start` / `db:stop` / `db:status`, and the fixed local development values |
| `test/` | Vitest integration harness and tests (`pnpm test:int`) |

The migrations table is `ops.pgmigrations` (the tool's default name, in the `ops`
schema). The runner creates `ops` and that table before the first migration runs.

## Roles

| Role | Kind | Rights |
|---|---|---|
| `wringy_migrator` | login | Owns the database, `app` and `ops`; runs all DDL. On Supabase possibly `postgres` (unverified) |
| `wringy_api` | NOLOGIN group | `USAGE` on `app` and `ops`; SELECT on new tables there by default. No CREATE |
| `wringy_worker` | NOLOGIN group | `USAGE` on `ops`; SELECT/INSERT/UPDATE on new `ops` tables and USAGE/SELECT on new `ops` sequences by default. Nothing in `app` |
| `wringy_api_login` | login, member of `wringy_api` | API process |
| `wringy_worker_login` | login, member of `wringy_worker` | Worker process |

Migration `0001_schemas_roles.sql` creates the schemas, revokes everything from
PUBLIC, grants the schema usage and sets the default privileges; functions the
migrator creates are not executable by PUBLIC. Later migrations grant per table.
Nothing goes in `public`, and nothing is granted to `anon`, `authenticated` or
`service_role`. Login roles and passwords come only from `pnpm db:bootstrap`,
never from a migration. Only the two runtime groups (and the owner) have CONNECT
on the application database.

## Local run (no Docker; ruling D29)

```sh
pnpm db:start        # embedded PostgreSQL 17.10 on 127.0.0.1:54329, data in .local/pg, TimeZone=UTC; prints the URLs
# put WRINGY_ENV=local and the printed DATABASE_URL_MIGRATOR in the root .env
pnpm db:bootstrap    # once: groups, logins, database `wringy` (development passwords because WRINGY_ENV=local)
pnpm db:migrate      # all pending migrations, as the migrator; `pnpm --filter @wringy/db migrate down [n]` locally or in CI only
pnpm db:stop
```

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

## Environment

| Command | Variables (names in the root `.env.example`) |
|---|---|
| `pnpm db:migrate` | `WRINGY_ENV`, `DATABASE_URL_MIGRATOR` |
| `pnpm db:bootstrap` | `WRINGY_ENV`, `PG_BOOTSTRAP_ADMIN_URL`, `PG_BOOTSTRAP_DATABASE`, `PG_BOOTSTRAP_MIGRATOR_PASSWORD`, `PG_BOOTSTRAP_API_PASSWORD`, `PG_BOOTSTRAP_WORKER_PASSWORD`. The admin URL and passwords are required unless `WRINGY_ENV=local` |
| `pnpm test:int` | `TEST_DATABASE_URL` (optional admin URL of an existing PostgreSQL 17) |

The bootstrap sends passwords to the server as SCRAM-SHA-256 verifiers computed
locally (`src/scram.ts`), so the plaintext is never in a statement a server log
could record. Passwords must be printable ASCII.

## Tests

| Script | Does |
|---|---|
| `pnpm --filter @wringy/db test` | Unit tests: migration file rules (SQL only, numbering, markers, no `public`, no login or password), SCRAM verifier |
| `pnpm --filter @wringy/db test:int` / root `pnpm test:int` | Integration tests on a real PostgreSQL 17: `TEST_DATABASE_URL` when set, otherwise a throwaway embedded cluster on a free port. The global setup bootstraps the roles and migrates a template database from zero as the migrator; `createTestDatabase()` clones it per file and `withRollback(pool, fn)` isolates each test |
| `pnpm --filter @wringy/db lint` / `typecheck` | ESLint / `tsc --noEmit` |

Integration test titles carry `M2-AC01/2` where they prove that sub-item: a fresh
migration from zero that a second run leaves unchanged, the migrator owning `app`
and `ops`, `wringy_api_login` refused CREATE (42501), `wringy_worker_login`
without privileges on `app`, and a login refused on a database without CONNECT.
