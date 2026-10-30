# Instructions for coding agents

- Read README.md, TODO.md, and CONTRIBUTING.md before working. They describe scope, implementation status, ownership, and the shared workflow.
- Follow the project owner's current instructions. At the initial documentation baseline, application scope awaits approval; documentation maintenance is authorized.
- Check Git status and remote changes before editing or pushing. Preserve other contributors' changes and never discard work or force-push shared history.
- Use focused branches and pull requests for application changes. Coordinate overlapping tasks and shared schema/configuration changes.
- Update README.md and TODO.md with each meaningful project change in the same commit/PR. Record behavior, setup changes, task ownership/status, verification results, blockers, and remaining work as applicable.
- Keep planned, implemented, tested, and deployed states distinct. Do not invent setup commands, completed checks, deployment URLs, or implemented features.
- Run verification appropriate to the change. At the documentation-only baseline, use `git diff --check`; application commands must be documented when introduced.
- Never commit secrets, private student rosters, or real chat data. Use placeholder configuration examples.
- Preserve server-side membership checks, owner-only listing mutations, and conversation participant access as implementation requirements. An institute email domain alone does not prove current student status.
- At handoff, report the changed files, branch/commit or PR, checks performed, and unresolved work.
