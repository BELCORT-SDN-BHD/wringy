# @wringy/config

Environment schemas for every Wringy process, one per process, built with zod 4
(kickoff-package.md §8.1, §8.5). A process reads only the variables its schema
names; anything else in the environment is ignored, so one process never picks up
another's secret.

| Entry point | Process | Variables |
|---|---|---|
| `@wringy/config/web` | Next.js server (`apps/web`) | `WRINGY_ENV`, `API_INTERNAL_URL` |
| `@wringy/config/api` | Fastify API (`apps/api`, M2-01 W2) | `WRINGY_ENV`, `DATABASE_URL`, `PORT` (default 3200), `HOST` (default 127.0.0.1), `LOG_LEVEL` (default info) |
| `@wringy/config/worker` | pg-boss worker (`apps/worker`, M2-01 W2) | `WRINGY_ENV`, `DATABASE_URL`, `WORKER_ID`, `IMAGE_REF`, `LOG_LEVEL` (default info) |
| `@wringy/config/migrate` | `pnpm db:migrate`, `pnpm db:env`, `pnpm db:seed:fixtures` | `WRINGY_ENV`, `DATABASE_URL_MIGRATOR` |
| `@wringy/config/bootstrap` | `pnpm db:bootstrap` | `WRINGY_ENV`, `PG_BOOTSTRAP_ADMIN_URL`, `PG_BOOTSTRAP_DATABASE` (default wringy), `PG_BOOTSTRAP_{MIGRATOR,API,WORKER}_PASSWORD` |
| `@wringy/config` | all of the above | |

`WRINGY_ENV` is one of `local`, `ci`, `staging`, `production`. The names and a
comment for each are in the repository-root `.env.example` (web, migrate,
bootstrap, tests), `apps/api/.env.example` and `apps/worker/.env.example`.

## Rules

- **Fail fast.** `loadXEnv()` throws one `EnvError` listing every missing or
  invalid variable. An empty or blank variable counts as missing.
- **Names, never values.** The message, `problems` and the JSON form of an
  `EnvError` carry variable names only; the input and zod's issues are not
  attached. A unit test checks this for every schema.
- **No defaults for secrets or URLs.** Only `PORT`, `HOST`, `LOG_LEVEL` (api and worker) and the
  bootstrap database name have defaults. The bootstrap admin URL and passwords may
  be left unset only when `WRINGY_ENV=local`; the bootstrap script then uses the
  embedded cluster's development values.
- **Server-only.** The web server's variables are read on the server. Nothing here
  is a `NEXT_PUBLIC_*` variable, and web components and features may not import
  this package (`pnpm depcruise`, rule `web-ui-not-to-server-config`).
- Depends on `zod` only; `pnpm depcruise` rejects imports of db, pg, fastify,
  next, react or apps.

`tryLoadEnv(() => loadWebEnv())` returns `{ ok: false, error }` instead of
throwing, for a page that renders a "not configured" state.

## Scripts

| Script | Does |
|---|---|
| `pnpm --filter @wringy/config lint` | ESLint (typescript-eslint recommended) |
| `pnpm --filter @wringy/config typecheck` | `tsc --noEmit` against `tsconfig.base.json` |
| `pnpm --filter @wringy/config test` | Vitest unit tests (`src/*.test.ts`); titles carry `M2-AC01`, and `M2-AC01/2` where an env error never echoes a value and where a process gets only its own database URL |

The package ships TypeScript source (`exports` point at `src/`); Next.js
(Turbopack) and tsx compile it where it is used.
