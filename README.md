# IIITD Black Market

A campus marketplace for IIIT-Delhi students to buy, sell, rent, and give away new or secondhand items, with photo listings and conversations inside the website.

## Current status

**Runnable foundation implemented; marketplace features remain planned.**

The owner authorized the basic repository/application scaffold on 31 October 2026. The website starter connects to the API health endpoint locally without credentials. Student sign-in, listings, uploads, database integration, chat, and deployment are not implemented. The full marketplace scope below remains a proposal.

This README is the shared project record for the owner, their collaborator, and Codex. Update it with every meaningful project change so everyone can see what exists, what changed, and what remains.

Shared development files: [TODO.md](TODO.md) tracks tasks and ownership, [CONTRIBUTING.md](CONTRIBUTING.md) explains the Git and review workflow, and [AGENTS.md](AGENTS.md) provides repository instructions for coding agents.

## Requested requirements

- Restrict access to students using their IIITD accounts.
- Let students create listings for new and secondhand items with uploaded photos.
- Organize items into categories.
- Keep buyer/seller conversations inside the website with built-in chat.
- Support buying, selling, and renting, as described in the original repository brief.

## Proposed first release

All entries below are **planned**, not implemented.

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

## Technical foundation

Installed and locked with npm workspaces:

- **Website:** React + TypeScript + Vite in `apps/web`.
- **Backend:** Fastify + TypeScript in `apps/api`; currently exposes only `GET /api/health`.
- **Shared contracts:** Type-only exports in `packages/shared`; no server secrets or runtime server imports.
- **Tooling:** Node.js 24, npm 11, one root lockfile, parallel development commands, and GitHub Actions checks.

Supabase remains the proposed provider for database, authentication, storage, and real-time messaging. `supabase/migrations/` reserves its migration location; no database or Supabase integration exists yet. Access policies and student eligibility checks must be implemented before marketplace data routes are exposed.

References: [Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [real-time authorization](https://supabase.com/docs/guides/realtime/authorization), and [storage access control](https://supabase.com/docs/guides/storage/security/access-control).

Hosting remains undecided. See [docs/architecture.md](docs/architecture.md) for boundaries, data flow, and deployment expectations. This scaffold is a local development foundation, not a production deployment.

## Local setup and deployment

Install **Node.js 24** and **npm 11**, then run from the repository root:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The website shows the development starter and backend connectivity status. The API listens on `http://127.0.0.1:3001`; Vite proxies `/api` requests to it. No credentials or environment files are required for this scaffold. On PowerShell systems that block `npm.ps1`, use `npm.cmd` in place of `npm`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start website and API together; Ctrl+C stops both. |
| `npm run dev:web` / `npm run dev:api` | Start only the selected workspace. |
| `npm run typecheck` | Check all workspaces and API test types. |
| `npm test` | Run the API scaffold tests; no browser tests exist yet. |
| `npm run build` | Compile API to `apps/api/dist` and website to `apps/web/dist`. |
| `npm run start --workspace @iiitd/api` | Run the compiled API after building. |

Optional overrides are documented in `apps/api/.env.example` and `apps/web/.env.example`. Copy an example to `.env` in the same directory only when needed. If changing the API port, update the web proxy target too. Restart dev servers after configuration changes. Variables prefixed `VITE_` are browser-public and must never contain secrets. `.env` files, dependencies, and build outputs are ignored.

```text
apps/
  web/                 React website, API client, feature folders
  api/                 Fastify server, module folders, API tests
packages/shared/       Shared type-only API contracts
supabase/migrations/   Reserved database migration location
docs/                  Architecture and handoff documentation
.github/               CI workflow and pull request template
```

Verification on 31 October 2026: type checking, two API tests, production builds, and HTTP smoke checks passed (website 200, direct API health, and health through the web development proxy). Browser rendering has not been visually verified. GitHub Actions is configured but its remote result must be checked on the pull request. No database migrations or hosted application have been tested.

Expected configuration needs include a backend project, Google OAuth credentials and callback URLs, the accepted institute domain, a student eligibility mechanism, and deployment configuration. Never commit secrets, private student rosters, or real chat data. Document configuration key names and use placeholders in examples.

## Working together

- Fetch the latest remote changes before starting work and again before pushing.
- Use focused feature branches and pull requests for application changes so parallel work can be reviewed together.
- Coordinate ownership of overlapping features/files before editing them.
- Preserve the other contributor's changes; resolve conflicts explicitly and avoid force-pushing shared history.
- Update this README in the same commit or pull request as each meaningful change: behavior, setup/configuration, verification results, remaining work, and relevant decisions.
- Keep proposed, implemented, tested, and deployed states distinct. Record actual checks and any verification limits; do not mark untested features complete.
- Keep the progress log concise. Git commits and pull requests contain the detailed history; link them when useful.

## Next steps

The detailed shared task board, including owners and dependencies, is in [TODO.md](TODO.md). Keep this overview aligned with that board.

- [ ] Approve or revise the proposed release scope.
- [ ] Decide how current student eligibility is verified.
- [x] Set up website, backend, shared contracts, and local development tooling.
- [ ] Finalize hosting and backend provider configuration.
- [ ] Implement institute sign-in and access controls.
- [ ] Implement listings, uploads, categories, and search.
- [ ] Implement private chat and offers.
- [ ] Implement dashboards, saved items, and moderation.
- [ ] Validate access isolation, uploads, listing ownership, and chat between separate test accounts.
- [ ] Document local setup, deployment, and operational limits as they become concrete.

## Progress log

| Date (Asia/Kolkata) | Work completed | Verification / remaining work |
| --- | --- | --- |
| 2026-10-31 | Reviewed the repository and documented the requested marketplace, proposed release scope, identity considerations, and collaboration workflow. Owner requested ongoing GitHub README updates for shared development. | Confirmed the repository initially contained only a README. Documentation-only change; no application tests apply. Scope approval and implementation remain pending. |
| 2026-10-31 | Added TODO.md for task ownership/dependencies, CONTRIBUTING.md for branches and review, and AGENTS.md for shared coding-agent instructions. | Documentation baseline; application implementation remains pending. |
| 2026-10-31 | Added the authorized website/API scaffold, shared types, migration directory, environment examples, npm lockfile, CI, PR template, and architecture notes on `feat/SETUP-01-repo-scaffold`. | Typecheck, 2 API tests, builds, and HTTP smoke checks passed. Marketplace features, student verification, provider configuration, and deployment remain pending. |
