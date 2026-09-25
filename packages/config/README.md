# @wringy/config

Environment schemas for every Wringy process, one per process, built with zod 4
(kickoff-package.md §8.1, §8.5). A process reads only the variables its schema
names; anything else in the environment is ignored, so one process never picks up
another's secret.

| Entry point | Process | Variables |
|---|---|---|
| `@wringy/config/web` | Next.js server (`apps/web`) | `WRINGY_ENV`, `API_INTERNAL_URL`, `WRINGY_APP_MODE` (`demo` \| `internal`, default demo), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN` (the last three required only when `WRINGY_APP_MODE=internal`) |
| `@wringy/config/api` | Fastify API (`apps/api`, M2-01 W2) | `WRINGY_ENV`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SESSION_LIVENESS` (`database` \| `auth_server`, no default), `PORT` (default 3200), `HOST` (default 127.0.0.1), `LOG_LEVEL` (default info) |
| `@wringy/config/worker` | pg-boss worker (`apps/worker`, M2-01 W2) | `WRINGY_ENV`, `DATABASE_URL`, `WORKER_ID`, `IMAGE_REF`, `LOG_LEVEL` (default info) |
| `@wringy/config/migrate` | `pnpm db:migrate`, `pnpm db:env`, `pnpm db:seed:fixtures` | `WRINGY_ENV`, `DATABASE_URL_MIGRATOR` |
| `@wringy/config/bootstrap` | `pnpm db:bootstrap` | `WRINGY_ENV`, `PG_BOOTSTRAP_ADMIN_URL`, `PG_BOOTSTRAP_DATABASE` (default wringy), `PG_BOOTSTRAP_{MIGRATOR,API,WORKER}_PASSWORD` |
| `@wringy/config` | all of the above | |

`WRINGY_ENV` is one of `local`, `ci`, `staging`, `production`. The names and a
comment for each are in the repository-root `.env.example` (web, migrate,
bootstrap, tests), `apps/api/.env.example` and `apps/worker/.env.example`.

## Shared value shapes (`src/shared.ts`)

| Export | Accepts |
|---|---|
| `wringyEnvSchema` / `WRINGY_ENVS` | `local`, `ci`, `staging`, `production` |
| `postgresUrlSchema` | a `postgres:`/`postgresql:` URL; never defaulted, because it carries a password |
| `httpUrlSchema` | an http(s) URL for server-to-server calls (a path is allowed) |
| `originSchema` / `isHttpOrigin()` | an http(s) **origin only**: scheme, host, optional port, and nothing else — no trailing slash, path, query, fragment or credentials, and no redundant default port or upper-case host. It is string-compared with request `Origin` headers (kickoff-package.md §4.5), so only the canonical serialisation passes |
| `publishableKeySchema` | `^[\w.-]{20,}$`: a Supabase **publishable** key. A `sb_secret_…` key is read nowhere in this repository |
| `appModeSchema` / `APP_MODES` | `demo` (M1 unchanged) or `internal` (the server-backed internal build) |
| `sessionLivenessSchema` / `SESSION_LIVENESS_MODES` | `database` (`platform.session_is_live`) or `auth_server` (`GET <SUPABASE_URL>/auth/v1/user`) |

`INTERNAL_MODE_VARIABLES` (`src/web.ts`) names the three web variables an
`internal` build requires: `APP_ORIGIN`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_URL`. They are optional fields plus one object-level rule rather than
required fields, so the demo build, the M1 Playwright suite and the env-less
image smoke keep working; each absent one is reported by name as missing.

## Rules

- **Fail fast.** `loadXEnv()` throws one `EnvError` listing every missing or
  invalid variable. An empty or blank variable counts as missing.
- **Names, never values.** The message, `problems` and the JSON form of an
  `EnvError` carry variable names only; the input and zod's issues are not
  attached. A unit test checks this for every schema.
- **No defaults for secrets or URLs.** Only `PORT`, `HOST`, `LOG_LEVEL` (api and worker),
  `WRINGY_APP_MODE` (`demo`) and the bootstrap database name have defaults.
  `SESSION_LIVENESS` has none on purpose: the wrong liveness mechanism is a silent
  answer, so a deployment must name one. The bootstrap admin URL and passwords may
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
| `pnpm --filter @wringy/config test` | Vitest unit tests (`src/*.test.ts`); titles carry `M2-AC01`, `M2-AC01/2` where an env error never echoes a value, where a process gets only its own database URL and where the root `.env.example` web section names exactly `webEnvSchema`'s keys minus `WRINGY_ENV` (`src/env-example.test.ts`), and `M2-AC02/2` for the app mode, the liveness enum and `originSchema` |

The package ships TypeScript source (`exports` point at `src/`); Next.js
(Turbopack) and tsx compile it where it is used.
