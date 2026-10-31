# Launch notes

Written overnight on 2026-10-31 by Claude (code, deployment tooling) with Codex doing the browser-only setup in Abhik's signed-in browser. This file separates what is **verified**, what **depends on an account owner's decision**, and what to do next. Keep it current; do not put secrets in it.

## How it fits together

| Piece | Where | Notes |
| --- | --- | --- |
| Site (static React app) | GitHub Pages from a **public build-only repo**, `AbhikRao/iiitd-black-market`, at `https://abhikrao.github.io/iiitd-black-market/` | The private source repo is never published. `npm run deploy:pages -- AbhikRao/iiitd-black-market` builds and pushes only `dist/`. |
| Backend | Supabase project `iiitd-black-market` (Free plan, Mumbai, ref `mkepigiktixxrowsteje`) | Database, Google sign-in, private photo storage, realtime messages. Created by Codex under `AbhikRao's Org`. |
| Sign-in | Google, restricted to `@iiitd.ac.in` by a database trigger (not just the browser hint) | New people wait for admin approval unless they are on the roster. |
| Keep-alive | Workflow `keepalive.yml` in the public repo pings `rpc/ping` twice a week | Free Supabase projects pause after about a week without activity. |

Browser settings that must match: Supabase **Site URL** `https://abhikrao.github.io/iiitd-black-market/`, redirect URLs `https://abhikrao.github.io/iiitd-black-market/**` and `http://localhost:5173/**`, and Google's authorized redirect URI `https://mkepigiktixxrowsteje.supabase.co/auth/v1/callback`.

## Verified so far

- The six migrations (`0001` to `0006`) apply as one transaction on a fresh database, locally and on the hosted project (`launch-bundle.sql`).
- `npm test` (37 database checks on PGlite) and `npm run e2e:local` (19 checks with separate accounts against a real local Supabase stack: auth, row-level security, private storage, offers, blocks, reports, notifications, expiry, realtime, admin bootstrap).
- The e2e run caught a real bug in the first version of the sign-up trigger: GoTrue inserts the user and confirms the email in a follow-up update, so a check made only at insert time would have left the owner's first Google sign-in pending instead of admin. `0006_launch.sql` now handles both orders (a provider check at insert, plus a trigger that promotes bootstrap-admin and roster emails when the email becomes confirmed) and defers the admin alert to the end of the sign-up transaction. A hosted project that ran an earlier bundle needs `~/iiitd-launch/fix-signup-trigger-v2.sql` once; it is the idempotent block between the `BEGIN/END SIGNUP TRIGGERS` markers in `0006_launch.sql`.
- A 4032 x 3024 photo uploaded through the real sell form is resized in the browser to a 1600 x 1200 JPEG of about 280 KB (this also removes EXIF data such as GPS), stored privately and shown with a signed URL. Chat attachments use the same path.
- The sub-path build (`/iiitd-black-market/`) boots from `404.html` on a deep link and remembers the page you wanted across the Google round trip.
- Against the hosted project with only the public key: `rpc/ping` works, anonymous users see zero listings, `profiles` and `admin_bootstrap` are permission denied.

## Not verified (needs the account owner)

- A real Google sign-in on the hosted project. Needs the Google Cloud OAuth client and the Google provider to be saved in Supabase (README steps 5 and 6 in `~/iiitd-launch`). Check with
  `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://mkepigiktixxrowsteje.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fabhikrao.github.io%2Fiiitd-black-market%2F"`
  which should print `302` and an `accounts.google.com` URL.
- Public hosting. Creating a public repository is an owner decision; an automatic attempt was blocked by the safety classifier and not retried. Google's "Publish app" step also needs the public privacy and terms pages (`privacy.html`, `terms.html`, shipped in `app/public`) to be live at the site address, so publishing the OAuth app follows the first deploy. Until the app is published, only test users added in Google Cloud can sign in.
- Behaviour on phones and other laptops beyond the browser checks in this repo.

## Owner checklist

Garv confirmed on 2026-10-31 that he has not created his own Supabase project or Google OAuth client. The project above belongs to Abhik's organization according to this handoff. First decide whether to use that setup or create a Garv-owned one. Verify access and the intended project in the dashboards before applying migrations or changing providers. Do not request secrets in chat or recreate resources solely because older TODO entries said setup was absent.

1. Approve public hosting, then deploy (see below).
2. Open the site, choose **Continue with IIITD Google**. Make yourself admin if you are not already (Supabase > SQL Editor):
   ```sql
   insert into public.admin_bootstrap (email) values ('you@iiitd.ac.in') on conflict do nothing;
   update public.profiles set role = 'admin', status = 'approved' where email = 'you@iiitd.ac.in';
   ```
3. Approve people in **Admin > Waiting for approval**, or paste verified student emails into the roster (they are approved on first sign-in). Admins get a bell alert when someone new signs up. Faculty and staff share the domain, so approve only people you can confirm.
4. Delete any Supabase access token you created for setup (Account > Access Tokens). Nothing here needs it.
5. To let someone else administer the backend, transfer the Supabase project to their organization (Project settings > General).

## Redeploying

Before the first deploy, the owner must create the chosen **public build-only** repository with an initialized `main` branch, then add `.iiitd-market-build-only` containing exactly `iiitdblackmarket-static-output`. The deployer refuses private, archived, non-main, or unmarked targets before replacing files. Never add this marker to the source repository. This guard does not create repositories or grant publishing approval. The marker is preserved in generated deployments.

```sh
cd app
cp ~/iiitd-launch/public-config.env .env.production.local   # URL + publishable key only
npm run check:config
npm run deploy:pages -- AbhikRao/iiitd-black-market
```

The script refuses non-HTTPS or secret-looking keys, builds with `VITE_BASE=/iiitd-black-market/`, strips the demo and local-login switches, and pushes `dist/` plus the keep-alive workflow to the repo's `main`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Only @iiitd.ac.in accounts can sign in" after choosing an account | A non-institute Google account was chosen. Pick the institute one. |
| Google error `redirect_uri_mismatch` | The OAuth client's redirect URI is not exactly the Supabase callback URL above. |
| Supabase says the provider is not enabled | Google provider not saved in Supabase (Authentication > Sign In / Providers). |
| After Google, you land on the login page again | Supabase Site URL or redirect URLs do not include the site address. |
| Signed in but "Awaiting approval" | Expected until an admin approves you; the page refreshes by itself. |
| Photos fail to upload | File is not an image, or the browser could not read it. JPG and PNG always work. |
| Site is slow or erroring after a quiet week | The free project was paused. Restore it from the Supabase dashboard. |

## Limits worth knowing

- No email or push notifications. People see alerts in the bell and, if they allow it, as desktop notifications while the site is open in a tab.
- Free tier: 500 MB database, 1 GB file storage (photos are about 300 KB each after resizing), limited bandwidth. Upgrade the Supabase plan if the campus outgrows it.
- Search is simple substring matching and the home grid shows the newest 60 results.
