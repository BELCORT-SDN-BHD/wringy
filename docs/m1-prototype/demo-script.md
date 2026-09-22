# M1 prototype — demo script

How to run the Wringy content-rewards prototype and what to look at, step by step. Everything it
shows is simulated: identity, clock, view data, notifications, email previews and payouts. No
Google, collection, email or payment request is ever made.

The in-app version of this script is the **guided demo** at [`/demo`](http://127.0.0.1:3100/demo),
reachable from the landing-page footer and from the "Demo tools" panel. It carries the same seven
steps and the same scenario list, and each "Go" switches to the right simulated identity for you.
Use this file when you want the expected values written down next to each step.

## Run it

Every command runs from the **repository root** (one pnpm workspace).

```bash
pnpm install                       # one root pnpm-lock.yaml covers every workspace
pnpm dev                           # next dev on http://127.0.0.1:3100
```

Checks, in the order the gates run them:

```bash
pnpm lint                          # eslint
pnpm typecheck                     # next typegen && tsc --noEmit
pnpm test                          # vitest run — the engine and the copy catalogue
pnpm --filter web e2e:install      # one-off: download Chromium (~310 MB)
pnpm e2e                           # playwright, three viewports (390, 1440, 320)
```

`pnpm e2e` starts and stops its own dev server (`webServer` in `apps/web/playwright.config.ts`,
`reuseExistingServer: true`), so it needs no server running. Port **3100** is fixed in `dev`,
`start` and the Playwright base URL; set `WEB_PORT` to run a second checkout alongside.

Only the acceptance suite:

```bash
pnpm --filter web exec playwright test acceptance.spec.ts
```

## Where the controls are

The **"Demo tools"** button sits at the bottom right of every page. It is the only place that can
move the simulated clock, add qualified views, break a data source, flip campaign readiness, decide
a simulated payout outcome, switch to an operations identity, load a scenario or reset. Keeping
these out of the product UI is deliberate: a creator will never have an "add views" button.

Roles. One simulated Google identity ("Demo User") owns both the creator workspace and the merchant
org "Kopi Kita"; that switch is in the header, where the real product would put it. The operations
reviewer and operations finance are separate simulated users and are reachable only from the demo
tools panel.

## The main flow

Start from a clean state: open the demo tools, **Reset**, confirm. The simulated clock is
1 September 2026, 12:00 (Asia/Kuala_Lumpur).

The four amounts to watch are **available / reserved / confirmed unpaid / paid**, in Malaysian
ringgit. They always add up to the reward pool and read the same in all three roles:

| After | available | reserved | confirmed unpaid | paid |
|---|---|---|---|---|
| Publishing, before any claim | 2,000 | 0 | 0 | 0 |
| The creator files the claim | 1,995 | 5 | 0 | 0 |
| Both reviews approve | 1,995 | 0 | 5 | 0 |
| Finance's simulated payout succeeds | 1,995 | 0 | 0 | 5 |

### 1. The merchant creates the campaign

Demo tools → **Merchant org**. Open **Campaigns** → the "Kopi Kita Cold Brew" draft → **Edit**.

The draft opens on the approved defaults: pool RM2,000, RM5 per 1,000 qualified views, minimum
claim RM5, cumulative cap RM100 per post, 14-day submission window, 7-day metering, 7-day claim
grace, 30-day retention. The service fee reads "pending configuration, not charged in demo" and is
never a number.

Two things to try before moving on:

- Set the **minimum claim** to 200 and press Save. It is refused: a minimum above the cap can never
  be paid. Set it back to 5.
- Set the **view threshold** to 100,000 and the **cap** to 50. This is allowed, and the editor states
  the capped amount straight away: "At 100,000 qualified views the reward is capped at RM 50.00".
  Save it, and the same sentence appears on the **Preview** in the next step and on the public
  campaign page — that rule sheet is literally the component a creator reads, so reaching the
  threshold visibly still pays at most RM50.

### 2. Preview the rules, then publish

Open **Preview** from the editor. This is exactly what a creator will read.

Press **Publish**. It is refused while readiness is unconfirmed, and the refusal names which row is
missing. Switch to Demo tools → **Ops reviewer** → **Readiness**, confirm funding evidence and data
source, then switch back to the merchant and publish. The campaign now appears in the public
catalogue, and the merchant gets a notification with a simulated email preview.

### 3. The creator joins from the public detail

Sign out, or open the catalogue in a fresh browser profile. Read `/campaigns`, open a campaign, and
check the rate, cap, minimum and dates are all readable without an identity.

Press **Join**. The only way in is "Continue with Google (simulated)" — there is no email, password
or one-time-code control anywhere in the prototype. Choose a language when asked.

Open **Accounts**. The TikTok connection is usable; the Instagram one is not, and the page names the
reason (token expired) and the next action. There is no upload entry anywhere: the creator publishes
on the platform and submits the post link afterwards.

Open **Submissions → Submit a link**, paste the TikTok URL, submit. Submitting the same URL again is
refused as a duplicate rather than recorded twice.

### 4. The acceptance baseline is recorded

The submission detail now shows the baseline view count, the acceptance time, and the window:

- accepted **1 Sep 12:00**
- metering ends **8 Sep 12:00** (acceptance + 7 days)
- claim deadline **15 Sep 12:00** (metering end + 7 calendar days)

The merchant's copy of the same submission and the operations copy show the same four dates. If they
ever disagree, that is a defect.

### 5. Add 1,000 qualified views, then claim RM5

Demo tools → **Qualified views** → pick the submission → **+1,000 views**.

The submission detail now reads 1,000 qualified views and RM5 claimable. The estimate and the
confirmed amount are labelled separately, and the last trusted read time is shown.

Press **Claim**. Confirm the exact amount. The claim is reserved and takes a queue position. Watch:

- the buckets move to **1,995 / 5 / 0 / 0**;
- pressing Claim again does nothing new — one pending claim per submission, so the second press is
  refused with "a claim for this submission is already pending" rather than reserving twice;
- the merchant and operations both see the same claim as reserved and awaiting review.

### 6. Both reviews pass, then finance pays

The merchant decides the **content** and operations decides the **metering**. They are separate
lines and a claim confirms only when both approve.

Demo tools → **Merchant org** → **Submissions** → the submission → **Approve**. The buckets do not
move: one approval is not a confirmation.

Demo tools → **Ops reviewer** → **Claims** → the claim → **Approve metering**. Now it confirms and
the buckets read **1,995 / 0 / 5 / 0**. An obligation exists; nothing has been paid.

Demo tools → **Ops finance** → **Payouts** → the obligation → **Start payout**. The attempt is
processing. Demo tools → **Payout outcome** → **Funds available**.

The buckets read **1,995 / 0 / 0 / 5**. "Paid" means funds are available in the simulated provider
account; **bank settlement is shown as a separate, unknown fact** and is never inferred from the
provider's success.

### 7. Read the four amounts in all three roles

Open the claim as operations, the campaign as the merchant, and the overview as the creator. All
three read 1,995 / 0 / 0 / 5 against a 2,000 pool.

## The exception scenarios

Load each one from Demo tools → **Scenario**, or from the guided demo at `/demo`, which also opens
the page the scenario is worth reading on. Loading a scenario rebuilds every demo record from the
baseline by replaying real commands, so anything you changed is discarded.

### baseline

The seed. One published campaign from Kopi Kita, one from another org, one draft, a valid TikTok
connection and an expired Instagram one, and no submission of your own.

**Look at:** the empty lists and the first-run states. `/creator/submissions` and
`/creator/claims` are empty with an explanation and a next action, not a blank page.

### main_flow_ready

One submission already metering with 1,000 qualified views; RM5 claimable.

**Look at:** the estimate against the confirmed amount, the last trusted read time, and the claim
deadline. This is the fastest way back into step 5 of the main flow.

### partial_budget

RM60 is claimable but only RM50 can be allocated.

**Click:** **Review offer** on the submission detail. **Look at:** nothing is reserved yet — the
reserved bucket is 0 while the offer is open. The remainder of RM10 is recorded as unreserved and
**not forfeited**. Then use the demo tools to add another 1,000 views and reopen the offer: it is now
stale and needs a fresh offer and a fresh consent, never a silent conversion. Consent to the exact
RM50 and the reserved bucket becomes 50.00.

### waitlist

What is left in the pool is below the RM5 minimum claim.

**Look at:** `/creator/claims` — the entry is on the waitlist with no reservation and no payment
guarantee, stated in those words. When budget frees up (operations finalising another creator's
rejection), the entry is notified and has to resubmit, taking a **new** queue time rather than the
old one.

### rejection_appeal

A claim rejected with a written reason, inside the appeal window.

**Look at:** the reason is readable on the creator's claim page, the reservation is still **held**,
and the appeal deadline is shown. **Click:** file an appeal with a reason. The claim moves to
"appealing" and the reservation stays held. As operations, note that finalising the rejection is
**blocked** while the appeal is open — the release is a check, never a timer. Uphold the appeal and
the check continues with the same queue position and the same amount; nothing closes itself.

**Worth going off-script here.** Once the appeal is upheld the claim is back in review, so reject it
a second time. The second rejection is a decision of its own: it carries a fresh 7-day window, the
creator can appeal it, and after the window operations can release the reservation — the queue lists
it as work to finalise. Then advance past the window, finalise, and look at the creator's page: the
RM5 is back in the pool, and the same 1,000 views cannot be claimed again, because that amount has
already been through the process. New qualified views can.

### payout_unknown

A payout attempt whose result the simulated provider never returned.

**Look at:** there is **no "pay again" button**, and the page says why. The only actions are viewing
the original attempt and reconciling against it — including in the demo tools, which list only
attempts the simulated provider has not answered yet, so an unknown attempt is not offered an outcome
there either. **Click:** Reconcile → "still unknown" and watch it recorded without inventing an
outcome. The reconciliation reads as a sentence on the creator's own payment record too, in whichever
language is selected.

### payout_failed

A payout attempt with a confirmed failure.

**Look at:** the confirmed failure is the evidence a controlled retry needs; the retry control is
enabled here and was not in the unknown scenario. **Click:** Retry, type the reason, and see the new
attempt recorded against the same obligation.

### deadline_extension

The data source was unreadable across the metering end, and the block has cleared.

**Look at:** the submission's **Extensions** section. It names the reason (source unreadable), the
moment the block cleared, and the new deadline — 16 Sep 12:00, which is the published 7-day grace
counted again from the unblock time. The metering end is still 8 Sep 12:00: metering is never
re-opened, and queue times are never back-dated. All three roles were notified; check
`/notifications` as the creator, then as the merchant, then as the operations reviewer.

### campaign_closure

A campaign closing with an open appeal, a confirmed unpaid amount and a small unconfirmed tail.

**Look at:** the merchant's campaign page — the closure panel reads **not fully settled** and lists
what it is waiting on. The unconfirmed tail below the minimum claim is disclosed **before** closure,
and the refund of the unused pool reads "pending verification"; there is no automatic refund path.
Operations reads the same verdict at `/ops/campaigns/<id>/readiness`.

### data_outage

A submission whose source cannot be read right now.

**Look at:** the last trusted number and its time are kept. Nothing shows 0 views and nothing treats
the gap as fraud. The claim button is disabled while the source is unreadable, with the reason on the
page: a valid claim needs verifiable data, and an unreadable source must not put a claim into the
reserved queue. **Click:** as operations, request a re-sync with a reason and watch it recorded.
Turn the outage off in the demo tools and the next read succeeds again — and the claim becomes
possible again. That is also the block the `deadline_extension` grace is granted for.

## Switching roles

| Role | How to reach it | Landing page |
|---|---|---|
| Creator | Header workspace switch, or Demo tools → You (creator) | `/creator` |
| Merchant (Kopi Kita) | Header workspace switch, or Demo tools → Merchant org | `/merchant` |
| Operations reviewer | Demo tools → Ops reviewer only | `/ops` |
| Operations finance | Demo tools → Ops finance only | `/ops` |

The creator and merchant workspaces belong to the same simulated Google identity, which is where a
real product would put that switch. The two operations capabilities are separate simulated users and
have no product-side entry at all. Permission checks run in the **engine**, not by hiding buttons:
opening `/merchant` as the creator shows a labelled simulated refusal, and the underlying command
would be refused too.

## Language

The language select is in the header on every page and on the landing page. Switching re-renders in
place, so **typed form input survives a switch** — try it on the campaign editor with unsaved values.
The first visit asks once, inline, with a skip that records no preference.

Three languages: English (en-MY), Bahasa Melayu (ms-MY) and 简体中文 (zh-Hans-MY).

## Reset and persistence

Demo tools → **Reset** → confirm returns every record to the seed. The guided demo at `/demo` has the
same button next to the current simulated clock.

Demo records are stored in **this browser only**, under one versioned `localStorage` key. A refresh
keeps your progress. Nothing is synced between devices or browsers, and no credential or real
personal data is stored. In a private window, or with site data blocked, the demo still runs and says
it will forget.
