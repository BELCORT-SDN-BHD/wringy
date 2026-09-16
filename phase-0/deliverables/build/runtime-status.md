# Local presentation runtime status

2026-09-10. Renderer worker owns only build/renderer/** and this file. No delegation. Main confirmed successful one-time create mark for three final PPTX outputs before this worker executed authoring. No additional mark was run.

Status: reusable renderer ready; no final learning/investor/brand manual produced by this worker. Canonical theme remains read-only. Await final content and main's production assignment.

## Runtime evidence

- Node: `${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` (runtime reported v24.19.0).
- Packages: `${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`; @oai/artifact-tool 2.8.59 and pdf-lib present. Only renderer/node_modules symlink created; no package installations or bundle edits.
- Python: `${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3` used by finalizer. fontTools is absent; native font cmap verification is implemented directly in renderer/font-coverage.mjs, without a substitute dependency.
- LibreOffice (not invoked): `${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/MacOS/soffice`. Only this bundled absolute path is permitted. Never desktop LibreOffice, even if bundled fails.
- PingFang SC verified in artifact-tool's own skia-canvas FontLibrary inventory; initial provisional smoke used it. The separate napi canvas inventory did not expose it, so it was not used for font verification or measurement.
- Canonical theme resolves `brand/tokens.json` semantic light and typography rules at execution. Current result uses Ink/Paper/Citron with secondary Iris. Manrope and Noto Sans SC downloaded from official google/fonts into renderer/assets/fonts, with OFL files and hashes in provenance.json. Registered through `FontLibrary.use`. All Han glyphs in each branded input are checked against actual Noto SC cmap entries; sample 15 unique Han glyphs passed, and all branded smoke input glyphs passed. No PingFang fallback in branded builds. Pure ASCII text boxes use Manrope; mixed Chinese/Latin text uses Noto SC.

## Current verified outputs (private tests)

- `renderer/test-output/brand-smoke-v3.pptx` and `.pdf`: 3 slides, canonical fonts/colors, Ink header and subtle horizontal table rules, native table, native chart with verified embedded workbook. Finalizer passed structure, geometry, native ownership contracts, font policy, chart data packaging and exact-file reimport. All three final PNGs inspected individually at full size.
- Its receipt: `renderer/.private/render-eAIUh7/validation.json`; PNGs: `renderer/.private/render-eAIUh7/slides/slide-001.png` through `003.png`.
- `renderer/test-output/diagram-v2.pptx`: native text nodes and attached native connectors; arrow direction corrected and visually verified source-to-target. Receipt/renders: `renderer/.private/render-v0H4Xy/`.
- `renderer/test-output/images-v1.pptx`: actual learning hero with editable Ink text over left negative space; actual Whop storefront evidence fitted whole, original Mobbin footer retained. Both final renders inspected. Receipt/renders: `renderer/.private/render-xK0QqL/`.
- `renderer/checks.mjs`: PASS, all 21 catalog entries and 23 table rows preserved through pagination, missing chart data rejected.
- Previous `brand-smoke-v1` was independently inspected by main; v3 incorporates main's Ink/Citron/table refinement. No issue found in current inspected renders.

## Handoff

Complete working CLI/library instructions and schema adjustments: `renderer/README.md`.

Command shape: bundled Node + renderer/cli.mjs --input content.json --tokens brand/tokens.json --assets slide-id-manifest.json --output NEW.pptx --workspace owned-workspace --pdf --mark-confirmed. `--assets` and `--pdf` optional. CLI returns all-slide PNG directory, final paths, validation receipt and expanded slide mapping. Production must use canonical tokens. Tables/catalogs split without data loss; dense individual text fails rather than shrinks or truncates. Native table/chart ownership contracts computed after pagination. Optional diagram and arithmetic contract schemas documented in README.

Production caveats: fonts are not embedded in PPTX; target application needs them installed for matching native appearance. PDF preserves appearance as slide images. Native PowerPoint edit/save/reopen has not been tested. Visual quality, content accuracy, citation completeness and image uniqueness still require per-slide review on final decks. Takeaways are optional and never synthesized. For dense screenshot evidence, omit unneeded subtitle and keep body brief so the image can remain large. Three supplied hero assets should be assigned once each to their final covers by production mapping.
