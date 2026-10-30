# Instructions for coding agents

- Read README.md, TODO.md, and CONTRIBUTING.md before working. They describe scope, implementation status, ownership, and the shared workflow.
- Follow the project owner's current instructions. The owner authorized scaffolding and the dark-tech visual direction. The collaborator's PR #3 supplies the marketplace app; this design branch builds on it without changing database/auth eligibility logic.
- On this branch use `app/`, read docs/design.md, preserve the dark tokens and the distinction between public landing and private marketplace. Coordinate the alternative scaffold PR #1 before merging competing frontend structures.
- Check Git status and remote changes before editing or pushing. Preserve other contributors' changes and never discard work or force-push shared history.
- Use focused branches and pull requests for application changes. Coordinate overlapping tasks and shared schema/configuration changes.
- Update README.md and TODO.md with each meaningful project change in the same commit/PR. Record behavior, setup changes, task ownership/status, verification results, blockers, and remaining work as applicable.
- Keep planned, implemented, tested, and deployed states distinct. Do not invent setup commands, completed checks, deployment URLs, or implemented features.
- For app changes run `npm run build` (includes TypeScript) and `npm run lint` inside app/, plus `git diff --check`. Record existing warnings and unavailable live-account checks honestly. No automated test suite exists in this branch.
- Never commit secrets, private student rosters, or real chat data. Use placeholder configuration examples.
- Preserve server-side membership checks, owner-only listing mutations, and conversation participant access as implementation requirements. An institute email domain alone does not prove current student status.
- At handoff, report the changed files, branch/commit or PR, checks performed, and unresolved work.
