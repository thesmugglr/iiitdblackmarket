# IIITD Black Market

A campus marketplace for IIIT-Delhi students to buy, sell, rent, and give away new or secondhand items, with photo listings and conversations inside the website.

## Current status

**First release merged into `main` through AbhikRao's PR #3, including review fixes from PR #5. Not yet tested against a live Supabase project or deployed.**

The owner asked for the project to be completed, so the proposed first-release scope below was built. The app compiles and bundles (`npm run build`), but no end-to-end run with real accounts has happened: it needs a Supabase project and Google OAuth credentials that only the owner can create. Treat every feature as *implemented, unverified* until QA-01 is done.

This README is the shared project record for the owner, their collaborator, and Codex. Update it with every meaningful project change so everyone can see what exists, what changed, and what remains.

Shared development files: [TODO.md](TODO.md) tracks tasks and ownership, [CONTRIBUTING.md](CONTRIBUTING.md) explains the Git and review workflow, and [AGENTS.md](AGENTS.md) provides repository instructions for coding agents.

## Requested requirements

- Restrict access to students using their IIITD accounts.
- Let students create listings for new and secondhand items with uploaded photos.
- Organize items into categories.
- Keep buyer/seller conversations inside the website with built-in chat.
- Support buying, selling, and renting, as described in the original repository brief.

## Proposed first release

The features below are implemented in code but remain **unverified against a live Supabase project**. Local database tests cover selected access rules, not all end-to-end behavior.

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

Hosting remains to be finalized. The canonical runnable app on main is `app/`, using Supabase for backend services. PR #1's alternative scaffold is superseded. The owner's near-black/electric-green design is a separate PR #4; reconcile it with Abhik's newer UI before merging visual changes.

## Local setup and deployment

Layout: `app/` is the React + TypeScript (Vite) client; `supabase/migrations/0001_init.sql` is the full schema, row-level security, RPCs, storage buckets and realtime setup.

1. Create a Supabase project. In the SQL editor run all files in `supabase/migrations/` in filename order (`0001_init.sql`, then `0002_review_access.sql`). Existing installations of 0001 must apply 0002 before use.
2. Enable Google auth (Authentication → Providers) with OAuth credentials from Google Cloud; add your site URL and `http://localhost:5173` to the redirect URLs.
3. `cd app && cp .env.example .env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. `npm ci && npm run dev` (checks from `app/`: `npm test`, `npm run build`, `npm run lint`).
5. Sign in once with the admin's @iiitd.ac.in account, then run in SQL: `update public.profiles set role='admin', status='approved' where email='you@iiitd.ac.in';`
6. As admin, open **Admin** and paste current-student emails into the roster. Rostered users are approved on sign-up; others stay pending until approved.

UI preview without a backend: put `VITE_DEMO=1` in `app/.env.local` and run `npm run dev`. This uses in-memory sample data (dev server only, ignored by production builds) and does not test any real access rules.

Hosting is not chosen. `npm run build` outputs static files in `app/dist` for any static host (e.g. Vercel, Netlify, Cloudflare Pages); configure the two env vars there. Never commit `.env` or real rosters/chats.

### What is implemented
- Sign-in with Google (domain hint in the client; `@iiitd.ac.in` enforced by a database trigger on sign-up). Marketplace access requires `approved` status (roster or admin approval).
- Listings (sale/rent/giveaway, up to 6 photos in a private bucket served by signed URLs), edit/delete/reserve/sold, search, filters, sorting, saved items.
- Chat started via RPC; messages, photo attachments, read receipts and unread counts, realtime updates; offers made by buyers and accepted/declined by sellers (acceptance reserves the listing).
- Profile with own listings and completed deals; reports on listings/messages, user blocking, admin console (roster, user approve/suspend, report queue, listing removal).

### Interface
The home screen is an interactive 2D night market (`app/src/components/Scene.tsx`): a draggable side-scrolling street with parallax layers, stars, fireflies, string lights and swinging price tags for the newest listings. Each category is a stall with a live listing count; selecting one filters the grid below. Supports mouse/touch drag with inertia, arrow keys, focusable stalls and `prefers-reduced-motion`.

### Known limits
- Unverified against a live backend; RLS policies need the separate-account tests in QA-01.
- No expiry reminders, notifications, "looking for" posts or bundles (EXTRA-01..03), and no integrated payments.
- Search is simple substring matching; no pagination beyond the first 60 results.
- Blocking stops new messages and new chats; admin listing removal uses the status field.
- Graduates: no automatic handling; admins suspend accounts manually.

### Review checks

`cd app` then `npm test` runs eight local PostgreSQL/PGlite checks (one parent test and seven scenarios) covering SQL-editor admin bootstrap, self-promotion denial, private email protection, conversation isolation, blocks, suspension, offer acceptance, and administrator removal. Public profile joins cannot select email; the self/admin screens use authorized RPCs for private fields. The harness supplies minimal auth/storage schemas and grants; it excludes the pgcrypto extension (UUID generation is built in). These are local database tests, not live Supabase OAuth, storage-service, realtime, or multi-connection concurrency verification. QA-01 still requires separate real accounts.

Before production, enable Google sign-in and disable unused account providers, verify institute identity and current-student eligibility, and run the live access checks. Client domain hints are not an authorization boundary.

Expected configuration needs include a backend project, Google OAuth credentials and callback URLs, the accepted institute domain, a student eligibility mechanism, and deployment configuration. Never commit secrets, private student rosters, or real chat data. Document configuration key names and use placeholders in examples.

## Working together

- Fetch the latest remote changes before starting work and again before pushing.
- Use focused feature branches and pull requests for application changes so parallel work can be reviewed together.
- Coordinate ownership of overlapping features/files before editing them.
- Preserve the other contributor's changes; resolve conflicts explicitly and avoid force-pushing shared history.
- Update this README in the same commit or pull request as each meaningful change: behavior, setup/configuration, verification results, remaining work, and relevant decisions.
- Keep proposed, implemented, tested, and deployed states distinct. Record actual checks and any verification limits; do not mark untested features complete.
- Keep the progress log concise. Git commits and pull requests contain the detailed history; link them when useful.
- The owner has authorized review and merge of `AbhikRao` PRs after checks. Review the exact current head and merge only when checks pass and no material findings remain. A 15-minute Codex review monitor is active; it should stay quiet when nothing actionable changes. See AGENTS.md for the standing instructions.

## Next steps

See [TODO.md](TODO.md). Remaining: create the Supabase project and run the migration, configure Google OAuth, run QA-01 with two or more test accounts, choose hosting and deploy.

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
