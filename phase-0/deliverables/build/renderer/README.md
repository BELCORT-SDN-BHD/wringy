# Wringy local presentation renderer

Reusable JavaScript ES-module library and Node CLI using only the supplied `@oai/artifact-tool` for PPTX authoring. Canvas is 1280 × 720 (16:9). Main confirmed the single operation mark on 2026-09-10 for three eventual PPTX deliverables. Do not run the mark again for this work.

## Working command

Run from any directory. Use a new output filename each time. Example reproduces the three representative slides with canonical brand tokens:

```sh
WRINGY_RENDERER=${WRINGY_WORKSPACE}/phase-0/deliverables/build/renderer
${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node "$WRINGY_RENDERER/cli.mjs" \
  --input "$WRINGY_RENDERER/smoke.json" \
  --tokens "$WRINGY_RENDERER/../../brand/tokens.json" \
  --output "$WRINGY_RENDERER/test-output/brand-smoke-v4.pptx" \
  --workspace "$WRINGY_RENDERER" \
  --pdf --mark-confirmed
```

For content production replace `--input`; optionally supply `--assets /absolute/manifest.json`. Output and candidate must be inside `--workspace`. This worker's write ownership remains renderer/** until main expands it. The CLI prints the final PPTX/PDF paths, all-slide PNG directory, private validation receipt, and the original slide ID/part/feature mapping. Do not deliver `.private` or `test-output` files as final decks.

Library: `import {renderDeck, buildPresentation, paginate} from './renderer.mjs'`. `renderDeck(content,{output,workspaceDir,theme:parsedTokens,assets:parsedManifest,assetBase,pdf:true})` exports, finalizes, reimports the exact final PPTX, renders every slide to PNG, and creates an image-based PDF with bundled pdf-lib. PDF is visual and not editable. Native PPTX objects stay editable.

## Content contract

The requested schema is retained:

```json
{
  "title": "中文标题",
  "language": "zh-CN",
  "slides": [{
    "id": "stable-id",
    "section": "章节",
    "title": "页面标题",
    "layout": "statement",
    "takeaway": "一句话重点",
    "body": ["第一项", "第二项", "第三项"],
    "example": "可选的具体例子",
    "visual_brief": "资产说明，不会生成虚构图片",
    "speaker_notes_zh": "中文讲稿",
    "sources": [{"title": "来源短标题", "url": "https://example.com/source"}],
    "feature_ids": []
  }]
}
```

Layouts: cover, statement, image, flow, compare, table, chart, module, catalog, closing. `section`, `visual_brief` and feature IDs are metadata, not automatically displayed. All copy is passed through, not rewritten. Sources and image provenance go into the relevant notes. Tables/charts and `facts_critical:true` slides show a small source-title footer. Keep source titles short; full URLs remain in notes.

- Native table: `table:{headers:[strings],rows:[[strings or numbers]],columnWidths?:[pixels]}`. Optional widths must total 1136. Catalog tables automatically split at eight data rows or sooner according to measured text height, repeating headers. Every input row survives pagination. `body` must be empty on table/chart slides; put narrative in takeaway/notes or a separate slide. Table arithmetic contracts can be supplied as top-level `tableArithmeticContracts` using the skill's exact finalizer schema and **expanded output** slide numbers.
- Native chart: `chart:{type:'bar'|'line'|'pie'|'doughnut'|'area',categories:[strings],series:[{name,values:[finite numbers],fill?}],numberFormat:'0%'|...,barOptions?:{direction:'bar'|'column',grouping:'clustered'|'stacked'|'percentStacked'}}`. Values are literals; 42% is 0.42. Finalization deliberately materializes and checks embedded workbook snapshots; original formulas/links are not represented by this schema. All chart fonts are explicitly set.
- `catalog` body lists split by both line height and a maximum of eight entries. Ordinary lists split after five items. Oversized individual items or dense compositions fail with a slide-specific error; they never shrink below readable sizes or silently lose text.
- `compare` supports two complete body strings in two flat columns. For row-based comparisons use a native table.
- `flow` defaults to editable numbered steps. For actual relationships, optional `diagram:{nodes:[{id,text,x,y,width,height}],edges:[{from,to,fromSide?,toSide?}]}` creates editable text nodes and attached native elbow connectors. Coordinates are CSS pixels within x=72..1208 and y=190..630 (y>=304 with takeaway). Diagram slides use empty body and no table/chart. See `diagram-smoke.json`. This schema represents supplied relationships, not decorative drawings.
- Full-bleed cover assets place editable Ink text in the left negative space (520 px wide); optional asset `textColor` controls contrast. Keep cover copy short. No opaque panel covers the hero image. Evidence assets always use contain and are never cropped.

## Asset manifest

```json
{
  "stable-id": {
    "path": "relative/to/manifest/image.png",
    "alt": "中文图片描述",
    "source": "https://example.com/original",
    "evidence": true,
    "fullBleed": false,
    "ai_generated": false
  }
}
```

One image per slide ID; PNG/JPEG/WebP supported. `image` slides require an asset, otherwise fail. Asset `fullBleed:true` is cover-only. AI-generated images receive an explicit Chinese disclosure in notes. No images or UI are synthesized by this renderer.

## Brand and fonts

Canonical `../../brand/tokens.json` is read, never modified. `theme.mjs` resolves semantic light colors and font families, reads brand slide sizes in points and converts to pixels, and uses chart semantic colors. Flat token overrides remain supported when no canonical token object is supplied. Default no-token theme is the earlier provisional purple/lime/PingFang scheme; final Wringy production must pass canonical tokens.

Noto Sans SC and Manrope are registered with documented `FontLibrary.use` in artifact-tool's own bundled skia-canvas, from local `assets/fonts/`. Chinese text uses Noto Sans SC; wholly ASCII text boxes use Manrope. Mixed Latin/Chinese text boxes use Noto Sans SC throughout. Each canonical-brand build checks every Han character in the input against the Noto font's cmap before authoring. Font files and OFL licenses are task-owned; bundled dependencies were not modified. Fonts are not embedded in PPTX, so native target applications need these fonts installed for matching appearance. The image PDF preserves the rendered appearance.

PingFang SC was independently confirmed in the renderer's system font inventory and used only in the initial provisional smoke test. Brand builds now use Noto Sans SC without fallback. Finalizer records the actual chosen font families.

## Validation and boundaries

`checks.mjs` verifies preservation of 21 catalog entries and 23 table rows across pagination, plus rejection of missing chart data. Three representative slides (Chinese cover/table/chart) finalized successfully in both provisional and canonical themes, with every render inspected at full size. Native table, chart, embedded workbook, font-policy, import, and geometry contracts passed. Native PowerPoint editing was not tested. Image placement/full-bleed logic has an actual hero/screenshot smoke test; each production slide still needs visual review.

No LibreOffice is needed for this pipeline. If a later task needs it, ONLY use:
`${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/MacOS/soffice`
Never use desktop LibreOffice, even if the bundle fails. No substitute authoring libraries or dependencies are installed.

2026-09-10 refinement: Ink/Citron lead the deck, Iris remains secondary. Native tables use Ink headers, no outer/vertical grid, and subtle horizontal rules. Optional takeaway is not synthesized. Native connector arrow direction was visually corrected to source → target and re-rendered.
