# Shared task board

Use this file to coordinate work before opening a branch. The owner authorized the basic scaffold on 2026-10-31; broader marketplace scope remains proposed. An unassigned task is not an instruction to start implementation.

Statuses: `Backlog`, `Ready`, `In progress`, `Blocked`, `Review`, `Done`.

Claim a task by adding your GitHub handle to Owner and linking your branch or pull request. Coordinate claims in GitHub before starting parallel work; local edits alone do not reserve a task. Split large tasks into smaller IDs as implementation becomes concrete.

| ID | Task | Status | Owner | Depends on | Branch / PR / notes |
| --- | --- | --- | --- | --- | --- |
| DOC-01 | Establish shared README, task board, contribution guide, and agent instructions | Done | Codex | — | Documentation only; 2026-10-31. |
| PLAN-01 | Approve or revise first-release scope | Ready | Project owner | — | See README proposal. |
| PLAN-02 | Decide current-student verification and approval process | Backlog | Unassigned | PLAN-01 | Institute domain alone does not establish student status. |
| SETUP-01 | Scaffold website, API, shared types, local tooling, and CI | Review | Codex | Owner authorized scaffold directly | [PR #1](https://github.com/garvrao80/iiitdblackmarket/pull/1), branch `feat/SETUP-01-repo-scaffold`; see README verification and setup. Merge pending. |
| SETUP-02 | Choose production hosting and configure backend provider | Backlog | Unassigned | SETUP-01 | No hosting or Supabase project configured. |
| DESIGN-01 | Dark-tech public homepage and reusable design guide | In progress | Codex | SETUP-01; owner selected dark tech | Branch `feat/DESIGN-01-dark-campus`, based on scaffold PR #1. Scope: web UI/assets and design documentation; no API/schema changes. |
| DATA-01 | Design schema and migrations for profiles, listings, conversations, offers, and reports | Backlog | Unassigned | PLAN-02, SETUP-01 | Include ownership and membership access policies. |
| AUTH-01 | Configure institute sign-in and student eligibility checks | Backlog | Unassigned | PLAN-02, DATA-01 | Document OAuth callback and environment key names. |
| LIST-01 | Create/edit listings and protected photo uploads | Backlog | Unassigned | AUTH-01, DATA-01 | Include image limits and owner-only mutations. |
| LIST-02 | Browse, categories, keyword search, filters, sorting, and detail page | Backlog | Unassigned | LIST-01 | Include empty, loading, and failure states. |
| LIST-03 | Sale/rental/giveaway fields and reserved/sold lifecycle | Backlog | Unassigned | LIST-01 | Define transitions and offer behavior. |
| CHAT-01 | Private persistent listing conversations and real-time messages | Backlog | Unassigned | AUTH-01, DATA-01 | Only authorized participants may read/send. |
| CHAT-02 | Attachments, unread counts, and offers | Backlog | Unassigned | CHAT-01, LIST-03 | Validate offer acceptance and attachment access. |
| USER-01 | Profiles, saved items, and personal dashboard | Backlog | Unassigned | AUTH-01, LIST-01 | Keep private contact data private. |
| MOD-01 | Reporting, blocking, and admin moderation | Backlog | Unassigned | AUTH-01, LIST-01, CHAT-01 | Define restricted admin permissions. |
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
- Hosting, backend project ownership, and configuration. React/Vite + Fastify scaffold is implemented for review.
- Final rental rules and listing lifecycle.
