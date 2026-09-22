# M1 prototype — known issues and limitations

What the prototype does not do, what it does in a way a reviewer should know about, and what is
deferred. Nothing here is a business-rule change: where a rule and the prototype differ, the rule
wins and the gap is written down.

Recorded 2026-09-22 against branch `feat/m1-prototype`.

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
- **`baseline_unavailable` as a persistent state.** The engine models a submission whose source could
  not give a baseline at all, and the creator page has the copy for it, but no demo control sets it:
  the data outage toggle affects reads *after* acceptance. Covered by engine tests only.

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
  it does not assert that every animation is suppressed.
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
  such as `claim.reviewMetering`.
