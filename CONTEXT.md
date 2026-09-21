# Wringy

Wringy connects merchants funding content campaigns with content creators earning rewards for verified eligible views. Malaysia is the first market. English, Malay and Simplified Chinese share one design system. First release: Content Rewards; commerce and creator tools are future scope.

## Canonical sources

- [Product blueprint: vision, users, journeys, scope and success measures](docs/PRD.md)
- [Technical blueprint: implemented state, accepted target and boundaries](docs/ARCHITECTURE.md)
- [Business rules and merchant-adjustable defaults](phase-0/foundation/campaign-defaults-v1.md)
- [Delivery scope and detailed acceptance](docs/planning/README.md)
- [Foundational business acceptance A01–A40](phase-0/foundation/prd-content-rewards-v2.md)
- [Accepted stack decision provenance](phase-0/foundation/full-stack-proposal-v1.md)
- [Design system](phase-0/foundation/design-system-v2/README.md)
- [External capability boundaries](phase-0/foundation/external-interface-contracts-v1.md)

Blueprints maintain the current product and technical understanding; their frontmatter defines how accepted Wayfinder / to-spec decisions replace affected sections. Exact business rules remain in the defaults source, acceptance in specs, and execution state in GitHub. Older foundation notes do not reopen rules superseded by later accepted decisions.

## Vocabulary

Merchant: an organisation publishing and funding campaigns.
Content creator: a participant submitting published social post URLs.
Campaign: published reward rules, budget, eligibility and deadlines.
Submission: a social post linked to a campaign and its measurement baseline.
Eligible views: verified increments accepted under published rules, distinct from raw views.
Claim: a request for an eligible unpaid increment; submitting content alone does not reserve budget.
Reservation: budget held for a valid claim under review and queue rules.
Confirmed reward: an approved obligation, distinct from issued funds.
Payout: delivery of confirmed funds through a verified provider path.
Operations: authorised review, appeals, exceptions, reconciliation and audit.

Read canonical rules for exact values and transitions; this glossary does not redefine them.
