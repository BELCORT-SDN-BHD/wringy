# Project Progress

## Current State

- 2026-09-22: `main` carries the owner's self-edits through [PR #72](https://github.com/BELCORT-SDN-BHD/wringy/pull/72): the orchestrator-fable skill line change, Codex interface metadata added under the Claude skill, the Codex-facing orchestrator variant removed, and AGENTS.md working-protocol item 4 shortened. Use `git log -1` for the current checkout commit.
- Agent tooling: 25 Matt Pocock skills vendored for both agents, the Graphify Claude hooks and Codex skill / hook, and the owner's orchestrator-fable skill for Claude Code. A read-only setup audit on 2026-09-22 found both installations sound; what it left for the owner is under Known Issues.
- Product runtime remains greenfield; [PRD](PRD.md) and [Architecture](ARCHITECTURE.md) consolidate accepted decisions and distinguish targets from verified implementation. GitHub owns live execution state.

## Completed

- Blueprints: the owner's focus criteria live in each file's YAML frontmatter; blueprints are updated in place after accepted Wayfinder / to-spec decisions and before to-tickets. AGENTS, README, CONTEXT and planning / ADR / foundation navigation point at the two blueprints. Verified 2026-09-21: valid YAML, all 88 local blueprint links / anchors, `git diff --check`, and `python -X utf8 scripts/check-planning.py` (5 specs, 60 tasks, acyclic). Product runtime tests were not run for documentation-only changes.
- Matt Pocock skills: the 25 published skills are installed into each of `.agents/skills` and `.claude/skills`, pinned to upstream `c55ee46073ed923f86ce59a5eb3b6d895095d1b7` (1.2.3); see the [installation and update record](agents/matt-pocock-skills.md). Re-verified 2026-09-22: 74 of 74 files per agent match the upstream Git blob hashes, the pin equals upstream `main` HEAD, all 50 skill frontmatters and their 50 Codex metadata files parse, the five triage labels exist on GitHub, and the project-scoped disablement of the managed Claude plugin matches the installed plugin id, so no skill loads twice. Fourteen skills are user-invoked only by upstream design (`disable-model-invocation`), so they are absent from the model's own skill list.
- Graphify: CLI `0.9.65` is the latest release. The Claude hooks in `.claude/settings.json` and the Codex hook in `.codex/hooks.json` match what the installed package writes, and direct command tests return valid soft `PreToolUse` JSON. `.agents/skills/graphify` is content-identical to the package's `0.9.65` Codex skill and eight references (version stamp corrected from `0.9.63` on 2026-09-22); Claude Code uses the global `~/.claude/skills/graphify` at `0.9.65`. The git hooks and the `graph.json` merge driver are installed in this clone. Do not run the general Graphify installer to update the project files: it also writes instruction files and targets `.codex/skills`.
- Graph: refreshed on 2026-09-22 with the incremental `/graphify . --update` flow for the instruction and navigation documents changed since the last semantic pass; [GRAPH_REPORT](../graphify-out/GRAPH_REPORT.md) holds the current counts.
- Orchestration is owner configuration: the Claude skill's Codex lane prefers `gpt-6-astra` / `medium`. Codex has had no orchestrator-fable skill since PR #72.

## In Progress

- Product implementation has not started; it remains the next separate task.

## Known Issues

- Owner decisions from the 2026-09-22 audit, none applied:
  - `.claude/skills/orchestrator-fable/agents/openai.yaml` is invalid YAML (unescaped inner quotes in `short_description`) and sits in a tree Codex does not scan; its project skill path is `.agents/skills`. Repairing the quotes would also activate `allow_implicit_invocation: false`. Decide whether Codex should have an orchestrator skill at all.
  - `.claude/skills/orchestrator-fable/SKILL.md` names `/loop-me`, an upstream in-progress skill that is not installed, and prescribes `--effort`, which the Codex plugin lane accepts but the `codex exec` lane named in its description rejects.
  - AGENTS.md working-protocol item 8 names the labels `idea` and `need-triages`; GitHub has `needs-triage` and no `idea`. `docs/agents/issue-tracker.md` names `wayfinder:map`, which does not exist either.
  - `core.autocrlf=true` makes working-tree bytes differ from the committed blobs, and Graphify hashes working-tree bytes. Manifest hashes therefore differ between checkouts and agents, and an AST rebuild can blank a document's `semantic_hash` although its content is unchanged. `* text=auto eol=lf` in `.gitattributes` would stabilise them.
  - `graphify-out/cost.json` is tracked although upstream marks it local-only; the merge driver in `.gitattributes` covers only `graph.json`; git hooks and the merge driver are per-clone, and no repository document yet tells a fresh clone to run `graphify hook install`.
- The Codex project hook has no trust record in `~/.codex/config.toml`: approve its trust prompt in the Codex app yourself. Direct hook-command tests do not prove automatic host dispatch.
- On Windows the planning checker requires UTF-8 mode (`python -X utf8 scripts/check-planning.py`); its default-codepage JSON read is an existing portability issue.
- Product runtime, real provider / payment capability, capacity and recovery remain unverified. Blueprint completion does not fulfil stage implementation or release gates.

## Next Steps

- Future accepted decisions replace affected blueprint sections using each file's frontmatter; do not append session history.
- Implementation entry remains [M1-01 / #2](https://github.com/BELCORT-SDN-BHD/wringy/issues/2), with [M4 feasibility / #15](https://github.com/BELCORT-SDN-BHD/wringy/issues/15) able to proceed in parallel after checking live dependencies.
