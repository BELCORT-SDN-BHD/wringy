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
| Commands (local) | Filled in with the W4 gate run below |
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
| M2-AC01/3 workspace | `feat/m2-01` (W4) | Local, Windows 11; real | `pnpm install --frozen-lockfile` over `pnpm-workspace.yaml` (`apps/*`, `packages/*`): apps web, api, worker; packages config, contracts, db | One workspace, one lockfile, each package declaring only what it imports | See the W4 gate run below | 2026-09-23, W4 worker | `pnpm-workspace.yaml`; `pnpm-lock.yaml` | None |
| M2-AC01/3 CI checks | `feat/m2-01` (W4) | Local, Windows 11; real. CI: NOT EXECUTED (not pushed yet) | The CI `check` job's commands run locally: `pnpm lint`, `pnpm typecheck` (类型), `pnpm test` (单元), `pnpm depcruise` (依赖方向, including a planted violation that must be rejected), `pnpm check:acceptance` (验收映射), `pnpm build`, `pnpm canary`; `python -X utf8 scripts/check-planning.py` (spec引用, CI job `planning`) | Each check passes on the tree and fails on a planted fault | See the W4 gate run below. The acceptance-mapping check was also shown to fail: with the `M2-AC01` tag removed from one describe block it listed the 5 untagged names and exited 1; with the tag removed from a static-parsed integration test and a Playwright test it listed both and reported M2-AC01/3 unmapped | 2026-09-23, W4 worker | `.github/workflows/app.yml` (jobs `check`, `integration`, `e2e`, `images`); `.github/workflows/planning.yml`; `scripts/check-acceptance-mapping.mjs`; `scripts/check-dependency-direction.mjs` | The CI run itself; the orchestrator records its URL |
| M2-AC01/3 CI-only checks | `feat/m2-01` (W4) | CI (`ubuntu-24.04`); NOT EXECUTED | `integration`: `pnpm test:int` against a `postgres:17` service; `e2e`: the M1 suite and `pnpm e2e:internal` on that service; `images`: the three Dockerfiles built with `push: false` and smoke-run | Green jobs on the first push | NOT EXECUTED: needs Docker and a Linux runner; this machine has neither Docker nor Linux. Locally, the shared-cluster shape of `integration` was run against the `pnpm db:start` cluster (`TEST_DATABASE_URL` set; three runs, exit 0), and the images' contents were run from local `pnpm deploy` outputs on Node 24.21.0 | 2026-09-23, W4 worker (local parts) | `packages/db/README.md` "One cluster, several runs"; commit "Add the web, api and worker images and the bundled migrate step" | The first CI run; Linux-only tests (the api SIGTERM test skips on win32) |

### Governance: branch protection, cross-vendor review, release gate

| 验收ID | 版本 | 环境 | 测试或人工步骤 | 期望 | 实际 | 时间 | 证据引用 | 未决项 |
|---|---|---|---|---|---|---|---|---|
| M2-AC01/3 branch protection (today) | `main` settings on GitHub | GitHub repository settings; real | Read the protection of `main`: `gh api repos/BELCORT-SDN-BHD/wringy/branches/main/protection` | Report what is enforced, without claiming more | Required status checks: `["planning"]` only (app id 15368), `strict: true`; a pull request is required with 0 approving reviews and stale reviews dismissed; `enforce_admins` on; linear history and conversation resolution required; force pushes and deletion off; no rulesets. The product checks (`check`, `integration`, `e2e`) are **not** required today, so a red product build could merge | 2026-09-23: orchestrator check (kickoff-package.md §2.1); re-read by the W4 worker at 2026-09-23T00:46:55Z with the same result | [kickoff-package.md](kickoff-package.md) §2.1; `gh api …/branches/main/protection`, `gh api …/rulesets` (0) | D22 applies after the merge (next row) |
| M2-AC01/3 branch protection (after merge, D22) | Not yet applied | GitHub repository settings | An admin, once `app.yml` has run on `main`: `gh api -X PATCH repos/BELCORT-SDN-BHD/wringy/branches/main/protection/required_status_checks -f strict=true -f 'contexts[]=planning' -f 'contexts[]=check' -f 'contexts[]=integration' -f 'contexts[]=e2e'`. `images` stays optional. GitHub's REST reference marks `contexts` deprecated in favour of `checks` (objects with `context` and an optional `app_id`); the equivalent `checks` body pins each context to GitHub Actions (app id 15368, as `planning` is today) | `planning`, `check`, `integration` and `e2e` required; `app.yml` has no `paths:` filter (D22a), so documentation PRs report all four | **NOT EXECUTED**: this needs admin rights and CI green on `main` first; the agent does not change repository settings. Cost: about 15 minutes of admin time (kickoff-package.md §2.2, G5) | Pending | [REST: update status check protection](https://docs.github.com/en/rest/branches/branch-protection?apiVersion=2022-11-28#update-status-check-protection); kickoff-package.md §9.1 D22 | Founder or admin action after merge; re-read the protection afterwards and add a row here |
| M2-AC01/3 cross-vendor review | This PR | — | Founder ruling D23: nothing is enforced; the per-ticket review is the repository's `code-review` skill; the Codex read-only review is at the orchestrator's discretion, saved as a PR comment when it runs | Register what actually ran, never an unrun review | **NOT RUN unless recorded below.** GitHub enforces no review: 0 required approvals and no `CODEOWNERS` (kickoff-package.md §2.1). Automating it would cost about 1 day or more and needs Codex credentials usable in Actions (unverified); accepted open as G8 | 2026-09-23 | [kickoff-package.md](kickoff-package.md) §6.6, §9.1 D23, §10 G8 | The orchestrator adds a row with the PR comment link if the review runs |
| M2-AC01/3 release gate | `feat/m2-01` (W4) | GitHub repository; real | Check for a release gate: GitHub environments, deploy workflows | Report that none exists, without claiming one | **None, by ruling D24**: M2 has no production release. 0 GitHub environments (`gh api repos/BELCORT-SDN-BHD/wringy/environments` → `total_count: 0`, re-read 2026-09-23T00:46:55Z); no deploy workflow: `app.yml` builds the three images with `push: false`, logs in to no registry, and deploys nothing. Building it (a staging GitHub Environment, a deploy workflow of SHA images gated on the required checks) costs about 1–2 days and belongs to M2-09 (G9) | 2026-09-23, W4 worker | [kickoff-package.md](kickoff-package.md) §2.2, §9.1 D24, §10 G9; `.github/workflows/app.yml` | M2-09 |

## W4 gate run

Filled in by the W4 worker at the end of the wave.
