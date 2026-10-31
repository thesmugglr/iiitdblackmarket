# Student-code approval review — 2026-10-31

Scope: migration `0007_student_codes.sql`, loader `app/scripts/student-codes.mjs`, related tests/service scenario and integration with existing bootstrap/roster approval. Reviewed the source introduced at `8870e96`, integrated through `549e73d`. Hosted administration remains unavailable to this reviewer; the reported production application is not independently verified here.

## Source and local evidence

- Matching requires the complete institute address shape and exactly five trailing digits. Only listed codes qualify; domain-only, unlisted, numeric-only and look-alike addresses remain pending in regression fixtures.
- Eligibility uses server-managed provider metadata or confirmed email. Client-editable verification/role fields cannot approve a user. The rule supports both insert-time provider verification and GoTrue's later email-confirmation update.
- The bulk helper only approves pending students; it does not restore suspended accounts or change admin roles. Code matching grants student approval, never admin access.
- Code rows use RLS with no API policies, and table access plus helper execution are revoked from anonymous/authenticated API roles. Regression tests cover reads, writes and helper calls under those roles.
- Loader fixtures verify batch selection, deduplication, exclusion of stray numbers, codes-only SQL and rejection of nonnumeric codes. The live loader dry run found 2,376 codes for 2023–2026 (570/597/607/602) and wrote no file. No names, addresses or source HTML were saved by this review.
- All 114 local regressions, build/typecheck and lint pass, with the existing eight lint warnings and large-chunk warning. Both GitHub checks and all 25 disposable Supabase service scenarios pass on reviewed head `403ccce`, including account/code cleanup verification (run 41197071008); PR #21 merged at `19cfe34`.

## Fixture cleanup correction (QA-03)

The new service scenario originally omitted both generated accounts and its inserted code from cleanup tracking. It now records each successful creation immediately, deletes only tracked IDs/code rows, checks account removal through the Auth admin API, and checks code removal through the database API. Earlier assertion failures still reach the cleanup scenario. The local endpoint guard remains in place; this does not connect to the hosted project or reset shared data.

## Remaining verification and policy limits

The selected policy assumes institute-issued address suffixes correspond to published roll-number codes. A suffix match is not an independent identity-to-roster-name comparison, and this review does not establish that naming invariant for every account. B.Tech coverage does not include every institute student. Unlisted users need manual review; refreshing codes is additive, old codes need explicit trimming, and already-approved graduates require manual suspension. Preserve those limits in launch decisions.

Still needed: an authorized new listed student's actual Google sign-in, an unlisted institute account's pending path, outside-domain rejection, admin UI checks and separate-account hosted access isolation. Garv's requested admin promotion is separate from automatic student approval and remains unapplied in this chat. No migration, code list, production account or provider setting was changed by this review.
