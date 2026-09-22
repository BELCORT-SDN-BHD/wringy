# M1 prototype — acceptance record P01–P11

The executed result for every row of the acceptance table in
[issue #1](https://github.com/BELCORT-SDN-BHD/wringy/issues/1) (原型验收表). Every row carries an
actual result; a row that was not executed says **NOT EXECUTED** and says why.

This records what the prototype does. It is **not** a business acceptance: a simulated check is not
a production control, and M3 has to re-verify every money rule in a server transaction.

## Execution

| | |
|---|---|
| Executed | 2026-09-22 |
| Re-executed | 2026-09-22, after the wave-4 adversarial review (see "Wave 4" below) |
| Branch | `feat/m1-prototype` |
| Executed by | agent run, wave 3 (the integration worker); re-run by the wave-4 fix worker |
| Browser engine | Chromium only, via `devices['Desktop Chrome']` (`@playwright/test` 1.63.0) |
| Viewports | `mobile` 390×844, `desktop` 1440×900, `small` 320×568 |
| Runtime | Node 20.19.5, pnpm 10.33.0, Next 16.3.5 |
| Command | `pnpm --filter web exec playwright test acceptance.spec.ts` |
| Result | **46 passed, 29 skipped, 0 failed** |

The 29 skips are the viewport split the spec itself asks for
("最低检查手机390px与电脑1440px，并抽查320px不出现关键操作被遮挡"): the 21 P-row and keyboard tests
run at 390 and 1440 and are skipped in the `small` project, and the 4 spot-check tests run only in
`small`. Each skip carries that reason in the runner output. No test was skipped because it failed
or was unfinished.

Supporting suites, run on the same commit:

| Suite | Command | Result |
|---|---|---|
| Engine and copy catalogue | `pnpm --filter web test` | 297 passed, 0 failed, 23 files |
| Whole end-to-end suite | `pnpm --filter web e2e` | **312 passed, 33 skipped, 0 failed**, 4.7 min |
| Lint | `pnpm --filter web lint` | clean |
| Types | `pnpm --filter web typecheck` | clean |
| Production build | `pnpm --filter web build` | succeeds, 36 routes, all `ƒ (Dynamic)` |

The end-to-end totals per Playwright project:

| Project | Viewport | Passed | Skipped | Failed |
|---|---|---|---|---|
| `mobile` | 390×844 | 110 | 5 | 0 |
| `desktop` | 1440×900 | 110 | 5 | 0 |
| `small` | 320×568 | 92 | 23 | 0 |

All 33 skips are deliberate viewport scoping, not unfinished work: 29 are the acceptance split
described above, and 4 pre-date this run — `merchant.spec.ts` › "the editor keeps its primary action
reachable at 320px" is skipped outside `small`, and the two screenshot-capture tests in
`creator.spec.ts` and `merchant.spec.ts` are skipped in `small`.

Screenshots are viewport-clipped (not full-page) and each one is asserted by the test that writes it
to be at most 300 KB. Neither `sharp` nor `pngquant` resolves in this workspace, so clipping is the
only size control available; see [known-issues.md](known-issues.md).

## The rows

### P01 — all three roles complete the same campaign

**PASS.** Ran the whole main flow from the seed, with no state edited by hand: the creator submits a
link through the real form, the demo tools add 1,000 qualified views, the creator files the claim,
the merchant approves the content, operations approves the metering, operations finance starts the
simulated payout and the simulated provider answers "funds available". The four amounts were then
read in all three roles and matched.

- Spec: `acceptance.spec.ts` › "P01 all three roles complete one campaign" › "submit, claim, both
  reviews and a payout, with the four amounts agreeing everywhere"
- Amounts observed, in integer sen off the rendered `data-money`: 200000/0/0/0 → 199500/500/0/0 →
  199500/0/500/0 → 199500/0/0/500. One approval alone moved nothing.
- Evidence: `screenshots/p01-390.png`, `screenshots/p01-1440.png`
- Engine tests: `engine.mainflow.test.ts`, `engine.conservation.test.ts` (the four buckets always
  sum to the pool)

### P02 — the configuration is clear and validated

**PASS.** The draft opens on the approved defaults (pool RM2,000, RM5 per 1,000, minimum RM5, cap
RM100, 7-day metering, 7-day grace) and the service fee reads "pending configuration, not charged in
demo" rather than a number. A minimum claim above the cap is refused with a readable summary. A view
threshold of 100,000 with a cap of RM50 is accepted and the capped amount is explained. The preview
states the same numbers the editor holds **and the same derived sentence** — "At 100,000 qualified
views the reward is capped at RM 50.00" — because the arithmetic now lives in one engine function
(`capAtThreshold`) that both the editor's live alert and the shared rule sheet render from. The rule
sheet is literally the component the public campaign page and the creator's submit page render, so a
creator reads the capped amount too, which is what campaign-defaults asks
("必须明确展示'达10万观看，奖励封顶RM100'"). Until wave 4 only the editor stated it.

- Spec: `acceptance.spec.ts` › "P02 the configuration is clear and validated"
- Evidence: `screenshots/p02-390.png`, `screenshots/p02-1440.png`,
  `screenshots/p02-invalid-390.png`, `screenshots/p02-invalid-1440.png`
- Engine tests: `engine.campaign.test.ts`, `features/merchant/campaign-form.test.ts`

### P03 — browse first, then join

**PASS.** A signed-out visitor reads the rate, the cap, the minimum and the dates on the public
campaign detail. "Join" leads to the single simulated Google entry, and the page carries no email,
password or one-time-code control at all.

- Spec: `acceptance.spec.ts` › "P03 browse first, then join"
- Evidence: `screenshots/p03-public-390.png`, `screenshots/p03-public-1440.png`,
  `screenshots/p03-390.png`, `screenshots/p03-1440.png`

### P04 — the link and the simulated data are explicit

**PASS.** No upload entry anywhere and no `input[type=file]` in the document. The same post link
submitted again is refused with `duplicate_post` and exactly one submission remains stored. With the
source unreadable, the last trusted number and its time are kept and the page never shows 0 views.
A submission that never had a trusted reading at all now reports its money as **unknown** rather than
RM 0.00, and the cap progress bar is replaced by the cap figure alone: localization-v1 keeps a known
zero, an unknown and a not-applicable apart, and the recorded reserved / confirmed / paid amounts stay
numbers because those are read from the claims, not from the source. Until wave 4 that page printed
"Estimated reward RM 0.00" two rows under its own "unknown does not mean zero" note.

- Spec: `acceptance.spec.ts` › "P04 the link and the simulated data are explicit"
- Evidence: `screenshots/p04-duplicate-390.png`, `screenshots/p04-duplicate-1440.png`,
  `screenshots/p04-390.png`, `screenshots/p04-1440.png`
- Engine tests: `engine.submission.test.ts`

### P05 — the claim amount and the statuses agree

**PASS.** 1,000 qualified views at RM5 per 1,000 is RM5 claimable. Filing reserves it; a second
claim on the same submission is blocked while one is pending and the claim button is disabled, with
exactly one claim stored. Adding 30,000 further views does not pay 150: the cumulative cap of RM100
per post holds and the page says the cap was reached.

- Spec: `acceptance.spec.ts` › "P05 the claim amount and the statuses agree"
- Evidence: `screenshots/p05-pending-390.png`, `screenshots/p05-pending-1440.png`,
  `screenshots/p05-390.png`, `screenshots/p05-1440.png`
- Engine tests: `engine.claim.test.ts`, `money.test.ts` (cap first, then floor to sen)

### P06 — a partial budget and the waitlist

**PASS.** RM60 claimable against RM50 allocatable reserves **nothing** until the creator consents to
that exact amount; after consent the reservation is RM50 and the RM10 remainder is stored as
unreserved and not forfeited. A changed reading makes the offer stale and it has to be made and
consented to again. Below the minimum, the entry waits with no claim and no reservation.

- Spec: `acceptance.spec.ts` › "P06 a partial budget and the waitlist"; the stale-offer path is
  covered in depth by `creator.spec.ts` › "a partial budget needs an explicit consent, and a changed
  offer needs a new one"
- Evidence: `screenshots/p06-offer-390.png`, `screenshots/p06-offer-1440.png`,
  `screenshots/p06-390.png`, `screenshots/p06-1440.png`
- Engine tests: `engine.claim.test.ts`

### P07 — review and appeal

**PASS.** The written rejection reason is readable on the creator's claim page, the reservation is
still held, and the appeal deadline is shown. Filing an appeal keeps the reservation and does not
change the queue position or the amount. Operations cannot finalise the rejection while the appeal is
open — the release is a check, not a timer. An upheld appeal continues the check with the same
sequence number and the same amount.

**What happens after that continued check is now covered too, and was broken until wave 4.** An
upheld appeal returns the claim to verification, where reject is one of the three sanctioned
outcomes. That second rejection used to be a dead end: the creator could not appeal it
(`appeal_already_filed`) and operations could never release it (`appeal_upheld`, forever), so RM5 sat
reserved with no exit and the claim vanished from the operations queue. The appeal right and the
release now belong to the **rejection round** rather than to the claim, which is how
campaign-defaults words them ("拒绝后7个日历日可申诉", release once "待处理结束"). A second rejection
carries a fresh 7-day window, a second appeal, and a release once that window closes; the queue shows
it as work to finalise. The `appeal_upheld` block reason and its copy are gone because they were only
ever reachable in the broken state.

A release is also final for the evidence it judged. The reservation returns to the pool, but the
amount was claimed once ("追加申请仍须新增奖励≥RM5，不能重复使用已申请的金额"), so a further claim on the
post needs qualified views the rejected claim did not cover — while the uncovered remainder of a
partly rejected claim stays claimable. Until wave 4 the identical frozen snapshot could be re-filed
the moment operations released it, and with the post already accepted into a second campaign one post
id could hold a live claim in two campaigns at once (D06).

A claim can no longer be filed against content the merchant rejected. Such a claim could never
confirm (both reviews must approve) and a content decision is one-shot, so it only minted a
reservation with no way out; the creator's page now says `content_rejected` instead of offering an
enabled button.

- Spec: `acceptance.spec.ts` › "P07 review and appeal"
- Evidence: `screenshots/p07-rejected-390.png`, `screenshots/p07-rejected-1440.png`,
  `screenshots/p07-390.png`, `screenshots/p07-1440.png`
- Engine tests: `engine.review.test.ts` (including the 48-hour escalation that never auto-approves,
  and "a rejection after an upheld appeal": a fresh appeal right, a release once the new window
  closes, and the queue item for it); `engine.claim.test.ts` ("content review as a claim
  precondition", "a finalised rejection is final for the evidence it judged", "D06 as a standing
  invariant")

### P08 — payouts and the operations exceptions

**PASS.** An unknown provider result offers reconciliation only: there is no "pay again" control, the
start button is disabled, the retry control is absent, and the page states why. A confirmed failure
is the evidence a controlled retry needs, and only then is the retry control enabled. "Paid" is the
simulated provider account and bank settlement is shown as a separate fact.

The demo tools agree with that rule now. The panel used to list an **unknown** attempt with three
enabled outcome buttons — including "Funds available" — that the engine refuses one and all, and its
description claimed it could set a result for an unknown attempt in all three languages. The panel
offers only attempts the provider has not answered yet, and the description says an unknown attempt is
reconciled against the original transaction on the operations page. The creator's own payment record
also reads "Confirmed succeeded" rather than the raw `confirmed_succeeded`, from the same shared copy
operations reads.

- Spec: `acceptance.spec.ts` › "P08 payouts and the operations exceptions"
- Evidence: `screenshots/p08-unknown-390.png`, `screenshots/p08-unknown-1440.png`,
  `screenshots/p08-390.png`, `screenshots/p08-1440.png`
- Engine tests: `engine.payout.test.ts`, `src/store/selectors.test.ts`
  (`selectUnresolvedPayoutAttempts` offers exactly the processing attempt)

### P09 — the deadlines and the retention end are clear

**PASS**, across five tests.

1. **The 7/7 windows, read identically by three roles.** Accepted 1 Sep 12:00 → metering ends
   8 Sep 12:00 → claim deadline 15 Sep 12:00. The creator, the merchant and operations were compared
   on the `<time datetime>` instant, not on a rendered label, and all three matched.
   Evidence: `screenshots/p09-creator-*.png`, `screenshots/p09-merchant-*.png`,
   `screenshots/p09-*.png`.
2. **Views after the metering end are not counted, and the demo tools say so.** The clock was moved
   past the metering end through the panel, 5,000 views were added, the qualified total stayed at
   1,000, and the panel reported "the metering window has closed" instead of claiming it added them.
3. **An outage across the metering end grants the published grace again.** Reason recorded
   (`data_outage`), new deadline 16 Sep 12:00 computed from the unblock time, metering end unchanged
   at 8 Sep 12:00, and one notification each to the creator, the merchant and the operations
   reviewer. Evidence: `screenshots/p09-extension-*.png`.
   Two things behind this row changed in wave 4. The premise is now enforced: while the source is
   unreadable a new claim is refused, so the outage really did block the claims the grace is granted
   for ("有效申请须满足资格、门槛和可核验数据条件"), and it is no longer possible to claim off an
   untrusted reading. And a block of **zero duration** — the outage switch flipped on and straight
   off — grants nothing, because "阻挡新增申请时" needs a block to have existed. The extension reason
   also reads as a sentence in the notification and its simulated email in all three languages
   instead of interpolating the raw `data_outage`.
   The **pending-case** extension behind the same row has one more premise since the owner's ruling
   of 2026-09-22 ([#9](https://github.com/BELCORT-SDN-BHD/wringy/issues/9)): the grace is granted only
   when something is still claimable at the moment the block clears, asked through the shared
   eligibility ladder with only the deadline gate lifted. A case that cleared with nothing left to
   claim moves no deadline and sends no notification. The `data_outage` path this row demonstrates is
   unchanged; see [known-issues.md](known-issues.md) for the full ruling.
   The deadline instant itself is now consistent: at exactly 15 Sep 12:00 the window is open, the
   claim succeeds and no "claims are closed" notice goes out; one millisecond later the claim is
   refused and the notice is sent. The engine used to emit the notice at the instant while still
   accepting the claim, which contradicted the metering-ended copy's own promise
   ("you can still claim until …").
4. **A link accepted on the last submission day keeps a full window.** Accepted 15 Sep 11:00, one
   hour before intake closes: metering to 22 Sep 11:00 and the claim deadline to 29 Sep 11:00.
5. **The retention end names which of the four terminal points decided it.** D04 lists four
   ("公布保留期、适用申请截止、申请／申诉处理完成、已确认款项发放完成"), and a settlement that completes
   after the published period is now labelled as the settlement rather than as "the published
   retention period". Covered by `engine.deadlines.test.ts` › "names the settlement when a late
   payment decided the end".
6. **A closing campaign never reads as fully settled.** With an open appeal and a confirmed unpaid
   amount, both the merchant panel and the operations panel read "not fully settled" and list what
   they are waiting on; the unconfirmed tail below the minimum is disclosed before closure and the
   refund reads "pending verification". Evidence: `screenshots/p09-closure-merchant-*.png`,
   `screenshots/p09-closure-ops-*.png`.

- Engine tests: `engine.deadlines.test.ts`, 21 tests, including "runs 7 days of metering and 7
  calendar days of grace from acceptance", "gives a link accepted on the last day a full metering
  window", "grants the full published grace after a data outage spanning the metering end", "grants a
  grace when an open case blocked a claimable remainder past the metering end", "grants nothing when
  the case cleared with nothing left to claim", "grants nothing when a finally rejected case leaves no
  new amount", "has no end date while a case is open or money is confirmed unpaid", "never shows fully settled while an appeal or confirmed
  money is open", "shows fully settled only once every case and payout is resolved", "the claim
  deadline instant itself" (two tests) and "an extension needs a block that actually blocked
  something" (two tests). Also `engine.campaign.test.ts` › "refuses a close without a reason and
  stores the one it is given" and › "demo.setReadiness and who is told about it".
- **Deviation to note.** Test 4 sets the clock with the `demo.advanceClock` command the panel sends
  rather than by pressing the panel's buttons: reaching publish + 13 days 23 hours needs about thirty
  panel interactions because the presets are +1 hour, +1 day and +7 days. The submission itself is
  made through the real creator form and the window is read off the page. A panel preset for "the
  last day of the submission window" is recorded as deferred in
  [known-issues.md](known-issues.md).

### P10 — language, phone and notifications

**PASS.** All three languages were switched on the campaign editor with unsaved typed values,
including a mixed-script title, and every value survived each switch while `<html lang>` followed the
choice. One event produces one row per (event, recipient, role): the creator's list says "Received as
creator" and not "as merchant", and the merchant's says the reverse. Marking a row read survived a
reload, and the other role's row for the same event stayed unread. The simulated email preview opens
and says "not sent".

- Spec: `acceptance.spec.ts` › "P10 language, phone and notifications", two tests
- Evidence: `screenshots/p10-form-390.png`, `screenshots/p10-form-1440.png`,
  `screenshots/p10-email-390.png`, `screenshots/p10-email-1440.png`, `screenshots/p10-390.png`,
  `screenshots/p10-1440.png`
- Trilingual coverage beyond this row: `i18n.spec.ts` walks **every** route in the app — public,
  creator, merchant, operations reviewer, operations finance and `/demo` — in all three languages
  with the browser console under watch, so a `MISSING_MESSAGE` fails the run. It also asserts that a
  route a role may read does not land on the simulated refusal.
- Unit tests: `src/i18n/messages.test.ts` (identical key sets, identical interpolation parameters, no
  empty strings, every notification kind has a title, body and simulated email subject and body),
  `src/lib/audit-copy.test.ts` (every locale has copy for every audit action key),
  `src/lib/reason-copy.test.ts` (every generated reason code has copy in every locale, the engine's
  own numbers survive inside the localized wrapper, and a reason a person typed is passed through
  unchanged)
- **Engine codes no longer leak into the prose**, which they did until wave 4. The audit *reason*
  column rendered `qualified_views_added`, `claimable:500` and `read_failed_source_unreachable` raw on
  the merchant, creator and operations timelines and in the operations exception log; three
  notification parameters (`reason`, `outcome`, `missingReason`) interpolated the raw code into an
  otherwise translated sentence and its simulated email. Both go through shared `common.*` copy now,
  and one vocabulary serves every surface: `reconcileOutcome`, `missingReason` and `extensionReason`
  moved out of the operations namespace so the creator's payment record and the notification cannot
  drift from what operations reads.
- **Accessible names follow the language too**, for every product dialog and sheet: the official
  `DialogContent`/`SheetContent` render a hardcoded English `sr-only` "Close", so the call sites pass
  `showCloseButton={false}` and render `components/app/close-icon-button.tsx`, which reads
  `common.shell.close`. The mobile navigation panel's own `sr-only` title is still the vendor's
  English and is recorded in [known-issues.md](known-issues.md): it lives inside
  `src/components/ui/sidebar.tsx`, which the project re-runs from the CLI rather than hand-edits.
- **The Malay and Chinese wording is a draft.** Key parity is enforced; the register and the legal
  phrasing have not been reviewed by a native speaker. See [known-issues.md](known-issues.md).

#### The 320px spot check

**PASS**, four tests in the `small` project. Each asserts no sideways scroll and, for each primary
action: the bounding box lies inside the viewport, `document.elementFromPoint` at its centre resolves
to the control rather than something on top of it, and Playwright's full actionability set passes.

| Page | Action checked | Evidence |
|---|---|---|
| Creator submission detail | Claim button | `screenshots/p10-320-claim-320.png` |
| Partial-offer dialog | Consent and decline | `screenshots/p10-320-offer-320.png` |
| Merchant campaign editor | Save | `screenshots/p10-320-editor-320.png` |
| Operations claim page | Approve and reject metering | `screenshots/p10-320-ops-claim-320.png` |
| Payout page, unresolved attempt | Reconcile | `screenshots/p10-320-payout-320.png` |
| Payout page, payable obligation | Start payout | `screenshots/p10-320-payout-start-320.png` |

Two layout defects were found and fixed at the cause during the wave-3 run, not worked around in the
test:

- The official `DialogContent` and `AlertDialogContent` are `fixed`, centred and unbounded in
  height, so the partial-offer dialog at 320×568 hung off both edges with nothing to scroll and its
  footer was unreachable. Every dialog now carries `DIALOG_FIT_CLASS`.
- The floating "Demo data" pill at the bottom left covered page content and, at 1440, the sidebar's
  identity line. It was removed; the mark is now in the page header at every viewport and each
  scrolling page reserves a bottom safe area for the demo-tools trigger.

#### Keyboard, focus return and reduced motion

**PASS**, three tests (run at 390 and 1440).

- The claim dialog opens with Enter from its trigger, closes with Escape, and focus returns to the
  trigger; it can then be completed with the keyboard alone.
- The reject-with-reason dialog keeps its confirm disabled until a reason is typed, and the whole
  path — open, type the reason, confirm — completes with the keyboard; the typed reason was then
  verified in the stored record.
- With `prefers-reduced-motion: reduce` emulated, the offer dialog and the demo-tools sheet open and
  close with no page error and no console error.

**Limitation.** This verifies that reduced motion renders correctly; it does **not** verify that
every animation is suppressed. `globals.css` carries a standard `prefers-reduced-motion` baseline
rule (durations collapsed to 0.01 ms) because `tw-animate-css` 1.4.0 ships none; no test asserts the
resulting computed durations. Recorded in [known-issues.md](known-issues.md).

### P11 — the demo can be run again

**PASS**, three tests.

1. **A reload keeps the progress, reset returns to the seed, and the main flow runs twice.** A claim
   was filed, the page reloaded, and the reservation and the four amounts were still there. Reset
   returned `scenario` to `baseline` with no claims and the seed's campaigns present — the seed, not
   an empty store. The same flow was then run a second time from scratch to the same amounts.
2. **A cold start with nothing stored renders the seed** rather than failing.
3. **The guided demo at `/demo`** lists exactly seven numbered steps and one card per scenario
   preset, shows the current simulated clock, and its "Go" reaches the right page as the right role
   from a guest. Loading a scenario from the guide switched to operations finance and opened the
   payouts page.

- Evidence: `screenshots/p11-kept-390.png`, `screenshots/p11-kept-1440.png`,
  `screenshots/p11-390.png`, `screenshots/p11-1440.png`, `screenshots/p11-guide-390.png`,
  `screenshots/p11-guide-1440.png`
- A defect found here and fixed at the cause: once a reviewer had switched to an operations identity,
  the demo tools could not return to the merchant workspace — the operations users have no org, so
  the button was disabled and there was no way back to Demo User. Both the panel and the guide now
  switch identity through one shared `useBecomeRole`, which signs in as the workspace identity first.

## Wave 4 — the adversarial review, and what it changed

The rows above were first executed in wave 3. Wave 4 read every ticket's acceptance list back against
the running prototype and the rule sources, and the confirmed findings were **fixed at the cause**
rather than recorded as limitations. Every row above was then re-executed and is still PASS. What
follows is the audit trail for that pass; the fixes themselves are described in the rows they belong
to.

Rule and state defects, each now covered by a test:

| What was wrong | Where the rule says otherwise | Fix |
|---|---|---|
| A rejection after an upheld appeal could be neither appealed nor released: a permanently locked reservation, invisible to the operations queue | 拒绝后7个日历日可申诉 (unqualified); release once 待处理结束 | The appeal right and the release belong to the rejection round (`Claim.rejection.appealId`), not to the claim |
| A finally rejected claim could be re-filed on the identical frozen evidence, and one post id could then hold a live claim in two campaigns | 追加申请仍须新增奖励≥RM5，不能重复使用已申请的金额; 同一平台发布ID默认不能跨活动重复计奖 | The adjudicated amount is deducted from what is newly claimable; D06 is a standing rung in the ladder, not only a submit-time gate |
| A claim could be filed against content the merchant had rejected, and never confirm or release | 以上均以内容合规…为前提 | `content_rejected` in the eligibility ladder |
| A claim could be filed while the source was unreadable, which also left the outage grace resting on a block the engine never enforced | 有效申请须满足资格、门槛和可核验数据条件 | `data_unavailable` while `dataOutage` is on |
| A zero-duration outage moved a published claim deadline and notified three roles | 阻挡新增申请时…阻挡解除后仍有完整公布宽限 | An extension needs `blockedFrom` strictly before the unblock |
| The "claims are closed" notice fired at the deadline instant, while the claim still succeeded | 正常9月15日12:00申请截止, and the app's own "you can still claim until …" | The notice is emitted strictly after the deadline |
| Money derived from a reading that never existed rendered as RM 0.00 | 数据缺失不显示0观看; 未知金额不得显示 MYR 0.00 | The derived money is nullable and renders as unknown |
| A live campaign's readiness switch told the merchant the campaign "cannot be published" | readiness gates publishing, and the operations page already said it is a record on a live campaign | The notice is emitted for a draft only |
| A claim filed from the submission page left its waitlist entry open, offering a "file again" control the one-pending-claim rule could only refuse | 额度恢复后通知重提 describes one queue position | `requestClaim` closes the entry it supersedes |
| Retention driven by a late settlement was labelled "the published retention period" | D04 names four terminal points | Two more reasons, and the label names the one that won |

Controls and copy that described something other than what happened:

- The claim button minted its command id from the *state* (submission, reading version, claimable
  amount), so declining a partial offer left the signature unchanged and the next genuine press
  replayed the old command and reported "the demo kept the one claim that already exists" with no
  claim in the store. Every press is its own id now, and the engine's guards do the deduplication —
  which is what ticket #5's line asks for anyway.
- "Ask for the amount again" appended a superseded offer row per press and never updated the dialog it
  was pressed in. The claims page lists the current offer per submission, keyed by submission, so the
  panel and its dialog follow the live quote.
- Waitlist "Resubmit" reported "The request was filed again with a new queue time" even when nothing
  was filed because the budget was still below the minimum. It branches on the engine's outcome now.
- The demo tools' submission picker labelled a record `platform · postId`, so at the baseline — where
  the acting identity owns no submission — "+1,000 views" reported success against another creator's
  post with nothing on screen naming the owner. The label names the creator and the campaign, and the
  panel says out loud when the only records on offer are someone else's.
- The clock section's "jump to the metering end" / "jump to the claim deadline" stayed enabled after
  the clock had passed them and refused with "Check the values and try again" — advice about a form,
  for a press with nothing to correct. They are disabled with the reason once the target is behind.
- The operations work queue showed "Nothing is waiting · no readiness, review, appeal, re-sync or
  payout is waiting" when a *filter* matched nothing, directly under a badge counting the items.
  A filtered no-match is its own page condition with its own copy and a Clear-filters action
  (`state-policy.md`, `reference-contract.md`).
- "Rejected · appeal open" was the label for `rejected_appealable`, which is also the status a claim
  returns to after **losing** an appeal. It reads "Rejected · reservation held", and the appeal's own
  badge sits beside it in the creator and operations lists.
- Signing in with a `/merchant` return path landed on "You do not have access to this workspace" for
  the org this identity owns, because `session.signIn` always selects the creator workspace and the
  engine derives the role from it. Sign-in derives the workspace from the return path
  (`ROLE_ROUTE_PREFIX`, the same map the route guard uses); an `/ops` return path — where the refusal
  would be true — says why and continues to the creator workspace.
- The same refusal reached an **already signed-in** identity, found in the founder walk of
  2026-09-22: with the merchant workspace active, "Join campaign" on a public campaign page links to
  `/creator/submissions/new?campaign=…` and the creator route answered "You do not have access to
  this workspace". `RequireRole` now follows the route for an identity that can hold its role — it
  dispatches `session.switchWorkspace` and renders the page — and keeps the refusal where the check
  is true: a guest (redirected to sign-in), an `/ops` route or an active operations identity (whose
  `opsRole` a switch would silently clear), and a `/merchant` route for an identity with no org.
  Covered by `shell.spec.ts` › "joining from the merchant workspace follows the route into the
  creator workspace", "a merchant route from the creator workspace lands on the merchant overview"
  and "an identity that cannot hold the role sees a labelled simulated refusal".
- "Independent cap per platform" promised that switching it off makes one piece of content share a
  cap across platforms, which the prototype cannot express. The editor now says what it does, and the
  gap is in [known-issues.md](known-issues.md).
- A money-moving audit row written while nobody was signed in dropped its actor line silently. It
  reads "No signed-in identity (demo tools)".

Documentation corrected:

- `apps/web/README.md` claimed `prefers-reduced-motion` was **not** honoured and that the rule had
  deliberately not been added to `globals.css`. The rule is there and has been since the scaffold
  (both landed in the same commit), and it is the one deliberate departure from
  `color-policy.md`'s "no CSS outside `:root`". The README now says so, and still says that no test
  asserts the resulting computed durations.
- [known-issues.md](known-issues.md) listed `baseline_unavailable` as unreachable with no demo control
  for it. The campaign-readiness switch reaches it, and an end-to-end test drives it through the real
  submit form.
- Every tracked screenshot was recaptured. Next's dev badge is anchored bottom-left, which is where
  the sidebar footer names the identity being acted as, so the delivered evidence had the badge on top
  of that line (and, at 320px, on top of body copy). `devIndicators: false` in `next.config.ts` —
  development only; `next build`/`next start` never showed it.

Findings left unfixed on purpose, with the reason, are in
[known-issues.md](known-issues.md) under "Rules the prototype records but does not simulate".

**One thing a reviewer with stored progress will notice.** Keying the appeal to its rejection round
adds a field to the stored records, so `SCHEMA_VERSION` moved from 1 to 2. A demo state saved by an
earlier build cannot answer "does this rejection already have an appeal?", so the app offers a reset
rather than guessing — which is the path [kickoff decision 9](kickoff.md) describes. Nothing is lost
but demo progress, and every scenario is reproducible from the panel.

## Limitations of this record

- **One browser engine, three viewports.** Chromium only; no Firefox, no WebKit, no real device, no
  touch emulation.
- **320px is a spot check, not a full pass.** Following issue #1, the P-rows run at 390 and 1440 and
  the 320px work is the six primary actions in the table above. Every page has not been reviewed at
  320px by eye.
- **Nothing asserts pixels.** The screenshots are evidence for a human reviewer, not a visual
  baseline.
- **No accessibility audit tool** has been run. The keyboard and focus assertions are hand-written
  and cover two dialogs; contrast, landmark structure and screen-reader output are unverified.
- **Founder confirmation has not happened.** Issue #1 ends with "创办人最终确认体验"; that is
  **NOT EXECUTED** and is not something an agent run can record.
