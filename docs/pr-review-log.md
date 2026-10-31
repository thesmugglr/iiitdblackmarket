# PR review record

Owner authorized reviewing and merging AbhikRao PRs after checks. Abhik retains UI/design ownership. This log records the 31 October 2026 review batch; it is not live-backend sign-off.

| PR | Exact approved head | Merge commit | Verification |
| --- | --- | --- | --- |
| [#7: night-market UI](https://github.com/garvrao80/iiitdblackmarket/pull/7) | `8d1a9f133b8267585c913cf261b2b8cd5bec08ff` | `ba1ae4b` | 23 local checks, build/typecheck, lint (warnings only), GitHub CI. |
| [#8: wanted/bundles/expiry/notifications](https://github.com/garvrao80/iiitdblackmarket/pull/8) | `1a0f17cab3dfcacc5af2231102b6020f749595ff` | `037cc7b` | 30 local checks, build/typecheck, lint (warnings only), GitHub CI. |
| [#9: editorial UI](https://github.com/garvrao80/iiitdblackmarket/pull/9) | `1eebcf04410e367d35ec4a7e63271fabb4c94de2` | `c91f83a` | 30 local checks, build/typecheck, lint (warnings only), GitHub CI; functional browser checks in labelled demo mode. |

## Integration and corrections

- Resolved README conflicts while retaining both contributors' work and the current backend readiness/ownership instructions. Retargeted dependent PRs to main in order.
- Removed duplicate requestAnimationFrame startup from the night scene; the later editorial redesign removes the scene entirely, as intended by Abhik.
- Renumbered the new extras migration to `0004_extras.sql` to avoid collision with existing `0003_upload_limits.sql`. Added `0005_expiry_access.sql`; both database suites load all migrations in order.
- Prevented privileged chat/offer/acceptance RPCs from bypassing listing expiry. Added regressions proving expiry denies new transactions and renewal restores the supported path.
- Prevented suspended responders from reading wanted responses; added regression coverage.
- Fixed drawer focus being reset on every filter-state render. The drawer now contains Tab navigation, restores focus on Escape/close, locks page scrolling while open, and respects reduced motion for its slide.
- Corrected privacy copy: existing policies permit authorized moderators to access conversations; the interface must not promise access exclusively to two participants.

## Verification limits and follow-up

The final local suite reports 30 passing checks. Tests use local PostgreSQL/PGlite platform fixtures. They do not validate live Google OAuth, actual Storage HTTP transfers/type rejection, Supabase realtime delivery, or concurrent database connections. Those remain in [live-qa.md](live-qa.md).

The browser session used explicitly labelled fictional demo data. Confirmed typing `1500` into the filter keeps input focus/value through rerenders, Tab wraps from Reset to Close, and Escape closes the drawer and returns focus to Filters. Demo data does not implement true server-side search/filter mutation, so no live query success is claimed. Public/real account testing still needs configured Supabase access.

Builds pass with the existing large-chunk warning; the new animation dependency increases the bundle. A future performance pass can split routes/animations. Lint reports warnings without errors, including existing effect/fast-refresh warnings and extras-page warnings. These are recorded, not presented as a clean lint output.
# PR #13 review in progress — 2026-10-31

Abhik closed PR #10 without merging it and opened #13, which includes newer launch/photo work. The review of #10 at `0eb8b51` passed 31 local tests/build/lint and 19 of 20 service checks in CI; Realtime timed out, so it was not approved or merged here. #13's original head `bbe4e4d` passes 37 local tests/build/lint (warnings only). Its reported hosted setup and browser results belong to Abhik's environment and are not independently verified in this chat.

Material findings addressed during this review: the local password form lacked loopback checks; the CLI test helper could expose credential-bearing output on failure and did not reject hosted endpoints; photo decoding failures silently uploaded original bytes despite the privacy notice promising camera/location removal. Preserve Abhik's photo interface while fixing those boundaries. Re-run local checks and independent service CI on the updated head; leave #13 unmerged until the full review is complete. PR #12 overlap still requires reconciliation. No deployment or cloud changes are authorized by this review.

Review fixes: all 39 local tests pass; build and lint pass with warnings. Independent Supabase service CI is pending on the updated head.
