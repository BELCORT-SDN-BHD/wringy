# Wokiee approved logo source and migration handoff

2026-09-23 — the founder approved the Wokiee symbol, wordmark A and combined proof, then explicitly requested a standalone `wokiee-website` repository and a shared-logo PR in `BELCORT-SDN-BHD/wringy`. The founder confirmed this repository as the canonical source and asked the PR to remind the next main-repository session to change the brand from **Wringy to Wokiee**.

## Canonical artwork

Use [wokiee-logo/](wokiee-logo/), its [usage guide](wokiee-logo/README.md) and [SHA-256 manifest](wokiee-logo/manifest.json). [Approval record](APPROVED-DIRECTION.md) preserves the actual approval statements; [approved composition proof](approved-proof.png) is review evidence, not a production export. Historical workspace paths in the approval record identify the original review artifacts; packaged originals live under `wokiee-logo/sources/`.

The smooth hand-and-star symbol and A wordmark silhouettes and proportions must remain unchanged. Artwork was not regenerated for this repository handoff. The original package build script now requires its packaged references and supports portable preview-label fonts; all supplied SVG, PNG, PDF, ICO, source image and vector-master bytes are unchanged.

## Wordmark font information

The exact font identity of the approved A wordmark is **unverified**. The production wordmark is outlined artwork traced from the approved raster reference, not editable font text. Do not guess a font name or retype the logo in a substitute font. Use the SVG paths. The package documents tracing fidelity and limitations.

Logo lettering is separate from website and product typography. The standalone website's Suisse/Inter choices are not the logo's font identity. The current main-repository design source uses Geist Variable (`../app/src/index.css`); this PR does not change that typography, colors, components or existing app branding.

## Acceptance and scope

- The approved logo package is available at this single canonical path; all manifest hashes verify.
- The supplied artwork is byte-identical to the approved package. Only rebuild portability instructions/script and their manifest entries changed.
- The separate website consumes these assets through an immutable repository commit and checksums; it owns only derived distribution copies.
- Wringy → Wokiee is recorded as the next main-session migration intent. This PR does not perform a global text/code/domain/package rename, replace current app logos, redesign the system or publish anything.

The existing design-system entrypoint remains `../README.md`. Do not elevate historical `design-v3` or deliverable copies into a second source. The founder will open a separate session in this repository to review and update the full design system and product branding. That session should decide the exact surfaces and identifiers to rename, update approved source rules first, propagate downstream and verify each affected surface. Existing names remain until that scoped work is approved and completed.

## Consumer contract for wokiee-website

Pin the full source Git commit, repository URL, this package path and SHA-256 of `manifest.json` in the website's asset lock file. Record each used canonical file path, destination and its manifest SHA-256. Copy only required runtime assets into the website and mark them generated: do not hand-edit those copies. Verify lock/manifest and every copied file before building. Updating artwork begins here; consumers deliberately select a newer reviewed commit and resynchronize. Do not download mutable `main` silently during a build. Prefer the merged main commit for the final pin; any PR-head pin is explicitly provisional until merge.

## Validation and rollback

Validate every manifest entry against its bytes and compare original approved artwork hashes. Check SVG path-only content and supplied shape geometry; the package's `sources/validation.json` records original production fidelity. Syntax-check the portable build script and exercise it on a disposable copy, not the canonical package. Existing repository CI remains applicable to the PR. Removing this additive folder and its entrypoint link reverts the handoff without changing application behavior; website consumers must retain their pinned version until a deliberate update.
