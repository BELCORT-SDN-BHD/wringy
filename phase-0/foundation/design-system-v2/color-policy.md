# Color allocation · 2026-09-11

CSS is canonical: [app/src/index.css](app/src/index.css). [palette.json](app/provenance/palette.json) mirrors all 43 colors: 31 original roles plus the 12 named additions below. This refinement implements the founder's approved color request; it does not reopen the component system.

| Role | Allocation |
|---|---|
| Workspace, hover, selection | Harmonious neutral surfaces and pale gray accent/sidebar-accent. Selection is not urgency. |
| Primary | Retained forest for deliberate primary actions and readable links. |
| Attention | Amber foreground/subtle background only for a verified action requirement. Not every pending state. |
| Blocked / error | Red, with an explicit failure or blocking label and next action. |
| Informational | Blue for background processing when useful; no action required unless stated. |
| Success | Subdued green for completion of the named operation. Content approved does not mean paid. |
| Inactive / unknown | Neutral, with explicit text. Unknown is not zero; unknown data can also be informational. Escalate only for a verified immediate block. |
| Brand | Citron in the small Wringy brand badge only; never generic hover, selection, warning, or an unlabelled chart status. |

Color communicates urgency and action requirement, not the full business state. Always pair it with an icon and label. All source-tab examples are labelled demos; no backend facts or payments are implied.

## Source contract

Only these new root color variables are allowed: `attention-foreground`, `attention-subtle`, `error-foreground`, `error-subtle`, `info-foreground`, `info-subtle`, `success-foreground`, `success-subtle`, `inactive-foreground`, `inactive-subtle`, `brand`, `brand-foreground` (each prefixed `--`). All values are colors. No new variants, theme mappings, component skins, font/size/radius/motion changes or CSS outside `:root`.

The source-tab sample composes unchanged official Alert, Badge, Item and Table. Element-scoped `style` props bind official background/foreground variables to root semantic colors; Item icon color references the same root variables. No duplicated raw colors. [Verifier](app/scripts/verify-provenance.mjs) checks exact membership, all 61 official hashes, root structure, CSS outside root and palette equality. The sample's layout-only minimum-width constraints allow official code/table overflow containers to work at 320px.

## Reference evidence and inference

Main task reports direct inspection of these Linear images; this worker did not independently inspect them:

- [Issue rows and sidebar](https://mobbin.com/screens/212fda35-366e-4dc0-a1d1-3b679659d6ab): neutral layout, small yellow in-progress and red urgent icons.
- [Selected sidebar and grouped status icons](https://mobbin.com/screens/610d34b6-6ad8-45ab-80fb-2107b31ed01e): gray selection.
- [Done and success feedback](https://mobbin.com/screens/b9104519-abc8-4638-a2fc-206bea260188): small purple done indicator and green toast.
- [Settings](https://mobbin.com/screens/b9c7d3d2-6f32-4553-9c85-0ef3a80af52a): muted layout, small red incomplete DNS label, purple toggles.
- [Export information](https://mobbin.com/screens/0480f3ec-c18f-4dbc-8ee9-f23a50b936fe): gray selected navigation and neutral informational toast.

Main's design inference: restrained colored area helps prioritization. Our exact palette is a Wringy choice, not extracted Linear values, and our action semantics do not copy Linear's task-state model.

## Review

| Before | After | Why |
|---|---|---|
| Citron generic hover and selected sidebar | Pale neutral gray | Routine navigation should not look like an alert. |
| Warm green-tinted neutrals | Coordinated neutral workspace/card/sidebar surfaces | Keep forest actions and actual attention distinct. |
| Brand yellow also in charts | Limited named brand role; subdued chart palette | Avoid conflating identity with warning or state. |
| No explicit action-color allocation | Amber action, red error, blue information, subdued green completion, neutral inactive | Waiting for the user differs from waiting for the system. |

Validation evidence: [color checks](output/color-verification.json), [browser checks](output/browser-verification.json), [final verification](output/finalverification.json). Light theme and Chrome only; not every upstream prop, combination, device or assistive technology is certified.

## Bounded product-language demonstrator

The source-tab sample alone offers English (`en-MY`), Bahasa Melayu (`ms-MY`) and 简体中文 (`zh-Hans-MY`) by name, without flags, via the unchanged official Select. Chinese is provisionally interpreted as Simplified Chinese for Malaysia; this script assumption is not a separate founder decision. [product-copy.ts](app/src/lib/product-copy.ts) is the centralized trilingual copy catalog. Only its alert, six status labels/descriptions, actions and table headings switch; each localized subtree carries `lang={locale}`. The Chinese design instructions and the other 64 gallery entries are not translated. English remains a demonstrator-only default, not the future platform default. Malay and Chinese copy are drafts awaiting professional review.

Future platform direction: first use should gently ask “Which language would you prefer?” with English, Bahasa Melayu and 简体中文, and explain that the choice can be changed later in settings. The main task owns the first-use specification and upstream language decision. This demonstrator does not implement that flow, preference persistence or backend behavior. Dates, currencies and broader product localization remain outside this change.

Acceptance for this bounded extension (worker request, 2026-09-11): three catalogs have identical keys and six corresponding rows; approval does not imply payment and unknown does not mean zero in each language; all three retain identical color roles and scoped language tags, fit at 320px, and can be selected in the offline export. Preserve all 61 official source files and 43 colors. Current evidence is recorded separately from the prior 22-check suite in [localized-verification.json](output/localized-verification.json).
