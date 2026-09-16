# Official Creator/Content Rewards flow evidence

Verified live with web tools: **2026-09-10**. Bounded worker research; no delegation, Mobbin inspection, account creation, funding, submission, withdrawal, or private-admin access. Prior research supplied pointers only. This is a research note, not an approved product specification.

**Answer:** detailed first-party flows exist outside Mobbin, especially for the legacy Whop-hosted brand experience. Current Content Rewards has substantial workflow documentation, but this check did not establish one complete, current, screen-by-screen brand-and-creator walkthrough through actual bank receipt. Six core sources below; the current homepage supplies a limited supporting check.

## Six core sources and what they cover

### 1. Legacy brand creation and review: strongest tutorial

https://whop.com/blog/set-up-content-rewards/

Whop, dated May 14, 2025. Describes: Earn → Add app → Content Rewards → enter title, content type, category, budget, reward per 1,000 views and platforms → Continue → deposit prompt → funded campaign becomes live. Includes embedded short videos.

Review: open campaign → See submissions → Pending/Approved/Flagged/Rejected. Pending shows submitted media, views and Approve/Reject. Reject opens a reason field and optional botting ban; approve opens confirmation. Budget progress advances with approvals.

The page links a payment-setup video at this exact embedded URL:
https://www.youtube.com/embed/tUonlfHeRWM?feature=oembed

The link was resolved from Whop’s own article; YouTube fetch was throttled, so video frames, channel and completeness were **not independently inspected**. Treat it as an official article’s linked tutorial, not a watched full payment flow.

The article’s 48-hour automatic approval and no-minimum-budget statements belong to this older documentation; do not transfer them to current CR.

### 2. Whop-hosted funding: most concrete button sequence

https://docs.whop.com/memberships-and-access/third-party-apps/content-rewards

Whop Docs, live retrieval. Marketing-campaign section includes setup screenshots and field descriptions. Add app → Content Rewards → Add → configure campaign. Funding: Add budget popup → choose payment method → amount → Send → Pending budget becomes Active after processing. Top-up: campaign three-dot menu → Add budget → amount → Send. The guide also explains view-based rewards plus optional flat bonuses.

Coverage: useful historical/integration UI reference for creating and funding inside a whop; not proof of the separate CR app’s present screens. Its introductory member points/badges section describes another meaning of “rewards”; exclude that from paid creator-campaign analysis.

### 3. Legacy creator join, submission and earnings

https://whop.com/blog/whop-clips/

Whop, dated April 8, 2025. Join Whop Clips free → open Content Rewards → read campaign budget and submission rules → create/publish content → submit post URL **and posted media file** → track My submissions → approved earnings appear in Whop dashboard → withdraw using Whop Payments.

This is a concrete first-party campaign example, not a universal current CR onboarding flow. It describes immediate approved payouts but does not document every identity-verification, bank-linking, withdrawal-confirmation or bank-receipt screen.

### 4. Current CR release: interaction details beyond the legacy guide

https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/articles/v2-is-here

Content Rewards, dated August 19, 2026. Describes separate brand/creator apps, organization-owned campaigns, campaign templates/drafts/scheduled launch and application controls. Creator Discover is a browsable campaign feed.

Optional pre-post review: creator uploads unpublished file → brand approves, rejects or requests revisions → versioned feedback thread → brand approves posting accounts → creator posts. It says unapproved accounts/drafts are blocked. Earnings page has Queued, Arriving and Received states; creators have a wallet and withdrawal control. Flagging has creator appeals and CR resolution.

Coverage: detailed product-release prose, not a complete visual tutorial. Release-day limitations include missing bulk approval/rejection and creator/submission CSV export; current availability was not tested.

**Version warning:** this August article’s payout cycles and creator fee descriptions differ from September terms below. Do not use its numerical fee/timing claims as current truth.

### 5. Current brand funding/review contract and product boundary

https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/brands-terms

Content Rewards Organization Terms, updated September 3, 2026; Scope and §§3–8, 11. CR and Whop are separate companies: CR operates campaign/earning logic; Whop handles funding and money movement. Earlier Whop-hosted campaigns retain their previously accepted Brands Terms. This does not establish ownership or acquisition history.

Brand sequence supported by the terms: create organization/campaign → choose per-1,000-view, per-post or recurring-cycle payment → put requirements on-platform → fund through Whop before launch → manually approve/reject submissions → validation → creator settlement. Minimum budget is $1,000. Pending submissions do not automatically approve. Optional raw-draft review allows revisions; approving a draft does not guarantee final posted-content approval. Public active campaigns appear on Discover; private campaigns do not.

Coverage: contractual mechanics, not observed funding checkout or private moderation screens.

### 6. Current creator reward-to-withdrawal mechanics

https://b4e0vdqv6zgqeqj4pfgm.apps.whop.com/terms

Content Rewards Creator Terms, updated September 3, 2026; §§3–8, 16. Documents account/social linking and campaign participation, but not a complete onboarding click sequence.

Creator sequence: participate in campaign → upload raw draft when required → obtain draft approval/revise → publish → submit public URL → fraud-risk triage → brand moderator decision → view/fraud validation → available CR balance → withdraw through Whop. Draft approval remains separate from posted-clip approval.

For view-based campaigns, approval starts seven earning days, then a three-day hold: settlement about ten days after approval. Per-post settles shortly after approval; recurring work after its cycle. Open fraud flags pause settlement. These September terms supersede the August article as the stronger current published timing source, without proving live execution. CR describes its balance as its own ledger record payable through Whop; do not collapse reward approval, available balance, Whop transfer and bank receipt into one event.

Coverage: payout rules and provider handoff, not a demonstrated bank withdrawal.

## Supporting current entrypoint

https://contentrewards.com/

Live homepage describes creator application → publication → submission, and brand budget/content/payment-model setup. Its payment FAQ lists card, Apple Pay, Google Pay, Cash App, US bank transfer and existing balance; bank transfer must clear. These are published options, not verified eligibility or completed payments. Use the homepage to reach current CR, rather than assuming an `apps.whop.com` source hostname means the document describes legacy Whop operation.

## Mobbin coverage supplied by the main researcher

Main inspected all returned preview images, **not every intermediate full screen**. The following is main-reported evidence; this worker did not independently inspect Mobbin.

| Flow | Listed screens | Preview evidence |
|---|---:|---|
| [Clipping](https://mobbin.com/flows/c187e2e9-1d11-4767-a60c-9177415721dc) | 4 | Campaign discovery |
| [Campaign detail](https://mobbin.com/flows/ae8fd552-c710-4337-bb72-f7257a464407) | 8 | Per-1,000-view rates, minimum/maximum, budget and resources |
| [Submitting a video](https://mobbin.com/flows/17e2add2-29bb-4b04-8ca4-a0a97a8a5c52) | 4 | Title, link, audience-demographic image and acknowledgement |
| [Content rewards](https://mobbin.com/flows/83ac1dc0-5a6f-4ed0-9cce-0812939f69a9) | 9 | My Submissions: Pending/Approved/Rejected/Flagged, estimated payout/minimum views, Linked Accounts |
| [Connecting to an account](https://mobbin.com/flows/11ce1d06-bebe-4a45-8699-5c3eac97f2ae) | 7 | Preview 1 submission; preview 4 Connect Account with YouTube username input; preview 7 successful account-verification toast and return to submission |

These previews establish useful creator-side reference flows. They do not establish the account-connection mechanism (including OAuth), complete brand/admin coverage or actual bank payout. Main rejected an Ads result for brand creation and a Patreon result for payout as unrelated. Main also independently spot-checked all 218 lines of the Whop Docs guide above: 11 campaign fields, funding activation, top-up and inline images 16/18. That guide is the strongest complementary brand setup reference.

## Coverage gaps to preserve in the main answer

- Legacy brand creation/funding/review: detailed public tutorial and written button sequences exist; embedded video content was not watched in this check.
- Legacy creator: join/submit/earn/withdraw is documented at workflow level, with concrete submission inputs; no complete bank-flow evidence.
- Current CR: substantial creation, review, draft/revision, reward and payout-state documentation exists. Exact current brand onboarding, creator application acceptance and social-account connection screens remain unverified.
- No verified single public first-party tutorial demonstrates both roles end-to-end on current CR, actual settled bank receipt, private admin tooling, or all rejection/refund/appeal states. This bounded search does not prove such a tutorial does not exist.
- Mobbin evidence above is attributed to main’s limited preview inspection; no claim of complete inventory or all-screen inspection is made.

Research limitation: source prose and published walkthroughs were checked, not live authenticated behavior. No product files or synced `sources/` material were modified.
