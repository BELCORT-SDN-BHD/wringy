# Clipping public UI evidence → Wringy continuous mockups

Accessed **2026-09-13 (Asia/Kuala_Lumpur)**. Worker owns only this directory; no deck/model changes. Public Chrome research only. Main owns authenticated iab browser 2/tab 1 and records actual app evidence separately under `clipping-app-v1`; this report does not claim to inspect that session. Product/docs pages below displayed no publication date.

## Read this distinction first

**V = visually observed public page; D = official documentation describes application; H = proposed Wringy design; U = unverified private UI.** Biggest risk: presenting a marketing demo or documentation sidebar as the actual authenticated product. The captured clipper docs contain text, tables and callouts; no embedded application screenshot was observed. Their sidebar and bottom “U User” are documentation chrome, not evidence of an authenticated app navigation model.

Main reports that a Mobbin `search_flows` query for Clipping.net creating a brand campaign returned Whop Content Rewards and beehiiv, without an exact Clipping match. This is **query-level absence, not a claim about the entire Mobbin catalog**; not independently rerun here.

## Public visuals ready for deckworker

**V — [Brands](https://clipping.net/brands):** charcoal hero, large left-aligned value proposition, two contact CTAs; right-hand rounded dashboard illustration. Its hierarchy is three KPI cells → blue views trend chart → budget-used progress bar → four portrait clip cards with platform/status/views. Useful as a performance-dashboard composition reference. Labels include verified views, clips live and average CPM. Numbers are marketing illustration, not audited results; they must not become Wringy traction or a fee calculation. The public page explicitly positions a fully managed service with no self-serve setup: brand supplies brief, team configures/runs campaign. Private creation screens, approval controls and permissions remain U.

**V — [Public Campaigns](https://clipping.net/campaigns):** this URL is a marketing landing page, not an observed creator campaign catalog. Hero pairs pay-per-view positioning with a source-content-to-social-clips illustration. Start-a-campaign CTA points to a partnership contact route. Do not caption this screenshot “campaign list”.

| Local screenshot under `images/` | Official URL | Evidence represented |
|---|---|---|
| `01-brands-public-hero.png` | https://clipping.net/brands | V: public dashboard illustration; strongest visual reference |
| `02-dashboard-doc.png` | https://clipping.net/docs/clippers/dashboard-home | V: documentation; D: dashboard behavior |
| `03-campaigns-doc.png` | https://clipping.net/docs/clippers/campaigns | V: documentation; D: catalog rules |
| `04-submit-doc.png` | https://clipping.net/docs/clippers/campaign-detail | V: documentation; D: detail/submission flow |
| `05-clips-doc.png` | https://clipping.net/docs/clippers/clips | V: documentation; D: library and statuses |
| `06-payments-doc.png` | https://clipping.net/docs/clippers/payments | V: documentation; D: methods and settlement |
| `07-campaigns-public-marketing.png` | https://clipping.net/campaigns | V: public marketing page, not app catalog |
| `08-accounts-doc.png` | https://clipping.net/docs/clippers/accounts | V: documentation; D: account verification |

Screenshots are browser captures, not downloaded media or reconstructed images. Matching `*-ax.txt` files preserve document text for the docs and public Campaigns page; captures show viewport portions, not every section.

## Documented application structure and rules

- **[Dashboard](https://clipping.net/docs/clippers/dashboard-home) — D:** active campaigns first, past below. Active requires a submission in the current cycle; a running campaign without a current-cycle submission may appear under Past. Fewer than three active campaigns produces a discovery card. Search, filters with count/reset, and campaign-card navigation are described. Actual card geometry remains U.
- **[Accounts](https://clipping.net/docs/clippers/accounts) — D:** choose platform and handle, place a five-digit verification code in the instructed profile location, then request checking. At least one Verified account is required to submit. States are Verified, Pending, Error and Expired. This describes profile-code verification, not proof of OAuth. Exact application modal layout remains U.
- **[Campaigns](https://clipping.net/docs/clippers/campaigns) — D:** cards expose name, platforms, payout rate and Active/Paused/Cap Reached. Search and filters include status/platform/type/payment/tags/rate and sort. **First submission joins; no separate Join action for ordinary campaigns.** Private campaigns show lock/Private; full rules and submission require approval. Support budget-based and deadline-based campaigns. Private approval application UI remains U.
- **[Submit/detail](https://clipping.net/docs/clippers/campaign-detail) — D:** details/rules/reference links, bounty choices and Your clips table. Publish externally on the linked account → open Upload clip → paste public URL → detected platform/account → optional bounty choice → Submit. One clip is regular or bounty, not both. Errors include wrong account, duplicate URL, age cutoff and missing sound. Eligibility dialog points to missing payment/account/private-access fixes. Thresholds vary; docs give 1,000 per post and usually 25,000 combined, not universal Wringy rules.
- **[Clips](https://clipping.net/docs/clippers/clips) — D:** cross-campaign library with total clips/views/engagement recalculated by filters. Search title/URL; platform/status/date/campaign/view range/sort. Primary state is **Tracking / Stopped / Banned**; **Paid / Bounty are additional badges**, not a single mutually exclusive pipeline. Tracking means metrics collection, not unconditional final entitlement.
- **[Payments](https://clipping.net/docs/clippers/payments) — D:** saved payment methods and per-campaign estimated-earnings table. Fields include clips, qualifying-view count, standard/bounty/total and threshold status; summary Estimated/Pending/Paid. Current new methods: PayPal or Ethereum USDC/USDT; method is campaign-specific. Estimates can decrease after review. Sequence: campaign/cycle completion → staff checks → sponsor approval → payment. Posts must remain public. No observed application table geometry or withdrawal interaction.

**Settlement caveat:** prior official [clipper terms](https://clipping.net/policies/clipper-terms-and-conditions), updated 2026-05-27 and checked 2026-09-13 in [prior findings](../clipping-v1/findings.md), specify sponsor-controlled cycle closing, no fixed closing time and no on-demand withdrawal. The simplified docs timeline must not become a guaranteed payment SLA. CPM describes viewing economics; it does not establish platform take rate or a 15% fee. Malaysia support and MYR settlement remain unverified.

## Actionable continuous Wringy storyboard — all H, not copied private Clipping UI

1. **Brand brief:** campaign objective, authorized source assets, intended audience/location/language, platforms and reward budget. Present assisted intake; do not claim a Clipping self-serve wizard.
2. **Campaign proposal and approval:** same brand/brief, proposed rules and reward basis, review/settlement conditions; show Wringy operator involvement. Private Clipping approval layout is unknown.
3. **Creator prerequisites:** social-account verification and payout readiness, including a clear missing-requirement state.
4. **Discover → detail:** one consistent fictional campaign card opens its full brief, source assets, rules, reward unit, remaining budget and eligibility. Avoid inventing a mandatory Join step as competitor fact.
5. **Publish → URL submission:** explain external publishing, show the same clip URL/account, successful submission and one actionable failure such as duplicate URL.
6. **Your clips → review:** same clip persists with tracking state, measured views versus reward-eligible views, reason for exclusion where applicable. Separate payment badges from tracking status. Operator review UI is Wringy proposal.
7. **Brand results:** reuse the observed KPI/chart/budget/clip hierarchy; clearly identify audience-quality metrics as proposed validation, not a demonstrated Clipping capability. Localized audience relevance is a business hypothesis, not merely translation.
8. **Settlement:** same campaign/clip evolves from estimate to reviewed/approved/paid; show adjustments and settlement conditions. A wallet withdrawal button or instant payout requires a separate Wringy decision.

Use consistent invented brand, campaign and clip identifiers across the sequence and label all figures “demonstration”. Retain Wringy visual language. These are storyboard options, **not all required beta features or a claim they fit the RM50,000 prototype + usable-beta R&D cap**. Manual setup/review may be proposed, but tracking integrations, fraud verification and payment infrastructure require their own feasibility/cost decisions. Founder direction remains Content Rewards first; later modules are outside this reference exercise.
