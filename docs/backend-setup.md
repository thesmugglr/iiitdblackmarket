# Backend setup and live verification

Owner: **Garv Rao / Codex**. Website design/UI: **AbhikRao**. Use `app/`; the backend is Supabase PostgreSQL/Auth/Storage/Realtime. A separate Fastify server is not required by the current app.

## Current evidence

QA-02 update: merged PR #14 independently passes 22/22 disposable local Supabase service scenarios, adding real upload rejection and simultaneous offer acceptance coverage plus run-scoped cleanup. All 41 regression checks/build/lint also pass. The selected hosted project's dashboard currently requires sign-in in this chat; hosted Google/phone QA remains pending.

Update after merged launch PR #13: Abhik reports a hosted project and provider setup in [launch.md](launch.md). This chat independently verified the merged code with 41 local tests and 19/19 disposable Supabase service scenarios in GitHub CI, including Realtime and bootstrap. Hosted Google sign-in and phone workflows remain unverified here. The earlier repository inspection below is historical evidence, not a claim that no cloud project now exists. No hosted deployment or production migration was performed by this engineering review.

The GitHub repository was checked on 31 October 2026. It contains `.env.example` placeholders, migrations, and local tests. GitHub returned no repository secret names, variable names, environments, deployments, or homepage. The current checkout has no local project environment file or Supabase access token. This establishes that live setup is not available through those paths; it does not establish whether Garv or Abhik already created cloud projects elsewhere. A Supabase connection was suggested but has not been confirmed.

## 1. Project and database

Garv selected the existing Supabase project `iiitd-black-market` (`mkepigiktixxrowsteje`) under AbhikRao's organization. Confirm the signed-in account can access that project before hosted setup or QA. Inspect its existing migration history first, and reuse its reported Google provider setup. This decision does not transfer account ownership or grant new dashboard access. Keep service-testing fixtures in the disposable local stack unless dedicated hosted test accounts are explicitly arranged.

Access check on 2026-10-31: the project dashboard redirected this chat's browser to Supabase sign-in; no Supabase plugin connection is available here yet. Sign in using an account with access to Abhik's organization (or connect Supabase using that account). If the selected project is absent, its organization owner must arrange access. Credentials stay in Supabase's sign-in/connection flow; do not paste passwords, management tokens or OAuth secrets into chat. Resume by confirming the project name/ref before reviewing provider settings or migration history.

Run each migration **once, in filename order** through the Supabase SQL editor or an authorized migration tool:

1. `supabase/migrations/0001_init.sql` — tables, initial policies/RPCs, private buckets, realtime.
2. `supabase/migrations/0002_review_access.sql` — reviewed privacy/access fixes and admin bootstrap.
3. `supabase/migrations/0003_upload_limits.sql` — private image buckets with 5 MiB limits.
4. `supabase/migrations/0004_extras.sql` — wanted posts, bundles, expiry, and notifications.
5. `supabase/migrations/0005_expiry_access.sql` — privileged expiry checks and suspended-response access protection.
6. `supabase/migrations/0006_launch.sql` — verified-email bootstrap, approval notices and public health ping.
7. `supabase/migrations/0007_student_codes.sql` — automatic approval of current students by the five-digit numeric part of their institute address (admin-only `student_codes` table; no names stored). Load codes with `npm run student-codes` (see docs/launch.md).
8. `supabase/migrations/0008_offer_retries.sql` — new `make_offer_once` and `respond_offer_once` RPCs for idempotent client retries; no new table or weaker policy, and legacy RPCs remain available.

**Rollout requirement:** apply 0008 to the selected backend before publishing the new offer client. A lost response can be retried using the same offer UUID; a repeated matching seller decision adds no new message. Request/conversation/buyer/amount mismatches are refused. Existing clients keep their legacy RPCs during migration. This review has not applied 0008 to the hosted project or deployed a new build. The 2026-11-03 read-only access attempt still redirected to Supabase sign-in; trusted project access is required for the hosted migration.

On an existing database, apply only migrations that have not already run. Do not rerun 0001 over existing tables, and do not reset a project to resolve migration errors. Retain the migration history in the provider/tool used. Schema and access policies must be ready before inviting users.

Check that both `listing-photos` and `chat-attachments` remain private. Upload policy paths are `<owner UUID>/<file>` for listing photos and `<conversation UUID>/<file>` for chat attachments. The service must reject uploads over 5 MiB and file types outside the image allowlist. Local tests check bucket metadata; only a live Storage request can prove service enforcement. [Supabase bucket restrictions](https://supabase.com/docs/guides/storage/buckets/creating-buckets)

## 2. Google OAuth and student approval

Create or select the Google Cloud project and a **Web application** OAuth client. Configure the consent audience and any required test users for the project. Do not select an organization-internal audience unless that Google project actually belongs to the intended organization.

- Authorized JavaScript origin for local work: `http://localhost:5173`.
- Google authorized redirect URI: the **Supabase Auth callback URL** from the Google provider panel, typically `https://<project-ref>.supabase.co/auth/v1/callback`.
- Put the Google client ID and **client secret only in Supabase's Google provider configuration**.
- In Supabase Auth URL configuration, set the app Site URL and allow `http://localhost:5173` for local callbacks. Add the final HTTPS app origin when chosen.
- Enable Google sign-in; disable unused email/password, phone, anonymous, or social providers. Keep email verification enabled where applicable.

These are two different redirects: Google returns to Supabase, then Supabase returns to the app. The app currently uses `window.location.origin`; use `localhost` consistently, or explicitly allow a `127.0.0.1` origin as well if you use it. [Supabase Google sign-in setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

The server-side sign-up trigger restricts institute email addresses. The frontend `hd` value is an account-picker hint, not proof of student status. Marketplace access additionally requires roster/admin approval. Faculty/staff can also have institute email, so the admin must verify enrollment before approval. Test this with real accounts before launch.

After the designated admin signs in once, run this in the trusted SQL editor, replacing the example address:

```sql
update public.profiles
set role = 'admin', status = 'approved'
where email = 'your-institute-email@iiitd.ac.in';
```

Sign back in, open Admin, and add only verified current-student emails to the roster. Already-pending members can be approved there. Record who handles approval, suspension, graduates, and reports; do not commit the roster.

## 3. Local configuration

Use Node.js 24. From the repository:

```sh
cd app
npm ci
```

Copy `.env.example` to `.env.local` (PowerShell: `Copy-Item .env.example .env.local`). Replace the project URL and the **publishable** API key from Supabase's Connect/API keys section:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<browser-safe-publishable-key>
```

Existing installations using `VITE_SUPABASE_ANON_KEY` remain supported. The publishable variable takes precedence. Never use a secret/service-role key, Google client secret, database password, or management token in `VITE_` variables. The browser can read those variables. [Supabase key types](https://supabase.com/docs/guides/getting-started/api-keys), [Vite environment behavior](https://vite.dev/guide/env-and-mode)

Run:

```sh
npm run check:config -- development
npm test
npm run build
npm run dev -- --host localhost --port 5173 --strictPort
```

`check:config` defaults to hosted/production settings. Passing `development` also permits a local Supabase HTTP endpoint. It checks configuration shape and public-vs-secret key type; it does not contact Supabase or verify key signatures, project existence, or OAuth. Diagnostics print variable names, not credential values. Missing config deliberately exits nonzero. Placeholder settings do not enable sign-in. Builds without credentials remain available for UI preview; Vite refuses server-only browser variables before bundling.

`VITE_DEMO=1` is only for Abhik's UI preview on the dev server. Remove it for live-backend testing; production builds exclude that code. Restart Vite after changing environment files. PowerShell users can use `npm.cmd` when execution policy blocks `npm.ps1`.

## 4. Live QA — required before campus launch

Use an admin, two approved students, and a pending institute account. Also try an outside-domain Google account. Use separate browser profiles so sessions are independent. Keep results in `docs/live-qa.md`; do not save actual emails, tokens, messages, or student photos there.

1. Outside-domain sign-in is rejected; an unrostered institute account stays pending. That account cannot browse private listings, upload, or call chat/offer APIs directly.
2. Admin approval enables access; a student cannot approve themselves or read the admin directory/private emails.
3. Student A creates/edits a listing with photos. B can browse/save it but cannot edit/delete it or upload to A's photo namespace.
4. Check Storage rejection for oversize and disallowed file types using direct API requests too. Confirm buckets are private and unauthenticated object URLs do not expose content.
5. B contacts A. Messages, attachments, read receipts, and offers update in both sessions. A third account cannot read the conversation or signed attachments.
6. A block stops new messages, attachments, chats, and offers. Suspension removes marketplace access for the suspended account, including existing conversations and RPCs.
7. Accepting one offer reserves the item and declines competing offers. Simultaneous acceptance attempts from separate sessions must not produce inconsistent reservations. Test that sold/removed items cannot be reserved by a stale offer.
8. Admin removal cannot be undone by the seller. Test reporting and moderation with test data.
9. Refresh a listing/chat deep link, reload after sign-out, and repeat on a phone. Record failures as follow-up tasks.

Local PGlite tests approximate database roles/grants and platform schemas; they do not replace these service-level tests, Google identity verification, or concurrent-session tests.

## 5. Deployment preparation

Choose a static host, then use repository root `app`, build command `npm ci && npm run check:config && npm run build`, output `dist`. Configure only the project URL and public API key as frontend build variables. Build variables must be set before Vite bundles; changing host settings requires a rebuild.

The host must rewrite browser routes such as `/listing/<id>` and `/inbox/<id>` to `/index.html`. `app/public/_redirects` provides that rule for hosts that support this file (including Netlify/Cloudflare Pages); configure an equivalent rewrite elsewhere. It does not protect private data: database/storage policies do that. References: [Netlify SPA rewrites](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/), [Cloudflare Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/).

After obtaining the deployment's HTTPS origin, register it with Supabase and Google as required above, run live QA on that origin, and record the URL/commit tested. No host has been selected, no cloud setup has been applied, and nothing has been deployed by this preparation work.
