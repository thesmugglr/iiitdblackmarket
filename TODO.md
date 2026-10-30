# Shared task board

Use this file to coordinate work before opening a branch. Scope is proposed until approved by the project owner; an unassigned task is not an instruction to start implementation.

Statuses: `Backlog`, `Ready`, `In progress`, `Blocked`, `Review`, `Done`.

Claim a task by adding your GitHub handle to Owner and linking your branch or pull request. Coordinate claims in GitHub before starting parallel work; local edits alone do not reserve a task. Split large tasks into smaller IDs as implementation becomes concrete.

| ID | Task | Status | Owner | Depends on | Branch / PR / notes |
| --- | --- | --- | --- | --- | --- |
| DOC-01 | Establish shared README, task board, contribution guide, and agent instructions | Done | Codex | — | Documentation only; 2026-10-31. |
| REVIEW-01 | Review/fix AbhikRao PR #3 before merge | Review | Codex | PR #3 | Branch `fix/PR-03-review`; corrective migration, seven local database checks, CI. Live Supabase QA remains separate. |
| PLAN-01 | Approve or revise first-release scope | Review | Codex | — | Implemented on `feat/mvp-app`; untested on live backend. |
| PLAN-02 | Decide current-student verification and approval process | Backlog | Unassigned | PLAN-01 | Institute domain alone does not establish student status. |
| SETUP-01 | Choose framework/hosting and scaffold application | Review | Codex | PLAN-01 | Implemented on `feat/mvp-app`; untested on live backend. |
| DATA-01 | Design schema and migrations for profiles, listings, conversations, offers, and reports | Review | Codex | PLAN-02, SETUP-01 | Implemented on `feat/mvp-app`; untested on live backend. |
| AUTH-01 | Configure institute sign-in and student eligibility checks | Review | Codex | PLAN-02, DATA-01 | Implemented on `feat/mvp-app`; untested on live backend. |
| LIST-01 | Create/edit listings and protected photo uploads | Review | Codex | AUTH-01, DATA-01 | Implemented on `feat/mvp-app`; untested on live backend. |
| LIST-02 | Browse, categories, keyword search, filters, sorting, and detail page | Review | Codex | LIST-01 | Implemented on `feat/mvp-app`; untested on live backend. |
| LIST-03 | Sale/rental/giveaway fields and reserved/sold lifecycle | Review | Codex | LIST-01 | Implemented on `feat/mvp-app`; untested on live backend. |
| CHAT-01 | Private persistent listing conversations and real-time messages | Review | Codex | AUTH-01, DATA-01 | Implemented on `feat/mvp-app`; untested on live backend. |
| CHAT-02 | Attachments, unread counts, and offers | Review | Codex | CHAT-01, LIST-03 | Implemented on `feat/mvp-app`; untested on live backend. |
| USER-01 | Profiles, saved items, and personal dashboard | Review | Codex | AUTH-01, LIST-01 | Implemented on `feat/mvp-app`; untested on live backend. |
| MOD-01 | Reporting, blocking, and admin moderation | Review | Codex | AUTH-01, LIST-01, CHAT-01 | Implemented on `feat/mvp-app`; untested on live backend. |
| QA-01 | Verify separate-account access isolation and core marketplace flows | Backlog | Unassigned | LIST-02, LIST-03, CHAT-02, USER-01, MOD-01 | Record actual results and remaining limits. |
| DEPLOY-01 | Configure deployment, verify live flows, and document operations | Backlog | Unassigned | QA-01 | Record URL, setup steps, and configuration requirements. |

## Optional backlog — scope not yet approved

- `EXTRA-01`: “Looking for” posts.
- `EXTRA-02`: Moving-out bundles.
- `EXTRA-03`: Listing expiry reminders and in-app notifications.
- `EXTRA-04`: Integrated payments; outside the proposed first release.

## Completion and handoff

Before marking a task Done, link the merged change, record meaningful verification, update the README for changed behavior/setup, and note unfinished work here. For Blocked tasks, name the missing dependency or decision and who can resolve it. For an unfinished handoff, leave the branch, current state, next step, and verification limits in the notes.

## Open decisions

- First-release scope approval.
- Student eligibility source, approval owner, and handling of graduates.
- Framework, hosting, backend project ownership, and configuration.
- Final rental rules and listing lifecycle.

## Status note (2026-10-31)
Tasks in `Review` are implemented but unverified. PLAN-02 is resolved as roster + admin approval (graduates handled manually). Still needed from the owner: Supabase project, Google OAuth credentials, hosting choice (QA-01, DEPLOY-01).

The owner authorized checking and merging AbhikRao's PRs. A 15-minute review monitor is active. Review the exact current head, resolve material findings, and run applicable checks before merge; leave blocked PRs unmerged. Local regression checks now cover a subset of QA-01, not live-provider verification.
