# Project Progress

## Current State

- 2026-09-21: project-local agent setup: Matt Pocock skills for both agents, plus a current Graphify Codex skill and compatible hook. Product runtime remains greenfield; [PRD](PRD.md) and [Architecture](ARCHITECTURE.md) consolidate accepted decisions and distinguish targets from verified implementation.
- Working branch: `codex/project-matt-pocock-skills`, based on blueprint commit `d55b62b` (draft [PR #71](https://github.com/BELCORT-SDN-BHD/wringy/pull/71)). Use `git log -1` for this installation's commit. Neither change is claimed merged to `main`.
- GitHub owns live execution state. Live M1–M5 spec issues were checked against local specs; no later product decision was found.

## Completed

- Preserved the owner's original blueprint focus criteria in YAML frontmatter; defined in-place updates after accepted Wayfinder / to-spec decisions, before to-tickets. Detailed acceptance and ticket history remain outside the blueprints.
- Updated AGENTS, README, CONTEXT and planning / ADR / foundation navigation to use the two blueprints.
- Verification: valid YAML and all 88 local blueprint links / anchors; `git diff --check`; `python -X utf8 scripts/check-planning.py` (5 specs, 60 tasks, acyclic dependencies). Two independent read-only source reviews found no material gaps. Product runtime tests were not run for this documentation-only change.
- Refreshed the eight changed blueprint / navigation documents in graphify: 5,955 nodes and 10,293 edges, with unrelated semantic records preserved and no dangling edges. Removed stale placeholder meanings; scoped cache and manifest are current. The installed skill/package version warning remains; no tools were upgraded.
- Installed the 25 published Matt Pocock skills into each of `.agents/skills` and `.claude/skills`, pinned to upstream `c55ee46073ed923f86ce59a5eb3b6d895095d1b7` (1.2.3). See the [installation and update record](agents/matt-pocock-skills.md). Existing tracker, labels and domain configuration are reused; `AGENTS.md`, `CLAUDE.md`, existing orchestrator skills and hooks are unchanged by this installation. The already-installed Matt Pocock Claude plugin is disabled only in project settings to avoid duplicate loading; other settings and global plugin state are untouched.
- Installation verification: 74 files per agent match all upstream Git blob hashes; all 50 skill frontmatters and Codex metadata files parse; planning check passes (5 specs, 60 tasks). Protected instruction/orchestrator/hook hashes match their pre-install values.
- Graphify: official package `0.9.63` Codex skill and eight references installed at `.agents/skills/graphify`; `.codex/hooks.json` now uses `graphify hook-check` (the official intentional no-op). The local Codex `skills/list` reports the project skill enabled and the legacy global skill disabled; `hooks/list` discovers the new project hook. Direct command tests passed: Codex exits 0 with empty stdout; Claude Bash/Grep/Read/Glob guards return valid `PreToolUse` JSON in soft mode. Both platform skill bundles match the installed package, and planning checks pass. Global Codex configuration, existing Claude skill/settings, both instruction files and orchestrators remain unchanged. Do not run the general Graphify installer just to update these files: it also writes instruction files. Update the scoped skill bundle/references from the installed package and re-verify discovery instead.

## In Progress

- Owner review of the documentation branch / draft PR; product implementation is the next separate task.

## Known Issues

- Existing unrelated changes are preserved and excluded from this work: modified `.claude/skills/orchestrator-fable/SKILL.md` and untracked `.agents/skills/orchestrator-fable/SKILL.md`. The owner explicitly approved correcting and tracking the previously untracked `.codex/hooks.json` in the Graphify follow-up.
- Graphify CLI still warns about the disabled global `0.3.17` copy because it scans global version stamps without checking Codex enablement. The project's enabled skill is `0.9.63`; the global copy/config were intentionally preserved. Codex hook discovery reports `trustStatus: untrusted`: approve any hook trust prompt in the app yourself; this session does not alter trust records. Skill discovery and direct hook-command tests do not prove automatic host dispatch.
- On Windows, the existing planning checker requires UTF-8 mode (`python -X utf8 scripts/check-planning.py`); its default-codepage JSON read is an existing portability issue.
- Product runtime, real provider/payment capability, capacity and recovery remain unverified. Blueprint completion does not fulfill stage implementation or release gates.

## Next Steps

- Review the blueprint diff. Future decisions replace affected sections using each file's frontmatter; do not append session history.
- Implementation entry remains [M1-01 / #2](https://github.com/BELCORT-SDN-BHD/wringy/issues/2), with [M4 feasibility / #15](https://github.com/BELCORT-SDN-BHD/wringy/issues/15) able to proceed in parallel after checking live dependencies. This session prepares documents, not product implementation.
