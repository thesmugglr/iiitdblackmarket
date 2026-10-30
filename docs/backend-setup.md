# Backend setup and live verification

Owner: **Garv Rao / Codex**. Website design/UI: **AbhikRao**. Use `app/`; the backend is Supabase PostgreSQL/Auth/Storage/Realtime. A separate Fastify server is not required by the current app.

## Current evidence

The GitHub repository was checked on 31 October 2026. It contains `.env.example` placeholders, migrations, and local tests. GitHub returned no repository secret names, variable names, environments, deployments, or homepage. The current checkout has no local project environment file or Supabase access token. This establishes that live setup is not available through those paths; it does not establish whether Garv or Abhik already created cloud projects elsewhere. A Supabase connection was suggested but has not been confirmed.

## 1. Project and database

Create or select a Supabase development project in the owner's account. Retain ownership of its organization, database password, and billing. Use a development project for first verification.

Run each migration **once, in filename order** through the Supabase SQL editor or an authorized migration tool:

1. `supabase/migrations/0001_init.sql` — tables, initial policies/RPCs, private buckets, realtime.
2. `supabase/migrations/0002_review_access.sql` — reviewed privacy/access fixes and admin bootstrap.
3. `supabase/migrations/0003_upload_limits.sql` — private image buckets with 5 MiB limits.
4. `supabase/migrations/0004_extras.sql` — wanted posts, bundles, expiry, and notifications.
5. `supabase/migrations/0005_expiry_access.sql` — privileged expiry checks and suspended-response access protection.

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

### Local Supabase stack

For service testing without a hosted project, install/run Docker and use Supabase CLI **2.122.0**. From the repository root:

```sh
npx --yes supabase@2.122.0 start
```

This applies all five current migrations. Seed loading is disabled because no seed file is supplied. Inspect local credentials in your own terminal with `npx --yes supabase@2.122.0 status -o env`; do not paste them into chat, logs or commits. Set `app/.env.local` to the local API URL and anon key, add `VITE_DEV_LOGIN=1`, and run the app on `http://localhost:5173`. The password form only appears on a loopback HTTP app with a configured loopback HTTP backend in Vite development mode. Create test institute accounts and bootstrap/approve an admin through local Studio/SQL as described above; never use real student credentials for these fixtures.

Run `cd app` then `npm run e2e:local`. The runner reads the local CLI status without printing credentials, refuses hosted endpoints, creates uniquely named fixtures and removes only its own photos/accounts. It checks Auth, RLS, private Storage, bucket size/type limits, conversations, offers, moderation, extras and Realtime. A forcibly terminated run may leave fixtures; use a disposable test stack. Stop it from the repository root with `npx --yes supabase@2.122.0 stop` (retain data). Do not reset shared or hosted databases.

The CLI publishes local service ports through Docker. Keep this stack private to your device; on an untrusted network, follow [Supabase's loopback network instructions](https://supabase.com/docs/guides/local-development) before starting it. Local email confirmation is disabled for generated accounts only; hosted providers retain the production configuration above. The GitHub integration job uses an ephemeral runner and needs no hosted secrets.

Local service tests do not validate Google identity or hosted access settings. This review machine has no Docker executable; GitHub's disposable Linux runner performs the service checks.

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
