# v4 production layout and asset handoff

Preparation only, 2026-09-10. Main has approved the YC mapping and corrected story for production. Creator Rewards remains under discussion. Await main's explicit canonical token/asset handoff before final visual authoring. No new color values are declared here.

Canvas: 1280×720 (16:9, matching all ten source template images). Font: supplied Noto Sans SC. Native editable text, minimum main body target 24px/18pt, headings around 44–52px with clean white space; exact fit checked after rendering. Flat compositions. No repeated cards, dashboard panels, decorative vector drawing or image reuse.

| Slide | Functional layout | Native evidence | Image role (each once) |
| --- | --- | --- | --- |
| 01 Cover | Minimal company title + concise proposition, large photographic composition | Editable cover text, proposal status visible | Mendel photo 1; concept label. Subject/crop inspected first. May differ from story's suggested UI hero while preserving function |
| 02 Problem | Large title, brand/creator perspectives, sparse icon-supported example | Editable questions and hypothesis label | Licensed Tabler artwork only; no faux chat UI |
| 03 Solution | Left explanation, large focused product screenshot at right/bottom | Editable action explanation and unapproved-scope label | New design-v3 activity concept, unique screenshot |
| 04 Example campaign | One creative photo + four concise process stages, generous separation | Editable requested process, pre-review distinct from final review/payment | Mendel photo 2, concept photo label; no real-client implication |
| 05 Insight | Large product detail showing continuity of one cooperation record | Editable insight and unverified-effect label | New design-v3 record detail, distinct image from03, labels read at projection size |
| 06 Business model | Open economic-attribution diagram, two clear destinations | Native requested money diagram + contribution formula; not payment routing | Distinct licensed icons if helpful |
| 07 Market | Dominant 100% bar with native percentage labels, Malaysia figure secondary | Native chart .25/.75; MY US$200亿 separately, never multiplied | No decorative infographic |
| 08 Future growth | Open hierarchy with Creator Rewards at entry and broader capabilities subordinate | Editable requested scope diagram + unfilled bottom-up revenue formula | Licensed semantic icons, no fake future UI |
| 09 Execution | Two-party responsibility layout with founder-owned Belcort relationship | Editable facts, no invented founder biography/headshot | Licensed icons if needed |
| 10 Funds | Exact total headline, five native budget bars and short 4/14 timing statement | Native chart [189750,216000,70000,50000,50400]; zero-revenue and non-raise qualifier | No funding-progress or growth image |

Two-photo placement and product-image slots are planned, not asset approvals. Main to provide canonical tokens path and new product assets. Mendel exclusively owns investor-v4/assets; this worker reads those files only. Build-generated icons and previews belong in build/ or output/, not assets/.

## Handoff shape

Builder reads a local JSON handoff with status `main-authorized`, absolute `tokenPath`, `colorKeys` mapping semantic background/surface/ink/muted/accent/line to actual canonical JSON keys, and `assets` with roles `coverPhoto`, `campaignPhoto`, `activityConcept`, `recordConcept`. Each asset needs path, alt, source and whether it is a concept. No fallback to design-v2 token values. Legacy Tabler SVGs are retained licensed artwork only; currentColor resolves from the newly authorized palette.

## Export and review

Use artifact-tool ESM to build candidate PPTX; finalizer requires native charts on07/10, literal embedded workbook snapshots and 10 slides. Render all ten final slides individually and contact sheet. Check Chinese glyphs, text wrapping, percentage formatting, horizontal bar categories and label fit, concept disclosures and accurate budget. Fix the builder and export a new candidate revision when needed. Produce preview PDF from final slide renders if native export is unavailable; disclose raster preview in private package report. Use bundled LibreOffice only if needed: ${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/MacOS/soffice. Never desktop LibreOffice.

Speaker notes contain factual context, proposal status and relevant sources, not internal build instructions, asset waiting status or review commentary. Full story research notes are not blindly copied to speaker notes.
