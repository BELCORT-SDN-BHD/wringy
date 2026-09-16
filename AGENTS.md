# ChatGPT project context

This directory is a local mirror of the ChatGPT project “wringy.com”.

- Treat every file under `sources/` as read-only reference material.
- Do not edit, rename, move, or delete synced project files.
- These files may be replaced the next time a task is created from this ChatGPT project.


## Project instructions

This project has no custom instructions.


## Agent skills

### Issue tracker

Use GitHub Issues in BELCORT-SDN-BHD/wringy for specs, tickets, dependencies and milestone status. Read `docs/agents/issue-tracker.md` before creating or changing tracked work.

### Triage labels

Use the five default triage roles. Read `docs/agents/triage-labels.md` before triaging issues.

### Domain docs

Single-context layout. Read `CONTEXT.md` and relevant decisions via `docs/agents/domain.md` before changing product behavior.

## Development governance

Verify upstream foundations and recorded approval before implementation: product intent, discovery, blueprint and spec; design work also checks brand, design system and components; backend work checks domain, schema and contracts. Report gaps and let the founder choose whether to fill or explicitly carry them. Planning is not evidence of working software.

Light work changes wording/values without behavior changes; medium work needs intent and checkable acceptance; heavy work (new surfaces, auth, tenant boundaries, money, schema, deletion) requires a full approved spec before coding. Record approval, evidence, appetite, success measures and non-goals. Scope changes enter the spec change register. Do not treat ticket migration as blanket implementation approval.

Use short-lived `codex/` or `claude/` branches in separate worktrees; main remains the integration baseline. Every PR references its spec and acceptance evidence. Cross-module PRs declare why. Tests scale to task risk, including integration for behavior changes and end-to-end/rollback evidence for heavy work. Cross-vendor review is required; unavailable review is reported, never fabricated. User-facing titles describe outcomes with identifiers secondary.

Production deployments and real funds movement require explicit founder approval. Never publish credentials or account/session exports. Existing .scratch records are migration archives, not a parallel tracker.

CI/harness coverage and gaps are recorded in `docs/repository-status.md`; missing gates are not waived by setup. Add and index module rules when implementation introduces modules. Apply ownership and protected-delivery rules before real releases.
