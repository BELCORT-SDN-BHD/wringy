# Wringy investor v3

2026-09-10. Ten Chinese slides in the official Sequoia sequence: Company purpose, Problem, Solution, Why now, Market potential, Competition, Business model, Team, Financials, Vision. No appendix. This is not an Airbnb original template.

## Outputs

- `output/Wringy-Investor-v3.pptx`: editable slide text and native tables on slides 6 and 9.
- `output/Wringy-Investor-v3-Preview.pdf`: raster preview of the rendered final PPTX.
- `output/contact-sheet.png`: all ten rendered pages.

## Sources and reproducibility

Content is the main-reviewed `story.md`; citations and source qualifications are carried in corresponding speaker notes. Canonical colors are read directly from `../../foundation/design-v2/tokens.json`. The palette is the Wringy adaptation of the selected warm-white Ramp direction, not official extracted Ramp tokens. `build/records.json` records canonical input hashes. Chinese presentation text uses local Noto Sans SC for rendering portability, an intentional adaptation from the web font stack. The actual design concept screenshot on slide 3 is from `../../foundation/design-v2/assets/dashboard-desktop.png`; it is illustrative example data, not an operating product or real customer evidence.

Build uses JavaScript ES modules and `@oai/artifact-tool` through the bundled runtime. `build/polish.py` preserves native table data and applies horizontal rules and financial number alignment. `build/validation.json` is the finalizer receipt; `build/package-summary.json` records delivered file hashes. No desktop LibreOffice was used. No PowerPoint desktop edit-save-reopen test was performed.

All v2 files remain unchanged. Business proposals and financial planning estimates remain expressly qualified on slides. The budget total is RM576,150 (approximately RM580k), covers 18 months at assumed zero revenue, and is neither a Belcort quote nor a formal fundraising request.
