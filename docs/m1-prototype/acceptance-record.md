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
| Branch | `feat/m1-prototype` |
| Executed by | agent run, wave 3 (the integration worker) |
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
| Engine and copy catalogue | `pnpm --filter web test` | 267 passed, 0 failed, 21 files |
| Whole end-to-end suite | `pnpm --filter web e2e` | **306 passed, 33 skipped, 0 failed**, 4.0 min |
| Lint | `pnpm --filter web lint` | clean |
| Types | `pnpm --filter web typecheck` | clean |
| Production build | `pnpm --filter web build` | succeeds, 36 routes, all `ƒ (Dynamic)` |

The end-to-end totals per Playwright project:

| Project | Viewport | Passed | Skipped | Failed |
|---|---|---|---|---|
| `mobile` | 390×844 | 108 | 5 | 0 |
| `desktop` | 1440×900 | 108 | 5 | 0 |
| `small` | 320×568 | 90 | 23 | 0 |

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
states the same numbers the editor holds.

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

- Spec: `acceptance.spec.ts` › "P07 review and appeal"
- Evidence: `screenshots/p07-rejected-390.png`, `screenshots/p07-rejected-1440.png`,
  `screenshots/p07-390.png`, `screenshots/p07-1440.png`
- Engine tests: `engine.review.test.ts` (including the 48-hour escalation that never auto-approves)

### P08 — payouts and the operations exceptions

**PASS.** An unknown provider result offers reconciliation only: there is no "pay again" control, the
start button is disabled, the retry control is absent, and the page states why. A confirmed failure
is the evidence a controlled retry needs, and only then is the retry control enabled. "Paid" is the
simulated provider account and bank settlement is shown as a separate fact.

- Spec: `acceptance.spec.ts` › "P08 payouts and the operations exceptions"
- Evidence: `screenshots/p08-unknown-390.png`, `screenshots/p08-unknown-1440.png`,
  `screenshots/p08-390.png`, `screenshots/p08-1440.png`
- Engine tests: `engine.payout.test.ts`

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
4. **A link accepted on the last submission day keeps a full window.** Accepted 15 Sep 11:00, one
   hour before intake closes: metering to 22 Sep 11:00 and the claim deadline to 29 Sep 11:00.
5. **A closing campaign never reads as fully settled.** With an open appeal and a confirmed unpaid
   amount, both the merchant panel and the operations panel read "not fully settled" and list what
   they are waiting on; the unconfirmed tail below the minimum is disclosed before closure and the
   refund reads "pending verification". Evidence: `screenshots/p09-closure-merchant-*.png`,
   `screenshots/p09-closure-ops-*.png`.

- Engine tests: `engine.deadlines.test.ts`, 14 tests, including "runs 7 days of metering and 7
  calendar days of grace from acceptance", "gives a link accepted on the last day a full metering
  window", "grants the full published grace after a data outage spanning the metering end", "grants a
  grace when an open case blocked the submission past the metering end", "has no end date while a
  case is open or money is confirmed unpaid", "never shows fully settled while an appeal or confirmed
  money is open" and "shows fully settled only once every case and payout is resolved". Also
  `engine.campaign.test.ts` › "refuses a close without a reason and stores the one it is given".
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
  `src/lib/audit-copy.test.ts` (every locale has copy for every audit action key)
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

Two layout defects were found and fixed at the cause during this run, not worked around in the test:

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
