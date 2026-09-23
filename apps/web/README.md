# apps/web — Wringy M1 prototype

Next.js App Router prototype for milestone M1 (三端交互原型). Everything it shows is
simulated: identity, clock, view data, notifications, email previews and payouts. See
[`docs/m1-prototype/kickoff.md`](../../docs/m1-prototype/kickoff.md) for scope and the
decisions this scaffold was built against.

Everything is in place: the demo engine, the store, the app shell, the public
pages, the three role workspaces, the notification centre, settings, the demo
tools and the guided demo at `/demo`.

Start at **[`/demo`](http://127.0.0.1:3100/demo)** — it lists the seven steps of
the main flow and every exception scenario, and its "Go" buttons switch to the
right simulated identity before opening the page. The written version with the
expected values is [`docs/m1-prototype/demo-script.md`](../../docs/m1-prototype/demo-script.md);
the executed acceptance rows are in
[`acceptance-record.md`](../../docs/m1-prototype/acceptance-record.md) and the
limitations in [`known-issues.md`](../../docs/m1-prototype/known-issues.md).

## Run

All commands are run from the **repository root** (this is a pnpm workspace).

```bash
pnpm install                       # one root pnpm-lock.yaml covers every workspace
pnpm dev                           # every app's dev script; web: next dev on http://127.0.0.1:3100
pnpm lint                          # eslint in every workspace
pnpm typecheck                     # every workspace; web: next typegen && tsc --noEmit
pnpm test                          # vitest run in every workspace
pnpm --filter web e2e:install      # one-off: download Chromium (~310 MB)
pnpm e2e                           # playwright test, 3 viewports (the M1 demo suite)
pnpm e2e:internal                  # the M2 internal-build suite on the real api, worker and database
pnpm canary                        # secret canary: builds web/api/worker with canary values, greps bundles and logs
```

The root scripts also cover `packages/*` (M2-01); `pnpm --filter web lint|typecheck|test|build`
runs this app alone.

## Two root layouts (M2-01)

`src/app` has no top-level layout. `src/app/(demo)/layout.tsx` is the M1 demo's root layout
(demo store, language prompt, demo tools) over `(demo)/(public)` and `(demo)/(workspace)`,
with every URL unchanged. `src/app/(internal)/layout.tsx` is the internal build's root layout
for `/internal`: the same fonts, CSS and `wringy-locale` cookie, the `common` and `internal`
message namespaces, the persistent trilingual 内部版本 · Internal build · Versi dalaman banner,
and none of the demo. Moving between the two is a full page load
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`,
"Caveats"). `pnpm depcruise` (rule `internal-not-to-demo`) keeps the demo out of `(internal)`.

**Unmatched URLs.** With two root layouts and no top-level `app/layout.tsx`, Next has no layout
to wrap an unmatched URL in and answers with its bare built-in 404 document (no `<html lang>`,
no app CSS). Two catch-alls call `notFound()` so each URL lands in its own root layout again:
`src/app/(demo)/[...notFound]/page.tsx` (Next's not-found UI inside the demo layout, as in M1)
and `src/app/(internal)/internal/[...rest]/page.tsx` with `src/app/(internal)/not-found.tsx`
(the internal not-found page under the banner, no demo store). Both answer HTTP 404. Next
renders a `notFound()` thrown during the first render as an error shell
(`<html id="__next_error__">`) whose flight data carries the root layout, so `lang`, the CSS
and the banner appear once the browser renders it, not in the raw HTML a `curl` sees; the
internal suite checks the rendered page. `global-not-found.js` would give a server-rendered
404 but is experimental in this Next version and could not tell the two layouts apart
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`).

The web app imports the TypeScript sources of `@wringy/config` and `@wringy/contracts`
without `transpilePackages`: "Turbopack transpiles workspace packages … in your monorepo
automatically" (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/transpilePackages.md`).

`pnpm --filter web <script>` reaches the same scripts directly. Playwright starts and stops
the dev server itself (`webServer` in `playwright.config.ts`, `reuseExistingServer: true`),
so `pnpm e2e` needs no server running.

One spec at a time, which is how the acceptance rows are re-run:

```bash
pnpm --filter web exec playwright test acceptance.spec.ts
pnpm --filter web exec playwright test --project=small acceptance.spec.ts   # the 320px spot checks
```

Port **3100** is fixed in `dev`, `start`, and the Playwright base URL; set `WEB_PORT` to run a
second checkout (a git worktree) alongside this one.

Turbopack has been seen to drop its filesystem cache and refuse connections the first time several
Playwright workers compile a brand-new route at once. If a run fails with `ERR_CONNECTION_REFUSED`
rather than an assertion, warm the route once with `pnpm dev` and run again.

Its development cache, `.next/dev`, also grows across runs. At 4.4 GB (2026-09-23) the dev server
logged "Finished filesystem cache database compaction in 26.5s" during a run in which 155 tests of
the M1 suite timed out on `page.goto` (another project's Playwright suite was running on the same
machine too); with `.next/dev` deleted the same suite passed (327). If many tests time out on
navigation, delete `apps/web/.next/dev` (it is rebuilt on the next `pnpm dev`) and warm the routes
again.

## The /internal page (M2-01)

`src/app/(internal)/internal/page.tsx` is a Server Component (`dynamic = 'force-dynamic'`). It
reads `GET /internal/campaigns` and `GET /internal/worker-health` from the Fastify API at
`API_INTERNAL_URL`, server to server, with `cache: 'no-store'` and a 5 s `AbortController`
limit each (`api-read.ts`), validates both bodies with the `@wringy/contracts` schemas, and
renders in the visitor's cookie locale:

- the fixture campaigns as a table (title, org, status badge, a demo-data badge from
  `dataOrigin`, the update time in Asia/Kuala_Lumpur with `(UTC+08:00)`), an explicit empty
  state, and a "data as of" line with the database clock;
- one 后台任务健康状态 card per worker: id, image ref, started, last heartbeat, last queue round
  trip, the process state (healthy / stale / stopped; `never_seen` reads as the localized
  "unknown") and the queue state (ok / overdue; `never` reads as "unknown"); an empty worker list
  reads "no worker has reported yet", an unknown state rather than zero;
- explicit states, each on a `data-app-state` attribute: `not-configured` (no usable
  `API_INTERNAL_URL`), `api-unreachable` (the request failed or timed out), `api-unavailable`
  (the API answered 503), `unexpected` (any other status, or a body that breaks the contract).
  When both reads fail the same way the state is shown once. No URL, status line or stack
  reaches the page; the server logs one line per failed read with the route and a code.

Badges follow the M1 `StatusBadge` rules through the server-safe tone classes in
`src/components/app/status-tone.ts`. No client code beyond the layout's, no demo store.

## What is installed

Node 24.21.0 (pinned by the root `.npmrc` `use-node-version`, so pnpm downloads and runs it even
when the machine's own `node` is older; CI reads the root `.nvmrc`), pnpm 10.33.0. Resolved
versions, read from the root `pnpm-lock.yaml`:

| Package | Range | Resolved |
|---|---|---|
| next | 16.3.5 | 16.3.5 |
| react / react-dom | 19.3.0 | 19.3.0 |
| typescript | ^5 | 5.9.3 |
| tailwindcss, @tailwindcss/postcss | ^4 | 4.3.3 |
| next-intl | 4.14.6 | 4.14.6 |
| zustand | 5.0.15 | 5.0.15 |
| vitest | ^4.1.11 | 4.1.11 |
| @playwright/test | 1.63.0 | 1.63.0 |
| eslint / eslint-config-next | ^9 / 16.3.5 | 9.39.5 / 16.3.5 |
| @types/node | ^24 | 24.13.6 |
| @types/react / @types/react-dom | ^19 | 19.3.0 |

`@types/node` follows the Node 24 runtime used locally and in CI (M2-01 W0 moved it from the `^20`
line that create-next-app chose).

Pulled in by the shadcn CLI, not chosen here: `@base-ui/react` 1.8.0, `@shadcn/react` 0.3.1,
`shadcn` 4.21.0, `radix-ui` 1.6.7, `lucide-react` 1.47.0, `cn` 0.3.2,
`class-variance-authority` 0.7.1, `cmdk` 1.1.1, `sonner` 2.0.8, `vaul` 1.1.2,
`react-day-picker` 10.0.1, `embla-carousel-react` 8.6.0, `input-otp` 1.5.0,
`react-resizable-panels` 4.13.2, `recharts` 3.8.0, `next-themes` 0.4.6,
`tw-animate-css` 1.4.0, `date-fns` 4.4.0.

Turbopack is the default bundler in Next 16; there is no webpack config here.

## What the shadcn CLI generated

Initialised with `shadcn@4.21.0 init -t next -b radix -p nova --css-variables --no-monorepo -y`.
The CLI's default base flipped to `base-ui` in 4.x, so `-b radix -p nova` is required to match
the accepted design system; `components.json` records `"style": "radix-nova"`, base colour
`neutral`, `rsc: true`.

`shadcn@4.21.0 add … --overwrite --yes` produced **61 files** in `src/components/ui/`, plus
`src/hooks/use-mobile.ts` and `src/lib/utils.ts`. That set is identical, name for name, to
`phase-0/foundation/design-system-v2/app/src/components/ui/` — the Vite showcase the design
system was accepted against. 41 of the 61 carry `"use client"`, added by the CLI for the
Next.js target; that is the reason the CLI output is used rather than a copy of the Vite
sources.

These files are upstream registry sources. Do not hand-edit them: re-run the CLI. ESLint
therefore turns off `react-hooks/set-state-in-effect` for `src/components/ui/**` and
`src/hooks/use-mobile.ts` only (`eslint.config.mjs`); `carousel.tsx` and `use-mobile.ts`
trip it upstream. The rule stays on for `src/components/app/**` and `src/features/**`.

## Colours and font

`src/app/globals.css` keeps the CLI's `@theme inline`, `@custom-variant dark`, generated
`.dark` block and `@layer base`, and the `tailwindcss` / `tw-animate-css` /
`shadcn/tailwind.css` imports. Two changes:

1. The `:root` block is copied byte for byte from
   `phase-0/foundation/design-system-v2/app/src/index.css` — 31 shadcn roles, `--radius`, and
   the 12 named additions (`attention-*`, `error-*`, `info-*`, `success-*`, `inactive-*`,
   `brand`, `brand-foreground`). That file is the accepted palette; do not hand-tune here.
2. The 12 named additions are exposed in `@theme inline` as `--color-<name>: var(--<name>)`,
   so `bg-brand`, `text-success-foreground`, `bg-attention-subtle` and the rest compile.
   All 24 such utilities were verified to emit against the copied values.

Because `@theme inline` is tree-shaken, a named colour appears in the served CSS only once a
utility using it exists in the source. An absent `--color-…` in build output is not a bug.

The font is `next/font/google` Geist bound to `--font-sans` (plus Geist Mono on
`--font-geist-mono`), the same family the showcase loads through
`@fontsource-variable/geist`. `next build` fetches it from Google Fonts, so builds need
network access.

The prototype ships light only. The `.dark` block is the CLI's neutral default and is **not**
part of the carried-over palette.

## i18n

next-intl without locale routing (kickoff decision 8). `src/i18n/request.ts` reads the
`wringy-locale` cookie, falls back to `en-MY`, sets the time zone to `Asia/Kuala_Lumpur`, and
loads the merged catalogue from `src/i18n/messages.ts`. `src/i18n/config.ts` holds the cookie
name, the default, and the `isLocale` guard. `next.config.ts` wires the plugin.

That request config only drives server-rendered output: page metadata and the initial
`<html lang>`. Client components take their messages from `AppProviders`
(`src/components/app/providers.tsx`), which swaps the catalogue in place from the persisted
session, so a language change re-renders without navigating and keeps form input.

A message key may not contain a `.`: next-intl reads a dot as nesting and refuses the
catalogue outright. Notification kinds are therefore stored nested
(`notifications.kinds.claim.reserved.title`), which `t('claim.reserved.title')` still
resolves; `src/lib/notification-copy.ts` flattens them back for the placeholder check.

Reading a cookie there makes every route server-rendered on demand; `next build` reports
`ƒ (Dynamic)` for `/` and `/_not-found`. That is expected for a prototype whose locale and
demo state are per visitor.

Eight namespaces per locale: `common`, `public`, `notifications`, `demo`, `settings`,
`merchant`, `creator`, `ops`. `src/i18n/messages.ts` imports all 24 files statically, so a role
worker fills its own `<role>.json` and never edits that module.

Audit-trail labels are shared, not per role: `src/lib/audit-copy.ts` maps every `CommandType` to a
key under `common.actions.*`, and the map is a complete `Record<CommandType, …>`, so adding a
command without copy for it is a type error. The merchant, creator and operations timelines all
render through it — they used to show raw command codes such as `claim.reviewMetering`.

`src/i18n/messages.test.ts` asserts the three locales carry identical key sets, the same
interpolation parameters and no empty strings, and that every notification kind has a title,
a body and a simulated email subject and body. `src/lib/audit-copy.test.ts` asserts every locale
has copy for every audit action key, and that no key is a dotted one (next-intl reads a dot as
nesting).

## Tests

- `vitest.config.mts` — node environment, `src/**/*.test.ts` and `tests/unit/**/*.test.ts`,
  `@` alias. The extension is `.mts`, not `.ts`: Vite's native config loader otherwise warns
  on every run about ESM in a file loaded as CommonJS.
- `playwright.config.ts` — `tests/e2e`, projects `mobile` 390×844, `desktop` 1440×900,
  `small` 320×568, screenshots on failure, output in `tests/e2e/test-results`.
- `playwright.internal.config.ts` — the M2 internal-build suite (`pnpm e2e:internal`), described
  below.
- `tests/e2e/smoke.spec.ts` asserts the title contains "Wringy" and that
  `document.documentElement.scrollWidth` does not exceed the viewport, in all three projects.
- `tests/e2e/helpers.ts` is the shared harness every later spec should use:
  `loadScenario` / `loadScenarioAsGuest` (state injected straight into localStorage),
  `loadScenarioViaUi`, `signInAs`, `setLocale`, `advanceClock`, `addViews`, `setDataOutage`,
  `resetDemo`, `readStoredState` and `expectNoHorizontalOverflow`.
- `tests/e2e/shell.spec.ts` covers the shared frame, and `tests/e2e/{creator,merchant,ops}.spec.ts`
  each cover one role's rules in depth.
- `tests/e2e/i18n.spec.ts` walks **every** route in the app — public, creator, merchant,
  operations reviewer, operations finance and `/demo` — in all three languages with the console
  under watch, so a missing message fails the run instead of rendering a raw key path. It also
  asserts that a route the role may read does not land on the simulated refusal, which is what
  would otherwise let a page pass the walk without rendering.
- `tests/e2e/acceptance.spec.ts` is the P01–P11 run, one `describe` per acceptance row. The rows
  run at 390 and 1440 and are skipped in the `small` project; the 320px work is the dedicated spot
  check at the end of that file, which asserts no sideways scroll and no covered primary action on
  the submission detail, the merchant editor, the operations claim page and the payout page. Its
  evidence frames are viewport-clipped and asserted to be at most 300 KB each (see "Evidence
  screenshots" below for where they go).
- `tests/e2e/screenshots.spec.ts` writes the older frame set to `tests/e2e/__screenshots__/`
  (git-ignored).
- `tests/e2e/helpers.ts` also carries `expectPrimaryActionUsable`, which is what the 320px checks
  are built on: it asserts the control's box is inside the viewport, that `elementFromPoint` at its
  centre resolves to the control rather than something on top of it, and that Playwright's full
  actionability set passes.

### Evidence screenshots (opt-in)

The acceptance records cite tracked PNGs. A run writes them only when
`WRINGY_EVIDENCE_SHOTS=1`; otherwise the same frames go to the gitignored
`tests/e2e/__screenshots__/evidence/`, so an ordinary run leaves the tree clean
(`tests/e2e/evidence.ts`; the 300 KB budget is enforced either way):

```bash
WRINGY_EVIDENCE_SHOTS=1 pnpm e2e            # refreshes docs/m1-prototype/screenshots
WRINGY_EVIDENCE_SHOTS=1 pnpm e2e:internal   # refreshes docs/m2-internal/screenshots
```

Every evidence frame is taken through `captureFrame` (`tests/e2e/evidence.ts`), which retries
only Chromium's transient `Page.captureScreenshot: Unable to capture screenshot` (an empty
surface copy; `tests/e2e/capture-retry.ts`), at most 3 attempts in all, after two animation
frames. Any other capture error fails the test at once (`tests/unit/capture-retry.test.ts`).

### The internal-build suite (`pnpm e2e:internal`, M2-AC01)

`playwright.internal.config.ts`, `tests/e2e-internal/`. Nothing is mocked: the `webServer`
array starts, in order (Playwright starts every entry before `globalSetup`):

1. `database` — `tests/e2e-internal/database-server.mts` (tsx): a PostgreSQL 17 cluster
   (`TEST_DATABASE_URL`'s, or a throwaway embedded one), a database migrated from zero as the
   migrator, marked `ci` and seeded with the fixture campaigns, through `@wringy/db`'s test
   harness (`@wringy/db/testing/cluster`). Its ready line names host, port and database, which
   Playwright's `wait.stdout` named groups put into the environment (`WRINGY_E2E_PG_*`); no
   password is printed.
2. `api` — apps/api on 127.0.0.1:3200 as `wringy_api_login`
   (`tests/e2e-internal/run-with-database.mts api` sets its `DATABASE_URL`), ready when
   `GET /health` answers 200.
3. `worker` — apps/worker as `wringy_worker_login`, `WORKER_ID=e2e-worker-1`,
   `IMAGE_REF=local/e2e`, ready when it logs "worker started".
4. `web` — `next build`, then `next start` on `WEB_PORT` (default 3100) with
   `API_INTERNAL_URL=http://127.0.0.1:3200` and `WRINGY_ENV=ci`.
5. `web-outage` — a second `next start` on `WEB_PORT+1` whose `API_INTERNAL_URL` is a closed port.

`globalSetup` checks the database through the harness connection (marker `ci`, three fixture
campaigns); `globalTeardown` asks the database process to drop the databases and stop its
cluster (Playwright cannot signal a process on Windows). `reuseExistingServer` is false
everywhere. Projects: `mobile` 390, `desktop` 1440 and `small` 320 run `internal.spec.ts`
(cold start in three locales, worker health, a stale and a stopped worker arranged in
`ops.worker_heartbeat` as the worker login, no demo store, the 320 px spot check, both
not-found routes); `outage` runs `outage.spec.ts` on the second instance (api-unreachable, no
URL or stack on the page); `database-outage` runs last and revokes the API group's CONNECT on
the database to show `api-unavailable`, then grants it back. Test titles carry `M2-AC01`, and
`M2-AC01/2` where they prove the page → Fastify → PostgreSQL read.

`@wringy/db` and `tsx` are **devDependencies** of this app for that suite only. The dependency
rules (`pnpm depcruise`, rule `web-not-to-server-runtime`) cruise `src/`, where importing
`@wringy/db` stays forbidden. Playwright loads test files as CommonJS here, so the specs use
`@wringy/db/testing/connect` (pg only); the two `.mts` scripts run under tsx and are
type-checked by `tests/e2e-internal/tsconfig.json` (the `typecheck` script runs it), because
the root `tsconfig.json`, with Next's global types, excludes them.

`next.config.ts` sets `allowedDevOrigins: ['127.0.0.1']` because Next 16 otherwise blocks the
dev-server `/_next/hmr` requests Playwright makes over that host. Development only.

## Standalone build and the image (M2-01)

`next.config.ts` sets `output: 'standalone'` with `outputFileTracingRoot` at the repository root,
because the app imports the workspace packages from `../../packages`
(`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`,
"Caveats"). `next build` then writes `.next/standalone/apps/web/server.js` with only the traced
`node_modules`; `.next/static` and `public` are copied beside it by hand. `next start` still works
and warns that it "does not work with output: standalone" (the internal suite uses it).
`apps/web/Dockerfile` builds from the repository root
(`docker build -f apps/web/Dockerfile -t wringy-web:<git-sha> .`) and runs
`node apps/web/server.js` as `USER node` with `HOSTNAME=0.0.0.0` and `PORT=3100`; it needs
`WRINGY_ENV` and `API_INTERNAL_URL` at run time, and renders `/internal`'s "not configured" state
without them. Locally (no Docker), the standalone server answered 200 on `/internal`, `/` and a CSS
chunk (2026-09-23); on Windows the standalone `node_modules` are junctions into the repository,
so the copied layout is proven only by CI's `images` job on Linux.

For `pnpm dev`, the web server reads `WRINGY_ENV` and `API_INTERNAL_URL` from
`apps/web/.env.local` (Next loads `.env*` from the app's own directory,
`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`; ignored by
`apps/web/.gitignore`).

## Gaps

- **No component gaps.** All 61 names exist under the `radix` base; nothing was hand-written
  and nothing was dropped.
- `@tanstack/react-table` is in the Vite showcase but is **not** installed here: the
  `radix-nova` `table.tsx` is presentational and no generated file imports it. Add it when a
  data table actually needs it.
- `pnpm typecheck` runs `next typegen` first. Next 16 puts `LayoutProps` / `PageProps` in
  `.next/types`, so a bare `tsc --noEmit` on a clean checkout fails on `src/app/(demo)/layout.tsx`.
  After routes move, delete a stale `.next/dev/types` (left by an earlier `next dev`) if
  `pnpm typecheck` reports the old paths.
- `prefers-reduced-motion` **is** honoured, by one global baseline rule in
  `globals.css` (`animation-duration` / `transition-duration` collapsed to `0.01ms`,
  `animation-iteration-count: 1`, `scroll-behavior: auto`). `shadcn/tailwind.css` only covers
  the `.shimmer` utility and `tw-animate-css` 1.4.0 ships no such rule, so without that
  baseline `animate-in` / `animate-out` and the Radix overlay transitions would still play.
  The rule is **the one deliberate departure** from `design-system-v2/color-policy.md`, which
  reserves "CSS outside `:root`"; the v2 showcase carries the same baseline, and it is recorded
  here and in [`known-issues.md`](../../docs/m1-prototype/known-issues.md) rather than left
  undocumented. The acceptance suite verifies that reduced-motion emulation renders every
  dialog and panel without an error; **no test asserts the resulting computed durations**, so
  per-animation compliance is unverified.
- The official `DialogContent` and `AlertDialogContent` are `fixed`, centred and **unbounded in
  height**, so a dialog taller than the viewport hangs off both edges with nothing to scroll — at
  320x568 the partial-offer footer was unreachable for a pointer, a keyboard and Playwright alike.
  Those files may not be hand-edited, so the bound is applied at every call site through
  `DIALOG_FIT_CLASS` (`src/components/app/dialog-fit.ts`). A new dialog must carry it.
- The floating "Demo data" pill that used to sit bottom-left was **removed**: a `position: fixed`
  mark cannot be laid out around, and it covered page content and the sidebar's identity line. The
  mark is now in the header at every viewport (`DemoBadgeInline`), and the demo-tools trigger keeps
  its bottom-right anchor with every scrolling page reserving `DEMO_SAFE_AREA_CLASS` beneath it.
- The `/campaigns/[id]` metadata is generated from the baseline seed, because the server
  cannot read the visitor's localStorage. A campaign a scenario created locally falls back to
  the catalogue title and description.
- `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` are written by `next dev` itself
  (`node_modules/next/dist/server/lib/generate-agent-files.js`) and are kept so the tree
  stays clean; deleting them only recreates them.
- `public/` holds a `.gitkeep`. The template's five demo SVGs were removed with the template
  page content.
- `pnpm-workspace.yaml` lists `sharp`, `unrs-resolver`, `@parcel/watcher` and `@swc/core`
  under `ignoredBuiltDependencies`; none of their native builds is needed.
