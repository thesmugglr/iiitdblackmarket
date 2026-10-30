# Live backend verification record

Owner: Garv Rao / Codex. Current status: **Not run — live Supabase/Google configuration is not connected.**

Record sanitized results only. Use account labels (Admin, Student A, Student B, Pending, Outsider); never paste tokens, actual emails, private chat contents, or real rosters.

| Check | Expected | Result / evidence |
| --- | --- | --- |
| OAuth and institute eligibility | Outside accounts denied; unrostered institute account pending | Not run |
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

## Local service coverage (PR #10)

Abhik reported 18 successful local-stack checks on his original head. The review adds credential/endpoint safeguards, real Storage rejection checks, fixture cleanup and GitHub service integration with migrations 0001–0005. The current runner has 20 checks; independent service results are pending CI. This Windows review machine has no Docker executable. Keep the hosted results above as Not run until actual Google/hosted QA occurs.
