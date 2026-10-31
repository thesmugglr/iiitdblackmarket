# Shared task board

Use this file to coordinate work before opening a branch. Scope is proposed until approved by the project owner; an unassigned task is not an instruction to start implementation.

Statuses: `Backlog`, `Ready`, `In progress`, `Blocked`, `Review`, `Done`.

Claim a task by adding your GitHub handle to Owner and linking your branch or pull request. Coordinate claims in GitHub before starting parallel work; local edits alone do not reserve a task. Split large tasks into smaller IDs as implementation becomes concrete.

| ID | Task | Status | Owner | Depends on | Branch / PR / notes |
| --- | --- | --- | --- | --- | --- |
| DOC-01 | Establish shared README, task board, contribution guide, and agent instructions | Done | Codex | — | Documentation only; 2026-10-31. |
| REVIEW-04 | Review launch PR #13 and reconcile #10/#12 overlap | In progress | Garv Rao / Codex | PR #13 | #10 was closed unmerged; its CI had a Realtime timeout (19/20 service checks passed). Preserve Abhik's newer photo UI; restore local endpoint safeguards and ensure photo metadata removal. Independent service CI and remaining launch review must pass before merge. #12 stays separate until its regression coverage is reconciled. |
| REVIEW-01 | Review/fix AbhikRao PR #3 before merge | Done | Codex | PR #3 | [Fix PR #5](https://github.com/garvrao80/iiitdblackmarket/pull/5) merged into [PR #3](https://github.com/garvrao80/iiitdblackmarket/pull/3); #3 approved and merged to main at `491d233`. Eight local DB checks and GitHub CI pass. Live Supabase QA remains separate. |
| REVIEW-02 | Review Abhik's stacked PRs #7, #8, #9 | Done | Codex | Latest main | #7 merged `ba1ae4b`, #8 `037cc7b`, #9 `c91f83a`. Reviewed heads pass local tests/build/lint and GitHub CI; final stack has 30 passing checks. See docs/pr-review-log.md. |
| DESIGN-02 | Own and improve the main website design/UI | Ready | AbhikRao | Latest main | Owner delegated design to Abhik. Codex PR #4 retired; branch retained as optional reference. |
| ENG-01 | Backend readiness: safe config, upload limits, broader tests, setup runbook | Done | Garv Rao / Codex | Latest main | [PR #6](https://github.com/garvrao80/iiitdblackmarket/pull/6) merged at `afe45c9`; 23 local tests and GitHub CI pass, build/lint pass with existing warnings. Live work below remains separate. |
| CLOUD-01 | Confirm/select Supabase project; apply unapplied migrations and configure Google OAuth | Ready | Garv Rao / Codex | Owner cloud connection | GitHub has no configured secrets/variables/environments/deployments. A Supabase integration was suggested but connection is unconfirmed. See docs/backend-setup.md. |
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
| QA-01 | Verify separate-account access isolation and core marketplace flows | Backlog | Garv Rao / Codex | CLOUD-01 | Record service-level results in docs/live-qa.md. Local DB/config checks pass; actual OAuth, transfers, realtime and concurrent sessions remain untested. |
| DEPLOY-01 | Configure deployment, verify live flows, and document operations | Backlog | Garv Rao / Codex | QA-01 | Setup/rewrite/preflight prepared. Host and production origin not selected; no deployment performed. |

## Extras implementation and backlog

- `EXTRA-01`: “Looking for” posts. Merged through reviewed PR #8; live backend QA pending.
- `EXTRA-02`: Moving-out bundles. Merged through reviewed PR #8; live backend QA pending.
- `EXTRA-03`: Listing expiry reminders and in-app notifications. Merged through reviewed PR #8; live backend QA pending.
- `EXTRA-04`: Integrated payments; outside the proposed first release.

## Completion and handoff

REVIEW-04 update: independent local Supabase CI passed all 19 service scenarios on `045638a`, including Realtime and bootstrap. Deployment review then added public build-only target safeguards and configuration delimiter checks; recheck the updated head before merging #13. Hosted Google/phone QA remains separate.

Before marking a task Done, link the merged change, record meaningful verification, update the README for changed behavior/setup, and note unfinished work here. For Blocked tasks, name the missing dependency or decision and who can resolve it. For an unfinished handoff, leave the branch, current state, next step, and verification limits in the notes.

## Open decisions

Work split: **Abhik owns design/UI. Garv Rao and Codex own the remaining engineering work.** Live account setup requires owner access; no Supabase connection is confirmed yet. EXTRA-01..03 are now merged but still need live QA; integrated payments remain outside scope.

- First-release scope approval.
- Student eligibility source, approval owner, and handling of graduates.
- Framework, hosting, backend project ownership, and configuration.
- Final rental rules and listing lifecycle.

## Status note (2026-10-31)
Tasks in `Review` are implemented but unverified. PLAN-02 is resolved as roster + admin approval (graduates handled manually). Still needed from the owner: Supabase project, Google OAuth credentials, hosting choice (QA-01, DEPLOY-01).

The owner authorized checking and merging AbhikRao's PRs. A 3-minute review monitor is active (interval updated at owner request). Review the exact current head, resolve material findings, and run applicable checks before merge; leave blocked PRs unmerged. Local regression checks now cover a subset of QA-01, not live-provider verification.

## Launch status (2026-10-31, branch `feat/LAUNCH-01-production`)
- Done: hosted Supabase project (Mumbai) with migrations 0001 to 0006, auth URLs set, Google provider enabled, email/phone/anonymous sign-ups off (by Codex in the owner's browser). Local stack and 19 end-to-end checks.
- Waiting on the owner: approve creating the public build-only repo (`AbhikRao/iiitd-black-market`), then deploy; Codex then publishes the Google app (needs the public privacy and terms pages served at the site address). First admin: run the two-line SQL in docs/launch.md if not already set.
- See [docs/launch.md](docs/launch.md) for the verified / not-verified split and the owner checklist.
