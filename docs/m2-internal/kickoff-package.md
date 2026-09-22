# M2 internal version — kickoff package (开工包)

2026-09-23. Kickoff package for milestone [M2](https://github.com/BELCORT-SDN-BHD/wringy/milestone/2) (可保存数据的内部版本), gate ticket [M2-00 / #14](https://github.com/BELCORT-SDN-BHD/wringy/issues/14) under the [M2 spec](../planning/specs/m2-spec.md). This file is the "可审阅开工包" that M2-AC00/1 asks for. It covers what M1 hands over, what the repository enforces today, and the proposed identity, session, migration, dependency, test, account and workspace contracts. It ends with the decisions and gaps the founder rules on before any heavy implementation starts. Business rules are not redefined here; the sources are [campaign-defaults-v1](../../phase-0/foundation/campaign-defaults-v1.md), the [implementation spec](../../phase-0/foundation/implementation-spec-content-rewards-v1.md) and the [M2 spec](../planning/specs/m2-spec.md). Vocabulary follows [CONTEXT.md](../../CONTEXT.md).

## Status

| Item | State | Source |
|---|---|---|
| Date and scope | 2026-09-23. Prepared for GitHub #14 (M2-00), acceptance M2-AC00/1–3 | `docs/planning/tickets/m2-00.md` L13–L15 |
| Approval | **Unsigned.** M2-00 is `blocked: founder approval required`, `Gate: true`. Nothing in this file is approved or built | `m2-00.md` L27, L29 |
| Branch | `feat/m2-kickoff` at `15df257`. This file is uncommitted until the orchestrator commits it; the frozen commit is the commit that contains it | `git rev-parse --short HEAD` (2026-09-23) |
| Blueprints | Blueprint implemented-state refreshed 2026-09-23, in this branch: `docs/PRD.md` and `docs/ARCHITECTURE.md` now read `implementation_status: m1-prototype-accepted; product-runtime-unbuilt` (uncommitted when this was written) | `git status --short` (2026-09-23) |
| How it was produced | Eight read-only investigations (M1 evidence, governance, identity/org, session/migration, dependencies, test boundary, external accounts, workspace shape). Verifiers checked each one, and their corrections are applied here. No account was created, no GitHub setting changed and no product code written | this preparation run |

**What the founder is asked to do**

1. Review §1–§8, which hold the evidence and the proposals.
2. Rule on every row of §9, and choose "close first" or "accept open" for every row of §10. A row left unruled stays open. The ticket forbids default consent and date inference: "没有明确批准则保持待批准，不能使用默认同意或日期推算" (`m2-00.md` L23).
3. Sign in a comment on #14 with your name, the real date and the frozen commit, following the §11 template.

**What stays blocked until the signature**

- The M2-01 (#16) implementation and everything after it: #21, #26, #27, #29, #31, #32, #33, #34 and #35. `docs/planning/tickets/m2-01.md` L27 names M2-00 as its blocker.
- `m2-spec.md` L83: "最终重型开工批准须通过 M2-00 取得；在此之前仅进行常规规划、只读核验与可行性准备，不启动被该票阻塞的实现。"
- Supplier evidence, fee and fund decisions, real transactions and production release keep their own gates (`m2-00.md` L23).
- 2026-09-16 was planning authorisation only (`m2-00.md` L15, L31).

**Citation convention.** "Orchestrator check 2026-09-23" marks facts the orchestrator verified: the toolchain, CI, branch protection and the Codex lane. `Lnn` is a line in the named file at `15df257`, unless the citation says it comes from the working tree. "Unverified" means no checkable source was found.

## 1. M1 evidence and handoff register

This section covers M2-AC00/1 (M1 experience evidence) and M2-AC01/1: "核对M1-08实际体验确认和P01–P11证据；登记产品仓库、模块归属、规则/设计审批引用及未完成项" (`m2-spec.md` L58).

### 1.1 M1 closure

| Fact | Source |
|---|---|
| Milestone 1 "M1 · 三端交互原型" is closed: 9 closed and 0 open issues, `closed_at` 2026-09-22T17:21:09Z | `gh api repos/:owner/:repo/milestones/1` (2026-09-23) |
| Issues #1–#9 are all CLOSED | `gh issue list --search 'milestone:"M1 · 三端交互原型"' --state all --json number,state` (2026-09-23) |
| Founder acceptance is recorded on #9 by `belcorttao`: "**Founder acceptance — 2026-09-23: PASSED.**" … "This closes the M1 ticket set (#2–#9)." The comment timestamp is 2026-09-22T16:53:19Z (UTC) | `gh issue view 9 --comments` (2026-09-23) |
| Spec #1 closed at 2026-09-22T17:21:08Z with the comment "Spec closed on founder acceptance — 2026-09-23. … The M1 milestone is closed with this comment." | `gh issue view 1 --json state,closedAt,milestone,title`; `gh issue view 1 --comments` (2026-09-23) |

The session asked whether the M1 tickets can be closed. They can, and they already are: nothing remains open on GitHub for M1. `docs/PROGRESS.md` L7 still says "spec #1 left open as the milestone record". That text was committed about 21 minutes before the spec closed (`git log -1 --format="%H %ci" docs/PROGRESS.md` gives `15df257` at 2026-09-22 17:00:24 UTC), so it is stale.

### 1.2 P01–P11 verification

The acceptance run was executed on 2026-09-22 and re-executed after wave 4. `acceptance.spec.ts` reported "**46 passed, 29 skipped, 0 failed**" (`docs/m1-prototype/acceptance-record.md` L10–L22).

Every row was re-checked on 2026-09-23 against the recorded result, its `describe` block in `apps/web/tests/e2e/acceptance.spec.ts` (grep for `describe(`), the cited unit and engine test files, and the screenshots under `docs/m1-prototype/screenshots/`. The last column says what the row constrains in M2.

| Row | Result | `describe` line | Cited unit/engine tests (all exist) | Screenshots (all exist) | Constraint on M2 |
|---|---|---|---|---|---|
| P01 | PASS | L115 | `engine.mainflow`, `engine.conservation` | 2 | Money flows stay demo-only (M2-AC10/3). The M2 fixture seed carries no money |
| P02 | PASS | L229 | `engine.campaign`, `features/merchant/campaign-form.test.ts` | 4 | The defaults are a hand copy (`apps/web/src/domain/rules.ts` L37–L60). M2-05 must take them from the canonical source (M2-AC05/1) |
| P03 | PASS | L289 | none cited (navigation) | 4 | M2-02 replaces the simulated Google entry. There is still no email, password or OTP control |
| P04 | PASS | L328 | `engine.submission` | 4 | "Unknown is never 0" also applies to new status screens, such as the worker-health card |
| P05 | PASS | L378 | `engine.claim`, `money` | 4 | Claims stay closed in M2 (M2-AC10/3) |
| P06 | PASS | L424 | `engine.claim` | 4 | Same as P05 |
| P07 | PASS | L479 | `engine.review`, `engine.claim` | 4 | Review writes are closed in M2 (Implementation Decision 5, `m2-spec.md` L38) |
| P08 | PASS | L541 | `engine.payout`, `store/selectors.test.ts` | 4 | Payouts are closed in M2 |
| P09 | PASS (5 tests at L590/632/672/713/747) | L586 | `engine.deadlines` (21 tests), `engine.campaign` | 10 | Kept as a demo regression suite |
| P10 | PASS (tests at L793/818) | L789 | `i18n/messages.test.ts`, `lib/audit-copy.test.ts`, `lib/reason-copy.test.ts` | 12, including 6 at 320 px | The new `(internal)` root layout must set `<html lang>`. `/internal` must join the trilingual walk, because `tests/e2e/i18n.spec.ts` L74 lists its routes explicitly |
| P11 | PASS (3 tests) | L866 | none cited (reset and cold start) | 6 | `/internal` must never mount the demo store (`components/app/providers.tsx` L38 calls `hydrateDemoStore()`) |

- The record's "Engine tests:" lines (L72, L91, L117, L129, L143, L179, L203, L253) cite exactly 9 distinct domain test files. `engine.notifications.test.ts` exists, but no row cites it. P03 and P11 cite no engine test, by design.
- The three tests the record cites for the wave-4 join-link fix exist word for word at `apps/web/tests/e2e/shell.spec.ts` L129, L154 and L172.
- A fresh run of `pnpm --filter web test` on 2026-09-23 printed "Test Files 24 passed (24)" and "Tests 322 passed (322)". The record still says "297 passed, 0 failed, 23 files" (L34) and "312 passed, 33 skipped" for e2e (L35). `docs/PROGRESS.md` L7 reports 322 Vitest and 318 Playwright tests. The same commit, `f2eae0a`, last touched both the record and the source, so the record's numbers were already stale when it was committed. The fix is to documentation only.
- `acceptance-record.md` L479–L480 still reads "**Founder confirmation has not happened.** … **NOT EXECUTED**". Until that line is fixed, cite #9 for the founder acceptance, not this file.
- `SCHEMA_VERSION = 2` (`apps/web/src/domain/types.ts` L21) matches the record (L463).

### 1.3 Owner rulings (2026-09-22) verified

| Ruling | Recorded | Test evidence |
|---|---|---|
| (1) The cross-platform independent cap is accepted as recorded. The switch records the permission and changes no amount in M1 | #9 comment "Founder rulings recorded 2026-09-22"; `docs/m1-prototype/kickoff.md` L43–L51; `known-issues.md` L84–L120 | None cited, because the behaviour is unchanged |
| (2) A pending-case deadline extension needs a claimable remainder | same | `engine.deadlines.test.ts` L182 "grants a grace when an open case blocked a claimable remainder past the metering end"; L216 "grants nothing when the case cleared with nothing left to claim" |
| (3) A finally rejected amount stays deducted | same | `engine.deadlines.test.ts` L246 "grants nothing when a finally rejected case leaves no new amount" |

### 1.4 Module ownership as found

| Path | Owns | Source |
|---|---|---|
| `apps/web/src/domain/` | The pure TypeScript demo engine. `applyCommand` is defined at `engine.ts` L2576 | `kickoff.md` L18 |
| `apps/web/src/store/demo-store.ts` L127 | The only production call of `applyCommand`. `types.ts` L619 says: "the store is the only caller of applyCommand" | `grep -rn applyCommand apps/web/src` |
| `apps/web/src/features/{merchant,creator,ops}/` | The role features | `kickoff.md` L23 |

The kickoff calls the engine the "replaceable data access layer: M2 swaps the store's engine call for Fastify calls" (`kickoff.md` L18). In practice the change is wider than the store. Outside the domain folder, 61 files import `@/domain`, 15 dispatch synchronously and 29 read the demo store. Some components also import runtime values: `DEFAULT_RULES`, `normalizePostUrl`, `createSeedState` and `checkPermission`. These counts come from a grep of `apps/web/src` on 2026-09-23; §8.6 gives the details.

### 1.5 Rule and design approvals M2 must cite

| Source | Approved | Citation |
|---|---|---|
| campaign-defaults-v1 core defaults | 2026-09-14 | `phase-0/foundation/campaign-defaults-v1.md` L3 |
| campaign-defaults-v1, five supplementary items ("可以") | 2026-09-14 | same file L6 |
| campaign-defaults-v1, six more supplementary rules ("好的") | 2026-09-15 | same file L48–L50 |
| full-stack-proposal-v1 stack direction ("好的就这样吧") | 2026-09-15 | `phase-0/foundation/full-stack-proposal-v1.md` L3, L86, L99 |
| design-system-v2 scope (Linear + shadcn only) | 2026-09-11 | `phase-0/foundation/design-system-v2/README.md` L3 |
| design-system-v2 root contract (the three roles share one system) | 2026-09-14 | same README L7 |
| localization-v1 language direction (en-MY, ms-MY, zh-Hans-MY) | 2026-09-11 | `phase-0/foundation/localization-v1.md` L3, L7 |

### 1.6 Inherited items: where each M1 item lands

| M1 item | Source | Disposition in M2 | Lands in |
|---|---|---|---|
| `connection_invalid` cannot be reached from the submit form | `known-issues.md` L56; `engine.submission.test.ts` L72 | Stays unreachable, because M2 has no real platform connections | Out of scope; M4 (真实接口接入) |
| The merchant "no campaigns at all" empty state cannot be reached | `known-issues.md` L61 | Becomes reachable once real orgs start empty. Needs one added test | M2-05 (M2-AC05) |
| The mobile nav sheet's accessible name is vendor English ("Sidebar") | `known-issues.md` L68–L76 | Conflicts with M2-AC04/3 and with the no-reskinning rule in the design-system-v2 README (L18) | D25 |
| The ms-MY and zh-Hans-MY copy are drafts with no native review | `known-issues.md` L44; `localization-v1.md` L58 | Professional review is due before launch | Out of scope; M5 gate |
| `/campaigns/[id]` metadata comes from the baseline seed | `known-issues.md` L152 | The metadata will come from the API | M2-06 (M2-AC06/2) |
| No "last day of submission window" preset; reduced motion honoured by a global rule only; no dark theme; `@tanstack/react-table` not installed | `known-issues.md` L134, L142, L150, L155 | No M2 AC needs these | Out of scope |
| The Turbopack dev server can die on a cold parallel run | `known-issues.md` L176 | Warm up `/internal` before the multi-server e2e run | M2-01 W3 |
| Five testing limitations: Chromium only, 320 px spot checks, viewport-clipped screenshots, no visual-regression baseline, no automated accessibility audit | `known-issues.md` "Testing limitations" | No M2 ticket commits to closing them (grep of `m2-01/04/09/10.md`) | D26 |
| The demo toolbar can switch into the ops reviewer or finance identity | `store/use-become-role.ts`; `components/app/demo-toolbar.tsx` L405–L416; `kickoff.md` L38 | Removed from the internal build. Ops access comes only from a granted capability | M2-02 / M2-03 |
| Merchants can review content | `domain/permissions.ts` L57–L66 | Review writes are closed in M2, with no server route | M2-07 / M2-10 (M2-AC10/3) |
| Only the first org is ever used | `permissions.ts` L37 | The user can switch across every membership they hold | M2-03 (D6) |
| Denied commands leave no audit entry | `engine.ts` L2591, L2610 | The server audits every denial | M2-03 (M2-AC03/3) |
| The locale lives only on the browser session | `types.ts` L63–L73 | An account preference is added | M2-04 |
| Stale M1 records: `acceptance-record.md` L34, L35 and L479; `PROGRESS.md` L7 | §1.1, §1.2 | A documentation fix of about 15 minutes | M2-AC01/1 |
| The demo state lives in browser `localStorage` | `kickoff.md` L40 | Must never be imported into the formal ledger | M2-10 (M2-AC10/3) |

## 2. Repository governance audit

This section covers the repository-governance part of M2-AC00/1 and the checks M2-AC01/3 names: "建立独立工作区和CI的类型、单元、依赖方向、spec引用及验收映射检查；核验分支保护、跨厂商审阅和发布门禁，未能配置项报告成本及处置，不伪称已生效" (`m2-spec.md` L58).

### 2.1 Current state

| Area | State on 2026-09-23 | Source |
|---|---|---|
| Branch protection on `main` | A PR is required. Required status contexts: `["planning"]` only, with strict mode on. Required approvals: 0. Stale reviews are dismissed. `enforce_admins` is on. Linear history and conversation resolution are required. Force push and deletion are disabled. No rulesets | orchestrator check 2026-09-23 (`gh api …/branches/main/protection`) |
| Contexts a real PR reports | `planning`, `check` and `e2e`; the last two are not required | `gh pr view 77 --json statusCheckRollup` |
| Code owners | No `CODEOWNERS` file | `find . -iname CODEOWNERS -not -path "*/node_modules/*"` (no output) |
| Visibility and access | Public; 3 admin collaborators and 1 with read access | orchestrator check 2026-09-23 |
| `.github/workflows/web.yml` | Job `check`: frozen install, lint, typecheck, `vitest run`, `next build`. Job `e2e`: Playwright on Chromium, then uploads the report (L60). Runs on Node 20 (L31, L52). Triggers only on changes to `apps/**`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` or the workflow file itself. No `services` block | `.github/workflows/web.yml` |
| `.github/workflows/planning.yml` | Python 3.12 runs `scripts/check-planning.py` on every push to `main` and on every PR, with no path filter | `.github/workflows/planning.yml` |
| `scripts/check-planning.py` | 25 lines. Checks that the required files exist, that `catalog.json` IDs are unique and resolve to files, that milestones are M1–M5, and that `blocked_by` has no cycles. This covers the "spec引用" (spec reference) check. It does not map tests to ACs (验收映射) | `wc -l scripts/check-planning.py`; full read |
| Planning check result | "Validated 5 specifications and 60 tasks; dependencies acyclic." | `python -X utf8 scripts/check-planning.py` (blueprint refresh, 2026-09-23) |
| Database in CI | No PostgreSQL service and no integration job | `grep -rn "postgres\|services:" .github/workflows/*.yml` (no match) |
| Dependency-direction check | No boundaries plugin and no dependency-cruiser | `apps/web/eslint.config.mjs`; grep of both `package.json` files |
| Cross-vendor review | Only the PR template field "Cross-vendor review evidence or explicit blocker:". No workflow or check runs a review. Codex CLI 0.153.4 is installed locally, and `.codex/hooks.json` wires only the graphify hook | `.github/pull_request_template.md`; `grep -rli codex .github/` (no match); orchestrator check 2026-09-23 |
| Release gate | 0 GitHub environments and no deploy workflow | `gh api repos/:owner/:repo/environments` → `total_count: 0`; `grep -il "deploy\|environment:" .github/workflows/*.yml` (no match) |
| Secret hygiene | `.gitignore` L5–L9 excludes `.env`, `.env.*` (but allows `.env.example`), `*.pem` and `*.key`. Secret scanning and push protection are enabled. Dependabot security updates are disabled | `.gitignore`; `gh api repos/:owner/:repo --jq '{security_and_analysis, visibility}'` |
| Node version pin | No `.nvmrc`, no `.npmrc`, and no `engines` field in either `package.json` | `ls -a`; `grep -n engines package.json apps/web/package.json` |
| Workspace | `pnpm-workspace.yaml` declares `apps/*`, and `apps/` holds only `web` | `pnpm-workspace.yaml`; `ls apps` |

Of the three checks M2-AC01/3 names, none may be claimed as in effect when it is not: 分支保护 (branch protection) exists but requires only `planning`; 跨厂商审阅 (cross-vendor review) is an unenforced PR-template convention; 发布门禁 (release gate) does not exist.

### 2.2 Gap register

| Gap | Cost | Who acts | Proposed disposition |
|---|---|---|---|
| The web `check` and `e2e` jobs are not required. If they were required with today's path filters, they would stay pending on unrelated PRs and block the merge. GitHub's troubleshooting page says a check skipped by path filtering "will remain in a Pending state" (search excerpt, not fetched in full) | About 1–2 h of design, about 15 min of admin time (`enforce_admins` is on), and about 0.1 agent-day | The founder rules (D22); an admin applies it | Close in M2-01 W4 |
| No human review is required, and there is one active human | A judgment call, not a build cost | Founder | Accept for M2. Required CI checks carry the enforcement |
| No dependency-direction check | 2–4 h | Agent | Close in M2-01 (D31) |
| No acceptance-mapping check (验收映射) | About 0.25 agent-day. There is nothing to map until tests named with `M2-AC` exist | Agent | Close in M2-01 W4: extend `check-planning.py` or add a script so that an in-progress ticket fails when an AC sub-item has neither a test title nor a manual-evidence row |
| No PostgreSQL service, integration job or API/worker CI | Built up from M2-01 to M2-08 | Agent | A skeleton in M2-01, extended per ticket |
| The cross-vendor review is not machine-checked | 0 for the convention. Automating it costs about 1 day or more and needs Codex credentials that work inside Actions, which is unverified | Founder (D23) | Accept, with a manual review saved on each PR |
| No release gate and no staging environment | About 1–2 days (Render, account separation, a GitHub Environment) | Agent, using the founder's accounts | Defer to M2-09 (D24). M2 has no production deployment ("无生产部署", M2-AC09/3, `m2-spec.md` L66) |
| Dependabot security updates are disabled | About 5 min | Admin | Turn them on (§10) |
| Node 20 is end of life and no version is pinned | See §5 | A human installs Node 24, then the agent pins it | Close in M2-01 W0 |
| `PROGRESS.md` and the acceptance record are stale | 15 min | Agent | A documentation fix under M2-AC01/1 |

## 3. Identity and organisation boundary (proposal)

This is a proposal for the founder to review, not a decision. It feeds M2-02, M2-03, M2-04, M2-06 and M2-07, and M2-08 through D5. Table names follow the implementation-spec draft (`implementation-spec-content-rewards-v1.md` L38–L42). The exact names and paths are fixed at the kickoff code review ("具体实现文件位置在开工代码评审确定", `m2-spec.md` L41). No backend, migration or Supabase code exists yet: `git ls-files | grep -iE "supabase|migration|apps/api|fastify|\.sql$|pg-boss"` matches only `docs/github-migration.json`.

### 3.1 Principles

- **The identity key is the JWT `sub`, never the email.** Supabase's `sub` equals `auth.users.id`. Google's guidance is to "Always use the sub field" ([Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect)).
- **Authorisation never reads user-controlled or stale metadata.** The user can edit `user_metadata`, and `app_metadata` stays stale until the next refresh ([Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)).
- **Membership and grants are re-read from PostgreSQL on every request.** A revocation therefore takes effect on the next request (M2-AC03/2).
- **Grant provenance lives on the current-state row.** Each row records who granted it, when and why, and every change also writes an append-only audit entry. There is no separate grant-event table, following the founder's "不要over design" (`phase-0/founder-inputs.md` L9).
- **The database enforces composition.** Every org-owned child row stores `org_id` and references its parent by `(org_id, id)` (implementation spec L53; Implementation Decision 3, `m2-spec.md` L36).

### 3.2 Entities

| Table | Key columns | Owning module | Constraints |
|---|---|---|---|
| `profiles` (draft L38) | `id` = JWT `sub` = `auth.users.id`; `display_name`; `contact_email`, copied from the verified token at each sign-in and used only for notifications; `locale_pref` (NULL means no explicit choice); `locale_pref_set_at`; `status` | 身份与组织 (`ARCHITECTURE.md` §4 L94) | PK(id). CHECK `locale_pref` ∈ {en-MY, ms-MY, zh-Hans-MY} (draft L38, "偏好限三种代码"). No UNIQUE on email. Whether to add an FK to `auth.users` is IT1 |
| Google account link | No Wringy table. `auth.users` and `auth.identities` belong to Supabase | Supabase Auth, reached through the identity module's token verifier | Google is the only provider; email/password and manual linking are off. The exact setting names are unverified and M2-02 checks them |
| `orgs` | `id`, `name`, `created_by`, `status`, `created_at` | 身份与组织 | PK(id). Ops staff are not modelled as an org |
| `org_members` (draft L38) | PK(org_id, user_id); `role` admin/member; `status`; `grant_basis` org_created/invitation; `invitation_id`; `granted_by`; `granted_at`; removal fields | 身份与组织 | CHECK on role. An org_created row must have `granted_by = user_id` and `role = admin`. An invitation row must have a non-null `invitation_id`. "At least one active admin" is enforced inside the command transaction while holding a lock on the org row |
| `org_invitations` (only if D2 picks invitations) | `org_id`, `invited_by`, `invitee_email_norm`, `role`, `token_hash`, `expires_at`, `status`, `accepted_by`, `accepted_at` | 身份与组织 | Composite FK (org_id, invited_by) → `org_members`. UNIQUE(token_hash). Partial UNIQUE(org_id, invitee_email_norm) WHERE pending. Accepting writes the membership and the audit entry in one transaction |
| `admin_scopes` (draft L39) | `user_id`, `org_id`, `capability` ∈ {review, finance}, `granted_by_operator`, `reason` NOT NULL, `granted_at` | 身份与组织 | PK(user_id, org_id, capability). FK user → `profiles` and FK org → `orgs`, **not** to `org_members` (D5 confirms this reading of "FK成员及组织"). `org_id` is NOT NULL, so there is no implicit global pass (draft L39). The runtime role has SELECT only |
| `platform_grants` (new; D5) | `user_id`, `capability` ∈ {ops_runtime}, `granted_by_operator`, `reason`, `granted_at` | 身份与组织 | PK(user_id, capability). Grants only the M2-AC08/3 failure view and controlled retry, and no reads of drafts, submissions or profiles. The runtime role has SELECT only |
| `account_connections` (draft L42) | `id`, `user_id`, `platform`, `platform_account_id`, `source` fixture/live, `status` verified/conflict_review/invalid/unlinked, `control_evidence_ref` | 投稿与账号验证 (`ARCHITECTURE.md` §4 L96) | The draft's U(user_id, platform, account_id) and U(user_id, id), plus UNIQUE(id, source) and a **partial UNIQUE(source, platform, platform_account_id) WHERE status = verified**. A second claimant therefore goes to `conflict_review` (draft L42; M2-AC07/2) |
| `audit_log` | `occurred_at` (database clock), `actor_kind` user/system/bootstrap, `actor_user_id`, `actor_label`, `context_org_id`, `action`, `target_type`, `target_id`, `outcome` allowed/denied, `denial_code`, `reason`, a before/after summary, `request_id`, `session_ref` (hash of the JWT `session_id`) | Cross-cutting (`ARCHITECTURE.md` L102) | The runtime role has INSERT and SELECT only, which makes the table append-only by privilege (draft L51: "audit只追加…不记录令牌"). CHECK that `denial_code` is present exactly when the outcome is denied. No token, cookie, secret or email is stored. D9 fixes the field set |

Composite constraints on the other M2 tables. Each table arrives with its own ticket (Implementation Decision 4, `m2-spec.md` L37).

| Child table | Composition constraints |
|---|---|
| `campaigns` | FK `org_id`; UNIQUE(org_id, id) (draft L40); UNIQUE(id, source) |
| `campaign_versions` | FK (org_id, campaign_id) → `campaigns`(org_id, id); UNIQUE(org_id, campaign_id, id) (draft L41); cannot change once confirmed |
| `submissions` | FKs on (org_id, campaign_id) and (org_id, campaign_id, version_id); **FK (creator_id, connection_id) → `account_connections`(user_id, id)**; FKs on (campaign_id, source) and (connection_id, source); UNIQUE(campaign_id, platform, post_id) (draft L43) |
| `notifications` | FK recipient → `profiles`; UNIQUE(event_id, recipient_user_id) |
| `request_dedup` | PK(actor_id, route, request_key), plus `org_id` (draft L46) |

### 3.3 Capability matrix

R means read and W means write. Anything not listed is denied.

| Resource / action | Guest | Creator (self) | Merchant admin | Merchant member | ops_runtime | review (org) | finance (org) | Bootstrap operator |
|---|---|---|---|---|---|---|---|---|
| Public list and detail of fixture campaigns (public fields only, M2-AC06/1) | R | R | R | R | R | R | R | – |
| Own profile and locale | – | R/W own | own | own | own | own | own | – |
| Own social connections (fixture) | – | R/W own | – | – | – | – | – | – |
| Submissions | – | Create; R own | R, for their own org's campaigns, limited fields (D8) | Same as admin | – | – in M2 | – | – |
| Org profile | – | Create a new org (D1) | R/W | R | – | – | – | – |
| Members and invitations | – | Accept own invitation | R/W; the last admin cannot be removed | R names and roles | – | – | – | – |
| Campaign drafts | – | – | R/W | R/W (D3) | – | – | – | – |
| Confirm a rule version; simulated publish of a fixture campaign | – | – | W (D3) | – | – | – | – | – |
| Own notifications | – | own | own | own | own | own | own | – |
| Notification and job failures; controlled retry with a reason | – | – | – | – | R/W, failure metadata only (M2-AC08/3) | – | – | – |
| Capability grants | – | – | – | – | – | – | – | Script only, audited |
| Audit | – | – | – | – | R, retry records | – | – | Read through SQL |

The server refuses real publish for everyone (M2-AC05/3). Claims, reviews, appeals, the ledger, obligations and payouts are closed to everyone in M2: there are no routes for them, and no tables beyond what M2 needs (Implementation Decisions 4–5; M2-AC10/3).

Separation tests, named `M2-AC03`: a review grant for org A gives nothing in org B; review and finance each refuse the other's actions; neither can retry notifications; `ops_runtime` cannot read drafts, submissions or profiles; being a merchant admin implies no capability, and holding a capability implies no membership; a crafted request that changes one's own role or grants oneself a capability is refused and audited.

### 3.4 Replacing the M1 demo role switch

The workspace becomes navigation, not authority. Each user has a personal (creator) context plus one per active membership, as listed by `GET /me/workspaces`, and switching changes only the URL; as in M1, switching is not audited (`permissions.ts` L98–L100). Every request is authorised again: a stale tab keeps its org id in the path, the server re-checks the membership, and an object from another org returns 403 with a denial audit entry (M2-AC03/2). Nobody switches into ops, review or finance. `/ops` appears only when `GET /me` lists a grant, and grants come only from the bootstrap script (D4). The demo identity switch (`session.setOpsRole`, `useBecomeRole` and the identity section of the demo toolbar) is removed from the internal build. Sign-in returns to the page it started from instead of jumping to the merchant workspace as M1 does (`sign-in-view.tsx` L92), which also covers returning to the original campaign (M2-AC06/3).

### 3.5 Fixture and live isolation for identity

- **Users are never fixtures.** Every user is a real Google identity, and no seeded user can sign in. Staging needs at least three real Google test accounts: one dual-role, one admin of a second org, and one outsider or ops user (`m2-03.md` L33; `m2-02.md` L33). Tokens signed locally with a test key exist only for integration tests and cannot close M2-AC02 (M2-AC02/3).
- **Each environment has its own Supabase project,** so no staging identity exists in production (`ARCHITECTURE.md` §8 L145; D17).
- **The label never changes.** `source` (fixture or live) is set on `campaigns` and `account_connections`, never changes, and flows through the composite FKs. Fastify registers fixture adapters only outside production. Together with the environment marker (§8.5), this gives the double isolation of Implementation Decision 5 (`m2-spec.md` L38).
- **What M2-AC07 needs.** "Connect simulated account" creates a fixture account owned by the caller; a fixture post from an account that is not one of the caller's verified connections is refused with `OWNERSHIP_UNVERIFIED` (`prd-content-rewards-v2.md` L91); a seeded contested account exercises `conflict_review`; self-submission follows D10.

### 3.6 Identity technical choices (settled at the kickoff code review)

| ID | Choice | Reason |
|---|---|---|
| IT1 | No cross-schema FK from `profiles.id` to `auth.users`. Fastify creates the row after it verifies the token | The migrations must run on plain local PostgreSQL. Supabase's example FK uses `on delete cascade`, which would delete rows the audit depends on ([managing user data](https://supabase.com/docs/guides/auth/managing-user-data)). The alternative is an FK with ON DELETE RESTRICT plus an `auth` stub schema in tests |
| IT2 | Org-scoped API paths carry the org, for example `/orgs/:orgId/...`. The server keeps no "current workspace" | A stale tab or a cached request cannot write into another org (M2-AC03/2) |
| IT3 | Sign-out passes scope `local` explicitly | supabase-js defaults to `global` ([signout](https://supabase.com/docs/guides/auth/signout)), and M2-AC02/2 limits sign-out to the current session |
| IT4 | Denials are audited in their own short transaction, after the business transaction rolls back | M1 drops denials (`engine.ts` L2610); M2-AC03/3 requires them |

### 3.7 Draft clarifications needed after the signature

About one hour of agent documentation work in implementation spec §3 and `ARCHITECTURE.md` §4: whether "profile.id关联托管auth subject" (L38) means a database FK (IT1); the reading of "FK成员及组织" and the new runtime grant (L39, D5); and the added verified-only partial unique on `account_connections` (L42). One risk stays open: Supabase "automatically links identities with the same email address to a single user" ([identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)). Whether that also links a recycled Google Workspace email arriving with a different `sub` is **unverified**; M2-02 either accepts the risk or adds a server check (about 0.5 day).

## 4. Session and migration contract (proposal)

This is a proposal only, and every test named here is unexecuted. It feeds M2-01 (#16), M2-02 (#21) and M2-09 (#34). Vendor facts were read on 2026-09-23. Next.js facts come from the documentation installed with next 16.3.5 under `apps/web/node_modules/next/dist/docs/`.

### 4.1 Responsibilities

| Component | Owns | Must not |
|---|---|---|
| Browser | httpOnly session cookies; same-origin requests | Hold Supabase tokens in JS; call the Supabase Data API or business tables; state its own role or org |
| Next.js `proxy.ts` | Refreshing the session on matched private routes. Next 16 renamed middleware to proxy, and proxy runs on Node only (`…/03-file-conventions/proxy.md` L11, L255, L806) | Authorise; query the database; run on public cacheable paths. The Next docs limit proxy to optimistic checks (`…/02-guides/authentication.md` L1026–L1033) |
| Next.js route handlers and server functions | `/auth/sign-in`, `/auth/callback`, `/auth/sign-out`, and the thin proxy to Fastify, which sends `Authorization: Bearer <access token>` (write path: D33) | Implement business rules; trust identity headers sent by the client |
| Server Components | Reading the session through a request-level client; calling Fastify for data | Set cookies (`…/04-functions/cookies.md` L76–L83) |
| Fastify | Verifying the token on every request; resolving the actor from `sub`; re-checking membership and capability in PostgreSQL; checking session liveness on writes | Accept identity from Next headers or the body; use the Supabase `role` claim or metadata as an app role |

### 4.2 Login flow (PKCE, Google only)

1. "Continue with Google" POSTs to `/auth/sign-in` with a `next` parameter and passes the Origin rule (§4.5).
2. The handler creates a request-level `createServerClient` (cookies `getAll`/`setAll`) and calls `signInWithOAuth({ provider: 'google', options: { redirectTo: APP_ORIGIN + '/auth/callback?next=…' } })`. It passes no `scopes`, `access_type` or `prompt`, then answers 303. Starting sign-in on the server is unverified and is confirmed in the M2-02 spike.
3. By default, Supabase's Google provider requests only `openid`, `userinfo.email` and `userinfo.profile` ([Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google)). No YouTube grant is therefore possible (M2-AC02/1), and Testing-mode refresh tokens stay exempt from the 7-day expiry (§7.2).
4. `GET /auth/callback` calls `exchangeCodeForSession(code)` and redirects to `APP_ORIGIN + next`, where `next` must be a same-app path. The redirect is never built from `x-forwarded-host`, which the vendor sample does. Provider tokens are never stored or logged.
5. The first verified request upserts `profiles`, keyed by `sub` (§3.2). The session report's working name `user_account` is replaced by the draft name.
6. Each outcome shows a result in all three languages ([error codes](https://supabase.com/docs/guides/auth/debugging/error-codes)): cancel (`access_denied`) → 登录已取消; `flow_state_expired` → 登录已过期，请重试; `bad_code_verifier` → 请在同一浏览器完成登录; refresh failure → a 会话已结束 prompt that keeps the page context.

### 4.3 Cookies and refresh

- **Cookie options.** `httpOnly: true`, `secure: true` outside localhost, `sameSite: 'lax'`, `path: '/'`, and no `Domain`. The `@supabase/ssr` default is `httpOnly: false`, because the library assumes a browser client (Context7 `/supabase/ssr` `DEFAULT_COOKIE_OPTIONS`). Wringy creates no browser Supabase client, so `httpOnly` should work; the M2-02 spike confirms it.
- **What `proxy.ts` does.** It creates the client per request: "Always initialize the Supabase client inside the request handler" ([advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)). It calls `getClaims()`, copies refreshed cookies onto both the request and the response, and applies the `Cache-Control`, `Expires` and `Pragma` headers handed to `setAll` ([Next.js guide](https://supabase.com/docs/guides/auth/server-side/nextjs)).
- **`getSession()` is never trusted on the server.** With an ES256 key, `getClaims()` verifies locally against the cached JWKS. With HS256, it would call the Auth server on every request ([getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims)).
- **Public campaign paths** sit outside the proxy matcher. They read no cookies and never send `Set-Cookie` (M2-AC06/2).
- **Concurrent tabs** rely on the 10-second refresh-token reuse interval ([sessions](https://supabase.com/docs/guides/auth/sessions)), which a test covers.

### 4.4 Fastify token verification

Fastify verifies asymmetric ES256 tokens through the JWKS at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. The algorithm allow-list rejects HS256, so no shared JWT secret exists anywhere. Supabase "strongly recommend[s] against" shared-secret verification ([JWTs](https://supabase.com/docs/guides/auth/jwts)), and new projects have used asymmetric keys by default since 2025-10-01 ([blog](https://supabase.com/blog/jwt-signing-keys)).

The library is `jose` 6.2.12, for two reasons. Supabase's own example uses it, and it keeps the JWKS URL fixed in config. The `@fastify/jwt` README example instead derives the key domain from the unverified `iss` ([fastify-jwt](https://github.com/fastify/fastify-jwt)).

```ts
const ISSUER = `${SUPABASE_URL}/auth/v1`
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`)) // defaults: cache 10 min, cooldown 30 s, timeout 5 s
const { payload } = await jwtVerify(token, JWKS, {
  issuer: ISSUER, audience: 'authenticated', algorithms: ['ES256'],
  requiredClaims: ['sub', 'exp', 'iat', 'session_id', 'role', 'aal'], clockTolerance: 5,
})
if (payload.role !== 'authenticated' || payload.is_anonymous === true || 'client_id' in payload) reject(401)
```

The options and defaults come from Context7 `/panva/jose`, and the claim set from [JWT fields](https://supabase.com/docs/guides/auth/jwt-fields).

| Claim or input | Use |
|---|---|
| `sub` | The only identity, mapped to `profiles.id` |
| `session_id` | The liveness check on writes (§4.6), and the audit (hashed) |
| `exp`, `iat`, `iss`, `aud`, signature | Verified on every request |
| `aal`, `amr` | Recorded, but not used for grants in M2 |
| `role` | Must equal `authenticated`. It is a Postgres role, not a Wringy role |
| `client_id` present | Rejected. It marks tokens from Supabase's OAuth-server feature, which stays disabled |
| `email` | Display and notifications only |
| `user_metadata`, `app_metadata` | Never used for authorisation |
| `X-User-*`, `X-Role`, or `userId`/`orgId`/`role` in the body | Ignored. Org and capability come from the database (M2-AC03/2) |

### 4.5 CSRF and Origin

Next.js checks Origin automatically only for Server Actions (`…/02-guides/data-security.md` L544–L552). The rule below applies to `/auth/sign-in`, `/auth/sign-out` and every non-GET/HEAD call proxied through a route handler:

1. Reject with 403 unless `Origin` is on the `APP_ORIGINS` allow-list, which comes from env and is never derived from `Host`.
2. If `Origin` is absent, accept only `Sec-Fetch-Site: same-origin`.
3. `GET /auth/sign-out` returns 405.
4. A rejected request never reaches Fastify.

PKCE protects `/auth/callback`, because the verifier cookie is bound to the browser that started sign-in. Fastify is reached only server-to-server with a Bearer token and reads no cookies. Whether it is reachable only over Render's private network is **unverified** and is checked in M2-09.

### 4.6 Logout and revocation

- **Logout.** `POST /auth/sign-out` calls `signOut({ scope: 'local' })`. The scope is passed explicitly because supabase-js defaults to `global` ([signout](https://supabase.com/docs/guides/auth/signout)). The response clears cookies, sends `no-store`, and redirects with 303 to a page that says 已退出此设备；其他设备上的登录不受影响 (M2-AC02/2: "其他设备作用域明示").
- **Why the server must check.** A revoked session's access token stays valid until `exp` (same page). `docs/planning/tickets/m2-02.md` L9 asks that protected writes stop after logout, which is stricter than M2-AC02/2's reservation for fund-sensitive commands.
- **Contract.** Every state-changing Fastify command checks session liveness inside its transaction (`requireLiveSession`), which satisfies both texts. Reads rely on the JWT alone, so they stay valid for at most the access-token lifetime. Fund-sensitive commands in M3 reuse the same guard.
- **Mechanism A (preferred).** A `SECURITY DEFINER` function, created by `postgres` in the platform bootstrap with `search_path=''`, returns whether `auth.sessions` has a row for the `session_id` and `sub`. Only the API role gets EXECUTE on it ([sessions](https://supabase.com/docs/guides/auth/sessions)). Whether this still works after the [2025-04-21 auth-schema restrictions](https://github.com/orgs/supabase/discussions/34270) is **unverified**; a one-hour spike in M2-02 settles it.
- **Mechanism B (fallback).** Call `GET /auth/v1/user` with the user's token and the publishable key. For a signed-out session it fails with `session_not_found` ([error codes](https://supabase.com/docs/guides/auth/debugging/error-codes)). This costs one network hop per write and needs no secret key.
- **Tests.** Local and CI databases get a stub `auth.sessions(id, user_id)` from the test bootstrap, not from the app migrations. A staging contract test proves that the real table still matches.

### 4.7 Cache rules

| Response | Required headers | Basis |
|---|---|---|
| Any response with `Set-Cookie` | `private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0`, `Pragma: no-cache` | The headers handed to `setAll` ([Next.js guide](https://supabase.com/docs/guides/auth/server-side/nextjs)) |
| Dynamic private pages | The Next default, `private, no-cache, no-store, max-age=0, must-revalidate` | `…/02-guides/self-hosting.md` L99 |
| Proxied GET | Dynamic by default since 15.0 (`…/route.md` L669); set `private, no-store` explicitly anyway | Defence in depth |
| Fastify authenticated responses | `private, no-store`, `Vary: Authorization` | Contract |
| Public campaign pages | May be static or ISR with `s-maxage` (`…/cdn-caching.md` L22–L24), but only with public fields, no cookies read and no `Set-Cookie` | M2-AC06/1–2 |
| Forbidden | `use cache`, `revalidate` or ISR on any route that reads cookies or the session | A cached `Set-Cookie` can sign the next visitor in as someone else ([advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)). `apps/web/next.config.ts` enables no `cacheComponents` today |

No CDN sits in front of M2. Adding one means re-running the shared-cache tests.

### 4.8 Supabase Auth checklist

Each environment records this checklist as M2-01/M2-02 evidence. Only the Google provider is enabled; email sign-in (including magic link and OTP), phone, anonymous sign-in, manual identity linking and the OAuth-server feature are all off. The Site URL is `APP_ORIGIN`, and the redirect allow-list holds exact callback URLs, with wildcards only for local development. The current signing key is ES256, and the access-token lifetime is the default 1 hour (D14 covers the other session controls). Each environment has its own Google OAuth client, whose consent screen lists only the default scopes. The web environment has no `sb_secret_` key; the bundle and log scans belong to M2-AC01/2.

### 4.9 M2-AC02 test list (all unexecuted)

Layers: **API-int** is Vitest, Fastify and real PostgreSQL with a locally generated ES256 JWKS; **Web-int** is route-handler tests against `next start`; **E2E** is Playwright; **Real** uses the Supabase test project and a Google test account, recorded as evidence. Simulated tests alone cannot close the ticket (`m2-spec.md` L59). Each test name starts with its sub-item and theme, for example `M2-AC02/3 forged: …`.

| Layer | Tests |
|---|---|
| API-int | **forged:** a token signed by an unknown key; `alg=none`, and HS256 signed with the publishable key; wrong `iss` or `aud`, missing `sub` or `session_id`, `role` other than authenticated, `is_anonymous`, or a `client_id` present → 401; `X-User-Id`, `X-Role` and body `userId`/`orgId` are ignored; a valid token of user A cannot act on user B's org. **stale:** an expired token → 401 `auth.expired` (also E2E: re-login keeps the context). **revoked:** `requireLiveSession` rejects a reserved fund-sensitive stub for a missing session |
| API-int + Real | **revoked:** a write with the old, unexpired token after local sign-out → 401 `session.revoked` |
| Web-int | **origin:** `Origin: https://evil.example` → 403 with no upstream call; no Origin plus `Sec-Fetch-Site: cross-site` → 403. **callback:** `next=//evil.example`, `next=https://evil.example` and `X-Forwarded-Host` never leave `APP_ORIGIN`. **cache:** every `Set-Cookie` response is private and no-store; user A refreshes, then user B through an RFC 9111 caching proxy receives nothing of A's (`http-cache-semantics` 4.2.0 locally, repeated on staging in M2-09); a public page with an expired session cookie returns no `Set-Cookie` and no user data |
| Web-int + E2E | **origin:** a cross-site POST to `/auth/sign-out` → 403, and `GET` → 405. **callback:** a missing code, `access_denied`, `flow_state_expired` and `bad_code_verifier` each show a localized page |
| Web-int + Real | **scopes:** the authorize URL asks only for `openid email profile` |
| E2E | **isolation:** two browser contexts refreshing at once never swap identities. **logout:** the back button after sign-out shows no private data |
| E2E + Real | **refresh:** two tabs refresh together and both stay signed in |
| Real | **scope:** local sign-out in browser A leaves browser B signed in and able to write. **bridge:** session liveness works against the real `auth.sessions` (Mechanism A or B). **stale:** a reused refresh token outside the reuse interval ends the session. **login:** a real Google sign-in lands on the original campaign page |
| CI | **isolation:** a check forbids a module-level Supabase client |

No verified method exists yet to automate a real Google sign-in in Playwright, so the Real rows are recorded as manual or semi-manual steps.

### 4.10 Migration tool

| Tool (npm, 2026-09-23) | SQL files | Windows without Docker | Verdict |
|---|---|---|---|
| **node-pg-migrate 9.0.0** (Node ≥20.11.0; peer `pg` <9) | Yes: `-- Up/Down Migration` markers or `.up.sql`/`.down.sql` files | Pure Node, on the same `pg` driver | **Recommended.** Advisory lock, configurable migrations table, single transaction, dry run, and a programmatic `runner()` for test setup (Context7 `/websites/salsita_github_io_node-pg-migrate`; `docs/src/cli.md` L183–L192) |
| dbmate 2.36.0 | Yes | A Go binary shipped through npm | Fallback. CLI only, and its `schema.sql` dump is silently skipped without `pg_dump` ([dbmate](https://github.com/amacneil/dbmate)) |
| graphile-migrate 1.4.1 (2.0.0-rc.5) | Roll-forward only | Node | Reset needs a superuser `ROOT_DATABASE_URL`, and Supabase's `postgres` is not a superuser ([roles-superuser](https://supabase.com/docs/guides/database/postgres/roles-superuser)) |
| Supabase CLI 2.117.0 | Yes | The local stack, `db pull` and `db diff` need Docker, which is not installed | Couples the tests to Docker. Whether `db push` alone needs Docker is unverified |
| A plain `psql` runner | Yes | `psql` is not installed | Tracking and locking would have to be hand-built |

Rules: SQL files only (CI rejects `.js` and `.ts` migrations); down sections are optional and run only locally, because a staging rollback redeploys the previous image instead (§8.9); migrations never run at app boot.

### 4.11 Roles and schemas

The role and schema names below are illustrative; the kickoff code review fixes them.

| Role | Owns or may do | Connects from |
|---|---|---|
| `postgres` (Supabase admin, not a superuser) | The platform bootstrap only: roles, schemas and the session-liveness function. The founder or a named operator holds its credentials, which never go into app env | A manual or CI bootstrap job |
| Migrator login (`wringy_migrator`; on Supabase possibly `postgres`, which is unverified) | Owns `app` (business), `ops` (environment marker and heartbeat) and the migrations table, and `pgboss` as proposed in §8.4. Each migration writes its own per-table GRANTs | A CI or deploy step |
| API login (group `wringy_api`) | `USAGE` on `app`. DML follows a reviewed grant manifest. INSERT and SELECT only on immutable version tables (Implementation Decision 3). No `CREATE`. On `auth`, only EXECUTE on the liveness function. No `pgboss` access; the API writes only outbox rows | Fastify |
| Worker login (group `wringy_worker`) | pg-boss DML, `app.outbox` and the notification tables, and heartbeat writes. No other DDL; whether it owns `pgboss` is D33 | Worker |
| `anon`, `authenticated`, `service_role` | **No grants** on `app`, `ops` or `pgboss`. `app` is not in the Exposed schemas list: custom schemas are neither exposed nor granted by default ([custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)). Supabase exposes `public` by default, so nothing goes in `public` | — |

RLS is not the authorisation mechanism for `app` tables. All access goes through Fastify. A CI test compares `has_table_privilege` for every role against the checked-in manifest: `M2-AC01/2 runtime role privileges match reviewed grant manifest`.

### 4.12 Connection modes

| Process | Connection | Why |
|---|---|---|
| Fastify `pg.Pool` | Supavisor **session** mode on `:5432`, user `<role>.<project-ref>` ([tenant-or-user-not-found](https://supabase.com/docs/guides/troubleshooting/tenant-or-user-not-found)), `sslmode=verify-full` | Direct connections are IPv6 by default, and Supabase lists Render and GitHub Actions as IPv4-only ([IPv4/IPv6](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP)). Session mode keeps prepared statements |
| Worker pool and outbox relay | Session mode, as the worker role | Needs session state |
| LISTEN (pg-boss `useListenNotify`, SSE invalidation) | One dedicated, session-pinned connection, never transaction mode ([connecting](https://supabase.com/docs/guides/database/connecting-to-postgres)) | Whether LISTEN works through the session pooler is **unverified**; M2-09 tests it. The fallback is the IPv4 add-on with a direct connection (D19), and pg-boss falls back to polling |
| Migrations | Session mode, as the migrator | The advisory lock is session-level |
| Local and CI tests | Vanilla PostgreSQL 17 (§6.2) | No Docker or psql locally |

M2-09 measures the connection budget: pool max × replicas, plus listeners, plus one migrator, plus headroom for Supabase's own services. The total stays within about 80% of max connections ([connection management](https://supabase.com/docs/guides/database/connection-management)). The same rule appears in `full-stack-proposal-v1.md` L92 and L113.

### 4.13 Compatible-then-remove rule (M2-AC09/3)

1. Expand, then migrate, then contract, with at least one release between expand and contract. App N runs on schemas N and N+1, and app N−1 runs on schema N.
2. An expand step may add tables, nullable columns, columns with defaults and indexes, and may add a constraint as `NOT VALID` and validate it later.
3. The release that stops using an object must not also `DROP` it, `RENAME` it, `ALTER … TYPE` it, or add `NOT NULL` without a backfill. A CI lint rejects these unless the file header names the expand migration that already shipped (`-- contract-of: <id>`).
4. pg-boss is pinned to an exact version, and each bump ships in its own release.
5. Drill: deploy N+1, write data, redeploy image N, and show that N still reads and writes and that N+1's rows survive (`M2-AC09/3 app rollback over expand migration keeps saved data`). The worker drains and re-claims its jobs (`M2-AC09/3 worker drain and re-claim`).

## 5. Supported dependency intersection (proposal)

M2-AC01/2 has four parts, all required ("所有子条件均满足才通过该ID", `m2-spec.md` L53): (1) 锁定受支持依赖交集; (2) after a fresh migration, a page → Fastify → PostgreSQL read succeeds; (3) 迁移账户与运行账户分权; (4) no secrets in the browser bundle or logs. This section researches part 1 only. Parts 2–4 are M2-01 implementation work, blocked by M2-00. Their designs are in §4.11, §8.4 and §8.5, building on `ARCHITECTURE.md` L84 ("服务端密钥不进浏览器；迁移账号、运行账号及队列 schema 权限分离") and `full-stack-proposal-v1.md` L46 and L113.

### 5.1 Node.js release status

Source: [nodejs/Release schedule.json](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json), fetched 2026-09-23.

| Major | Phase on 2026-09-23 | LTS start | Maintenance start | End of life |
|---|---|---|---|---|
| 20.x | End of life | 2023-10-24 | 2024-10-22 | 2026-04-30 |
| 22.x | Maintenance LTS | 2024-10-29 | 2025-10-21 | 2027-04-30 |
| 24.x | Active LTS | 2025-10-28 | 2026-10-20 | 2028-04-30 |
| 26.x | Current, not yet LTS | 2026-10-28 | 2027-10-20 | 2029-04-30 |

This machine runs Node v20.19.5, and CI pins `node-version: 20` (`web.yml` L31, L52) (orchestrator check 2026-09-23). Both run on an end-of-life runtime.

### 5.2 What forces the floor above Node 20

| Package | Latest | `engines.node` |
|---|---|---|
| pg-boss | 12.33.5 | ≥22.12.0. The `maint-v10` line (10.4.2) needs only ≥20 |
| @supabase/supabase-js | 2.117.0 | ≥22.0.0. `@supabase/ssr` 0.12.7 has it as a peer dependency (`^2.114.0`) |
| dependency-cruiser | 18.4.0 | ^22 ∥ ^24 ∥ ≥26. The 16.x and 17.x lines accept Node 20 |

Source: `npm view <pkg> version engines dist-tags --json` (2026-09-23). Staying on Node 20 would force pg-boss's maintenance line and an older supabase-js, and would keep an unsupported runtime.

### 5.3 Pinned intersection

| Layer | Pin | Node requirement | Source |
|---|---|---|---|
| Node.js | 24.x, specifically 24.21.0 | — | Active LTS until 2028-04-30, and Render's default for new services ([render.com/docs/node-version](https://render.com/docs/node-version)). nodejs.org/dist/index.json dates v24.21.0 to 2026-09-07 |
| PostgreSQL | 17 (local, CI, staging) | — | A Supabase changelog post of 2026-05-18: "Postgres 17 is what we currently default to on the Supabase platform" ([changelog](https://supabase.com/changelog/46080-self-hosted-supabase-upgrading-from-pg-15-to-17-breaking-change)). Supabase's canonical upgrading guide does not say ([upgrading](https://supabase.com/docs/guides/platform/upgrading)), so re-check with `select version()` on the M2-02 project. pg-boss needs ≥13 |
| next | 16.3.5 (installed; 16.3.6 is published) | ≥20.9.0 | `apps/web/node_modules/next/package.json` |
| fastify | 5.12.5 (6.0.0-alpha.4 is on the `next` tag) | 20/22/24/26, per its LTS table | [LTS.md L63](https://raw.githubusercontent.com/fastify/fastify/main/docs/Reference/LTS.md). The fastify.dev page still lists only 20 and 22 |
| pg-boss | 12.33.5 | ≥22.12.0 | npm view |
| @supabase/supabase-js / @supabase/ssr | 2.117.0 / 0.12.7 | ≥22.0.0 | npm view |
| pg | 8.23.0 | ≥16 | npm view |
| jose | 6.2.12 | None declared | npm view |
| node-pg-migrate | 9.0.0 | ≥20.11.0 | npm view |
| zod / @fastify/type-provider-zod | 4.6.5 / 1.0.0 | Peers: zod ≥4.2.0, fastify ^5.5.0 | npm view |
| dependency-cruiser | 18.4.0 | ^22 ∥ ^24 ∥ ≥26 | npm view |
| eslint-plugin-boundaries (fallback) | 7.2.0 | ≥18.18 | npm view |
| vitest | 4.1.11 (unchanged) | ^20 ∥ ^22 ∥ ≥24 | npm view |
| @playwright/test | 1.63.0 (unchanged) | ≥20 | npm view |
| embedded-postgres and @embedded-postgres/windows-x64 | 17.10.0-beta.17, not the `latest` tag 18.4.0-beta.17 (a PostgreSQL 18 beta) | ≥16 | npm view. Every published version carries a `-beta` suffix |
| tsx | 4.23.15 | ≥18 | npm view |
| `@types/node` | ^24 (today ^20, at `apps/web/package.json` L44) | — | `npm view @types/node@24` → 24.13.6 |
| pg-mem | Excluded, because the spec forbids replacing the database | — | `m2-spec.md` L46 |

### 5.4 Changes needed (none applied)

| Item | Now | Change |
|---|---|---|
| Local Node | v20.19.5 | A human installs Node 24, or pnpm pins it per repo (§5.5) |
| Root `.npmrc` | Absent | `use-node-version=24.21.0`, `engine-strict=true` |
| `engines.node` (root and apps) | Absent | `">=24 <25"` |
| `.nvmrc` | Absent | `24.21.0`; CI reads it through `node-version-file` |
| `web.yml` | `node-version: 20` (L31, L52) | Node 24 through `node-version-file` |
| CI database | None | A `postgres:17` service with a `pg_isready` health check. GitHub's own example uses an unversioned `postgres` image ([GitHub docs](https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers)); the `:17` pin is Wringy's own, for parity |
| Docker base image | None | Digest-pinned `node:24-bookworm-slim` |
| Render services | Not provisioned | Set `engines` explicitly, so a change to Render's default cannot move the major |

### 5.5 Verified on this machine

pnpm 10.33.0's `use-node-version` setting was exercised in scratch directories (`…/scratchpad/npmrc-test`, `…/scratchpad/npmrc-test2`). With `22.12.0`, `pnpm node -v` and `pnpm run` printed `v22.12.0` while plain `node -v` stayed at `v20.19.5`. With `lts`, pnpm printed `WARN "lts" is not a valid Node.js version.` and `ERROR Could not resolve LTS version of Node.js`, then exited 1; a bare `22` failed the same way. pnpm needs an exact `X.Y.Z`, so the pin needs a manual bump on every Node patch release, and workspace members still need their own `engines` field.

### 5.6 Recommendation

**Use Node 24 LTS (24.21.0) and PostgreSQL 17 everywhere.** Choosing the Node major is an implementation refinement within the accepted "受支持 Node.js LTS" (`ARCHITECTURE.md` L52; decision authority at L20), and `full-stack-proposal-v1.md` L95 leaves the pick to implementation: "此处是最低要求核查，不等于选定最低版本；实际安装选仍受支持版本，锁文件、CI与Docker一致，升级跑回归". D28 lists it for ratification only. Once it is applied, prove it with `pnpm install --frozen-lockfile`, `pnpm node -v` and `pnpm --filter web exec node -v`, recorded under `M2-AC01` with the version, environment, action, expected result and actual result.

## 6. Test boundary and evidence format

The spec already fixes the boundary: "最高可用边界为三端浏览器旅程→唯一业务API→真实PostgreSQL→受控提供方适配" (`m2-spec.md` L45). Fixture adapters replace only external sources, never the database or server authorisation, and test names carry the stage AC with results mapped back to PRD A-numbers and implementation D-numbers (L46). "测试边界由2026-09-16常规规划授权确定，不再额外问卷" (L47).

Every M2 ticket's "Verification and recovery" section repeats the same clause (`m2-01.md` L36 and the nine others).

### 6.1 Test pyramid

| Layer | Tool | Where (proposed) | May fake | Evidence |
|---|---|---|---|---|
| Pure rules (money, dates, validation, deriving defaults) | Vitest | `packages/domain` from M2-05 (§8.2); `apps/web/src/domain` stays the demo | Nothing | Vitest summary, with the `Axx`/`Dxx` trace |
| API integration on real PostgreSQL | Vitest + `pg` | `apps/api/tests/integration/**` | Only the platform view-metric and payout providers; never the database or Fastify authorisation | Test file, migration version, CI run |
| Worker and outbox integration | Vitest, spawning the real worker | `apps/worker/tests/integration/**` | Same as above | The kill point exercised and the recovered state |
| Browser journeys | Playwright | `apps/web/tests/e2e/**`, against the real API and database | Same as above. Google sign-in must use the real test IdP (M2-AC02/3) | Screenshot and trace, within a 300 KB budget (`apps/web/tests/e2e/helpers.ts` L444, `ACCEPTANCE_SHOT_MAX_BYTES = 300 * 1024`) |
| Founder walk (phone and desktop, on staging) | A person, following a script like `docs/m1-prototype/demo-script.md` | — | Nothing | A hand-written row naming `M2-AC10` (D27) |

**Naming.** Every test title carries `M2-ACxx`, following M1's precedent of `describe` blocks named `P01` to `P11` in `acceptance.spec.ts`. A test of one of the D01–D06 rules (implementation spec §7) also carries its `Dxx` id. The PRD `Axx` trace comes from the AC's own column in `m2-spec.md`.

**Two kinds of "external".** Platform metrics and payment providers can use fixtures, because M2 keeps real production writes closed (Out of Scope, `m2-spec.md` L73–L75; M2-AC05/3). Google and Supabase identity cannot: M2-AC02/3 forbids closing on a simulated login. The evidence record keeps the two kinds apart.

### 6.2 Real PostgreSQL without Docker

| Option | Verdict | Evidence |
|---|---|---|
| embedded-postgres 17.10.0-beta.17 | **Recommended for local use** (D29) | A scratch probe (`…/scratchpad/epg-probe/probe.mjs`) printed "PostgreSQL 17.10 on x86_64-windows, compiled by msvc-19.44.35226". A login role without grants was refused with "42501 permission denied for schema app". Init, start, query and stop took 11.5 s. The binaries take about 100 MB. Windows x64 is in the support matrix ([README](https://github.com/leinelissen/embedded-postgres#readme)). Every published version is a `-beta`, so pin the exact version and use it only locally |
| Native PostgreSQL 17 install | Works, but needs a human install (roughly 20 minutes, an estimate) | Supported through a `TEST_DATABASE_URL` override |
| Docker Desktop | Works, but needs a human install, WSL2 and a licence check | Docker Desktop is free only for companies under 250 employees and US$10M revenue ([Docker pricing FAQ](https://www.docker.com/pricing/faq/)). Whether the company qualifies is **unverified** |
| Hosted Supabase branch | Not suitable for the test loop | Each branch is an isolated instance ([branching](https://supabase.com/docs/guides/deployment/branching)), but it adds a network dependency and shared state. Its cost is **unverified** |

In CI, use `services: postgres: image: postgres:17` with a `pg_isready` health check on a Linux runner ([GitHub docs](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)). That runs Docker on GitHub's runner, not on the founder's machine. Locally, force `timezone=UTC`; without it, the probe showed the host's `Asia/Kuala_Lumpur`.

### 6.3 Isolation per layer

API integration tests each run in a transaction that is rolled back afterwards. A worker-scoped fixture shares one connection per Vitest worker, and `globalSetup` starts the database once and migrates a template database (Context7 `/vitest-dev/vitest`: `docs/guide/recipes/db-transaction.md`, `docs/guide/lifecycle.md`). Worker and outbox tests cannot roll back, because the worker reads committed rows over its own connection; each file gets a fresh database created from the migrated template (`CREATE DATABASE … TEMPLATE …`), or the tables are truncated and reseeded. A schema reset always runs the real versioned migrations, never a hand-kept dump (Implementation Decision 4, `m2-spec.md` L37).

### 6.4 Evidence record

The evidence goes in `docs/m2-internal/acceptance-record.md`, with screenshots in `docs/m2-internal/screenshots/`, following the M1 precedent; neither exists yet. The columns are the spec's own list (`m2-spec.md` L49):

| 验收ID | 版本 | 环境 | 测试或人工步骤 | 期望 | 实际 | 时间 | 证据引用 | 未决项 |
|---|---|---|---|---|---|---|---|---|
| M2-AC0X/Y | Commit SHA and migration version | local / CI / staging | Test file and name, or the manual step | The AC's checkable result | What happened | ISO date, and who or what ran it | Test path with `Axx`/`Dxx`, screenshot path, CI run URL, and the PR comment holding the cross-vendor review | Blockers, skips and founder items |

A row that did not run says **NOT EXECUTED** and why, which is the M1 rule (`acceptance-record.md` L5). Long logs are linked by CI run URL; `web.yml` L60 already uploads the Playwright report. Each row says whether the verification was simulated, sandbox or real (`m2-spec.md` L49).

### 6.5 Acceptance items no test can close

| AC | Why it waits for something real | Source |
|---|---|---|
| M2-AC02 | "真实测试凭据缺失须列阻塞，模拟结果不能关闭本票" | `m2-spec.md` L59 |
| M2-AC09 | Needs the real staging environment, and stays unaccepted while the external accounts are unavailable | `docs/planning/tickets/m2-09.md` |
| M2-AC10 | "登记独立跨厂商只读审阅结果；未完成不得以按钮可点击代替" | `m2-spec.md` L67 |
| M2-AC08/2 (in part) | Genuine `failed` and `bounced` email states need a real Resend key; in-app notifications and SSE do not | `m2-spec.md` L65 |

### 6.6 Cross-vendor review and release gate

Codex reviews the diff of each M2 PR read-only, after local tests pass and before merge (CLI 0.153.4 is installed; orchestrator check 2026-09-23). A full review is mandatory for M2-02 (auth), M2-03 (org boundaries), M2-05 (version conflicts), M2-07 (fixture ownership), M2-08 (outbox) and gate packages such as this one; other PRs get a lighter pass (D23). The result is recorded as a `gh pr comment` with the scope and the verdict, and referenced from the ticket's evidence row, because M2-AC01/3 and M2-AC10/2 ask for it to be 登记 (registered). Nothing on GitHub enforces the review (0 required approvals, no `CODEOWNERS`, only `planning` required), and the release gate does not exist (§2.1); D24 decides when it is built.

### 6.7 One substantive failure or refusal per ticket

| Ticket | Scenario |
|---|---|
| M2-01 (#16) | A deliberately wrong import is rejected by the dependency check. A stopped worker shows "stale", and a stopped API shows an error state |
| M2-02 (#21) | The server rejects a forged or stale token, or a failed Origin check, even when the request carries a plausible cookie |
| M2-03 (#26) | A member of org A tries to read or write an org B object and is refused, with an audited denial that leaks no secrets |
| M2-04 (#27) | An interrupted preference save shows "not saved" and offers a retry, never a stale account value |
| M2-05 (#29) | Two browsers edit one draft, and the second save gets a version conflict instead of a silent overwrite |
| M2-06 (#31) | A signed-out visitor opens a private or missing campaign link and gets a safe not-found result that leaks nothing |
| M2-07 (#32) | A link whose fixture ownership resolves to another account is refused or sent to review, never reassigned |
| M2-08 (#33) | The worker is killed between the outbox write and consumption, and nothing is lost or delivered twice |
| M2-09 (#34) | A real app and migration rollback on staging keeps the saved data |
| M2-10 (#35) | Privilege-escalation and cache-isolation probes across all three roles, on phone and desktop, recorded with the cross-vendor review |

## 7. External accounts, credentials and cost register

This is a read-only inventory: no account was created and no secret requested. Prices were read on 2026-09-23, which bounds how current they are. The spec already tells the first ticket to register and advance the Google and database configuration ("由首票登记并推进配置，无法获得凭据时保持真实登录验收阻塞", `m2-spec.md` L89) and counts waiting on external accounts separately ("外部账号等待单列", L17). The open question is who creates and owns the accounts (D15). The operating entity "是待明确身份的马来西亚独立公司，不能用 Belcort 代替" (`docs/PRD.md` L36). No `.env*` file exists in the tree (`find . -iname "*.env*" -not -path "*/node_modules/*"`).

### 7.1 Register

| Account | What M2 needs | Who acts | Handover | Wait | Monthly cost | Blocked without it |
|---|---|---|---|---|---|---|
| Supabase | An org and project in Southeast Asia (Singapore), `ap-southeast-1` ([regions](https://supabase.com/docs/guides/platform/regions)); the Google provider; an ES256 key; a topology per connection type (§4.12) | The founder (D15); plan D16; number of projects D17 | Project ref, publishable and secret keys and role passwords go into secret stores and an untracked `.env`, never into chat | Instant self-serve | Free: $0, pauses after 1 week without activity, 2 active projects, 500 MB, 50,000 MAU, 5 GB egress. Pro: "from $25/month", including $10 of Micro compute ([pricing](https://supabase.com/pricing)) | M2-AC02, 03, 08, 09, 10 |
| Google Cloud | A project; an OAuth consent screen set to External and Testing; a Web client with the Supabase callback as its redirect URI; scopes `openid email profile` only | The founder (D15) | Client ID and secret through a secret store | Project creation is near-instant. Consent-screen setup takes roughly 10–30 minutes, an agent estimate rather than a Google figure | $0 | All of M2-AC02 |
| Render | Three Singapore services: web (Web Service), private API (Private Service) and worker (Background Worker) | The founder (D18), with a payment method | Deploy hook or API key through a secret store | Instant | About $7 each on Starter, so about $21 (third-party source; see §7.2). The Hobby workspace costs $0 | M2-AC09, M2-AC10 |
| Resend | An account, and optionally a verified sending subdomain | The founder (D20), with DNS access | API key through a secret store | Instant | Free: 3,000 emails a month, 100 a day, 3 domains ([pricing](https://resend.com/pricing)) | The M2-AC08/2 email records (without a domain, mail reaches only the owner) |
| GitHub | A `staging` Environment with secrets | An admin | — | Minutes | $0. "Users with GitHub Free plans can only configure environments for public repositories" ([docs](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)). Limits are 100 environment secrets of up to 48 KB each ([secrets](https://docs.github.com/en/actions/reference/security/secrets)) | CI-driven staging deploys |
| Google test accounts | At least three real accounts: dual-role, admin of a second org, and outsider or ops | The founder | Added as OAuth test users | Minutes | $0 | The M2-03 refusal cases (`m2-03.md` L33) |
| Custom domain | None | — | — | — | — | Nothing (D21) |
| Sentry | None. It is listed as "Sentry 仍候选" (`ARCHITECTURE.md` L58; `full-stack-proposal-v1.md` L117) | — | — | — | — | Nothing. M2-AC09 observability uses logs, health checks, the heartbeat and backlog age |

### 7.2 Facts behind the register

- **Google Testing mode.** An app in Testing mode is limited to 100 test users ([production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)). Its refresh tokens expire after 7 days "unless the only OAuth scopes requested are a subset of name, email address, and user profile" ([OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)). Keeping to `openid email profile` avoids a weekly re-login. Moving the app to Verified or Production status belongs to M4 or M5.
- **Render plans.** The Free plan is "Available for 'web services' only"; Starter and above cover private services, background workers and cron jobs ([compute plans](https://render.com/docs/compute-plans)). A free web service spins down after 15 minutes without traffic ([free](https://render.com/docs/free)), which would break the SSE reconnect evidence of M2-AC09/2. The Hobby workspace plan "does not have a monthly fee" ([workspace plans](https://render.com/docs/new-workspace-plans)). The per-instance **dollar figures ($7 for Starter, $25 for Standard) come from third-party sources**: render.com/pricing returned no readable price on two fetches, so confirm them in the dashboard before budgeting. Every service keeps a free `*.onrender.com` URL ([custom domains](https://render.com/docs/custom-domains)).
- **Resend domains.** "You must add and verify at least one domain to send emails with Resend." Resend recommends a subdomain rather than the root domain ([domains](https://resend.com/docs/dashboard/domains/introduction)). The claim that the shared `resend.dev` address delivers only to the account owner is **unverified**, because it comes from third-party sources only. Check it in the dashboard.
- **Supabase IPv4.** Render and GitHub Actions are IPv4-only, and the pooler works over IPv4. The IPv4 add-on for direct connections costs about $4 a month according to Supabase's page, and needs Pro (D19).

### 7.3 Monthly cost (minimum M2 staging)

| Vendor | Plan | Monthly |
|---|---|---|
| Supabase | Free, accepting the weekly pause | $0 |
| Supabase | Pro, recommended once staging is used across several days (D16) | $25 |
| Supabase IPv4 add-on | Only if the M2-09 LISTEN test fails (D19) | About $4 |
| Google Cloud | OAuth project in Testing mode | $0 |
| Render | 3 × Starter (third-party price) | About $21 |
| Render | Hobby workspace | $0 |
| Resend | Free | $0 |
| GitHub | Environments and secrets (public repository) | $0 |
| Sending domain | Optional, only if D20 needs it | A small annual fee (not sourced) |
| **Total** | With Supabase Free / with Supabase Pro | **About $21 / about $46** |

Under Pro, a second Supabase project may add compute cost. That figure is unverified.

### 7.4 What can be prepared before the signature

**Allowed now**, as planning and documentation only (`m2-spec.md` L83): the environment-variable **names**, without values (Supabase URL and keys, OAuth client id and secret, Resend key, a `DATABASE_URL` per role, `DATABASE_URL_MIGRATOR`, `API_INTERNAL_URL`, `WRINGY_ENV`, `WORKER_ID`, `IMAGE_REF`); the fixture campaign definitions, written as spec content; a written outline of the Render Blueprint and the staging workflow; and the local PostgreSQL choice (D29). **Only after the signature**, as M2-01 and M2-09 implementation (`m2-01.md` L27): migration tooling wired to a real database with account separation, a real `render.yaml`, and real CI workflow files.

## 8. Workspace shape and the M2-01 narrow loop (proposal)

The spec leaves file locations to the kickoff code review (`m2-spec.md` L41), so this section proposes paths for that review to confirm. `ARCHITECTURE.md` §4 L90 says modules are logical divisions that "不要求独立服务、包". A package is therefore created only when two runtimes share code; business modules stay as folders. The engineering choices in this section are listed for ratification as D28–D33.

### 8.1 Layout

| Path | Role | Created in | May depend on |
|---|---|---|---|
| `apps/web` (exists) | Next.js 16.3.5 pages. M2-01 adds `src/app/(internal)/layout.tsx` and `src/app/(internal)/internal/page.tsx`, and moves `(public)` and `(workspace)` under `src/app/(demo)/` | M1 | `@wringy/contracts`, `@wringy/config` (the web subset); `@wringy/domain` from M2-05 |
| `apps/api` | Fastify 5: `src/server.ts`, `src/routes/{health,internal}.ts`, and later `src/modules/<identity-org\|campaign\|submission>/` | M2-01 | domain, db, contracts, config |
| `apps/worker` | pg-boss 12: `src/main.ts`, `src/jobs/heartbeat.ts` | M2-01 | domain, db, config |
| `packages/db` | `migrations/*.sql`, `src/pool.ts` (one pool per role), `scripts/local-pg`, `test/harness`, `fixtures/internal-campaigns.sql`, `README.md` | M2-01 | `pg`, config |
| `packages/config` | zod env schemas, one per process (web, api, worker, migrate). Fails fast, with no defaults for secrets | M2-01 | `zod` |
| `packages/contracts` | Request and response schemas, with inferred types, for `/health`, `/internal/campaigns` and `/internal/worker-health` | M2-01 | `zod` |
| `packages/domain` | Pure rules only | **M2-05** | Nothing at runtime |
| `packages/modules/<m>` | Commands shared by api and worker | Only when the worker first needs one (M2-08) | domain, db |

`pnpm-workspace.yaml` lists only `apps/*` today, so `packages/*` must be added.

### 8.2 Domain move (D30)

`apps/web/src/domain` does not move in M2-01, and it does not move wholesale at any point in M2. The engine is a demo simulator: its rules take the whole `DemoState` (`rules.ts` L85–L216), and its ids come from the simulated clock ("No Math.random, no Date.now, no crypto", `ids.ts` L1–L6). If api or worker could import it, demo accounting could reach real tables, which Implementation Decisions 1 and 5 and M2-AC10/3 forbid. Its `DEFAULT_RULES` (`rules.ts` L37–L51) is a hand copy of campaign-defaults-v1, and promoting it into shared code would break M2-AC05/1 ("默认值只从canonical规则承接"). The server needs only a few pure pieces: `money.ts` (which imports only types, L13), `time.ts`, `capAtThreshold` with the min/cap/threshold validation (M2-05), and `normalizePostUrl` (`rules.ts` L244–L297, M2-07). M2-05 creates `packages/domain` by moving these pieces with their tests rather than copying them, and M2-07 moves `normalizePostUrl`; the demo engine then imports them, so the demo and the server share one implementation. `m2-01.md` rules out an empty package now: "没有相应改动则不硬建新层".

### 8.3 The narrow loop

`Browser → /internal (Next server component, no-store) → Fastify GET /internal/campaigns and /internal/worker-health (API role) → PostgreSQL app.campaigns, ops.worker_heartbeat ← worker (interval beat + pg-boss scheduled job)`

**Web.** `/internal` gets its own root layout, because today's `app/layout.tsx` mounts `LocalePrompt` (L52), `DemoToolbar` (L59) and `AppProviders`, which hydrates the demo store (`providers.tsx` L22, L38). `(public)` and `(workspace)` move under a `(demo)` group that keeps the current layout. URLs do not change, and moving between the two root layouts is a full page load (Context7 `/vercel/next.js`, route-groups). The page shows a persistent 内部版本 · Internal build · Versi dalaman banner from a new `internal` namespace in all three locales, and the fixture campaigns, each with title, org, status and a 演示数据 fixture badge taken from `dataOrigin`. A 后台任务健康状态 card shows the last heartbeat, the last queue round trip and the image ref, with a state of healthy, stale or never seen (never seen displays as unknown, following P04). There are explicit states for an unreachable API, an unavailable database (the API returns 503) and an empty list. The page is checked at 390 px and 1440 px. All calls are server-to-server, so M2-01 adds no browser-facing API, CORS or cookie surface.

**API.**

| Route | Behaviour |
|---|---|
| `GET /health/live` | Checks the process only; no database |
| `GET /health` | Queries the database as the runtime role and compares the migration head and pg-boss schema version with the expected ones; returns 200 or 503 |
| `GET /internal/campaigns` | `{items:[{id,title,status,orgName,dataOrigin,updatedAt}], dataAsOf}`, fixture rows only; the response schema is the allow-list |
| `GET /internal/worker-health` | `{workers:[{workerId,startedAt,lastBeatAt,lastQueueRoundTripAt,imageRef,state}], dbNow}`, with staleness computed on the database clock |

The API binds to 127.0.0.1 locally. M2-02 adds token verification, and M2-03 puts `/internal/*` behind an ops capability, because M2-AC08/3 keeps run alerts away from normal users. The pino `redact` option covers the authorization and cookie headers and connection strings. Response allow-listing also holds with zod: `@fastify/type-provider-zod` serialises `safeEncode(schema,data).data` ([core.ts L217–L225](https://raw.githubusercontent.com/fastify/fastify-type-provider-zod/main/src/core.ts)), and `z.object` strips unknown keys by default (Context7 `/colinhacks/zod`). A response schema never uses `z.looseObject`.

**Worker.** It starts `new PgBoss({schema:'pgboss', migrate:false, createSchema:false})`, so the runtime role needs no DDL, and `start()` refuses to run while migrations are pending ([constructor.md L98–L112](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/constructor.md)). Beat A upserts `ops.worker_heartbeat` every 15 s to show the process is alive. Beat B uses `schedule('system.heartbeat','* * * * *')` plus `work()` to update `last_queue_round_trip_at`, which shows the queue path is alive; schedules are evaluated every 30 s at minute precision ([scheduling.md L3](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/scheduling.md)). Two separate beats catch a worker that is stuck without throwing ("任务卡住但没抛异常也能告警", `full-stack-proposal-v1.md` L117). On SIGTERM it runs `boss.stop({graceful:true})` and then sets `stopped_at`, which rehearses M2-AC09/3.

### 8.4 Migrations for M2-01

The migrations are node-pg-migrate SQL files, run under an advisory lock in a single transaction. `pnpm db:migrate` first runs `pg-boss migrate` from the CLI as the migrator ([cli.md L34–L40](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/cli.md)), then `node-pg-migrate up`. Both use `DATABASE_URL_MIGRATOR`.

| File | Creates |
|---|---|
| `0001_schemas_roles.sql` | NOLOGIN group roles `wringy_api` and `wringy_worker`; schemas `app` and `ops`; `REVOKE ALL … FROM PUBLIC`. Nothing goes in `public`, and nothing is granted to `anon` or `authenticated` |
| `0002_environment_marker.sql` | `ops.environment`, a single row `{name, fixtures_allowed}`, and the trigger function `ops.assert_fixture_allowed()` |
| `0003_orgs_campaigns.sql` | `app.orgs(id, name, data_origin, UNIQUE(id,data_origin))` and `app.campaigns(id, org_id, title, status draft/published, data_origin, timestamps, UNIQUE(org_id,id), FK(org_id,data_origin) → orgs)`, with the fixture trigger. The API gets SELECT only |
| `0004_worker_heartbeat.sql` | `ops.worker_heartbeat`; the worker may INSERT and UPDATE, the API may SELECT |
| `0005_pgboss_grants.sql` | Runs after `pg-boss migrate`. Grants USAGE, DML and EXECUTE on `pgboss` to `wringy_worker`, plus default privileges for future objects. Queues use `partition:false` ([queues.md L60–L62](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/queues.md)). Wave 2 tests whether `createQueue` works under the runtime role (D33) |

The `data_origin` column here and the `source` column in §3.2 are the same fixture/live label; the code review picks one name.

### 8.5 Accounts, fixture isolation and secrets

| Login | Group | Rights |
|---|---|---|
| Migrator (`wringy_migrator`, or `postgres` on Supabase, which is unverified) | None | Owns `app`, `ops` and `pgboss`; DDL |
| `wringy_api_login` | `wringy_api` | Table-level SELECT in M2-01; no DDL; no `pgboss` |
| `wringy_worker_login` | `wringy_worker` | `pgboss` DML and heartbeat writes; no DDL |

Login roles and their passwords come from a per-environment bootstrap (`pnpm db:bootstrap`), never from versioned migrations.

**Fixture and live data stay apart at two levels** (Implementation Decision 5). At the environment level, `WRINGY_ENV` is one of local, ci, staging or production; the api and worker refuse to start if it differs from `ops.environment.name`, and `pnpm db:seed:fixtures` refuses to run unless `fixtures_allowed` is true. At the record level, the `data_origin` column, the composite FK and the trigger make mixing impossible, and every response carries `dataOrigin`. The fixture seed has two orgs and three campaigns, with titles and statuses only. It carries no money and no rule values, and it is not imported from `apps/web/src/domain/seed.ts`.

**Secrets.** The web server gets only `API_INTERNAL_URL`: no database URL, and no `NEXT_PUBLIC_*` variable in M2-01. The API reads its own `DATABASE_URL`; the worker reads its own `DATABASE_URL`, `WORKER_ID` and `IMAGE_REF`; migrations read `DATABASE_URL_MIGRATOR`. There is one `.env.example`, at the repository root: the root `.gitignore` L5–L7 allows it, while `apps/web/.gitignore` L33–L34 ignores every `.env*` file. A CI canary job injects canary values for every secret, builds, and greps `apps/web/.next/static/**` and the captured api and worker logs; any hit fails the job (M2-AC01/2, part 4).

### 8.6 The data-access seam in the M1 store

A grep of `apps/web/src` on 2026-09-23 found 61 files importing `@/domain` (59 of them from `@/domain/types`), 15 dispatching synchronously (`dispatch(command) => CommandResult`, in `store/demo-store.ts`) and 29 reading `useDemoState` or `useDemoSnapshot`. Runtime values are imported in `features/merchant/campaign-editor-view.tsx` L54, `features/merchant/campaign-form.ts` L21, `features/creator/submit-view.tsx` L42, `app/(public)/campaigns/[id]/page.tsx` L4 and L26, and `features/ops/ops-shared.tsx` L41. Each ticket from M2-02 to M2-08 therefore changes the components it touches (async state, 409 conflicts, request keys, contract types); budget for this in every ticket.

| Stays in zustand (client) | Moves to server fetches |
|---|---|
| Unsent form drafts and their request key (`store/command-id.ts` `newCommandId` becomes the request-key header) | Session and identity (M2-02) |
| UI-only state: dialogs, filters, tabs | Orgs, memberships, capabilities (M2-03) |
| The guest's locale choice and prompt flags | The signed-in locale preference (M2-04) |
| The selected workspace or org, kept only as a hint that the server re-verifies | Campaign drafts and versions (M2-05) |
| The whole `DemoState`, in demo mode only | The public catalogue and metadata (M2-06); accounts and submissions (M2-07); notifications (M2-08) |

**How the switch works.** Each feature gets a `features/<role>/data/{demo.ts,server.ts}` pair behind one hook or prop shape, typed by `@wringy/contracts`. Reads are React Server Components that call Fastify. Writes go through the thin proxy (mechanism: D33), then `router.refresh()`, and later the M2-08 SSE hint. No client cache library is added until a ticket needs one. From M2-02, `WRINGY_APP_MODE=demo|internal` selects the implementation: `demo` is M1 unchanged, and its Playwright suite stays in CI; `internal` renders the server-backed implementations, shows "not in internal build" for claims, reviews and payouts, and never mounts the demo engine (M2-AC10/3). M2-01 does not touch the store.

### 8.7 Dependency direction

pnpm's isolated `node_modules` let a package import only what it declares ([pnpm motivation](https://pnpm.io/motivation)). On top of that, dependency-cruiser in CI (D31) enforces these rules:

| From | Must not import |
|---|---|
| `packages/domain` | Any runtime: `node:*`, pg, fastify, react, next, zod, `apps/*` |
| `packages/contracts`, `packages/config` | db, pg, fastify, next, react, `apps/*` |
| `packages/db` | fastify, next, react, contracts, `apps/*` |
| `apps/api` | `apps/web`, `apps/worker` |
| `apps/worker` | `apps/web`, `apps/api`, fastify |
| `apps/web` | `@wringy/db`, pg, pg-boss, fastify, `apps/api`, `apps/worker` |
| `apps/web/src/{components,features}/**` | db, and any `server-only` config module |
| `apps/web/src/app/(internal)/**` | `@/store/*`, `@/domain/{engine,seed,scenarios}`, `@/components/app/{demo-toolbar,providers}` |
| api, worker, `packages/*` | `apps/web/src/domain/{engine,seed,scenarios,scenario-steps,selectors}` |
| All | Cycles |

CI also runs the checker on a file that deliberately breaks a rule and asserts that it is rejected, which covers "一次依赖违规被检查拒绝" (`m2-01.md`, Verification).

### 8.8 Local run and CI

**Local.** `pnpm db:start` starts embedded PostgreSQL 17 on 127.0.0.1:54329, with its data in a gitignored `.local/pg` folder and `timezone=UTC`; then run `pnpm db:bootstrap` once, `pnpm db:migrate` and `pnpm db:seed:fixtures`. `pnpm dev` runs `pnpm -r --parallel --filter "./apps/*" run dev`: web on port 3100, api on port 3200 (through `tsx watch`) and the worker, with the api and worker retrying the database connection with backoff. `pnpm test` runs the unit tests. `pnpm test:int` runs Vitest against `TEST_DATABASE_URL` if it is set, otherwise against a fresh embedded database migrated from zero. `pnpm e2e:internal` runs Playwright with a `webServer` array for api, worker and web (Context7 `/microsoft/playwright`, "Multiple web servers").

**CI.** `web.yml` grows into an app workflow:

| Job | Runs |
|---|---|
| `check` | Lint, typecheck, unit tests, dependency-cruiser with the violating fixture, the secret canary, and the AC-mapping check |
| `integration` | A `postgres:17` service; migrate from empty as the migrator, then run the tests as the runtime roles |
| `e2e` | The M1 demo suite plus the `M2-AC01` internal suite, which walks `/internal` in all three locales after a warm-up for the Turbopack issue |
| `images` | `docker build` for all three images, with no push before M2-09 |

Test titles carry `M2-AC01/1..3`. Whether these jobs become required checks is D22.

### 8.9 Images and rollback rule

| Image | Build | Runtime |
|---|---|---|
| web | `apps/web/Dockerfile`: `output:'standalone'` with `outputFileTracingRoot` at the repository root; copies `.next/standalone`, `.next/static` and `public` (Context7 `/vercel/next.js`: output, with-docker) | `node apps/web/server.js`, as `USER node` |
| api | `apps/api/Dockerfile`: bundle, then `pnpm --filter api --prod deploy`. pnpm v10 needs `injectWorkspacePackages` or `--legacy` for this ([pnpm deploy](https://pnpm.io/cli/deploy)) | `node dist/main.js`. The image also carries the migrations for a one-off migrate step |
| worker | Same pattern as api | `node dist/main.js`; drains on SIGTERM |

Images are tagged `ghcr.io/belcort-sdn-bhd/wringy-{web,api,worker}:<git-sha>`, with an OCI revision label. The `latest` tag is never deployed.

The rollback rule is first exercised in M2-09. It follows the "Service-specific config" table of [Render rollbacks](https://render.com/docs/rollbacks).

1. Every release records the git SHA, the three image digests, the migration head, the pg-boss schema version, the env config version and the `render.yaml` commit.
2. Deploy only immutable SHA tags or digests. Render's rollback reuses "the same image tag or digest as the target deploy", so a mutable tag could point to a different image by then (our inference).
3. Keep release-critical config in service-level env vars, which match the target deploy on rollback, not in environment groups: "Rolling back does not modify any values in an environment group".
4. Migrations follow §4.13. A rollback redeploys the previous digests and config, with no down migration. The Render page says nothing about databases, and Supabase sits outside Render, so this discipline is Wringy's to enforce.
5. Keep at least five releases in GHCR. Render keeps only "a fixed number of recent build artifacts for each service, based on your workspace plan". A dashboard rollback "automatically disables autodeploys", so re-enable autodeploy afterwards.
6. Drain the worker before switching.

Three things are unverified: whether images built from a public repository are visible in GHCR, whether Render can pull from a private registry, and whether Render's pre-deploy command is available on the plan. M2-09 verifies them, in about 0.25 day.

### 8.10 M2-01 build plan (after the signature)

| Wave | Work | Lanes | Effort (agent, elapsed) |
|---|---|---|---|
| W0 | A human installs Node 24. The agent pins versions, moves CI to Node 24 and re-runs the M1 suite | 1 | 0.25 d |
| W1 | `packages/*`, the base tsconfig, config, contracts and db (pool, runner, local PostgreSQL, harness); dependency-cruiser with the violating fixture; root scripts; the `(demo)`/`(internal)` split with an M1 e2e re-run. Also check how web consumes TypeScript-source packages (for example `transpilePackages`, which is recalled and not yet checked) and pick the api/worker bundler | 1–2 | 0.75 d |
| W2 | (a) Migrations 0001–0005, the bootstrap, the guarded seed, and integration tests (fresh migrate, runtime-role denial, fixture guard, composite FK). (b) API routes, with inject tests on real PostgreSQL. (c) Worker beats and a drain test | 3 | 1 d |
| W3 | The `(internal)` page with copy in three locales; Playwright `M2-AC01` tests (cold start, a stopped worker shows stale, an API outage shows an error, the trilingual walk); the secret canary | 1–2 | 0.5 d |
| W4 | CI jobs and image builds; READMEs for `apps/api`, `apps/worker` and `packages/db`; `ARCHITECTURE.md` §1 and §4 updated only with evidence; the branch-protection report; the AC-mapping check; the Codex read-only review; the PR | 1 | 0.5 d |
| W5 | An adversarial check against M2-AC01/1–3 and the evidence record | 1 | 0.25 d |

About 3.25 agent-days, not counting time spent waiting on people. The M2-AC01/1 register (§1 and the M1 record fixes) runs in parallel with W1. The spec's day-3 checkpoint ("首个3个工作日检查最小登录/保存链路", `m2-spec.md` L17) can include login only if the D15 accounts exist by then; otherwise day 3 reports the remaining work and re-slices, as the Appetite clause requires.

### 8.11 What M2-02 to M2-10 add on top

| Ticket | Adds |
|---|---|
| M2-02 | Supabase Auth (Google only) through `@supabase/ssr`: the callback, cookie refresh, Fastify JWT verification, `profiles` keyed by `sub`, Origin and CSRF checks, private caching, `WRINGY_APP_MODE`, and `/internal` behind sign-in (§4) |
| M2-03 | `org_members`, `admin_scopes`, `platform_grants`, grant records and the append-only audit; authorisation re-checked on every request, backed by composite FKs (§3) |
| M2-04 | The locale stored on the profile with an explicit flag, following the localization-v1 resolution order; drafts and request keys survive a language switch |
| M2-05 | `campaign_versions` (immutable once confirmed), `request_dedup`, 409 on version conflict, `packages/domain`, and the canonical-defaults mechanism. Real publish is refused; internal fixture publish is allowed |
| M2-06 | The public catalogue and detail served from the API with public-field schemas; metadata from the API (which fixes `known-issues.md` L152); cache headers; return to the original page after sign-in |
| M2-07 | Fixture-verified `account_connections`; `submissions` with UNIQUE(campaign_id, platform, post_id) and composite FKs; `normalizePostUrl` moved to the domain package; no media upload |
| M2-08 | `app.outbox` written in the same transaction, one relay into pg-boss, persisted localized notifications, Resend delivery records, SSE hints with a polling fallback, and ops retry with an audit entry |
| M2-09 | Render staging with three services built from SHA images; the Supabase region, TLS and connection budget; health, heartbeat and backlog-age monitoring; SSE through the proxy; a rollback drill |
| M2-10 | Acceptance across all three roles on phone and desktop, per-AC evidence, the cross-vendor review, and inputs for M3 |

## 9. Decisions the founder must freeze

Each row gives a recommendation. The §11 sign-off line records the rulings explicitly; no ruling is inferred from silence. The "why" column is one line, and the last column names the source that constrains the choice.

| ID | Question | Options | Recommendation | Why | Constraining source |
|---|---|---|---|---|---|
| **Identity and organisation** | | | | | |
| D1 | Can any admitted user create a merchant org in M2? | (a) Self-service; the creator becomes admin. (b) Only after an operator approves. (c) Only the bootstrap script creates orgs | (a). The server keeps refusing real publish until funding, data and payout readiness exist | The founder already allowed one account to create a merchant team, and the publish gate contains the risk | `phase-0/founder-inputs.md` L308; M2-AC03/1; M2-AC05/3 |
| D2 | How does an existing org gain a member (the 授权授予记录)? | (a) An admin invites by email. The invitee signs in with Google and accepts a single-use link that expires; the verified email must match. (b) A reusable join link. (c) Automatic join by email domain. (d) An admin adds the user directly, with no acceptance step | (a), with the expiry length set by the founder. A reference practice fetched 2026-09-23: GitHub invitations expire automatically after seven days ([GitHub docs](https://docs.github.com/en/organizations/managing-membership-in-your-organization/inviting-users-to-join-your-organization)). That is a reference point, not a Wringy rule | (b) leaks membership through forwarded links, no source supports (c), and (d) adds people without their consent | M2-AC03/1. No source defines a join mechanism: `founder-inputs.md` L308 and PRD v2 L40 say only 创建／加入, and `campaign-defaults-v1.md` has no match for 组织, 成员 or 账号 |
| D3 | Which merchant roles exist inside an org in M2? | (a) Admin (settings, members, confirming the immutable rule version, simulated publish of fixture campaigns) and member (reads everything, edits drafts). (b) Admin and a read-only member. (c) Every member is an admin | (a). The last admin cannot leave or be demoted | Limits who can make rules immutable | M2-AC03/1; M2-AC05/2; implementation spec L38 (角色CHECK) |
| D4 | How are the first ops, review and finance capabilities granted, and is there an in-app platform-admin role? | (a) A named person runs an audited bootstrap script with the migration account. A reason is required, the runtime role has SELECT only on the grant tables, and there is no admin console. (b) An in-app admin UI. (c) A list of user ids in an environment variable | (a). A reference practice fetched 2026-09-23: Django's `createsuperuser` creates the first superuser from the command line ([Django docs](https://docs.djangoproject.com/en/5.1/ref/django-admin/)) | Enforces 无自助提权 through database privilege and reuses the migration/runtime account split; (c) leaves no audit trail | M2-AC03/1; M2-AC01/2; PRD v2 L40; `three-role-flows-v1.md` L114 ("Admin不是无限权限通行证") |
| D5 | Which ops capabilities exist in M2, at what scope, and how is "FK成员及组织" read? | (a) Review and finance follow the `admin_scopes` draft exactly: PK(user_id, org_id, capability), with a mandatory org scope and FKs to the profile and the org (not to `org_members`), and no M2 routes. A separate `ops_runtime` platform grant covers only M2-AC08/3. (b) Like (a), but `ops_runtime` is also scoped per org. (c) Every capability is platform-wide in M2. (d) An FK to `org_members`, so ops staff must be merchant members | (a). Reconsider the four-eyes separation of review and finance at M3-00 | The sources require an org scope and no implicit pass. (d) would give ops staff merchant rights, and under (b) nobody could retry failures for self-created orgs | PRD v2 L38; implementation spec L39; M2-AC03/3; M2-AC08/3 |
| D6 | Can one Google account belong to several orgs? | (a) Yes, with no limit in M2. (b) Up to N orgs. (c) One org per account | (a) | Removes M1's first-org-only limit (`permissions.ts` L37). The M2-03 verification uses two orgs | m2-spec user story 3; `m2-03.md` L33; `founder-inputs.md` L308 |
| D7 | What happens when a user's Google email changes? | (a) The identity stays keyed on `sub`. `contact_email` is refreshed from the verified token at each sign-in. Pending invitations sent to the old email do not move. (b) Freeze the email captured at the first sign-in. (c) A separate notification email with its own verification | (a). The risk that Supabase links a recycled email to an existing user is unverified and is logged for M2-02 | Google says to "Always use the sub field"; (c) adds a flow the founder did not ask for | [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect); [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking); `founder-inputs.md` L322 |
| D8 | What does a merchant see about a creator on a submission? | (a) The platform handle, the post URL and the status only, never the Google name or email. Members see each other's display name and role. (b) As (a), plus the Google display name. (c) Nothing about the creator | (a) | M2-AC03/3 makes the creator profile visible only to its owner | M2-AC03/3; implementation spec L53; PRD v2 L111 |
| D9 | What are the minimum audit fields and the M2 retention? (M2-AC03/3 already requires denials to be audited) | (a) The §3.2 field set, with no IP address, user agent, token, cookie or email; keep everything during M2. (b) As (a), plus IP address and user agent | (a). The retention policy is set with the M4/M5 privacy decisions | Minimum personal data. M1 recorded no denials (`engine.ts` L2610) | M2-AC03/3; implementation spec L51; `ARCHITECTURE.md` L139; PRD v2 L111 |
| D10 | May an org member submit their own content to their org's campaign? | (a) No. The server refuses it, and a test covers the refusal. (b) Yes, but flagged for review. (c) Yes, without restriction | (a), revisited in M3. No close external example is known; the argument comes from Wringy's own flow: merchants check content (PRD v2 L80), so such a submission would be self-review | Removes a self-dealing path before any money exists | PRD v2 L80, L38; M2-AC07/3 |
| D11 | Where is the fixture/live label set, and who owns the public fixture campaigns? | (a) On the campaign and the account connection, fixed at creation. Outside production any org may hold fixture campaigns, and the public demo campaigns belong to an org the bootstrap script creates. (b) On the org only. (c) Only the bootstrap org may run simulated publishes | (a) | Testers can run the whole merchant journey in their own org, while the composite FKs on (id, source) keep fixture and live data apart | Implementation Decision 5 (`m2-spec.md` L38); M2-AC05/3; M2-AC06 |
| D12 | How do leaving an org, removal and account deletion work in M2? | (a) Admins remove members and members may leave, except the last admin. Business records stay with the org. There is no self-service deletion, but an operator can disable an account. (b) Self-service deletion now. (c) Memberships cannot change | (a). Deletion and erasure come with the M4/M5 privacy decisions | The M2-03 rollback keeps business records, and no retention policy is approved yet | `m2-03.md` L33; `m2-02.md` L33; `docs/PRD.md` §7 L131 |
| **Session** | | | | | |
| D13 | Who may sign in to the deployed M2 internal version? | (a) Any Google account. (b) An allowlist of named testers, checked against the verified email at first sign-in. An audited script maintains the list, which is never committed; everyone else sees a neutral "internal version" page. (c) Accounts from one Google Workspace domain only (the `hd` claim) | (b). The identity key stays `sub` | The repository is public, M2 is an internal version, and production writes stay closed. (c) would shut out testers who use personal Gmail | `m2-spec.md` L13 (内部版本); M2-AC09/3; M2-AC10/3; orchestrator check 2026-09-23 (public repository) |
| D14 | How long do sessions last in M2, and does that justify Supabase Pro's session controls? | (a) Supabase defaults: 1-hour access tokens, no time-box and no inactivity timeout. Set the numbers before M3. (b) Pro now, with a time-box and an inactivity timeout set by the founder. (c) Shorter sessions for ops and finance, enforced in Fastify in M3 | (a) | M2 has no money actions, every write checks that the session is live (§4.6), and Supabase recommends the 1-hour default. The values are the founder's product and spending choice, not the agent's | [sessions](https://supabase.com/docs/guides/auth/sessions); PRD v2 L179 (A32) |
| **Environment and accounts** | | | | | |
| D15 | Who creates and owns the external accounts (Google Cloud project and OAuth client, Supabase org and projects, Render workspace, Resend), and when? | (a) The Malaysian operating entity's own Google Workspace, now. (b) The founder's account as interim owner now, moved over (with a new OAuth client) before M4/M5. (c) A named admin collaborator creates them on the company's behalf. (d) Wait until the entity is finalised | Create them this week, in parallel with M2-01: (a) if the entity's Workspace exists, otherwise (b). Secrets go only into secret stores and an untracked `.env` | Agents cannot create third-party accounts, and the entity is not yet finalised. M2-01 does not need the accounts, but M2-02 and the day-3 login checkpoint do | `docs/PRD.md` L36; `m2-spec.md` L17, L89 |
| D16 | Which Supabase plan for the staging project? | (a) Free: $0; pauses after 1 week without activity; 2 active projects. (b) Pro: "from $25/month", no pause | Free for the first days of agent setup, then Pro once staging is used across several days | An automatic pause would fake a recovery failure under M2-AC09 | [Supabase pricing](https://supabase.com/pricing); M2-AC09 (`m2-spec.md` L66) |
| D17 | How many Supabase projects? | (a) One, for both dev/test and the M2-09 staging drill. (b) Two: dev/test (M2-02 onwards) and staging (M2-09). (c) None until M2-09, which leaves the M2-02 real-credential rows blocked | (b). Free allows 2 active projects; what a second project costs under Pro is unverified | Keeps the rollback drill away from the data and credentials the M2-02–M2-08 evidence depends on, and gives each environment its own project | `ARCHITECTURE.md` §8 L145; M2-AC02/3; M2-AC09 |
| D18 | Approve three paid Render instances (web, private API, worker) for staging? | (a) 3 × Starter. (b) A free web service plus paid API and worker | (a). The price of about $7 each comes from third parties (render.com/pricing returned no readable figure). The Hobby workspace itself has no fee | Private services and background workers have no Free plan, and a free web service spins down after 15 minutes, which breaks the SSE reconnect evidence | [compute plans](https://render.com/docs/compute-plans); [free](https://render.com/docs/free); M2-AC09/2 |
| D19 | How should staging reach the database, and what may it spend? | (a) The session pooler first (IPv4, no extra cost). Buy the IPv4 add-on (about $4/month per Supabase's page; needs Pro) only if the M2-09 LISTEN test fails. (b) Buy the add-on up front and use direct connections | (a) | Render is IPv4-only, and LISTEN through the pooler is unverified; pg-boss falls back to polling | [IPv4/IPv6](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP); M2-AC09/1 |
| D20 | Should M2 verify a Resend sending domain? | (a) Verify a subdomain of a domain the company owns or buys (an annual fee, not sourced). (b) Stay on the `resend.dev` test address | (a) only if M2-08 test mail must reach more than the account owner; otherwise (b) | Resend requires a verified domain to reach arbitrary recipients. That `resend.dev` reaches only the owner is unverified | [Resend domains](https://resend.com/docs/dashboard/domains/introduction); M2-AC08/2 |
| D21 | Should staging get a custom domain now? | (a) Buy one and point it at Render now. (b) Use `*.onrender.com` for the whole of M2 | (b) | No M2 AC mentions a custom domain, and `onrender.com` URLs are automatic and kept | [custom domains](https://render.com/docs/custom-domains); `m2-spec.md` L57–L67 |
| **Governance** | | | | | |
| D22 | Should product CI jobs become required status checks on `main`? | (a) Close the gap: require `check`, `integration` and `e2e` once M2-01's CI lands, and remove `paths:` filters from the required workflows. (b) Close the gap with an always-on guard job that reports these contexts when the real jobs are skipped. (c) Accept: `planning` stays the only required check | Close in M2-01 W4, using (a), or (b) if fast docs-only PRs matter. An admin applies it (`enforce_admins` is on) | A red product build can merge today, and a path-filtered required check would stay Pending forever | Orchestrator check 2026-09-23; M2-AC00/2; M2-AC01/3 |
| D23 | How often is the cross-vendor read-only review run, and is it enforced? | (a) A manual `codex exec` review saved on every M2 PR, with a full review mandatory for M2-02, 03, 05, 07, 08 and gate packages. It is not enforced by CI, which is accepted as a gap. (b) A review only before the M2-00 and M2-10 sign-offs. (c) A required CI check, which needs Codex credentials usable in Actions (unverified) and about 1 day or more | (a) | The spec asks for the review to be saved and registered, not enforced, and nothing on GitHub enforces it today | `m2-spec.md` L48; M2-AC01/3; M2-AC10/2; `.github/pull_request_template.md` |
| D24 | When is the release gate (发布门禁) built, and what is it? | (a) M2-01 reports "no release gate; M2 has no production release". M2-09 builds a staging GitHub Environment and a deploy workflow: SHA images, deployed only when required checks are green. (b) Build a release-gate workflow in M2-01, before staging exists | (a) | M2-AC01/3 forbids pretending a gate is in effect. M2-AC09/3 says "无生产部署", and there are 0 environments today | M2-AC01/3; M2-AC09/3; `gh api …/environments` |
| **Testing** | | | | | |
| D25 | The mobile nav sheet's accessible name stays vendor English in ms-MY and zh-Hans-MY, but M2-AC04/3 requires accessible names in all three languages. What should M2 do? | (a) Fork `components/ui/sidebar.tsx` and translate the name, which breaks the design system's no-reskinning rule. (b) Pursue an upstream fix and accept the wait. (c) Accept it as a named M2-AC04/3 exception and revisit before M5 | (c) | It is one hidden accessible name on one mobile sheet, not a visible amount, deadline or refusal | `known-issues.md` L68–L76; `m2-04.md` L23; `design-system-v2/README.md` L3, L18 |
| D26 | What happens to M1's five testing limitations (Chromium only; 320 px spot checks; viewport-clipped screenshots; no visual-regression baseline; no automated accessibility audit)? | (a) Close a subset in M2, for example another Playwright browser project and an axe pass. (b) Accept all five as outside M2 scope and revisit before M3. (c) Close the accessibility audit now and defer the rest | (b). M2 evidence is labelled "Chromium only" | None of them blocks a literal M2 AC, and the spec scopes testing to external behaviour and per-ticket risk | `known-issues.md` "Testing limitations"; `m2-spec.md` L47; grep of `m2-01/04/09/10.md` |
| D27 | Does the founder personally walk through M2-AC10 on phone and desktop on staging, as for M1 (#9)? | (a) Yes. (b) A delegate walks through it and the founder reviews the evidence. (c) Automated tests plus the cross-vendor review only | (a) | M2-AC10/2 forbids treating a clickable button as proof, and M1 closed on the founder's own walk-through | M2-AC10 (`m2-spec.md` L67); `gh issue view 9 --comments` |
| **Technical (listed for ratification)** | | | | | |
| D28 | Which Node major? | (a) Node 24 LTS, pinned at 24.21.0. (b) Node 22. (c) Stay on Node 20 with pg-boss `maint-v10` 10.4.2 | (a): pins as in §5.4, and a human installs Node 24 on this machine | Node 20 reached end of life on 2026-04-30, and supabase-js 2.117.0 and pg-boss 12.33.5 both need ≥22. Node 24 is supported until 2028-04-30 and is Render's default | `ARCHITECTURE.md` L20, L52; `full-stack-proposal-v1.md` L95; [schedule.json](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json) |
| D29 | Which PostgreSQL for local and CI tests? | (a) embedded-postgres 17.10.0-beta.17 locally, pinned exactly, with a `TEST_DATABASE_URL` override; a `postgres:17` service in CI. (b) Docker Desktop (licence status unverified; needs WSL2). (c) A native PostgreSQL 17 install. (d) A hosted Supabase branch | (a) | The probe ran PostgreSQL 17.10 on this machine in 11.5 s with no install. Every embedded-postgres build is a beta, so CI uses the official image | `m2-spec.md` L45, L47; `ARCHITECTURE.md` L57; scratch probe; `npm view embedded-postgres` |
| D30 | Should `apps/web/src/domain` move into a shared package? | (a) No move in M2-01. M2-05 moves money, time and validation into `packages/domain`, and M2-07 moves `normalizePostUrl`. The engine, seed and scenarios stay as the demo. (b) Move the whole domain now | (a) | The engine simulates `DemoState` on a simulated clock, and its hand-copied `DEFAULT_RULES` would become a rule source, which M2-AC05/1 forbids | `rules.ts` L37–L60, L85–L216; `ids.ts` L1–L6; `m2-01.md`; M2-AC05/1 |
| D31 | Which tool checks dependency direction? | (a) dependency-cruiser 18.4.0 (needs Node ≥22, which D28 provides), with the deliberately violating fixture. (b) eslint-plugin-boundaries 7.2.0 in the existing lint step | (a). (b) is the fallback if D28 is overruled and the repository stays on Node 20 | Cross-package rules plus the violating fixture cover "一次依赖违规被检查拒绝" | npm view (2026-09-23); M2-AC01/3; `m2-01.md` Verification |
| D32 | Ratify the remaining engineering choices? | zod for config and contracts (through `@fastify/type-provider-zod` 1.0.0); node-pg-migrate 9.0.0 SQL files plus the pg-boss CLI; React Server Component reads and the `WRINGY_APP_MODE` flag; a minimal `orgs` table in M2-01; `pnpm --parallel` for dev; separate `(demo)` and `(internal)` root layouts | Ratify as described in §4.10 and §8 | None of these changes a business rule | `m2-spec.md` L41; `ARCHITECTURE.md` §4 L90 |
| D33 | Two points where the reports disagree, to settle at code review: (i) the thin-proxy write path; (ii) who owns the `pgboss` schema | (i) Server Actions (§8.6) or route handlers forwarding a Bearer token (§4.1). (ii) The migrator owns `pgboss` and the worker gets DML only, with `partition:false` (§8.4); or the worker owns `pgboss` | (i) Decide at the M2-02 kickoff code review; either way the §4.5 Origin rule holds, and Next checks Origin automatically only for Server Actions. (ii) The migrator owns it; fall back to worker ownership only if `createQueue` or maintenance fails under the runtime role in M2-01 W2 | Both options satisfy "Next.js仅页面、会话刷新及薄代理" and "迁移与运行权限分离"; the stricter separation is preferred | Implementation Decision 2 (`m2-spec.md` L35); `full-stack-proposal-v1.md` L113; `…/02-guides/data-security.md` L544–L552 |

The sources already decide five questions the reports raised, so this table leaves them out:

- **Logout scope.** M2-AC02/2 fixes it to the current session, and a "sign out everywhere" control is not in M2 scope (`m2-spec.md` L59).
- **How ops and finance sign in.** Every role signs in with Google only (`full-stack-proposal-v1.md` L7; `prd-content-rewards-v2.md` L40). Ops powers come only from database grants (D4).
- **Whether denied attempts are audited.** M2-AC03/3 requires it; only the field set remains open (D9).
- **Whether to start the external accounts now or wait.** `m2-spec.md` L89 already tells the first ticket to advance them; only ownership remains open (D15).
- **Whether to sign M2-AC00/1 on the governance part alone.** The question is moot, because §1–§8 cover all five AC00/1 areas.

D28–D33 are engineering choices that the sources delegate to implementation (`ARCHITECTURE.md` L20, L52; `full-stack-proposal-v1.md` L95; `m2-spec.md` L41, L47). They are listed so the founder can overrule them, and the §11 sign-off line covers them explicitly.

## 10. Gaps the founder chooses to close first or accept

| # | Gap | What closing it takes | Cost | Consequence if accepted open | Recommended choice |
|---|---|---|---|---|---|
| G1 | Node 20 is end of life, and no version is pinned (§5) | A human installs Node 24; the agent adds the pins, moves CI and re-runs the M1 suite | About 0.25 agent-day, plus the install | pg-boss 12 and supabase-js 2.117 cannot be installed, and the runtime is unsupported | Close first (M2-01 W0) |
| G2 | No local PostgreSQL, Docker or psql (orchestrator check 2026-09-23) | embedded-postgres 17 scripts and a test harness (D29) | Inside M2-01 W1 | Integration tests run only in CI | Close in M2-01 |
| G3 | No external accounts: Supabase, Google OAuth client, Render, Resend, Google test accounts (§7) | The founder creates them (D15) | Roughly 0.5–1 h of founder setup, plus agent configuration (the reports' estimates) | The M2-02 real-credential rows, the M2-03 refusal cases, M2-08 email, M2-09 and M2-10 stay blocked, and the spec keeps real-login acceptance blocked | Close in parallel with M2-01 |
| G4 | M2-AC01/2 parts 2–4 are not done: the fresh-migration read, the account separation, and no secrets in bundles or logs | M2-01 W2–W3 | Inside M2-01 | Cannot be accepted open, because M2-AC01/2 needs all four parts | Close in M2-01 |
| G5 | Only `planning` is a required check (§2) | D22 | 1–2 h of design, 15 min of admin time, 0.1 agent-day | A red product build can merge to `main` | Close in M2-01 W4 |
| G6 | No dependency-direction check | D31 | 2–4 h | M2-AC01/3 stays unmet | Close in M2-01 |
| G7 | No acceptance-mapping check | Extend `check-planning.py` or add a script | About 0.25 agent-day | M2-AC01/3 stays unmet, and AC coverage goes unchecked | Close in M2-01 W4 |
| G8 | The cross-vendor review is not enforced by CI | A CI job with Codex credentials that work in Actions (unverified) | About 1 day or more | The review depends on discipline, and is recorded per PR | Accept; use a manual saved review (D23) |
| G9 | No release gate and no staging environment | A staging GitHub Environment and a deploy workflow | 1–2 days | None before M2-09, because M2 has no production deployment | Accept until M2-09 (D24) |
| G10 | No human review is required, and there is one active human | A required reviewer | Needs a second active reviewer | Required CI checks are the only merge guard | Accept for M2 |
| G11 | Dependabot security updates are disabled | Turn on the repository setting | About 5 min | No automated security-update PRs | Close (turn it on) |
| G12 | Stale M1 records (`acceptance-record.md` L34, L35 and L479; `PROGRESS.md` L7) | A documentation edit | 15 min | Readers see "NOT EXECUTED" for a founder confirmation that has happened | Close under M2-AC01/1 |
| G13 | The mobile nav's accessible name is vendor English (D25) | A vendor-file fork or an upstream fix | A small code change that breaks the design-system rule, or an unknown wait | One hidden name in two languages misses M2-AC04/3 | Accept as a named exception; revisit before M5 |
| G14 | M1's five testing limitations (D26) | Another browser project, an axe pass and a visual baseline | Not estimated (roughly ticket-sized) | M2 evidence is Chromium-only | Accept; revisit before M3 |
| G15 | The canonical defaults are a hand copy in `rules.ts` | A single-source mechanism in M2-05, for example a trace test against campaign-defaults-v1 | Inside M2-05 | M2-AC05/1 fails | Close in M2-05 |
| G16 | The implementation-spec drafts need clarifying (§3.7) | A documentation update after the signature | About 1 h | The spec and the blueprint drift apart | Close after the signature |
| G17 | Unknowns about Supabase: the default PostgreSQL major (the canonical docs are silent), whether a custom migrator role can own the schemas, whether `auth.sessions` is readable, whether LISTEN works through the session pooler, and recycled-email linking | Spikes in M2-02 and M2-09 | About 1 h + 0.1 d + an M2-09 test + 0.5 d | Each has a fallback: Mechanism B, `postgres` as migrator, the IPv4 add-on, or accepting the risk | Accept open; verify in the ticket named for each |
| G18 | Unknowns about Render and GHCR: the first-party instance price, GHCR visibility, pulls from a private registry, the pre-deploy command | A dashboard check and the M2-09 verification | About 0.25 d | The budget may be off by an unknown amount, and the deploy plan may need changes | Accept open; verify before the first staging deploy |
| G19 | Whether `resend.dev` reaches only the account owner is unverified | A dashboard check | Minutes | It is unclear who can receive M2-08 test mail | Accept open until D20 |
| G20 | A real Google sign-in cannot be automated (no verified method) | Recorded manual or semi-manual steps | A human step per run | The "Real" test rows need a person each time | Accept |

## 11. Sign-off record

M2-AC00/3 requires a real signature. The 2026-09-16 date was planning authorisation only and cannot be entered here: "2026-09-16仅是规划授权，不能填作本票实施批准" (`m2-00.md` L15). Neither silence nor a date inferred from other events counts (`m2-00.md` L23). The founder posts the filled template as a comment on #14, and the orchestrator copies it into this section in a later commit.

| Field | Entry |
|---|---|
| 签署人 (signer) | |
| 真实日期 (real date of signing) | |
| 冻结版本 (frozen commit) | |
| 批准范围 (approved scope) | |
| 不批准事项 (not approved) | |
| 带缺口推进的缺口清单 (gaps accepted open; §10 row numbers) | |
| §9 rulings (for example "D1–D33: recommendation accepted, except …") | |

For reference only, and not an entry: the spec's Out of Scope already excludes "真实社交OAuth/计量、正式奖励预留/审核/付款、生产发布、完整官网、视频上传、钱包及未来Whop商城" (`m2-spec.md` L73–L75). Unverified third-party capabilities, finance, entity and fee decisions, real money operations and production release are outside the 2026-09-16 authorisation (`m2-spec.md` L83), and they stay outside this approval unless the signature names them.

## Sources

**Repository files** (at `15df257` unless marked working tree)

- `AGENTS.md`; `CONTEXT.md`
- `docs/PRD.md` (L36; §7 L131), working tree
- `docs/ARCHITECTURE.md` (L20, L52, L57, L58, L84; §4 L90–L105; L139; §8 L145), working tree
- `docs/PROGRESS.md` (L7, L37, L38); `docs/repository-status.md`
- `docs/planning/specs/m2-spec.md` (L13, L17, L34–L41, L45–L49, L53, L57–L67, L73–L75, L83, L87, L89)
- `docs/planning/tickets/m2-00.md` (L9, L13–L15, L23, L27–L31), `m2-01.md` (L22, L23, L27, L36, L42), `m2-02.md` (L9, L23, L33, L41), `m2-03.md` (L9, L21, L33), `m2-04.md` (L23), `m2-05.md`, `m2-06.md`, `m2-07.md`, `m2-08.md` (L9, L22, L23, L42), `m2-09.md` (L41), `m2-10.md` (L42); `docs/planning/catalog.json`
- `docs/m1-prototype/kickoff.md` (L18, L23, L28, L38, L40, L43–L57), `acceptance-record.md` (L5, L10–L36, L72–L253, L463, L479–L480), `known-issues.md` (L36, L44, L56, L61, L68–L76, L84–L120, L134–L176, "Testing limitations"), `demo-script.md`, `screenshots/`
- `phase-0/founder-inputs.md` (L9, L308, L322)
- `phase-0/foundation/campaign-defaults-v1.md` (L3, L6, L48–L50); `full-stack-proposal-v1.md` (L3, L7, L18, L20, L26, L46, L86, L92, L95, L99, L113, L117); `implementation-spec-content-rewards-v1.md` (§3 L36–L53, §7); `prd-content-rewards-v2.md` (L38, L40, L80, L91, L111, L179); `three-role-flows-v1.md` (L114); `localization-v1.md` (L3, L7, L21, L58, L73, L77); `design-system-v2/README.md` (L3, L7, L18); `external-interface-contracts-v1.md` (§1–§2)
- `phase-0/research/stack-audit-2026-09-15/frontend-auth-audit.md`, `database-jobs-audit.md`
- `.github/workflows/web.yml` (L31, L52, L60), `.github/workflows/planning.yml`, `.github/pull_request_template.md`; `scripts/check-planning.py`
- `package.json`, `pnpm-workspace.yaml`, `.gitignore` (L5–L9), `apps/web/.gitignore` (L33–L34), `apps/web/package.json` (L44), `apps/web/next.config.ts`, `apps/web/eslint.config.mjs`, `apps/web/vitest.config.mts`, `apps/web/playwright.config.ts`; `.codex/hooks.json`; `.agents/skills/`
- `apps/web/src/domain/`: `types.ts` (L21, L38–L74, L461–L473, L619), `permissions.ts` (L25–L44, L57–L66, L98–L100), `engine.ts` (L2576–L2611), `rules.ts` (L37–L60, L85–L216, L244–L297), `ids.ts` (L1–L6), `money.ts` (L13), `index.ts`, and the `*.test.ts` files (`engine.deadlines.test.ts` L182, L216, L246; `engine.submission.test.ts` L72)
- `apps/web/src/store/demo-store.ts` (L127), `use-become-role.ts`, `actor.ts`, `command-id.ts`, `selectors.test.ts`
- `apps/web/src/app/layout.tsx` (L40–L59); `apps/web/src/components/app/providers.tsx` (L22, L38), `workspace-switcher.tsx` (L44), `demo-toolbar.tsx` (L405–L416), `require-role.tsx`; `apps/web/src/app/(public)/sign-in/sign-in-view.tsx` (L92); `apps/web/src/app/(public)/campaigns/[id]/page.tsx` (L4, L26); `features/merchant/campaign-editor-view.tsx` (L54), `features/merchant/campaign-form.ts` (L21), `features/creator/submit-view.tsx` (L42), `features/ops/ops-shared.tsx` (L41)
- `apps/web/tests/e2e/acceptance.spec.ts`, `shell.spec.ts` (L129, L154, L172), `i18n.spec.ts` (L74), `helpers.ts` (L444)
- `apps/web/node_modules/next/dist/docs/01-app/`: `03-api-reference/03-file-conventions/proxy.md`, `03-api-reference/03-file-conventions/route.md`, `03-api-reference/04-functions/cookies.md`, `02-guides/authentication.md`, `02-guides/data-security.md`, `02-guides/self-hosting.md`, `02-guides/cdn-caching.md`, `02-guides/upgrading/version-16.md`; `apps/web/node_modules/next/package.json`

**Commands** (2026-09-23)

- `gh api repos/:owner/:repo/branches/main/protection` (orchestrator check); `gh api repos/:owner/:repo/milestones/1`; `gh api repos/BELCORT-SDN-BHD/wringy/milestones` (with and without `?state=all`); `gh api repos/:owner/:repo --jq '{security_and_analysis, visibility}'`; `gh api repos/:owner/:repo/environments`; `gh api repos/pnpm/pnpm/issues/9276`
- `gh issue view 1` (JSON and `--comments`); `gh issue view 9 --comments`; `gh issue view 14`; `gh issue view 16/21/26/27/29/31/32/33/34/35 --json number,title,milestone`; `gh issue list --search 'milestone:"M1 · 三端交互原型"' --state all`; `gh pr view 77 --json statusCheckRollup`
- `git rev-parse --short HEAD`; `git status --short`; `git diff --stat`, `git diff -U0` (on `docs/ARCHITECTURE.md` and `docs/PRD.md`); `git log`; `git show HEAD:docs/ARCHITECTURE.md`; `git ls-files | grep -iE "supabase|migration|apps/api|fastify|\.sql$|pg-boss"`
- `pnpm --filter web test`; `python -X utf8 scripts/check-planning.py`; `node --version`
- `npm view` for: pg-boss (including `@11.0.0` and `@10.4.2`), fastify, @supabase/supabase-js, @supabase/ssr, @supabase/auth-js, pg, jose, @fastify/jwt, get-jwks, fast-jwt, node-pg-migrate, dbmate, graphile-migrate, supabase, dependency-cruiser (including `@16` and `@17.4.3`), eslint-plugin-boundaries, embedded-postgres (dist-tags, versions, `@17.10.0-beta.17`), @embedded-postgres/windows-x64, zod, typebox, @sinclair/typebox, @fastify/type-provider-zod, fastify-type-provider-zod, @fastify/type-provider-typebox, concurrently, tsx, next, vitest@4.1.11, @playwright/test@1.63.0, @types/node@24, http-cache-semantics, @electric-sql/pglite
- `grep`, `find`, `wc -l`, `ls` as cited inline; `graphify query` (orientation)
- Scratch probes under `C:/Users/zhant/AppData/Local/Temp/claude/C--Users-zhant-Desktop-wringy/2814900c-d0d1-4c24-86da-a71fe9d25939/scratchpad/`: `epg-probe/probe.mjs`, `npmrc-test`, `npmrc-test2`

**URLs** (fetched 2026-09-23 unless noted)

- Node.js and Fastify: https://raw.githubusercontent.com/nodejs/Release/main/schedule.json; https://nodejs.org/dist/index.json; https://raw.githubusercontent.com/fastify/fastify/main/docs/Reference/LTS.md; https://raw.githubusercontent.com/fastify/fastify/v5.12.5/.github/workflows/ci.yml; https://fastify.dev/docs/latest/Reference/LTS/; https://raw.githubusercontent.com/fastify/fastify-type-provider-zod/main/src/core.ts; https://github.com/fastify/fastify-jwt
- pg-boss and migration tools: https://raw.githubusercontent.com/timgit/pg-boss/master/README.md and `docs/install.md`, `docs/api/constructor.md`, `docs/api/ops.md`, `docs/api/queues.md`, `docs/api/scheduling.md`, `docs/cli.md` under the same path; https://raw.githubusercontent.com/salsita/node-pg-migrate/main/docs/src/cli.md; https://github.com/amacneil/dbmate
- Supabase: https://supabase.com/docs/guides/auth/server-side/nextjs; https://supabase.com/docs/guides/auth/server-side/advanced-guide; https://supabase.com/docs/guides/auth/signing-keys; https://supabase.com/blog/jwt-signing-keys; https://supabase.com/docs/guides/auth/jwts; https://supabase.com/docs/guides/auth/jwt-fields; https://supabase.com/docs/reference/javascript/auth-getclaims; https://supabase.com/docs/reference/javascript/auth-getuser; https://supabase.com/docs/guides/auth/signout; https://supabase.com/docs/guides/auth/sessions; https://supabase.com/docs/guides/auth/debugging/error-codes; https://supabase.com/docs/guides/auth/social-login/auth-google; https://supabase.com/docs/guides/auth/managing-user-data; https://supabase.com/docs/guides/auth/auth-identity-linking; https://supabase.com/docs/guides/auth/identities; https://github.com/orgs/supabase/discussions/34270; https://supabase.com/docs/guides/database/postgres/row-level-security; https://supabase.com/docs/guides/database/postgres/roles; https://supabase.com/docs/guides/database/postgres/roles-superuser; https://supabase.com/docs/guides/api/using-custom-schemas; https://supabase.com/docs/guides/database/connecting-to-postgres; https://supabase.com/docs/guides/database/connection-management; https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP; https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI; https://supabase.com/docs/guides/troubleshooting/tenant-or-user-not-found; https://supabase.com/docs/guides/getting-started/api-keys; https://supabase.com/docs/guides/local-development/cli/getting-started; https://supabase.com/docs/reference/cli/supabase-db-push; https://supabase.com/docs/guides/deployment/branching; https://supabase.com/pricing; https://supabase.com/docs/guides/platform/regions; https://supabase.com/docs/guides/platform/upgrading; https://supabase.com/changelog/46080-self-hosted-supabase-upgrading-from-pg-15-to-17-breaking-change; https://supabase.com/docs/guides/self-hosting/postgres-upgrade-17 (search result only)
- Google: https://developers.google.com/identity/openid-connect/openid-connect; https://developers.google.com/identity/protocols/oauth2; https://developers.google.com/identity/protocols/oauth2/production-readiness/overview
- Render: https://render.com/pricing (no readable prices); https://render.com/docs/free; https://render.com/docs/compute-plans; https://render.com/docs/new-workspace-plans; https://render.com/docs/custom-domains; https://render.com/docs/node-version; https://render.com/docs/rollbacks; https://render.com/docs/docker; https://feedback.render.com/features/p/ipv6-support (search result only)
- Resend: https://resend.com/pricing; https://resend.com/docs/dashboard/domains/introduction
- GitHub: https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment; https://docs.github.com/en/actions/reference/security/secrets; https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers; https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers; https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/troubleshooting-required-status-checks (search excerpt); https://docs.github.com/en/organizations/managing-membership-in-your-organization/inviting-users-to-join-your-organization
- Other tools: https://github.com/javierbrea/eslint-plugin-boundaries; https://github.com/sverweij/dependency-cruiser; https://github.com/leinelissen/embedded-postgres#readme; https://www.docker.com/pricing/faq/; https://pnpm.io/npmrc; https://pnpm.io/cli/deploy; https://pnpm.io/motivation; https://docs.djangoproject.com/en/5.1/ref/django-admin/

**Context7:** `/supabase/ssr` (configuration, design, types); `/supabase/supabase` (jwt-fields, oauth-server/token-security, row-level-security, using-custom-schemas, securing-your-api); `/panva/jose` (RemoteJWKSetOptions, jwtVerify); `/websites/salsita_github_io_node-pg-migrate`; `/graphile/migrate`; `/fastify/fastify` (Getting-Started, Type-Providers, Validation-and-Serialization, Logging); `/colinhacks/zod` (api.mdx); `/vitest-dev/vitest` (db-transaction recipe, lifecycle); `/vercel/next.js` (output, with-docker, route-groups); `/microsoft/playwright` (test-webserver)
