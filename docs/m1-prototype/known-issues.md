# M1 prototype — known issues and limitations

What the prototype does not do, what it does in a way a reviewer should know about, and what is
deferred. Nothing here is a business-rule change: where a rule and the prototype differ, the rule
wins and the gap is written down.

Recorded 2026-09-22 against branch `feat/m1-prototype`, and revised the same day after the wave-4
adversarial review. Defects that review found were fixed rather than recorded; what is recorded here
is what M1 genuinely does not do, plus the rules it can only record and not simulate.

## Demo-only by design (not defects)

These follow directly from the M1 scope in [issue #1](https://github.com/BELCORT-SDN-BHD/wringy/issues/1)
and the [kickoff decisions](kickoff.md). They are listed because each one is a thing a reviewer could
otherwise mistake for a real capability.

- **Nothing leaves the browser.** No Google OAuth, no platform collection, no email send, no payment
  request. Sign-in is a simulated identity; the "simulated email preview" is rendered from the same
  copy the page uses and says "not sent".
- **One browser, no sync.** Demo records live in this browser's `localStorage` under one versioned
  key. A refresh keeps progress; a different device, browser or profile starts from the seed. Two
  people cannot look at the same demo state. In a private window or with site data blocked, the demo
  runs and says it will forget.
- **One simulated clock.** Time moves only when the demo tools move it, and it never moves backwards.
  Everything dated in the prototype derives from that clock, so "now" in the UI is not the wall clock.
- **Role switching is a demo tool, not authorisation.** Permission checks run in the engine, so a
  hidden control and a refused command always agree — but this is a simulated check, and M3 must
  re-verify every one of them in a server transaction. A browser-side constraint is not fund safety.
- **The service fee is never a number.** It reads "pending configuration, not charged in demo"
  everywhere. The 15% from the investor example is deliberately absent.
- **Paid means the simulated provider account.** Bank settlement is a separate fact and stays
  "unknown" unless it is set; the prototype never infers it from a provider success.
- **Refunds are not modelled.** A closing campaign discloses the unused pool and the unconfirmed tail
  and shows the refund as "pending verification". There is no refund command and no refund route.
- **No search-engine or link-preview claim.** Public pages carry titles and descriptions, but nothing
  is deployed publicly, so no indexing or unfurling has been verified.

## Language

- **English is the source copy; Malay and Chinese are drafts.** All three catalogues carry identical
  key sets, identical interpolation parameters and no empty strings, and that is enforced by
  `src/i18n/messages.test.ts` plus a trilingual route walk with the browser console under watch.
  What is *not* verified is the wording: the ms-MY and zh-Hans-MY strings have not been reviewed by a
  native speaker or a legal reviewer. Treat every non-English amount, deadline or refusal sentence as
  a draft that needs review before anything is shown to a merchant or creator.
- The Malay for the money and deadline vocabulary follows the existing EN/MS/简体中文 convention and
  invents no new locale mapping, but the register has not been checked for consistency across the
  three role areas, which three different workers wrote.

## Unreachable and unexercised branches

Code paths that exist, are typed and are covered by an engine test, but that no UI route can reach in
M1. They are listed rather than deleted because they are the correct behaviour for M2, and rather
than faked because a scenario that needs a rule bent is not a demo state.

- **`connection_invalid` from the creator submit form.** The connection select disables an unusable
  connection and names the reason next to it, so the form cannot send a submission against one. The
  engine's refusal is therefore never rendered from that page. The engine path is covered by
  `src/domain/engine.submission.test.ts`; the UI shows the reason and the reconnect action on
  `/creator/accounts` instead.
- **The merchant overview's "no campaigns at all" empty state.** The seed always gives Kopi Kita at
  least one campaign, and no demo action deletes a campaign, so the truly-empty overview cannot be
  reached from the demo. What *is* reachable and is covered is the refusal path (a creator opening
  `/merchant`). Adding a scenario or a demo-tool action purely to reach this branch was considered and
  rejected: the scenario list should describe business situations, not code coverage.
- **The mobile navigation panel's accessible name is the vendor's English.** `ui/sidebar.tsx` renders
  the mobile `Sheet` with an `sr-only` `SheetTitle` "Sidebar" and description "Displays the mobile
  sidebar.", which is the dialog's accessible name in ms-MY and zh-Hans-MY too. Those files are
  upstream registry sources the project re-runs from the CLI rather than hand-edits
  ([kickoff](kickoff.md), `apps/web/README.md`), and localization-v1 says to record a gap the official
  composition cannot hold rather than modify the component. The close controls on every product dialog
  and sheet **were** fixed at the call site — `showCloseButton={false}` plus
  `components/app/close-icon-button.tsx`, which reads `common.shell.close` — because a call site is
  reachable; the sidebar's own header is not. Fixing it needs either an upstream change or a decision
  to fork that one file.

*(`baseline_unavailable` used to be listed here as unreachable. It is not: the demo tools' campaign
readiness switch turns a published campaign's data source off, and a submission made after that lands
in exactly that state. It is reached through the panel and the real submit form by
`tests/e2e/creator.spec.ts` "a missing baseline is not fabricated".)*

## Rules the prototype records but does not simulate

Where the prototype cannot evaluate an approved rule, it says so on the control rather than letting
the copy promise behaviour the engine does not have. Each one needs an owner decision before M3.

- **"Independent cap per platform" records the merchant's permission and changes no amount.**
  campaign-defaults-v1 (approved 2026-09-14) allows independent per-platform caps only
  "商家明确允许时", and D06 keeps that permission. `crossPlatformIndependentCap` is stored, validated,
  editable and displayed, and the engine reads it nowhere: a `Submission` is identified by (campaign,
  platform, post id) and carries **no content identity**, so the prototype cannot tell one video
  re-posted on two platforms from two different videos. Every accepted post is therefore capped on its
  own whichever way the switch is set, which honours the cap as campaign-defaults defines it
  ("单条上限|同一视频在本活动累计RM100") but does not demonstrate the OFF case. The editor now states
  this next to the switch in all three languages instead of promising shared-cap grouping. Making the
  flag load-bearing needs a content-identity decision (what makes two posts "the same content", and on
  whose evidence), which is a product decision, not an implementation one.
- **A deadline extension is not scoped to a remaining claimable amount.** campaign-defaults-v1 申请期限
  says "受阻延展针对受影响申请", and the engine now refuses an extension for a block of zero duration
  (nothing was blocked). It still grants one when the block has cleared but nothing is left to claim —
  for example a full-amount claim that has just been confirmed. The same paragraph says the grace
  explicitly does not guarantee budget ("不保证预算"), and the pending-case extension is the one P09
  demonstrates to all three roles, so narrowing it to "only when an amount remains" would remove a
  recorded acceptance result on a reading the rule does not settle. Left as is, with the reason
  recorded, for the owner to decide.
- **The demo tools work without a signed-in identity, and the audit row says so.** `checkPermission`
  admits every `demo.*` command before the guest check, deliberately and with a unit test
  (`permissions.test.ts`: "Demo tools stay available: they are an explicitly simulated panel"), because
  the panel is a simulation surface rather than a product surface. That means a settlement decided by
  the simulated provider while nobody is signed in has no operator. The audit row no longer drops the
  actor line silently — it reads "No signed-in identity (demo tools)" — but the panel is still not
  identity-gated. M3 re-verifies every one of these server-side anyway.

## Deferred

- **A demo-tools preset for "the last day of the submission window".** The clock section offers
  +1 hour, +1 day, +7 days and jumps to the metering end and the claim deadline. Reaching publish +
  13 days 23 hours by hand is thirty interactions. The rule itself — a link accepted on the last day
  still gets the full 7-day metering window — is covered by an engine test
  (`engine.deadlines.test.ts`, "gives a link accepted on the last day a full metering window") and by
  an end-to-end test that sets the clock with the same `demo.advanceClock` command the panel sends and
  then submits through the real creator control. A panel preset would need its own campaign picker to
  be honest about which campaign's window it is jumping to, so it is deferred rather than half-built.
- **`prefers-reduced-motion` is honoured by a global baseline rule, not verified per animation.**
  `tw-animate-css` 1.4.0 ships no reduced-motion rule of its own, so `globals.css` carries a standard
  baseline (`animation-duration` and `transition-duration` collapsed to 0.01 ms under
  `prefers-reduced-motion: reduce`; an accessibility affordance, not a motion redesign). The
  acceptance suite verifies that reduced-motion emulation *renders correctly and raises no error*;
  it does not assert that every animation is suppressed. That baseline is also the **one deliberate
  departure** from `design-system-v2/color-policy.md`, which reserves "CSS outside `:root`"; the v2
  showcase carries the same rule, and `apps/web/README.md` names the departure too.
- **No dark theme.** The prototype ships light only. The `.dark` block in `globals.css` is the shadcn
  CLI's neutral default and is not part of the carried-over palette.
- **`/campaigns/[id]` metadata comes from the baseline seed.** The server cannot read the visitor's
  `localStorage`, so a campaign a scenario created locally falls back to the catalogue title and
  description in the page metadata. The page body is correct; only the `<head>` is generic.
- **`@tanstack/react-table` is not installed.** The `radix-nova` `table.tsx` is presentational and no
  page needs sorting or virtualisation yet.

## Testing limitations

- **One browser engine.** Every Playwright project uses Chromium (`devices['Desktop Chrome']`) at
  three viewports. No Firefox, no WebKit, no real mobile device, no touch emulation. A layout or
  focus difference in Safari would not be caught.
- **320px is a spot check, not a full pass.** Following issue #1 ("最低检查手机390px与电脑1440px，并
  抽查320px"), the P01–P11 rows run at 390 and 1440 and are skipped in the `small` project; the 320px
  work is a dedicated set of tests asserting no sideways scroll and no covered primary action on the
  submission detail, the merchant editor, the operations claim page and the payout page. A visual
  review of every page at 320px has not been done.
- **The screenshots are viewport-clipped, not full-page.** Neither `sharp` nor `pngquant` resolves in
  this workspace, so clipping is the only size control available; each tracked frame is asserted to be
  at most 300 KB. A clipped frame does not show content below the fold.
- **No visual-regression comparison.** Nothing asserts pixels. The screenshots are evidence for a
  human reviewer, not a baseline a test compares against.
- **No accessibility audit tool.** The keyboard and focus-return checks are hand-written assertions on
  the claim dialog and the reject-with-reason dialog. No axe or Lighthouse run has been made, so
  contrast, landmark structure and screen-reader output are unverified.
- **The dev server occasionally dies under a cold parallel run.** Turbopack reported an internal error
  and dropped its filesystem cache the first time several workers compiled a brand-new route at once
  (`ERR_CONNECTION_REFUSED` on `/demo`). Re-running against a warm server passed. If a full suite run
  fails with connection-refused rather than an assertion, warm the route once with `pnpm dev` and run
  again.

## Things a reviewer is likely to ask about

- **Why is the demo-tools trigger still floating?** It is the one control that must be reachable from
  every page without being part of any page, and it is anchored bottom-right. Every scrolling page
  reserves a bottom safe area equal to its height (`DEMO_SAFE_AREA_CLASS` in
  `src/components/app/demo-badge.tsx`), and the 320px spot checks assert that no primary action ends
  up underneath it. The floating *"Demo data"* badge that used to sit bottom-left was removed in
  wave 3 for exactly the reason it would have failed those checks; the mark now lives in the header at
  every viewport.
- **Why does closing a campaign require a reason?** Both `campaign.close` and
  `campaign.closeSubmissions` carry a `reason` that the engine validates as non-empty and stores on
  the audit entry, so the campaign history can show it. Before wave 3 the dialog asked for a reason and
  threw it away, which is worse than not asking.
- **Why do the timelines all read the same now?** One shared map (`src/lib/audit-copy.ts` with
  `common.actions.*` in all three locales) covers every command type, and a type error is raised if a
  command is added without copy. The merchant and creator timelines used to render raw command codes
  such as `claim.reviewMetering`. The *reason* column got the same treatment in wave 4
  (`src/lib/reason-copy.ts` with `common.reasons.*`): a generated code such as `qualified_views_added`
  or `claimable:500` now reads as a sentence with the engine's own number inside it, while a reason a
  person typed is still rendered verbatim, which localization-v1 requires. The one deliberate
  exception is the operations audit badge, which shows `before → after` in a monospace face as a
  technical value rather than prose.
- **Why can a claim not be filed while the source is unreadable?** campaign-defaults-v1 申请、排队与预留
  makes verifiable data a condition of a valid claim ("有效申请须满足资格、门槛和可核验数据条件"), and the
  PRD forbids entering the reserved queue on an unverifiable reading. The last trusted number and its
  time stay on screen — unknown is never read as zero — but the claim waits. That is also what makes
  the outage deadline extension honest: the outage really did block new claims while it ran.
- **Why is a finally rejected amount still deducted from what is claimable?** The reservation itself
  goes back to the pool, which is what "最终拒绝才释放" means, and the four buckets show it. What the
  per-post accounting remembers is that the amount was already claimed once:
  "追加申请仍须新增奖励≥RM5，不能重复使用已申请的金额". So a further claim needs qualified views the
  rejected claim did not cover, and the uncovered remainder of a partly rejected claim stays
  claimable. Without this, "最终拒绝" would decide nothing and the same frozen evidence could be re-filed
  the moment operations released it.
- **Why is "Rejected · appeal open" gone?** A rejected appeal returns the claim to the same
  `rejected_appealable` status, so the old label asserted an appeal was open on a claim that had
  already lost one. The badge now reads "Rejected · reservation held", which is true in both cases, and
  the appeal's own status badge appears beside it in the creator and operations lists.
