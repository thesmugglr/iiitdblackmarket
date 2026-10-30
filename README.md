# IIITD Black Market

A campus marketplace for IIIT-Delhi students to buy, sell, rent, and give away new or secondhand items, with photo listings and conversations inside the website.

## Current status

**Planning stage — application implementation has not started.**

The repository was reviewed on 31 October 2026 and contained only this README. The scope below is a proposal awaiting the project owner's approval; it does not describe working features. Documentation updates have been authorized.

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

## Proposed technical foundation

These choices are proposals, not installed dependencies:

- React and TypeScript for the application interface.
- Supabase for database, authentication, image storage, and real-time messaging.
- Access policies restricting conversation data to authorized participants and listing changes to authorized owners/admins.

References: [Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [real-time authorization](https://supabase.com/docs/guides/realtime/authorization), and [storage access control](https://supabase.com/docs/guides/storage/security/access-control).

Hosting and the application framework remain to be finalized before implementation.

## Local setup and deployment

There is no runnable application, dependency manifest, database schema, or deployment yet. Setup commands will be documented here when those files exist.

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
- [ ] Finalize framework, hosting, and backend configuration.
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
