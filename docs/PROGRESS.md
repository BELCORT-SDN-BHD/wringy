PROGRESS.md: The most basic state persistence file

# Project Progress

## Current State
- Main branch as of 2026-09-17. Harness scaffolding (AGENTS.md, CLAUDE.md, docs/PRD.md, docs/ARCHITECTURE.md) is committed but still greenfield: PRD and Architecture are placeholder stubs, and AGENTS.md still carries template placeholders ("产品名字", "HIGHEST VISION SENTENCES", references to "Clara").
- Project skills in place: `orchestrator-fable` (`.claude/skills/`), graphify 0.9.63 (global `/graphify` skill, git post-commit/post-checkout hooks, PreToolUse hooks in `.claude/settings.json`, graphify section in AGENTS.md), and the `mattpocock-skills` Claude Code plugin 1.2.3 enabled at project scope via `.claude/settings.json`.
- Knowledge graph built for the whole repo: 833 files, 5913 nodes, 10237 edges, 292 labeled communities in `graphify-out/` (graph.json, GRAPH_REPORT.md, graph.html). Finance artefacts (phase-0/finance, deliverables */finance, finance build scripts) are excluded via `.graphifyignore` by founder decision on 2026-09-17; the files stay in the repo.
- Verification: `graphify hook status` reports both git hooks and the merge driver installed; `claude plugin details mattpocock-skills@claude-plugins-official` lists 25 skills; graph rebuild and labeling completed with exit code 0.

## Completed
- 2026-09-17: orchestrator-fable skill copied from PROJECT TEMPLATE into `.claude/skills/`.
- 2026-09-17: graphify upgraded 0.3.17 -> 0.9.63, Claude Code and git integration installed, first full graph built (docs via 32 parallel extraction subagents, code via AST), then rebuilt with finance artefacts excluded.
- 2026-09-17: mattpocock-skills plugin enabled for this repo (it was previously only enabled in scratch test folders, so `grilling`, `wayfinder`, `to-spec`, `to-tickets` were unavailable here).
- 2026-09-17: graph memory records the founder's ruling that the "Cobalt Blue as the only brand accent" and "Citron Yellow is brand action, not success" rules do not conflict.

## In Progress
- [ ] None.

## Known Issues
- docs/PRD.md and docs/ARCHITECTURE.md are stubs; AGENTS.md header and table still contain template placeholder text.
- `graphify-out/graph.json` is ~7.5 MB and tracked in git (merge driver registered in `.gitattributes`). Caches, converted files and dated backups are gitignored.
- The graph's semantic layer was extracted by Claude Code subagents, so `graphify-out/cost.json` records 0 tokens for those runs.
- `docs/agents/issue-tracker.md` says "use --body-file for multiline bodies" where the upstream template says "use a heredoc"; kept deliberately for Windows.

## Next Steps
1. Start a fresh Claude Code session so the mattpocock-skills plugin loads, then run `/wayfinder` or `/grill-with-docs` to replace the PRD and Architecture stubs with real content and fix the AGENTS.md placeholders.
2. After any doc changes, run `/graphify . --update` (docs need semantic re-extraction; the git hook only refreshes code via AST).
3. Decide whether `.scratch/wringy-foundations/issues/15-finance-review.md` should also be excluded from the graph.
