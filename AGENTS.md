# Instructions for coding agents

- Read README.md, TODO.md, and CONTRIBUTING.md before working. They describe scope, implementation status, ownership, and the shared workflow.
- Follow the project owner's current instructions. Core marketplace engineering is authorized; optional extras remain separate scope.
- Check Git status and remote changes before editing or pushing. Preserve other contributors' changes and never discard work or force-push shared history.
- Use focused branches and pull requests for application changes. Coordinate overlapping tasks and shared schema/configuration changes.
- Update README.md and TODO.md with each meaningful project change in the same commit/PR. Record behavior, setup changes, task ownership/status, verification results, blockers, and remaining work as applicable.
- Keep planned, implemented, tested, and deployed states distinct. Do not invent setup commands, completed checks, deployment URLs, or implemented features.
- Run verification appropriate to the change. At the documentation-only baseline, use `git diff --check`; application commands must be documented when introduced.
- Never commit secrets, private student rosters, or real chat data. Use placeholder configuration examples.
- Preserve server-side membership checks, owner-only listing mutations, and conversation participant access as implementation requirements. An institute email domain alone does not prove current student status.
- At handoff, report the changed files, branch/commit or PR, checks performed, and unresolved work.

## Work ownership (owner instruction, 2026-10-31)

- AbhikRao owns website design, UI, styling, layout, visual assets, and interaction presentation.
- Garv Rao with Codex in this chat owns backend, authentication, migrations, access policies, tests, CI, configuration, and deployment preparation.
- Keep Codex engineering changes out of shared CSS, visual components, and layout unless a concrete functional fix requires coordination. Do not impose the retired Codex design PR #4; its source remains available for Abhik to use at his discretion.
- Prefer small backend/logic helpers with stable interfaces so Abhik can build the UI independently. Coordinate before changing frontend data contracts.

## Standing PR review authorization (2026-10-31)

The repository owner authorized reviewing and merging PRs authored by collaborator `AbhikRao` after checking them. Fetch the exact current head, inspect the diff and integration with ongoing work, and run applicable checks. Merge only non-draft PRs with no unresolved material findings and passing required checks. Fix routine defects on a focused branch or report blockers; do not merge blindly. Preserve both collaborators' contributions, and keep README/TODO current. This authorization does not authorize deployment or weakening access controls. The Codex chat has a 15-minute review heartbeat; avoid duplicating an in-progress review.
