# Contributing

Start with [README.md](README.md) for scope and actual project status, then [TODO.md](TODO.md) for task ownership. No runnable application exists yet; package-manager, build, and test commands will be added when the stack is established.

## Coordinate work

1. Agree on a task and claim its ID in TODO.md with your GitHub handle and branch/PR link. Check remote changes before claiming the same task as someone else.
2. Start a focused branch from the latest main. Suggested names: `feat/LIST-01-listing-editor`, `fix/CHAT-01-access-check`, or `docs/shared-workflow`.
3. Coordinate shared schema, authentication, configuration, and dependency changes before editing overlapping files.
4. Open a pull request and include the task ID, user-visible changes, actual verification, remaining limitations, and setup changes. Link it in TODO.md.
5. Fetch again before merging. Preserve both contributors' intended changes when resolving conflicts. Do not force-push shared branches or discard another contributor's work.

Example for a new task, starting from a clean checkout:

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/LIST-01-listing-editor
```

If the pull cannot fast-forward, inspect the divergence and coordinate before proceeding. Save existing local work before switching branches; do not reset it away.

## Keep the shared record current

Include documentation with every meaningful contribution:

- **README.md:** Product behavior, implementation status, setup/configuration, verification outcomes, and concise dated progress entries.
- **TODO.md:** Ownership, status, dependencies, branch/PR links, blockers, and next steps.
- **CONTRIBUTING.md:** Changes to the shared development workflow and real commands once available.
- **AGENTS.md:** Shared repository instructions for coding agents when those instructions change.

Describe features as planned, implemented, tested, or deployed accurately. A completed UI does not establish that backend behavior works. Keep secrets, private rosters, and real conversations out of commits, documentation, and test fixtures. When configuration is added, provide example key names with placeholders and ignore local secret files.

## Review and verification

Keep commits focused and use descriptive messages such as `feat: add listing photo uploads`. Run checks appropriate to the change and record exactly what ran. Documentation changes should pass `git diff --check`; no application tests exist yet.

As features arrive, meaningful checks should cover institute/student eligibility, listing ownership, uploaded file access, and isolation between different users' conversations. Include responsive and accessible interaction checks for UI changes. Document unavailable checks and configuration dependencies rather than claiming success.

Suggested pull request contents:

```text
Task: LIST-01
Change: <problem and resulting behavior>
Verification: <commands or manual scenarios and results>
Setup changes: <configuration key names/migrations, or none>
Remaining work: <limits/blockers, or none>
```

The initial documentation baseline is committed directly to main. Application contributions should use the branch/PR workflow above. Repository branch protection has not been configured by this documentation change.
