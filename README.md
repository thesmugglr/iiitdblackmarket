# IIITD Black Market

A campus marketplace for IIIT-Delhi students to buy, sell, rent, and give away new or secondhand items, with photo listings and conversations inside the website.

## Current status

AUTH-02 ([PR #16](https://github.com/garvrao80/iiitdblackmarket/pull/16)) merged at `2258e4e` after review of exact head `184557f`. It prevents delayed profile/session lookups from restoring a previous account after sign-out or an account change. Account changes clear the old profile immediately; same-account token refreshes preserve the active page while membership reloads. Failed profile loads end loading and allow retry. All 51 local regressions (including 10 new auth lifecycle scenarios), build/typecheck, lint and both GitHub checks pass; existing lint/chunk-size warnings remain. Disposable Supabase CI passed all 22 service scenarios. The local demo opens the approved marketplace without console errors. This fix has not been deployed. Abhik's design and backend access policies are unchanged.

[PR #14](https://github.com/garvrao80/iiitdblackmarket/pull/14) merged at `38b102e` after all 22 disposable Supabase service scenarios passed on exact head `336a91f`. Coverage includes simultaneous offer acceptance from independent seller sessions, actual size/type rejection in both private buckets, and run-scoped fixture cleanup. All 41 local regressions/build/lint and both GitHub checks pass with existing warnings. This does not connect to the selected hosted project or alter Abhik's UI.

Launch review also adds a build-only repository marker/public-visibility check before deployment replaces any target contents, plus validation that rejects delimiter-bearing legacy keys and control characters in project URLs. Public deployment remains an owner decision and has not been performed by this review.

Abhik's PR #15 reports public deployment after approval in his workflow. This review independently confirmed the existing live pages, mobile sign-in screen, public Auth settings and Google redirect without deploying anything. Garv subsequently reported that institute sign-in opens the marketplace; the other authenticated flows remain pending in docs/live-qa.md.

[PR #15](https://github.com/garvrao80/iiitdblackmarket/pull/15) is merged at `097fdcd` after current GitHub checks and review of exact head `af2c599`. Garv reports successful institute Google sign-in on [the live site](https://abhikrao.github.io/iiitd-black-market/); authenticated listing/photo/chat and cross-account QA are next. Supabase dashboard access is needed for configuration changes/administration, rather than for this ordinary end-user login test.

[PR #13](https://github.com/garvrao80/iiitdblackmarket/pull/13) was reviewed and merged at `c51f541` after checks on exact head `f5011b7`. All 41 local tests, build/lint, Windows deployment dry-run, and both GitHub checks pass; disposable Supabase CI passes all 19 service scenarios including Realtime and admin bootstrap. Review fixes protect photo metadata, loopback-only password login, credential output, and build-repository replacement. Hosted Google sign-in, phone QA and owner-approved public deployment remain separate. PR #10 is closed unmerged; PR #12's simpler upload implementation is superseded by Abhik's newer UI in #13.

**First release and launch-readiness work are merged into `main` (PRs #3 to #9 and #13). Garv selected Abhik's existing Supabase project on 2026-10-31: `iiitd-black-market`, ref `mkepigiktixxrowsteje`, under AbhikRao's organization. Reuse its reported Google provider setup; see [docs/launch.md](docs/launch.md). Dashboard/connector access and hosted Google QA still need verification in this chat. The site was deployed on 2026-10-31 (source `a235788`) to https://abhikrao.github.io/iiitd-black-market/ from the public build-only repository `AbhikRao/iiitd-black-market`, with approval reported by Abhik in his setup workflow. He also reports Google OAuth publication to production; Garv now reports that institute Google sign-in opens the marketplace. First-admin verification, other authenticated flows and full phone QA remain pending.**

The first-release scope below is implemented. All 51 local regression checks (`npm test`) and 22 service scenarios against disposable local Supabase (`npm run e2e:local`) pass on the reviewed AUTH-02 source. Garv reports one successful institute Google login. Hosted access isolation, listing/photo/chat and full phone QA remain pending (QA-01).

This README is the shared project record for the owner, their collaborator, and Codex. Update it with every meaningful project change so everyone can see what exists, what changed, and what remains.

Shared development files: [TODO.md](TODO.md) tracks tasks and ownership, [CONTRIBUTING.md](CONTRIBUTING.md) explains the Git and review workflow, and [AGENTS.md](AGENTS.md) provides repository instructions for coding agents.

## Requested requirements

- Restrict access to students using their IIITD accounts.
- Let students create listings for new and secondhand items with uploaded photos.
- Organize items into categories.
- Keep buyer/seller conversations inside the website with built-in chat.
- Support buying, selling, and renting, as described in the original repository brief.

## Proposed first release

The features below are implemented and locally tested. Garv reports one successful hosted Google login; the remaining authenticated live flows are unverified. Local database tests cover selected access rules, not all end-to-end behavior.

| Area | Planned behavior |
| --- | --- |
| Access | Institute account sign-in, server-side identity checks, and student verification; marketplace content available to approved members. |
| Listings | Multiple photos, title, description, price in INR, category, condition, negotiable price, and preferred campus pickup area. Owners can edit, delete, reserve, and mark items sold. |
| Listing types | Sale, rental, and giveaway; rental listings include duration and deposit details. |
| Discovery | Keyword search, category/price/condition/type filters, and sorting by newest or price. |
| Categories | Electronics, books and course materials, hostel essentials, furniture, cycles, clothing, sports and gaming, and miscellaneous. |
| Chat and offers | Persistent private conversations linked to listings, real-time messages, photo attachments, unread counts, and offers that sellers can accept or decline. |
| Dashboard | My listings, saved items, conversations, offers, and completed deals. |
| Profiles | Display name, optional batch, and verification status; phone numbers and room numbers need not be public. |
| Moderation | Report listings/messages, block users, and admin tools to review reports, remove listings, and suspend accounts. |

Suggested additions, subject to scope approval:

- “Looking for” posts for students seeking specific items.
- Moving-out bundles for multiple hostel essentials.
- Listing expiry reminders and in-app notifications.

## Proposed experience

**Sign in → browse or list an item → chat → agree on a campus meetup → mark the deal complete.**

Mobile-friendly interface with large item photos, readable prices, and prominent selling and messaging actions. Proposed visual direction: warm white backgrounds, charcoal text, and an orange accent. Proposed phone navigation: Browse, Saved, Sell, Inbox, and Profile.

Payments for the first release would be arranged directly between students at handover. Integrated checkout is outside the proposed initial scope.

## Identity and student verification

An `@iiitd.ac.in` address establishes an institute account, but does **not** by itself establish that the account belongs to a current student: faculty and staff also use that domain. See [IIITD IT guidance](https://it.iiitd.edu.in/static/HowCan%20I.pdf).

Proposed approach:

- Use institute Google sign-in if supported by IIITD's account configuration.
- Validate identity tokens and the accepted hosted domain on the server, following [Google's OpenID Connect guidance](https://developers.google.com/identity/openid-connect/openid-connect).
- Use an approved student roster or admin approval for student eligibility until an official verification integration is available.
- Enforce membership and ownership rules in backend/database access policies, including listings, photos, and private conversations.

The student eligibility source and approval process still need to be decided. Do not label a user as a verified student based only on the email domain.

## Proposed technical foundation

The application in `app/` uses these dependencies:

- React, TypeScript, Vite, and React Router for the application interface.
- Supabase for database, authentication, image storage, and real-time messaging.
- Access policies restricting conversation data to authorized participants and listing changes to authorized owners/admins.

References: [Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [real-time authorization](https://supabase.com/docs/guides/realtime/authorization), and [storage access control](https://supabase.com/docs/guides/storage/security/access-control).

Hosting remains to be finalized. The canonical runnable app on main is `app/`, using Supabase for backend services. PR #1's alternative scaffold is superseded. The owner has assigned design/UI to Abhik; Codex design PR #4 is retired.

## Local setup and deployment

Layout: `app/` is the React + TypeScript (Vite) client; `supabase/migrations/0001_init.sql` is the full schema, row-level security, RPCs, storage buckets and realtime setup.

Follow [docs/backend-setup.md](docs/backend-setup.md) for the detailed backend/OAuth/configuration runbook and [docs/live-qa.md](docs/live-qa.md) for actual live test results. Browser-public probes confirm the selected backend configuration; Garv reports successful Google login. The backend-readiness work is tracked in [PR #6](https://github.com/garvrao80/iiitdblackmarket/pull/6).

1. Create/select a Supabase project. Apply all unapplied files in `supabase/migrations/` in filename order: `0001_init.sql`, `0002_review_access.sql`, `0003_upload_limits.sql`, `0004_extras.sql`, `0005_expiry_access.sql`, `0006_launch.sql`. Do not rerun applied migrations.
2. Enable Google auth (Authentication → Providers) with OAuth credentials from Google Cloud; add your site URL and `http://localhost:5173` to the redirect URLs.
3. Copy `app/.env.example` to `app/.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Legacy `VITE_SUPABASE_ANON_KEY` remains supported.
4. From `app/`, run `npm ci`, `npm run check:config -- development`, then `npm run dev` (checks: `npm test`, `npm run build`, `npm run lint`).
5. Sign in once with the admin's @iiitd.ac.in account, then run in SQL: `update public.profiles set role='admin', status='approved' where email='you@iiitd.ac.in';`
6. As admin, open **Admin** and paste current-student emails into the roster. Rostered users are approved on sign-up; others stay pending until approved.

UI preview without a backend: put `VITE_DEMO=1` in `app/.env.local` and run `npm run dev`. This uses in-memory sample data (dev server only, ignored by production builds) and does not test any real access rules.

Production hosting: `npm run build` outputs static files in `app/dist` (with `404.html` for deep links). The chosen host is GitHub Pages from a public **build-only** repository, deployed with `npm run deploy:pages -- <owner/repo>` (details in [docs/launch.md](docs/launch.md)); any static host works if it rewrites unknown paths to `index.html`. Set `VITE_BASE` when serving from a sub-path. Never commit `.env` or real rosters/chats.

### Run the whole stack locally (real backend)
Needs Docker. From the repo root:
1. `npx supabase start -x studio,mailpit,edge-runtime,vector,logflare,imgproxy,postgres-meta,supavisor` (the first run downloads images and applies all migrations).
2. `npx supabase status -o env` prints the API URL and keys. Put the URL and the publishable (or anon) key in `app/.env.local`, plus `VITE_DEV_LOGIN=1` to show the local-only email/password form (Google sign-in needs real OAuth credentials).
3. `cd app && npm run dev`. Create users through the form, then approve and promote the first admin in SQL.
4. `cd app && npm run e2e:local` runs 22 end-to-end checks against that stack with separate accounts. `npx supabase stop` shuts it down.

### What is implemented
- Sign-in with Google (domain hint in the client; `@iiitd.ac.in` enforced by a database trigger on sign-up). Marketplace access requires `approved` status (roster or admin approval).
- Listings (sale/rent/giveaway, up to 6 photos in a private bucket served by signed URLs), edit/delete/reserve/sold, search, filters, sorting, saved items.
- Chat started via RPC; messages, photo attachments, read receipts and unread counts, realtime updates; offers made by buyers and accepted/declined by sellers (acceptance reserves the listing).
- Profile with own listings and completed deals; reports on listings/messages, user blocking, admin console (roster, user approve/suspend, report queue, listing removal).

### Interface
Editorial, soft-minimal design (warm off-white `#FAF7F2`, ink `#1A1A1A`, coral `#FF5C35`, sand `#E8E1D5`; Fraunces headlines, DM Sans body). The home page has a hero with search and a floating collage of the newest listings, a scrollable category row with live counts, a bento listing grid with save hearts and skeleton loaders, a slide-out filters drawer, How it works, Trust and safety, a call-to-action block and a footer. Framer Motion drives the floating cards, scroll fade-ups and the drawer; everything respects `prefers-reduced-motion`. The sticky navbar and mobile tab bar use backdrop blur. Styling is plain CSS in `app/src/index.css` (no Tailwind).

### Extras (EXTRA-01..03)
Migration `supabase/migrations/0004_extras.sql` (apply after 0001–0003), followed by `0005_expiry_access.sql`, adds:
- **Looking for** (`/wanted`): students post requests with an optional budget; others reply by attaching one of their own active listings via `respond_wanted`, which notifies the poster. Owners can mark a request found or closed.
- **Moving-out bundles** (`/bundles`): sellers group 2 to 10 of their own active listings at one price via `create_bundle`; buyers chat through the first available item; `mark_bundle_sold` marks the bundle and its items sold.
- **Expiry and notifications** (`/notifications`, bell in the header): listings expire after 30 days and are hidden from others (owners still see them); owners get one reminder in the last 3 days and can renew for 30 days. New messages, wanted replies and expiry reminders create in-app notifications (one unread per destination). Reminders are generated when the owner opens the app or notifications page, so no scheduled job is needed.

Verified by local PostgreSQL checks in `app/test/extras.test.mjs` (permissions, ownership, one-reminder, expiry visibility) and a browser check with demo data. Not verified on live Supabase, and notifications only appear while the app is open (no email or push).

### Known limits
- One hosted Google login is user-reported; other hosted flows and RLS policies still need the separate-account tests in QA-01.
- No integrated payments, email or push notifications.
- Search is simple substring matching; no pagination beyond the first 60 results.
- Blocking stops new messages and new chats; admin listing removal uses the status field.
- Graduates: no automatic handling; admins suspend accounts manually.

### Review checks

`cd app` then `npm test` runs 51 local regression checks covering auth lifecycle races, database permissions, bootstrap, config/secret handling, photo privacy and deployment safeguards. `npm run e2e:local` runs 22 scenarios against disposable Supabase services, including real Storage validation, Realtime and concurrent offer acceptance. Current local results and GitHub verification are recorded above. These do not replace hosted Google identity, live approved-account isolation or full phone QA. Public profile joins exclude email; private fields use authorized RPCs. The PGlite fixture supplies approximate platform schemas/grants, while the separate service suite exercises actual local services.

Before production, enable Google sign-in and disable unused account providers, verify institute identity and current-student eligibility, and run the live access checks. Client domain hints are not an authorization boundary.

Expected configuration needs include a backend project, Google OAuth credentials and callback URLs, the accepted institute domain, a student eligibility mechanism, and deployment configuration. Never commit secrets, private student rosters, or real chat data. Document configuration key names and use placeholders in examples.

## Working together

The separate [amber concept PR #11](https://github.com/garvrao80/iiitdblackmarket/pull/11) remains open for design review, with its own dependencies/styles and sample data. It does not replace Abhik's canonical `app/`. Its owner-private preview is linked in that PR. Coordinate any future adoption rather than merging competing Sell/layout implementations.

**Ownership:** AbhikRao owns the main website design/UI. Garv Rao and Codex own backend, authentication, database/access policies, tests, CI, and deployment preparation. Codex's old design PR #4 is closed; its branch is reference material only. The standing review monitor follows this split.

- Fetch the latest remote changes before starting work and again before pushing.
- Use focused feature branches and pull requests for application changes so parallel work can be reviewed together.
- Coordinate ownership of overlapping features/files before editing them.
- Preserve the other contributor's changes; resolve conflicts explicitly and avoid force-pushing shared history.
- Update this README in the same commit or pull request as each meaningful change: behavior, setup/configuration, verification results, remaining work, and relevant decisions.
- Keep proposed, implemented, tested, and deployed states distinct. Record actual checks and any verification limits; do not mark untested features complete.
- Keep the progress log concise. Git commits and pull requests contain the detailed history; link them when useful.
- The owner has authorized review and merge of `AbhikRao` PRs after checks. Review the exact current head and merge only when checks pass and no material findings remain. A 3-minute Codex review monitor is active; it should stay quiet when nothing actionable changes. See AGENTS.md for the standing instructions.

## Next steps

See [TODO.md](TODO.md). Remaining: confirm access to the selected existing Supabase project, test the remaining approved-user and access-isolation flows, and complete phone QA on the live site.

## Progress log

| Date (Asia/Kolkata) | Work completed | Verification / remaining work |
| --- | --- | --- |
| 2026-10-31 | Reviewed the repository and documented the requested marketplace, proposed release scope, identity considerations, and collaboration workflow. Owner requested ongoing GitHub README updates for shared development. | Confirmed the repository initially contained only a README. Documentation-only change; no application tests apply. Scope approval and implementation remain pending. |
| 2026-10-31 | Added TODO.md for task ownership/dependencies, CONTRIBUTING.md for branches and review, and AGENTS.md for shared coding-agent instructions. | Documentation baseline; application implementation remains pending. |
| 2026-10-31 | Built the first release: Vite/React/TypeScript client in `app/`, Supabase schema/RLS/RPC/storage migration, and all planned screens (auth gate, listings, search, chat, offers, dashboard, moderation, admin). | `npm run build` and `tsc` pass; lint has warnings only. Not run against a live Supabase project; QA and deployment pending. |
| 2026-10-31 | Reviewed AbhikRao's PR #3. Added corrective migration 0002 for admin bootstrap, email privacy, membership/block checks, removed-listing protection, and serialized offer decisions; added eight local database checks and CI. Recorded standing review/merge authorization and 15-minute monitor. | Local database tests pass. Live Supabase QA and deployment remain pending; fixes must be included before merge. |
| 2026-10-31 | Redesigned the UI (classifieds-style editorial look, serif/grotesk type, category tabs, sold/reserved stamps, SVG icons, mobile tab bar, light/dark) and added a dev-only demo mode. | Checked visually in a browser at desktop and phone widths with demo data; build re-run below. Still no live-backend testing. |
| 2026-10-31 | Preserved Abhik's newer UI/demo commit during review. Updated the dev-only demo for private-profile RPCs, added a visible fictional-data notice, and load demo code only in development so it is removed from the production bundle. | Demo is restricted to Vite development mode; production remains behind real authentication/approval. The owner's dark-tech design is tracked separately in PR #4. |
| 2026-10-31 | Approved and merged [AbhikRao PR #3](https://github.com/garvrao80/iiitdblackmarket/pull/3) into main after [fix PR #5](https://github.com/garvrao80/iiitdblackmarket/pull/5) and review of the exact current head. Merge commit: `491d233`. | Eight local DB checks pass; build/type checking and lint pass with existing warnings; both GitHub checks pass on the reviewed head. Live-provider QA and deployment remain pending. Standing review monitor checks AbhikRao PRs every 15 minutes. |
| 2026-10-31 | Added the interactive 2D night-market home scene and night theme (drag, parallax, stalls as category filters). | Checked in a browser at desktop and phone widths with demo data; `tsc`, build and tests run below. No live-backend testing. |
| 2026-10-31 | Added EXTRA-01..03: looking-for posts, moving-out bundles, listing expiry/renewal and in-app notifications (migration 0003, UI, tests). | `npm test` (database checks), `tsc`, build and lint run; browser check with demo data. No live-backend testing. |
| 2026-10-31 | Redesigned the interface in an editorial, soft-minimal style from the owner's brief (new palette and type, hero collage, bento grid, filters drawer, how-it-works, trust, CTA, footer, Framer Motion). Replaced the night-market scene. | `tsc`, build, lint and 13 tests run; checked in a browser at desktop and phone widths with demo data. No live-backend testing. The trust section describes real safeguards, not invented ratings or testimonials; no newsletter form because there is no backend for it. |
| 2026-10-31 | Owner assigned design/UI to Abhik and remaining engineering to Garv Rao/Codex. Retired Codex design PR #4 and updated review automation. Started backend-readiness work on `feat/ENG-01-backend-readiness`. | GitHub currently has only configuration examples: no repository secret/variable names, environments, or deployments. This does not prove whether projects exist in private cloud accounts. |
| 2026-10-31 | Prepared publishable-key configuration with legacy support, secret rejection before bundling, a configuration preflight command, migration 0003 upload limits, expanded tests, SPA rewrite file, and backend/OAuth/live-QA documentation in PR #6. | 23 local tests pass; build/typecheck passes with existing chunk-size warning; lint has 5 existing warnings and no errors. Configuration preflight correctly reports missing project settings. No cloud migration, OAuth setup, live QA, or deployment has been performed. |
| 2026-10-31 | Merged backend-readiness PR #6 after GitHub CI passed (`afe45c9`). Updated the review monitor from 15 minutes to 3 minutes at the owner's request. | Local preparation is complete. Supabase connection/cloud setup, live QA, and deployment remain pending; Abhik owns design/UI. |
| 2026-10-31 | Reviewed PR #7 and merged current backend-readiness changes into its branch, preserving Abhik's UI and both progress histories. Removed a duplicate animation-frame startup that could leave a canvas loop running after unmount. | Local tests/build/lint checked during review; live backend QA remains pending. |
| 2026-10-31 | Reviewed extras PR #8 against current main. Assigned extras migration version 0004 to avoid the applied 0003 upload-limit version, added expired-listing RPC checks and suspended wanted-response protection, and expanded regression coverage. | Local checks recorded in the PR review; live Supabase/realtime/concurrency QA remains pending. |
| 2026-10-31 | Reviewed editorial PR #9 over the current backend/extras stack, preserving Abhik's scene removal and visual design. Stabilized drawer focus during filter edits, added keyboard containment/reduced-motion handling, and corrected privacy copy to reflect authorized moderator access. | Local test/build/lint and review verification recorded with the PR. Live backend QA remains pending. |
| 2026-10-31 | Approved and merged Abhik's stacked PRs #7, #8, and #9 after integration fixes and checks on each exact reviewed head. Final editorial design is on main (`c91f83a`); extras use migrations 0004 and 0005 after upload migration 0003. | 30 local checks pass; build/typecheck and GitHub CI pass; lint has warnings only. Demo-browser checks confirm filter typing retains focus, Tab is contained, and Escape restores focus. See docs/pr-review-log.md. Live provider QA/deployment remain pending. |
| 2026-10-31 | Launch preparation: Pages-ready build (sub-path, 404 fallback, return-to-page after sign-in), browser-side photo resizing with previews, first-admin bootstrap and admin approval alerts (migration 0006, found and fixed a sign-up trigger ordering bug via the local end-to-end run), live notifications, share button, privacy and terms pages, deploy script, local Supabase stack with 19 end-to-end checks. Codex created the hosted Supabase project and Google sign-in in the owner's browser. | 37 unit and 19 end-to-end checks pass locally; hosted project verified with public-key probes only. Public site not deployed (needs owner approval); real Google sign-in on the hosted project not yet exercised. |
| 2026-10-31 | Created the public build-only repo `AbhikRao/iiitd-black-market` after the owner's approval, enabled GitHub Pages and deployed the site from source `a235788`. | Live URLs, privacy/terms pages, deep link, bundle contents and the Google hand-off checked (docs/launch.md). Codex later published the Google OAuth app to production (Google Auth Platform shows In production; Branding URLs match the live pages). A real Google sign-in on the live site and phone QA are still pending. |
