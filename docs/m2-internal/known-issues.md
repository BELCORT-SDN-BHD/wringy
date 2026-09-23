# M2 internal build (M2-01) — known issues and limitations

What the M2-01 internal build does not do, what it does in a way a reviewer should know about, and
what is left unverified. **Nothing here changes a business rule.** M2-01 adds no business value
anywhere: the fixture campaigns carry a title, a status and a data origin only
(`packages/db/src/fixtures.ts` L14; `packages/db/migrations/0003_orgs_campaigns.sql` L32–L44), and
[campaign-defaults-v1](../../phase-0/foundation/campaign-defaults-v1.md) stays the only source of
business defaults.

Recorded 2026-09-23 against branch `feat/m2-01` (local HEAD `9615439` plus the commit that adds this
file; GitHub holds `9ca00a5`), after the W5 adversarial review. The 23 defects that review confirmed
were fixed and none was skipped ([acceptance-record.md](acceptance-record.md) "W5 adversarial
review"). What is recorded here is what M2-01 deliberately does not do, what it inherits, and what it
cannot prove on this machine or in CI.

## Internal build only, by design (not defects)

These follow from the M2-01 scope ([m2-01.md](../planning/tickets/m2-01.md), kickoff-package.md §8.3
and §8.11). Each is listed because a reviewer could otherwise take it for a capability.

- **No identity.** There is no sign-in. Every `/internal/*` API route runs an `authenticate` hook
  that is a no-op today (`apps/api/src/authenticate.ts` L22, `TODO(M2-02)`; `apps/api/README.md`
  L39), and the `/internal` page is open to anyone who can reach the web server. M2-02 adds Supabase
  sign-in (kickoff-package.md §8.11) and M2-03 puts `/internal/*` behind an ops capability
  (`apps/api/README.md` L42–L44). The API image listens on `0.0.0.0` when `HOST` says so
  (`apps/api/README.md` L206); nothing is deployed, so nothing is exposed today, but the internal
  build must not be deployed where others can reach it before M2-02.
- **No writes.** The API serves GET routes only, and its database login holds SELECT and nothing
  else (`packages/db/test/grant-manifest.ts` L55). The only writers are the worker (its heartbeat
  and pg-boss's own tables) and the migrator (schema, environment marker, fixture seed).
- **No live data.** The page shows fixture rows seeded by `pnpm db:seed:fixtures`. A database marked
  production refuses fixture rows (migration 0002), cannot be marked production while it holds any
  (`37a7c2d`; since `2e84a7a` the check and the marker update are serialised with fixture writes
  by a SHARE lock, `packages/db/README.md` "Local run"), and no row's origin can change (0007).
  There is no live data source and no live adapter.
- **Fixture content is demonstration content.** The three campaign titles and two org names are
  placeholders, not customers, and carry no amounts, dates or rules.
- **No Supabase, no Render.** Locally the database is embedded PostgreSQL 17; in CI it is a
  `postgres:17` service. Nothing has run against Supabase or Render
  (`packages/db/README.md` "Supabase (unverified)", L157). The external accounts are the founder's
  step (D15–D18), with the checklist on
  [#21](https://github.com/BELCORT-SDN-BHD/wringy/issues/21#issuecomment-5783628106).
- **No deployment and no release gate.** The images are built with `push: false`; there is no
  GitHub environment and no deploy workflow (ruling D24; kickoff-package.md §10 G9). M2 has no
  production deployment (M2-AC09/3).
- **The M1 demo is untouched.** It keeps its own `(demo)` root layout and its browser store;
  M2-01 does not touch the store (kickoff-package.md §8.6), and the whole M1 suite still passes
  (327 passed, 33 skipped in CI on `9ca00a5`).

## Accepted limitations

- **A 404's raw HTML is Next's error shell.** With two root layouts and no top-level layout, the two
  catch-alls call `notFound()`, which Next renders as `<html id="__next_error__">` whose flight data
  carries the right root layout: the browser shows `lang`, the CSS and the banner, a `curl` of the raw
  HTML does not (`apps/web/README.md` L50–L61). `global-not-found.js` would render on the server but
  is experimental in this Next version and cannot tell the two layouts apart. Accepted by the M2-01
  orchestrator; the internal suite checks the rendered page.
- **The demo catch-all's comment overstates what `next start` does.** Under `next start` an unknown
  URL (and `/internal` once the internal entry is removed) answers 404 with Next's error document and
  the prototype's `<title>`, while `src/app/(demo)/[...notFound]/page.tsx` says the 404 renders inside
  the demo root layout. Observed in the recovery rehearsal; `next dev` not checked
  ([acceptance-record.md](acceptance-record.md) "Recovery").
- **SIGTERM tests skip on Windows.** Windows has no POSIX signals, so `child.kill('SIGTERM')` is a
  forced kill there. The api's SIGTERM test is skipped on win32
  (`apps/api/tests/integration/startup.int.test.ts` L133), and the worker test uses its IPC
  `shutdown` message instead (`apps/worker/test/process.int.test.ts` L60–L61;
  `apps/worker/README.md` L104). Linux CI runs the real signal: on `9ca00a5` apps/api test:int ran 26
  tests with none skipped. Locally the count reads "28 passed, 1 skipped".
- **Embedded PostgreSQL and deep paths on Windows.** The Windows binaries load their DLLs from about
  120 characters below the repository root; in a clone whose deepest DLL path reached 278
  characters, `initdb` could not start (0xC0000135). The 260-character path limit is the likely cause
  (inferred, not confirmed). Keep the checkout path short, or point `TEST_DATABASE_URL` at another
  PostgreSQL 17 (`packages/db/README.md` L148–L155).
- **Chromium's empty screenshot.** Chromium sometimes answers `Page.captureScreenshot` with "Unable
  to capture screenshot" (an empty surface copy). Evidence frames retry that one error, at most 3
  attempts, after two animation frames; any other capture error fails the test at once
  (`apps/web/README.md` L275–L278; `tests/unit/capture-retry.test.ts`). The cause inside Chromium is
  not fixed here.
- **Four page states have no end-to-end test.** Of the `/internal` page's `data-app-state` values,
  the Playwright suite renders `api-unreachable` and `api-unavailable`, and only asserts that `empty`
  and `no-workers` are absent during an outage. `unexpected` is covered at the unit level only
  (`apps/web/src/app/(internal)/internal/api-read.test.ts` L57); `not-configured` is rendered only by
  the CI images smoke (`.github/workflows/app.yml` L221); `empty` (no fixture campaigns) and
  `no-workers` (no worker has reported) are rendered by no test. None of the four arises on the stack
  the suite starts (a seeded database, a running worker, a configured API address).
- **Malay and Chinese internal copy are drafts.** `apps/web/src/messages/{ms-MY,zh-Hans-MY}/internal.json`
  were written with the page (`306892a`); key parity across the three locales is enforced
  (`apps/web/src/i18n/messages.test.ts`); no review of the wording by a native speaker is recorded, as for M1
  ([M1 known issues](../m1-prototype/known-issues.md) "Language").
- **`pnpm dev` on Windows needed another watcher.** `tsx watch`, started by `pnpm -r --parallel run
  dev`, printed nothing on Windows (0 lines in 12 s). The api and worker `dev` scripts now run
  `node --watch --import tsx` (`2be5188`), and `pnpm dev` printed 7 api, 7 worker and 7 web lines in
  25 s. The cause below `pnpm run` is not established; Node's watcher sometimes restarts once at
  start-up on a "Change detected" in `node_modules`, which is harmless (root `README.md` L60). No
  automated test covers it.
- **The M1 suite can time out on a large Turbopack cache.** At 4.4 GB, `apps/web/.next/dev` coincided
  with 155 navigation timeouts while another project's Playwright suite ran on the same machine;
  with the cache deleted the suite passed (`apps/web/README.md` L81–L90). The cause of two smaller
  runs of timeouts (13 and 15) is not established beyond machine load.
- **A database migrated before 0006 must be migrated again.** Run `pnpm db:migrate` on it (for
  example a local `pnpm db:start` cluster) to get 0006 and 0007; `installPgBossSchema()` refuses to
  run the pg-boss CLI while a queue row breaks the 0006 rule (`packages/db/README.md` L105–L109).
- **API integration tests use a committed clone per file, not a rolled-back transaction per test.**
  A deviation from kickoff-package.md §6.3, recorded in `apps/api/README.md` and in the record's
  "Deviations" table: the app reads through its own pool, which cannot see another connection's
  uncommitted transaction.
- **One worker per environment is assumed for the queue round trip.** pg-boss creates one
  `system.heartbeat` job per minute for the whole cluster (`apps/worker/src/jobs/heartbeat.ts`
  L8–L10, L24; `apps/worker/src/worker.ts` L236). Only the worker that takes the job stamps its own
  `last_queue_round_trip_at` (`roundTripStatement`, `apps/worker/src/jobs/heartbeat.ts` L63–L70).
  With several workers, the others' round trips age, and the API reads them as `overdue` after
  3 minutes (`QUEUE_OVERDUE_AFTER_MS`, `packages/db/src/heartbeat.ts` L27;
  `computeQueueState`, `apps/api/src/worker-state.ts` L52–L56), although their queue path works.
  Raised in review of PR #82 and judged outside M2-01's scope, which runs one worker per
  environment. M2-09 (multi-instance) must revisit `queueState`: judge it per cluster, or schedule
  a job per worker.
- **Restarting a worker with the same `WORKER_ID` can briefly show it as stopped.** Both processes
  write one row. If the old process is still draining when the new one has beaten, the old
  process's graceful stop sets `stopped_at = now()` on that row (`stoppedStatement`,
  `apps/worker/src/jobs/heartbeat.ts` L77–L82), which is at or after the new process's
  `last_beat_at`. The API then reports `stopped` (`computeWorkerState`,
  `apps/api/src/worker-state.ts` L38) until the new process's next beat clears `stopped_at`
  (`beatStatement`, `apps/worker/src/jobs/heartbeat.ts` L45–L48). That takes at most one beat
  interval, 15 s (`HEARTBEAT_INTERVAL_MS`, `packages/db/src/heartbeat.ts` L14). Raised in review
  of PR #82 and judged outside M2-01's scope, which runs one worker per environment.

## Governance not yet in force

- **Branch protection (D22) waits for the merge.** Today `main` requires only `planning`
  (re-read 2026-09-23T05:48:15Z). `check`, `integration` and `e2e` become required after `app.yml`
  has run on `main`; an admin applies it (about 15 minutes, G5). Until then a red product build
  could merge.
- **The cross-vendor review is not enforced.** Ruling D23: the Codex read-only review is at the
  orchestrator's discretion. For PR #82 it ran once, on `12a85ab`, on 2026-09-23 (Codex CLI 0.153.4,
  gpt-6-astra, read-only), and the result is saved as a
  [PR #82 comment](https://github.com/BELCORT-SDN-BHD/wringy/pull/82#issuecomment-5790041412). Its
  two defects are fixed in `2e84a7a` and the commit after it
  ([acceptance-record.md](acceptance-record.md) "M2-AC01/3", cross-vendor row). Nothing makes the
  review run on a later PR: automating it is still open as G8.
- **No release gate** (D24, G9): see "Internal build only".

## Unverified until CI, Supabase or Render

- **The review fixes have not run in CI.** CI is green on `9ca00a5`; the 18 review-fix commits are
  not pushed. Unproven on Linux until then: `apps/api/tests/integration/timeouts.int.test.ts`,
  `apps/worker/test/schedule.int.test.ts` (up to about 120 s), the harness guards in
  `packages/db/test/cluster.int.test.ts` (CI's `TEST_DATABASE_URL` host 127.0.0.1 counts as
  loopback), the PostgreSQL 17 and Node 24 assertions, and `failOnFlakyTests` in
  `apps/web/playwright.internal.config.ts` L54, which takes effect only when `CI` is set.
- **The images are proven only in CI.** No Docker on this machine. The `images` job on `9ca00a5`
  built all three and smoke-ran them; pushing, pulling from GHCR and Render's pre-deploy command are
  unverified (kickoff-package.md §8.9, G18).
- **Supabase behaviours** (G17; checked in M2-02 and M2-09): whether a custom `wringy_migrator` can
  own `app`, `ops` and `pgboss` or `postgres` must migrate; whether the pg-boss CLI and
  node-pg-migrate's session advisory lock work through the Supavisor session pooler; whether
  `pnpm db:bootstrap` can create the logins as Supabase's non-superuser `postgres`
  (`packages/db/README.md` L157–L164); whether `auth.sessions` is readable (kickoff-package.md
  §4.6, Mechanism A); whether LISTEN works through the session pooler; and whether Supavisor passes
  the API's `statement_timeout` startup parameter (the fallback is
  `ALTER ROLE wringy_api_login SET statement_timeout`; `apps/api/README.md` L116).
- **Render's shutdown grace.** The worker drains for up to 20 s on SIGTERM, plus 10 s of grace
  (`apps/worker/README.md` L162). Render's grace period has not been checked against it, and a
  SIGTERM drain inside a container is unverified until M2-09 (`apps/worker/README.md` L170–L172).
  Whether the API is reachable only over Render's private network is also unverified
  (kickoff-package.md §4.5).

## Testing limitations

- **One browser engine.** Chromium only, at 390, 1440 and 320 px, as in M1 (G14, ruling D26).
- **Local evidence is Windows only.** Linux-only paths come from CI.
- **Nothing asserts pixels.** The screenshots in `docs/m2-internal/screenshots/` are evidence for a
  human reviewer, not a visual baseline.
