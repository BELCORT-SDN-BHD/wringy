# M1 prototype — kickoff record

2026-09-22. Implementation entry for milestone [M1 · 三端交互原型](https://github.com/BELCORT-SDN-BHD/wringy/milestone/1), tickets [#2](https://github.com/BELCORT-SDN-BHD/wringy/issues/2)–[#9](https://github.com/BELCORT-SDN-BHD/wringy/issues/9) under spec [#1](https://github.com/BELCORT-SDN-BHD/wringy/issues/1). This file is the "开工规格记录" the tickets ask for: what is being built, where it lives, which decisions were taken to start, and how work is split. Business rules are not redefined here; the sources are [campaign-defaults-v1](../../phase-0/foundation/campaign-defaults-v1.md), [implementation spec D01–D06](../../phase-0/foundation/implementation-spec-content-rewards-v1.md) and the [prototype spec](../../phase-0/foundation/milestones/prototype-spec-v1.md).

Status: 2026-09-22, branch `feat/m1-prototype`. Waves 0–3 are built: the scaffold and engine, the app shell and public pages, the three role workspaces, the deadline and closure pass across roles, the guided demo entry at `/demo`, the P01–P11 acceptance suite and this documentation set. Wave 4 (adversarial review against every ticket's acceptance list, then the PR) has not run. The executed acceptance results and their evidence are in [acceptance-record.md](acceptance-record.md), the run instructions and what to look at in [demo-script.md](demo-script.md), and the limitations in [known-issues.md](known-issues.md); nothing is passed by this file.

## What M1 is

A locally runnable Next.js prototype in which one simulated campaign runs through three roles (merchant, creator, operations incl. a separate finance capability) on one shared record set. Everything is explicitly simulated: identity, clock, view data, notifications, email previews and payouts. Every page carries a visible "Demo data" mark. No real Google OAuth, network collection, email or payment requests are made.

Out of scope (per spec): real auth, multi-device sync, Fastify/DB, social OAuth or scraping, real email/payment, video upload, marketing site, AI clipping, shop/courses, production anti-fraud.

## Where it lives

| Path | Content |
|---|---|
| `apps/web/` | Next.js App Router prototype (TypeScript, Tailwind v4, official shadcn `radix-nova` components carried over from the design-system showcase, next-intl, zustand persist, Vitest, Playwright) |
| `apps/web/src/domain/` | Pure TypeScript demo engine: types, money, rules, `applyCommand`, seed, scenarios, selectors. No React. Unit-tested. This is the "replaceable data access layer": M2 swaps the store's engine call for Fastify calls. |
| `apps/web/src/store/` | zustand store persisting `DemoState` to `localStorage`; the only caller of `applyCommand` |
| `apps/web/src/app/` | Routes: public (`/`, `/campaigns`, `/campaigns/[id]`, `/sign-in`), `creator/*`, `merchant/*`, `ops/*`, `/notifications`, `/settings` |
| `apps/web/src/components/ui/` | Official shadcn sources (unchanged except for `"use client"` where Next.js requires it) |
| `apps/web/src/components/app/` | Shared app components (shell, demo badge, demo toolbar, status badges, budget buckets, money/date text, empty/loading/forbidden states, email preview) |
| `apps/web/src/features/{merchant,creator,ops}/` | Role feature components and hooks |
| `apps/web/src/messages/{en-MY,ms-MY,zh-Hans-MY}/*.json` | Trilingual copy, one file per namespace (`common`, `public`, `merchant`, `creator`, `ops`, `notifications`, `demo`) |
| `apps/web/tests/e2e/` | Playwright acceptance runs (390 px, 1440 px, 320 px spot checks) and screenshots |
| `docs/m1-prototype/` | This record, [demo script](demo-script.md), [acceptance record](acceptance-record.md), [known issues](known-issues.md), screenshots |

Root `package.json` + `pnpm-workspace.yaml` only proxy scripts to `apps/web`; the workspace shape leaves room for `apps/api` and `apps/worker` in M2 without promising them now.

## Decisions taken to start (owner may overrule; none changes a business rule)

1. **Money is integer sen.** Reward math uses integer arithmetic: `exactMilliSen = views × ratePerThousandSen` (i.e. thousandths of a sen), `cappedSen = floor(min(exactMilliSen, cap × 1000) / 1000)`; claimable = capped − (reserved + confirmed unpaid + paid). This is the approved "cap first, floor to sen, subtract exclusive occupancy" rule (D01). The display formatter never writes back to the state.
2. **One simulated server clock.** `state.clock.nowIso` (base `2026-09-01T12:00:00+08:00`) and a monotonic `seq` decide every timestamp and queue position. Only the demo toolbar advances time. This reproduces the approved example: acceptance 1 Sep 12:00 → metering ends 8 Sep 12:00 → claim deadline 15 Sep 12:00.
3. **Four status lines stay separate.** Content review (merchant, on the submission), metering review (ops, on the claim), claim status, payout attempt status. A claim confirms only when both reviews are approved. Rejection keeps the reservation until ops explicitly finalises after the 7-calendar-day appeal window or a rejected appeal.
4. **Partial offers and waitlist are not claims.** An offer reserves nothing and holds no queue position until the creator consents to the exact server amount and versions; any budget change makes the offer stale. Below the minimum, the entry goes to the waitlist with no reservation; on budget recovery it is notified and resubmits for a new sequence.
5. **Payout unknown has no "pay again".** Unknown attempts can only be reconciled against the original attempt; controlled retry needs a confirmed failure. "Paid" means funds available in the simulated provider account; bank settlement is shown as a separate unknown fact.
6. **Deadline extensions are computed, not typed.** When a data outage or an open case blocked new claims across the metering end, clearing the block grants the full published grace from the unblock time, records the reason, and notifies; metering never re-opens and queue times are never back-dated.
7. **Roles.** One simulated Google identity ("Demo User") owns both the creator workspace and the merchant org "Kopi Kita"; the switch sits where the real product would put it. Operations reviewer and finance are separate simulated users reachable only from the demo toolbar. Permission checks run in the engine (not only by hiding buttons) and are labelled as demo checks, not production security.
8. **Locale.** `en-MY`, `ms-MY`, `zh-Hans-MY` via next-intl without locale routing; the locale lives in the persisted session and a cookie for server metadata. Switching re-renders in place so form input survives. First visit shows the inline "Which language would you prefer?" prompt with skip.
9. **Persistence and reset.** Only `DemoState` (demo records) is stored in `localStorage` under one key with a schema version; reset returns to the seed after an AlertDialog confirmation. No credentials or real personal data are stored.
10. **Service fee** is rendered as "pending configuration, not charged in demo" and is never a number.

## Seed (baseline state)

- Users: `user-demo` (Demo User; creator; member of `org-kopi`), `user-ben` (another creator), `user-ops-reviewer`, `user-ops-finance`.
- Orgs: `org-kopi` (Kopi Kita), `org-other` (Nusantara Fit).
- Campaigns: `cmp-kopi-raya` published by Kopi Kita at the base clock with approved defaults; `cmp-other-fit` published by Nusantara Fit; `cmp-kopi-draft` draft.
- Connections: Demo User TikTok valid, Instagram invalid (token expired); Ben TikTok valid.
- Submissions: Ben has one metering submission in `cmp-other-fit` (isolation demo). Demo User has none (empty states).
- Notifications: two preset for Demo User (one unread, one read).
- Scenarios (`demo.loadScenario`) rebuild from the seed by replaying commands, so every scenario is reproducible after reset: `baseline`, `main_flow_ready`, `partial_budget`, `waitlist`, `rejection_appeal`, `payout_unknown`, `payout_failed`, `deadline_extension`, `campaign_closure`, `data_outage`.

## Ticket → build mapping

| Ticket | Build | Acceptance |
|---|---|---|
| #2 browse & enter | scaffold, shell, public pages, simulated sign-in, language, notifications centre, settings, demo toolbar, reset, empty/loading/forbidden states | P03, P10, P11 |
| #3 merchant configure/publish | merchant campaigns list, editor with defaults, validation (min > cap blocked; high threshold + low cap allowed with explanation), preview/readiness, publish → public catalogue, notifications | P02, P10, P11 |
| #4 creator submit | accounts page (valid/invalid), submit URL with post-id dedup and cross-campaign block, submission detail (baseline, window, qualified views, last trusted time, estimate vs confirmed), demo views/time panel, ops resync | P04, P05, P10, P11 |
| #5 claims & budget | claim request (full / partial consent / waitlist), one pending per submission, idempotent double click, four buckets 1995/5/0/0 in all roles | P05, P06, P10, P11 |
| #6 review & appeal | merchant content decision with reason, ops metering approve/hold/reject, escalation after 48 h, appeal file/uphold/reject, finalise rejection, audit trail, role checks | P07, P08, P10, P11 |
| #7 payouts | finance-only payout start, processing/paid/failed/unknown, reconcile, controlled retry, 1995/0/0/5, creator payment records | P01, P08, P10, P11 |
| #8 deadlines & closure | metering end, grace, extension on outage/pending case, retention end, closure view with tails and refund pending | P09, P08, P10, P11 |
| #9 repeatable demo | demo entry (scenarios), run instructions, demo script, screenshots, P01–P11 record, known issues | P01–P11 |

## Work split and ownership (implementation)

Wave 0: bootstrap (`apps/web` scaffold, dependencies, config, official UI sources, CI workflow) — one worker.
Wave 1: domain engine + tests (`src/domain/**`) ‖ app shell, i18n plumbing, shared components, public pages, settings, notifications UI, demo toolbar (everything except `src/domain/**` and `src/features/**`).
Wave 2: merchant ‖ creator ‖ ops feature workers in isolated worktrees, each owning its `src/app/<role>/**`, `src/features/<role>/**` and `src/messages/*/<role>.json`. Shared files are additive only; requested edits to shared components go through the orchestrator.
Wave 3: deadlines/closure across roles, scenario presets, Playwright acceptance, documentation.
Wave 4: adversarial review against every ticket's acceptance list, fixes, PR, graph refresh, PROGRESS update, ticket evidence.

## Rollback

The prototype is additive: removing `apps/web/`, the root workspace files and `docs/m1-prototype/` restores the previous repository state. Persisted demo data lives only in the visitor's browser under a versioned key; a schema change bumps the version and the app offers reset instead of failing.
