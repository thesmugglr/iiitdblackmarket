# Shared task board

Use this file to coordinate work before opening a branch. Scope is proposed until approved by the project owner; an unassigned task is not an instruction to start implementation.

Statuses: `Backlog`, `Ready`, `In progress`, `Blocked`, `Review`, `Done`.

Claim a task by adding your GitHub handle to Owner and linking your branch or pull request. Coordinate claims in GitHub before starting parallel work; local edits alone do not reserve a task. Split large tasks into smaller IDs as implementation becomes concrete.

| ID | Task | Status | Owner | Depends on | Branch / PR / notes |
| --- | --- | --- | --- | --- | --- |
| DOC-01 | Establish shared README, task board, contribution guide, and agent instructions | Done | Codex | — | Documentation only; 2026-10-31. |
| USER-02 | Confirm saved-item writes and preserve overlapping results | In progress | Garv Rao / Codex | Latest main | Branch `fix/USER-02-saved-state`; update saved state only after successful writes, prevent duplicate per-item requests, preserve independent saves and report/retry read failures. Shared logic for Browse/detail; preserve card/page layouts and database policies. Verification pending. |
| LIST-04 | Gate listing edits on a current owned listing | Done | Garv Rao / Codex | Latest main | [PR #19](https://github.com/garvrao80/iiitdblackmarket/pull/19) merged at `bcfd18d`, exact head `05e2b2f`. Loading/ownership guards, retry, obsolete-response cleanup and route draft/photo isolation; cover reordering pauses during upload/save. 68 regressions/build/lint, both GitHub checks and all 22 service scenarios pass with existing warnings. Browser checks confirm non-owner denial/retry and transition to a fresh create form without console errors. Not deployed. |
| REVIEW-06 | Review admin/redeployment record | Done | Garv Rao / Codex | PR #18 | [PR #18](https://github.com/garvrao80/iiitdblackmarket/pull/18) merged at `f6aa5aa`, exact reviewed head `91ce656`, after diff checking and final-head GitHub verification passed. Public build `1228bc4` declares source `8dc2c60`; live JS bytes match it, CHAT-03 copy is present, public pages/Auth/limited anonymous checks pass. Admin SQL is author-reported and Garv's already-authorized admin request remains unapplied. No deployment or role update by this review. |
| CHAT-03 | End unavailable-chat loading and guard obsolete chat requests | Done | Garv Rao / Codex | Latest main | [PR #17](https://github.com/garvrao80/iiitdblackmarket/pull/17) merged at `f4b94af`, exact head `185beee`. Missing/failed loads end loading; retry, stale response/subscription guards and per-route draft isolation added. 60 regressions/build/lint, both GitHub checks and all 22 service scenarios pass. Demo populated/missing/retry/back checks pass; final browser checks have no console errors. Existing warnings remain; published by Abhik in build `1228bc4` from source `8dc2c60`. |
| CLOUD-02 | Apply owner-requested first-admin access | In progress | AbhikRao (project access); Garv / Codex verification | Existing project SQL Editor | Garv clarifies Google authentication reaches Awaiting approval and requests admin access for his own account. Guarded private SQL handoff prepared and locally checked; Abhik must apply it in project `mkepigiktixxrowsteje`. Dashboard in this chat is signed out and no admin connector is connected. Update 2026-10-31: Abhik reports applying and read-only verifying his own first-admin access (bootstrap row present; profile admin/approved); this reviewer has not inspected the hosted rows. Garv already authorized admin access for his own account in this chat. That specific request has NOT been applied and still requires Abhik's trusted SQL access; ordinary member approval in Admin does not grant the admin role. Verify the live Admin page afterward. Keep the account email out of source/docs. |
| AUTH-02 | Prevent stale profile results after sign-out/account changes | Done | Garv Rao / Codex | Latest main | [PR #16](https://github.com/garvrao80/iiitdblackmarket/pull/16) merged at `2258e4e`, exact reviewed head `184557f`. Late responses discarded, prior-account state cleared immediately, same-account refreshes preserve the page, and errors permit retry. 51 regressions/build/lint, both GitHub checks and all 22 disposable service scenarios pass; demo opens without console errors. Existing warnings remain; published by Abhik in build `1228bc4` from source `8dc2c60`. |
| REVIEW-05 | Review existing public deployment record | Done | Garv Rao / Codex | PR #15 | [#15](https://github.com/garvrao80/iiitdblackmarket/pull/15) merged at `097fdcd`, exact reviewed head `af2c599`. Live pages/assets, 390px login/deep link, public Auth settings/Google redirect and limited anonymous API responses verified. Real Google login, approved-user/phone flows and dashboard access remain pending. No deployment performed by this review. |
| QA-02 | Expand local service checks for concurrent offers and upload rejection | Done | Garv Rao / Codex | Latest main | [PR #14](https://github.com/garvrao80/iiitdblackmarket/pull/14) merged at `38b102e`, exact reviewed head `336a91f`. All 22 disposable-local service scenarios, 41 regressions/build/lint and both GitHub checks pass. Hosted account access remains separate. |
| REVIEW-04 | Review launch PR #13 and reconcile #10/#12 overlap | Done | Garv Rao / Codex | PR #13 | [#13](https://github.com/garvrao80/iiitdblackmarket/pull/13) merged at `c51f541`, reviewed head `f5011b7`: 41 local tests/build/lint, Windows dry-run, GitHub verification and 19/19 Supabase service checks pass. #10 closed unmerged; #12 superseded, branch retained. Hosted Google/phone QA and public deployment remain separate. |
| DESIGN-04 | Isolated amber marketplace concept | Review | Codex | Owner's visual brief | [PR #11](https://github.com/garvrao80/iiitdblackmarket/pull/11) remains separate from Abhik's canonical UI. Review components together before coordinated integration. |
| REVIEW-01 | Review/fix AbhikRao PR #3 before merge | Done | Codex | PR #3 | [Fix PR #5](https://github.com/garvrao80/iiitdblackmarket/pull/5) merged into [PR #3](https://github.com/garvrao80/iiitdblackmarket/pull/3); #3 approved and merged to main at `491d233`. Eight local DB checks and GitHub CI pass. Live Supabase QA remains separate. |
| REVIEW-02 | Review Abhik's stacked PRs #7, #8, #9 | Done | Codex | Latest main | #7 merged `ba1ae4b`, #8 `037cc7b`, #9 `c91f83a`. Reviewed heads pass local tests/build/lint and GitHub CI; final stack has 30 passing checks. See docs/pr-review-log.md. |
| DESIGN-02 | Own and improve the main website design/UI | Ready | AbhikRao | Latest main | Owner delegated design to Abhik. Codex PR #4 retired; branch retained as optional reference. |
| ENG-01 | Backend readiness: safe config, upload limits, broader tests, setup runbook | Done | Garv Rao / Codex | Latest main | [PR #6](https://github.com/garvrao80/iiitdblackmarket/pull/6) merged at `afe45c9`; 23 local tests and GitHub CI pass, build/lint pass with existing warnings. Live work below remains separate. |
| CLOUD-01 | Confirm existing project access and hosted provider setup | In progress | Garv Rao / Codex | Existing project access | Garv selected Abhik's existing project `mkepigiktixxrowsteje` on 2026-10-31. Reuse the reported Supabase/Google setup under AbhikRao's Org. Verify dashboard/connector access, applied migrations and provider settings; Garv reports institute Google authentication reaches Awaiting approval; other hosted QA and dashboard inspection remain pending. |
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
| QA-01 | Verify separate-account access isolation and core marketplace flows | Review | Garv Rao / Codex | CLOUD-01 | 68 local regressions and 22 local Supabase service scenarios pass. Hosted anonymous/API configuration and mobile sign-in screen checked; institute Google authentication reaches Awaiting approval by user report; CLOUD-02 must complete before owner marketplace QA; listing/photo/chat, approved-user isolation and full phone flows remain pending in docs/live-qa.md. |
| DEPLOY-01 | Configure deployment, verify live flows, and document operations | Review | Abhik / Claude (Garv / Codex review) | QA-01 | Deployed 2026-10-31 to https://abhikrao.github.io/iiitd-black-market/ from the public build-only repo `AbhikRao/iiitd-black-market` (source `a235788`); URLs, deep link, bundle contents and Google hand-off checked (docs/launch.md). Abhik reports his setup session published the Google OAuth app to production (Google Auth Platform shows In production; Branding URLs match the live pages). Garv reports institute Google authentication reaches Awaiting approval; first admin verification, other authenticated flows and phone QA remain pending. |

## Extras implementation and backlog

- `EXTRA-01`: “Looking for” posts. Merged through reviewed PR #8; live backend QA pending.
- `EXTRA-02`: Moving-out bundles. Merged through reviewed PR #8; live backend QA pending.
- `EXTRA-03`: Listing expiry reminders and in-app notifications. Merged through reviewed PR #8; live backend QA pending.
- `EXTRA-04`: Integrated payments; outside the proposed first release.

## Completion and handoff

REVIEW-04 is complete: #13 merged after all 19 service scenarios passed on final reviewed head `f5011b7`, alongside 41 regressions/build/lint. Public deployment and hosted Google/phone QA remain separate.

Before marking a task Done, link the merged change, record meaningful verification, update the README for changed behavior/setup, and note unfinished work here. For Blocked tasks, name the missing dependency or decision and who can resolve it. For an unfinished handoff, leave the branch, current state, next step, and verification limits in the notes.

## Open decisions

Work split: **Abhik owns design/UI. Garv Rao and Codex own the remaining engineering work.** Garv chose Abhik's existing hosted project; access and hosted QA remain pending verification. EXTRA-01..03 are merged and locally service-tested; hosted QA remains pending. Integrated payments remain outside scope.

- First-release scope approval.
- Student eligibility source, approval owner, and handling of graduates.
- Framework, hosting, backend project ownership, and configuration.
- Final rental rules and listing lifecycle.

## Status note (2026-10-31)
Tasks in `Review` need the verification or decision named in their notes. PLAN-02 uses roster + admin approval (graduates handled manually). Garv chose Abhik's existing Supabase/Google setup, reported in docs/launch.md. Next verify access and provider settings, then complete hosted QA and hosting decisions (CLOUD-01, QA-01, DEPLOY-01).

The owner authorized checking and merging AbhikRao's PRs. A 3-minute review monitor is active (interval updated at owner request). Review the exact current head, resolve material findings, and run applicable checks before merge; leave blocked PRs unmerged. Local regression checks now cover a subset of QA-01, not live-provider verification.

## Launch status (2026-10-31, branch `feat/LAUNCH-01-production`)
- Done: hosted Supabase project (Mumbai) with migrations 0001 to 0006, auth URLs set, Google provider enabled, email/phone/anonymous sign-ups off (by Codex in the owner's browser). Local stack and 19 end-to-end checks.
- Waiting on the owner: approve creating the public build-only repo (`AbhikRao/iiitd-black-market`), then deploy; Codex then publishes the Google app (needs the public privacy and terms pages served at the site address). First admin: run the two-line SQL in docs/launch.md if not already set.
- See [docs/launch.md](docs/launch.md) for the verified / not-verified split and the owner checklist.
