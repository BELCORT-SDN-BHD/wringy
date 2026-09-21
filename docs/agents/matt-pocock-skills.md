---
source: https://github.com/mattpocock/skills
revision: c55ee46073ed923f86ce59a5eb3b6d895095d1b7
package_version: 1.2.3
installed_on: 2026-09-21
selection: .claude-plugin/plugin.json#skills
skill_count: 25
destinations:
  codex: .agents/skills
  claude_code: .claude/skills
maintenance: Replace this installation record in place when updating; do not append session history.
---

# Matt Pocock skills — project installation

The 25 skills in the upstream published plugin manifest are installed as editable,
project-local files for both agents. The two copies are byte-identical to the pinned
upstream revision, including `agents/openai.yaml`, reference files and script
templates. No global installation or managed Claude plugin was added. The existing
managed Claude plugin is disabled only in this project's `.claude/settings.json`
to prevent duplicate loading; its installation and all other settings are preserved.

Engineering: `ask-matt`, `code-review`, `codebase-design`, `diagnosing-bugs`,
`domain-modeling`, `grill-with-docs`, `implement`, `improve-codebase-architecture`,
`prototype`, `research`, `resolving-merge-conflicts`, `setup-matt-pocock-skills`,
`tdd`, `to-spec`, `to-tickets`, `triage`, `wayfinder`, `wizard`.

Productivity: `grill-me`, `grilling`, `handoff`, `teach`, `to-questionnaire`,
`wait-what`, `writing-for-agents`.

The upstream `in-progress` and `misc` directories are not part of this published
bundle and are not installed. Existing `orchestrator-fable` skills are independent
and were not changed.

## Repository setup

Reuse the existing [GitHub tracker](issue-tracker.md), [triage labels](triage-labels.md)
and [single-context domain layout](domain.md). All five configured triage labels
were verified on GitHub at installation. The existing `AGENTS.md` and `CLAUDE.md`
already provide the configuration pointers; neither was edited. Re-running setup
is unnecessary unless the owner wants to change these choices.

Invoke a skill explicitly, for example `$wayfinder` in Codex or `/wayfinder` in
Claude Code. Codex can discover the new skills on the next turn; if an existing
Claude session does not list them, start a new session in this project. Installation
does not execute the supplied scripts, install hooks or implement product tickets.

## Updating

Choose and review a new upstream commit, then read its `.claude-plugin/plugin.json`
`skills` list. Download those directories into a temporary staging directory with
the Codex `skill-installer` helper (`--repo mattpocock/skills --ref <commit> --path
<manifest paths> --dest <staging directory>`). Compare the staged files before
replacing only this bundle's directories in both destinations. Preserve local
customizations explicitly; never overwrite unrelated skills, settings, hooks,
`AGENTS.md`, `CLAUDE.md` or the existing repository setup documents.

Verify both installed trees against the pinned upstream Git blob hashes and update
this header and the skill list together. These helper-installed copies are not
registered with an `npx skills` lockfile; do not assume `npx skills update` manages
them. Do not re-enable the managed Claude plugin while these local Claude copies
are present; choose one installation method per agent.

The vendored files are covered by the [upstream MIT license](matt-pocock-LICENSE.txt).
