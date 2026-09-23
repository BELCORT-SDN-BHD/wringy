# M2 internal build — acceptance record (M2-AC01)

The evidence for [M2-01 / #16](https://github.com/BELCORT-SDN-BHD/wringy/issues/16), acceptance
M2-AC01/1–3 ([m2-spec.md](../planning/specs/m2-spec.md#m2-ac01),
[m2-01.md](../planning/tickets/m2-01.md)). Every row carries the spec's columns (`m2-spec.md` L49;
[kickoff-package.md](kickoff-package.md) §6.4): 验收ID, 版本, 环境, 测试或人工步骤, 期望, 实际, 时间,
证据引用, 未决项. A row that was not executed says **NOT EXECUTED** and why, which is the M1 rule
([M1 record](../m1-prototype/acceptance-record.md) L5). Each row says whether the verification was
simulated, sandbox or real.

Automated tests carry their acceptance ID in their full name (describe chain plus title). Manual and
governance evidence lives in the rows below. `pnpm check:acceptance`
(`scripts/check-acceptance-mapping.mjs`, CI job `check`) requires every M2 test name to carry
`M2-AC`, and every M2-AC01 sub-item to have a test name or a row here whose first cell starts with
its ID.

This records what the internal build does. It is not a business acceptance, and it is not a release:
M2 has no production deployment (M2-AC09/3, `m2-spec.md` L66).

## Execution

| | |
|---|---|
| Recorded | 2026-09-23 (wave W4: this skeleton, the CI workflow and the images) |
| Branch | `feat/m2-01` |
| Executed by | agent run, M2-01 wave W4 worker |
| Runtime | Node 24.21.0 (root `.npmrc` `use-node-version`, `.nvmrc`), pnpm 10.33.0; PostgreSQL 17.10 through embedded-postgres 17.10.0-beta.17 locally; CI: `ubuntu-24.04` runners with a `postgres:17` service |
| Machine | Windows 11 (local); no Docker on this machine, so the images are built only in CI |
| Commands (local) | The W4 gate run below, on `f2b9f88` |
| Review fixes | 2026-09-23: the M2-01 review's confirmed findings fixed in the commits "Fix M2-01 review: …" from `18099af`; the review-fix gate run, the recovery rehearsal and the deviations recorded below |
| CI | `.github/workflows/app.yml` ("App checks"); run URL: NOT EXECUTED — the branch is not pushed yet; the orchestrator pushes it and records the run |

Rows for W0–W3 evidence are appended by W5 from the workers' evidence logs.

## M2-AC01/1 — M1 handoff register

Spec: "核对M1-08实际体验确认和P01–P11证据；登记产品仓库、模块归属、规则/设计审批引用及未完成项，不以设计系统展示替代原型"
(`m2-01.md`, Acceptance criteria).

| 验收ID | 版本 | 环境 | 测试或人工步骤 | 期望 | 实际 | 时间 | 证据引用 | 未决项 |
|---|---|---|---|---|---|---|---|---|
| M2-AC01/1 register | `3def287` on `main` (PR #81 squash); no migration | Repository documents; real (no simulation) | Manual: check the M1-08 founder confirmation and the P01–P11 evidence; register the product repository, module ownership, rule and design approval citations and the open items; correct the stale M1 records | A register a reviewer can check line by line, with the prototype itself (not the design-system showcase) as the evidence | Done in [kickoff-package.md](kickoff-package.md) §1: M1 milestone closed with 9 closed and 0 open issues (§1.1); founder acceptance "PASSED" on #9 (§1.1); every P01–P11 row re-checked against `apps/web/tests/e2e/acceptance.spec.ts`, its unit tests and screenshots (§1.2); module ownership (§1.4); seven rule and design approvals with dates (§1.5); every inherited M1 item with its landing ticket (§1.6). The M1 record's stale lines were corrected in the same PR: [acceptance-record.md](../m1-prototype/acceptance-record.md) "Supporting suites" now reads 322 Vitest and 318 Playwright passed, and "Limitations" reads "Founder confirmation: EXECUTED, PASSED (2026-09-23)". The P01–P11 evidence is the `apps/web` prototype's own suite and screenshots, not the design-system showcase | 2026-09-23, orchestrator (M2-00 preparation); PR #81 merged 2026-09-22T19:13:23Z (UTC) | PR [#81](https://github.com/BELCORT-SDN-BHD/wringy/pull/81) (files: kickoff-package.md, m1-prototype/acceptance-record.md, PROGRESS.md, PRD.md, ARCHITECTURE.md); [#9](https://github.com/BELCORT-SDN-BHD/wringy/issues/9); `gh pr view 81 --json mergedAt,files` (2026-09-23) | None for this sub-item. The inherited M1 items stay open in their landing tickets (§1.6) |

## M2-AC01/2 — dependency intersection, fresh-migration read, account separation, no secrets

Spec: "锁定受支持依赖交集；全新数据库迁移后，页面→Fastify→PostgreSQL读取成功；迁移账户与运行账户分权，浏览器包和日志不含密钥".
The automated evidence is every test whose full name carries `M2-AC01/2` (`pnpm check:acceptance`
counts them); the rows for W0–W3 are appended by W5.

## M2-AC01/3 — workspace and CI checks; branch protection, cross-vendor review, release gate

Spec: "建立独立工作区和CI的类型、单元、依赖方向、spec引用及验收映射检查；核验分支保护、跨厂商审阅和发布门禁，未能配置项报告成本及处置，不伪称已生效".

### Workspace and CI checks

| 验收ID | 版本 | 环境 | 测试或人工步骤 | 期望 | 实际 | 时间 | 证据引用 | 未决项 |
|---|---|---|---|---|---|---|---|---|
| M2-AC01/3 workspace | `feat/m2-01` (W4) | Local, Windows 11; real | `pnpm install --frozen-lockfile` over `pnpm-workspace.yaml` (`apps/*`, `packages/*`): apps web, api, worker; packages config, contracts, db | One workspace, one lockfile, each package declaring only what it imports | `pnpm install` and every gate below ran on this workspace (W4 gate run); the api and worker builds fail on any undeclared external, and a local `pnpm deploy --legacy` of each app installed only its production dependencies | 2026-09-23, W4 worker | `pnpm-workspace.yaml`; `pnpm-lock.yaml` | None |
| M2-AC01/3 CI checks | `feat/m2-01` (W4) | Local, Windows 11; real. CI: NOT EXECUTED (not pushed yet) | The CI `check` job's commands run locally: `pnpm lint`, `pnpm typecheck` (类型), `pnpm test` (单元), `pnpm depcruise` (依赖方向, including a planted violation that must be rejected), `pnpm check:acceptance` (验收映射), `pnpm build`, `pnpm canary`; `python -X utf8 scripts/check-planning.py` (spec引用, CI job `planning`) | Each check passes on the tree and fails on a planted fault | Passed locally (W4 gate run below); the dependency check rejects its planted violation on every run. The acceptance-mapping check was also shown to fail: with the `M2-AC01` tag removed from one describe block it listed the 5 untagged names and exited 1; with the tag removed from a static-parsed integration test and a Playwright test it listed both and reported M2-AC01/3 unmapped | 2026-09-23, W4 worker | `.github/workflows/app.yml` (jobs `check`, `integration`, `e2e`, `images`); `.github/workflows/planning.yml`; `scripts/check-acceptance-mapping.mjs`; `scripts/check-dependency-direction.mjs` | The CI run itself; the orchestrator records its URL |
| M2-AC01/3 CI-only checks | `feat/m2-01` (W4) | CI (`ubuntu-24.04`); NOT EXECUTED | `integration`: `pnpm test:int` against a `postgres:17` service; `e2e`: the M1 suite and `pnpm e2e:internal` on that service; `images`: the three Dockerfiles built with `push: false` and smoke-run | Green jobs on the first push | NOT EXECUTED: needs Docker and a Linux runner; this machine has neither Docker nor Linux. Locally, the shared-cluster shape of `integration` was run against the `pnpm db:start` cluster (`TEST_DATABASE_URL` set; three runs, exit 0), and the images' contents were run from local `pnpm deploy` outputs on Node 24.21.0 | 2026-09-23, W4 worker (local parts) | `packages/db/README.md` "One cluster, several runs"; commit "Add the web, api and worker images and the bundled migrate step" | The first CI run; Linux-only tests (the api SIGTERM test skips on win32) |
| M2-AC01/3 CI checks (review fixes) | `feat/m2-01` after the review fixes | Local, Windows 11; real | `pnpm depcruise` and `pnpm check:acceptance` as they now run (review findings test-integrity-1 and test-integrity-3, and the worker rule from kickoff-package.md §8.1/§8.7) | Each check fails on its own planted fault, on every run, without a hand edit | `pnpm depcruise` plants two violations in one cruise and requires each rule to name its file: apps/web importing `@wringy/db` (`web-not-to-server-runtime`) and apps/worker importing `@wringy/contracts` (`worker-not-to-contracts`, new). `pnpm check:acceptance` first runs a self-test on `scripts/fixtures/acceptance-self-test/` and exits 1 unless it catches an untagged name, a declared `test.skip`, a `test.fixme`, M2-AC99/10 not counting for /1 and two run-time skips (with `names()` broken to always match, it stopped with "self-test: ... could pass what it must fail"); a Playwright spec whose every test is expected skipped no longer counts, and (c) refuses an unconditional run-time skip in a listed file. Replayed: a planted `describe.skip` + `test.fixme` spec tagged M2-AC02/1 and a `ctx.skip()` test tagged M2-AC02/2 made `node scripts/check-acceptance-mapping.mjs m2-02` report M2-AC02/1 tests 0 and (c) FAIL, exit 1 (before the fix both counted). The one test that used to carry M2-AC01/3 tested the harness's role bootstrap; it is now tagged M2-AC01, so /3 rests on these rows | 2026-09-23, review-fix worker | `scripts/check-dependency-direction.mjs`; `scripts/check-acceptance-mapping.mjs`; `scripts/fixtures/`; commits `f16c95e`, `bc1f7fd` | The CI run of these commits |

### Governance: branch protection, cross-vendor review, release gate

| 验收ID | 版本 | 环境 | 测试或人工步骤 | 期望 | 实际 | 时间 | 证据引用 | 未决项 |
|---|---|---|---|---|---|---|---|---|
| M2-AC01/3 branch protection (today) | `main` settings on GitHub | GitHub repository settings; real | Read the protection of `main`: `gh api repos/BELCORT-SDN-BHD/wringy/branches/main/protection` | Report what is enforced, without claiming more | Required status checks: `["planning"]` only (app id 15368), `strict: true`; a pull request is required with 0 approving reviews and stale reviews dismissed; `enforce_admins` on; linear history and conversation resolution required; force pushes and deletion off; no rulesets. The product checks (`check`, `integration`, `e2e`) are **not** required today, so a red product build could merge | 2026-09-23: orchestrator check (kickoff-package.md §2.1); re-read by the W4 worker at 2026-09-23T00:46:55Z with the same result | [kickoff-package.md](kickoff-package.md) §2.1; `gh api …/branches/main/protection`, `gh api …/rulesets` (0) | D22 applies after the merge (next row) |
| M2-AC01/3 branch protection (after merge, D22) | Not yet applied | GitHub repository settings | An admin, once `app.yml` has run on `main`: `gh api -X PATCH repos/BELCORT-SDN-BHD/wringy/branches/main/protection/required_status_checks -f strict=true -f 'contexts[]=planning' -f 'contexts[]=check' -f 'contexts[]=integration' -f 'contexts[]=e2e'`. `images` stays optional. GitHub's REST reference marks `contexts` deprecated in favour of `checks` (objects with `context` and an optional `app_id`); the equivalent `checks` body pins each context to GitHub Actions (app id 15368, as `planning` is today) | `planning`, `check`, `integration` and `e2e` required; `app.yml` has no `paths:` filter (D22a), so documentation PRs report all four | **NOT EXECUTED**: this needs admin rights and CI green on `main` first; the agent does not change repository settings. Cost: about 15 minutes of admin time (kickoff-package.md §2.2, G5) | Pending | [REST: update status check protection](https://docs.github.com/en/rest/branches/branch-protection?apiVersion=2022-11-28#update-status-check-protection); kickoff-package.md §9.1 D22 | Founder or admin action after merge; re-read the protection afterwards and add a row here |
| M2-AC01/3 cross-vendor review | This PR | — | Founder ruling D23: nothing is enforced; the per-ticket review is the repository's `code-review` skill; the Codex read-only review is at the orchestrator's discretion, saved as a PR comment when it runs | Register what actually ran, never an unrun review | **NOT RUN unless recorded below.** GitHub enforces no review: 0 required approvals and no `CODEOWNERS` (kickoff-package.md §2.1). Automating it would cost about 1 day or more and needs Codex credentials usable in Actions (unverified); accepted open as G8 | 2026-09-23 | [kickoff-package.md](kickoff-package.md) §6.6, §9.1 D23, §10 G8 | The orchestrator adds a row with the PR comment link if the review runs |
| M2-AC01/3 release gate | `feat/m2-01` (W4) | GitHub repository; real | Check for a release gate: GitHub environments, deploy workflows | Report that none exists, without claiming one | **None, by ruling D24**: M2 has no production release. 0 GitHub environments (`gh api repos/BELCORT-SDN-BHD/wringy/environments` → `total_count: 0`, re-read 2026-09-23T00:46:55Z); no deploy workflow: `app.yml` builds the three images with `push: false`, logs in to no registry, and deploys nothing. Building it (a staging GitHub Environment, a deploy workflow of SHA images gated on the required checks) costs about 1–2 days and belongs to M2-09 (G9) | 2026-09-23, W4 worker | [kickoff-package.md](kickoff-package.md) §2.2, §9.1 D24, §10 G9; `.github/workflows/app.yml` | M2-09 |

## Recovery: removing the new entry returns the prototype

`m2-01.md` "Verification and recovery": 移除新入口可回到原型，保留源设计资产 (review finding spec-docs-1).

| 验收ID | 版本 | 环境 | 测试或人工步骤 | 期望 | 实际 | 时间 | 证据引用 | 未决项 |
|---|---|---|---|---|---|---|---|---|
| M2-AC01 recovery: remove the new entry | `2be5188` (the code of every review fix; the script and this record were added after it) | Local, Windows 11, Node 24.21.0, pnpm 10.33.0; a throwaway git worktree of HEAD in the system temp directory, removed afterwards; real | `node scripts/rehearse-prototype-rollback.mjs --e2e`: delete `apps/web/src/app/(internal)/` (the (internal) root layout, the /internal page and its parts: 11 tracked files), check nothing left in `apps/web/src` imports `@wringy/*`, `pnpm install --frozen-lockfile --offline`, `pnpm --filter web test`, `pnpm --filter web build`, `next start` and GET `/`, `/campaigns`, `/internal` and an unmatched URL, then the M1 prototype Playwright suite on a warmed `next dev` without the removed entry's own tests (`--grep-invert M2-AC01`: the suite's "M2-AC01 internal build route walk" in `tests/e2e/i18n.spec.ts` walks /internal, 3 locales in 3 projects; run with them on the same worktree, those 9 failed and the other 318 passed); and, in the checkout, `git diff <merge base> HEAD` over the design sources | No manifest or lockfile edit; tests and build pass; /internal answers exactly as any URL the prototype does not know; the M1 suite passes; the design sources are unchanged | See the run log below the table | 2026-09-23, review-fix worker | `scripts/rehearse-prototype-rollback.mjs` | A deeper back-out that also deletes `apps/api`, `apps/worker` and `packages/*` is not rehearsed. Besides deleting them it needs: `apps/web/package.json` (drop `@wringy/config`, `@wringy/contracts` and the devDependency `@wringy/db`), `apps/web/tests/e2e-internal/`, `apps/web/playwright.internal.config.ts`, the `internal` message namespace (`src/i18n/messages.ts`, `src/messages/*/internal.json`), the root `package.json` scripts (`db:*`, `e2e:internal`, `depcruise`, `canary`, `check:acceptance`), `pnpm-workspace.yaml` (`packages/*`), `.dependency-cruiser.cjs`, `scripts/check-*.mjs`, `.github/workflows/app.yml`, and a lockfile update. Not needed to return to the prototype, which (above) no longer imports any of them once the entry is gone |

Run log (`node scripts/rehearse-prototype-rollback.mjs --e2e`, 2026-09-23):

```text
rollback: design assets unchanged since the merge base 3def287: phase-0/foundation/design-system-v2, phase-0/deliverables/brand, apps/web/src/components/ui, apps/web/src/app/globals.css, apps/web/public
rollback: worktree of 2be5188 in the system temp directory
rollback: removed apps/web/src/app/(internal) (11 tracked files)
rollback: apps/web/src imports no @wringy/* package once the entry is removed
rollback: pnpm install --frozen-lockfile --offline: exit 0 (no manifest or lockfile edit needed)
rollback: pnpm --filter web test: exit 0 (Tests  329 passed (329))
rollback: pnpm --filter web build: exit 0, 37 route lines, none of them /internal
rollback: next start: / 200, /campaigns 200, /internal 404 like any unmatched prototype URL (<title>Wringy — prototype</title><html id="__next_error__">)
rollback: next dev warmed: 36 routes
rollback: M1 prototype suite (apps/web playwright.config.ts, --grep-invert M2-AC01): exit 0, 33 skipped, 318 passed (4.3m)
rollback: PASS on 2be5188
```

The design sources checked are `phase-0/foundation/design-system-v2`, `phase-0/deliverables/brand`,
`apps/web/src/components/ui`, `apps/web/src/app/globals.css` and `apps/web/public`. Under
`next start`, /internal and an unknown URL both answer 404 with Next's error document
(`<html id="__next_error__">`) and the prototype's `<title>`: the demo catch-all
(`src/app/(demo)/[...notFound]/page.tsx`, which the removal does not touch) answers every URL the
prototype does not know that way. Its comment says the 404 renders inside the demo root layout; in
`next start` it did not (observed here; `next dev` not checked).

## Review fixes: deviations from the signed kickoff text

The review fixes follow kickoff-package.md except where a row below says otherwise. The signed sections
are not edited; the deviation is recorded here and in the module README named.

| Signed text | What the build does | Why | Where |
|---|---|---|---|
| §6.3 "API integration tests each run in a transaction that is rolled back afterwards" | Each API integration test file gets its own committed clone; a test that needs a state arranges it itself (the leak probe adds its own canary column) | The app under test reads through its own `pg.Pool` as `wringy_api_login`, which cannot see an uncommitted transaction opened by the test on another connection; packages/db's own tests, which query directly, do use `withRollback` | `apps/api/README.md` "Integration tests"; review finding test-integrity-7 |
| §8.8 "api on port 3200 (through `tsx watch`)" | `apps/api` and `apps/worker` run `node --watch --import tsx` in `dev`; `pnpm dev` stays `pnpm -r --parallel` (D32) | `tsx watch` started by `pnpm -r --parallel run dev` printed nothing on Windows (0 lines in 12 s on 2026-09-23; `node --watch --import tsx` 4 lines in 8 s, and `pnpm dev` 7 api, 7 worker and 7 web lines in 25 s) | root `README.md`; commit `2be5188`; review finding ci-docker-ops-1 |
| §8.4 lists migrations 0001–0005 | Adds `0006_pgboss_runtime_bounds` and `0007_data_origin_immutable` | Review findings security-privileges-1 and -4 and correctness-runtime-7. New migrations rather than edits of 0005/0002: node-pg-migrate does not re-run an edited file on a database that already applied it, so an edit would silently leave such a database on the old grants | `packages/db/README.md` "Schema (M2-01)" |
| §4.11 "No `pgboss` access" and §8.5 "no `pgboss`" for the API login, next to §8.3 "`GET /health` queries the database as the runtime role and compares … the pg-boss schema version" | Both hold: the API login has no right in schema `pgboss` and reads the version, as the runtime role, through the migrator-owned view `ops.pgboss_schema_version` (0006) | 0005 had granted the API USAGE on `pgboss` and SELECT on `pgboss.version` without recording the conflict between the two signed sentences | `apps/api/README.md` `GET /health`; review finding security-privileges-4 |
| §4.11 "A CI test compares `has_table_privilege` for every role against the checked-in manifest" | Stricter: the manifest test also compares column-level privileges and covers every non-system schema, `public` included | A column GRANT or a grant in a new schema passed the table-level check | `packages/db/test/grant-manifest.ts`; review finding security-privileges-5 |

## W4 gate run

Run by the W4 worker on 2026-09-23 on `feat/m2-01` at `f2b9f88` (the tree of every W4 code
commit), Windows 11, Node 24.21.0, pnpm 10.33.0. Local only; the CI run is the orchestrator's.

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | exit 0 |
| Types | `pnpm typecheck` | exit 0 |
| Unit | `pnpm test` | exit 0: contracts 9, config 15, db 25, worker 25, api 42, web 334 (26 files) passed |
| Integration, embedded clusters | `pnpm test:int` (no `TEST_DATABASE_URL`) | exit 0: db 40 passed (8 files), api 25 passed and 1 skipped (the SIGTERM test skips on win32), worker 12 passed |
| Integration, one shared cluster (the CI shape) | `TEST_DATABASE_URL=<pnpm db:start superuser URL> pnpm test:int`, three runs | exit 0 each, same counts; no test database left behind. Before the bootstrap lock the first of two runs failed with "tuple concurrently updated" (XX000) |
| Build | `pnpm build` | exit 0; `apps/web/.next/standalone/apps/web/server.js`, `packages/db/dist/migrate.js`, `apps/api/dist/main.js`, `apps/worker/dist/main.js` written |
| Dependency direction | `pnpm depcruise` | PASS: no violation in 359 modules and 1399 dependencies; the planted `apps/web/src/lib/__dependency-violation__.ts` rejected by `web-not-to-server-runtime` |
| Secret canary | `pnpm canary` | PASS: 0 canary values in `.next/static` (72 files), `.next/server` (756), the rest of `.next` (1727, standalone included), both bundles, and 10 s of api and worker logs |
| Acceptance mapping | `pnpm check:acceptance` | PASS: 214 names from 10 sources carry `M2-AC`; M2-AC01/1 by 1 row, /2 by 82 tests, /3 by 1 test and 7 rows. It fails on a removed tag and on a removed row (see the M2-AC01/3 CI-checks row) |
| M1 demo suite | `pnpm --filter web e2e`, after warming all 38 routes on `pnpm --filter web dev` (8 s) | 327 passed, 33 skipped (viewport scoping), 0 failed, 4.1 min |
| Internal-build suite | `pnpm e2e:internal` | 28 passed, 4 skipped (viewport scoping), 0 failed, 46 s, embedded cluster; again with `TEST_DATABASE_URL` at the `pnpm db:start` cluster (the CI shape): 28 passed, 4 skipped, 39 s. `next start` warns that it "does not work with output: standalone" and serves as before |
| Planning | `python -X utf8 scripts/check-planning.py` | "Validated 5 specifications and 60 tasks; dependencies acyclic." |
| Workflow lint | actionlint 1.7.12 with shellcheck 0.11.0 (release binaries) on `app.yml` and `planning.yml` | no finding |
| Whitespace | `git diff --check` | clean |

Not run here, and why: the `images` job and every Docker build (no Docker on this machine); the
`integration` and `e2e` jobs on Linux with a `postgres:17` service (no Linux runner here). The
images' contents were exercised instead from local `pnpm deploy` outputs on Node 24.21.0 against
a freshly migrated database (`node dist/migrate.js` from zero and again, the api's `/health`
"ok", the worker's "worker started") and the standalone web server (`/internal` 200).

## Review-fix gate run

Run by the review-fix worker on 2026-09-23 on `feat/m2-01` with the code of `2be5188` (the last
code commit of the review fixes; the rehearsal script and this record's rows came after it),
Windows 11, Node 24.21.0, pnpm 10.33.0. Local only; the CI run is the orchestrator's.

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | exit 0 |
| Types | `pnpm typecheck` | exit 0 |
| Unit | `pnpm test` | exit 0: contracts 9, config 17, db 36, web 336 (26 files), worker 25, api 48 passed |
| Integration, embedded clusters | `pnpm test:int` (no `TEST_DATABASE_URL`) | exit 0: db 49 passed (9 files), worker 15 passed (5 files), api 28 passed and 1 skipped (8 files; the SIGTERM test skips on win32) |
| Build | `pnpm build` | exit 0; the migrate image step copies `packages/db/migrations`, so 0006 and 0007 ship with it (`apps/api/Dockerfile`) |
| Dependency direction | `pnpm depcruise` | PASS: no violation in 362 modules and 1409 dependencies; both planted violations rejected, each by its rule (`web-not-to-server-runtime`, `worker-not-to-contracts`) |
| Secret canary | `pnpm canary` | PASS: 0 canary values in the bundles, the server build and 10 s of api and worker logs |
| Acceptance mapping | `pnpm check:acceptance` | PASS, self-test first: 250 names from 10 sources carry `M2-AC`; M2-AC01/1 by 1 row, /2 by 105 tests, /3 by the rows above; no unconditional run-time skip in 45 listed files |
| Internal-build suite | `pnpm e2e:internal` | 28 passed, 4 skipped (viewport scoping), 0 failed, 58 s, embedded cluster |
| M1 demo suite | `pnpm --filter web e2e` on a `next dev` warmed over all 38 routes | 327 passed, 33 skipped, 0 failed, 4.3 min. First runs on this machine timed out in 13 to 180 tests: `apps/web/.next/dev`, Turbopack's development cache, had grown to 4.4 GB and the dev server stalled on "Finished filesystem cache database compaction in 26.5s"; the base commit `9ca00a5` failed the same two spec files the same way under the same conditions (18 failed). With that cache deleted, the full suite passed as above (see `apps/web/README.md`) |
| Recovery rehearsal | `node scripts/rehearse-prototype-rollback.mjs --e2e` | PASS (the "Recovery" section above) |
| Planning | `python -X utf8 scripts/check-planning.py` | "Validated 5 specifications and 60 tasks; dependencies acyclic." |
| Whitespace | `git diff --check` | clean |

Not run here, and why: the CI-only jobs (`integration` and `e2e` on Linux with a `postgres:17`
service, `images` with Docker), as in the W4 gate run.
