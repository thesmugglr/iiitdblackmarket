# Live backend verification record

Owner: Garv Rao / Codex. Current status: **Garv selected Abhik's existing project `mkepigiktixxrowsteje`. Public hosted checks pass as recorded below; Garv reports successful institute Google sign-in; other authenticated workflows and dashboard access remain pending.**

## User-reported Google login — 2026-10-31

Garv answered “Marketplace opens” after the prompt to sign in on the live site using his institute Google account. Record this as one successful user-reported login, not an independently observed browser session or proof of other accounts’ access rules. The signed-in session is not available in this chat’s browser. Hosted listing/photo/chat, pending/admin/outsider and full phone tests remain outstanding.

## Independent public deployment checks — 2026-10-31

Reviewed Abhik's deployment record in PR #15 and verified the existing public site at https://abhikrao.github.io/iiitd-black-market/ (published source `a235788`, public build commit `7b1daca`). Home, JS, privacy, terms and favicon return HTTP 200. A nonexistent listing deep link returns the expected Pages HTTP 404 with the app shell; the live browser renders the signed-out login screen correctly. At 390px it has no page overflow, Google sign-in is enabled and no development password form is present.

Using only the browser-public key from that deployed bundle, Auth settings report Google enabled and email/phone disabled; `ping` returns 200, anonymous listing reads return zero rows, and email-column/bootstrap reads return 401. Zero listing rows alone do not prove row-level isolation against populated data. The authorize endpoint returns 302 to accounts.google.com with the expected Supabase callback; this is not a completed Google login. No private key or token was printed/stored, no production data was mutated, and this review did not deploy or change access settings.

Still required: outside-account and pending/admin approval checks, approved-account listing/chat/privacy/concurrency tests, and full phone workflows. Supabase dashboard authentication remains pending in this chat. Other launch claims retain their author attribution in docs/launch.md.

2026-10-31 access attempt: dashboard returned the Supabase sign-in page. Waiting for an authenticated account that can access the selected project; no provider settings, migrations or production data were changed.

Hosted setup is now reported in docs/launch.md from Abhik's environment. The hosted checks below remain Not run by this reviewer. Merged PR #13 independently passes 19/19 local Supabase service scenarios in CI (Auth, Storage, RLS, Realtime, bootstrap and extras), alongside 41 local regression checks. These do not establish a successful hosted Google sign-in or phone QA.

Record sanitized results only. Use account labels (Admin, Student A, Student B, Pending, Outsider); never paste tokens, actual emails, private chat contents, or real rosters.

PR #14 merged at `38b102e` after all 22 local service scenarios passed in [GitHub CI](https://github.com/garvrao80/iiitdblackmarket/actions/runs/41186293555), exact head `336a91f`. Simultaneous seller sessions accepted exactly one offer and reserved the matching price; both buckets rejected disallowed types and files over 5 MiB without storing objects; cleanup removed only generated fixtures. All 41 local regressions/build/lint and GitHub verification also pass. No hosted QA result changes until those checks run against the selected hosted project with authorized accounts.

| Check | Expected | Result / evidence |
| --- | --- | --- |
| OAuth and institute eligibility | Outside accounts denied; unrostered institute account pending | Partial: Garv reports institute Google sign-in opens the marketplace (2026-10-31). Outside-domain and unrostered-account outcomes remain untested. |
| Approval/admin permissions | Admin can approve; student cannot self-approve/read admin directory | Not run |
| Listings and owner permissions | Create/edit own; other users cannot mutate | Not run |
| Storage service | Private buckets, namespace rules, type/5 MiB limits | Not run |
| Messages and realtime | Two sessions exchange messages/read receipts | Not run |
| Attachment/privacy isolation | Nonparticipants cannot read data or sign attachment URLs | Not run |
| Block/suspension | Deny new writes; suspension denies private access | Not run |
| Offers/concurrency | Correct reservation/declines; simultaneous accepts consistent | Not run |
| Admin removal/reports | Removed listing stays removed; reports reviewed | Not run |
| Hosted routing/mobile | Direct deep links refresh; phone workflows usable | Not run |
| Wanted posts and bundles | Responses notify only intended users; bundles accept only owned active items | Not run |
| Expiry/notification service behavior | Expired items reject new chats/offers; renew restores availability; notifications stay private | Not run |

Before signing off, record the project label, app origin, tested commit, applied migration filenames, test date, and any remaining issues. Follow [backend-setup.md](backend-setup.md) for steps. Local tests passing does not change this record to Passed.
