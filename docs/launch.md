# Launch notes

**Current status:** see [current-status.md](current-status.md) for the deployed baseline, local fix branch and remaining verification. Older dated results below are historical evidence, not current access/setup blockers.


Written overnight on 2026-10-31 by Claude (code, deployment tooling) with Codex doing the browser-only setup in Abhik's signed-in browser. This file separates what is **verified**, what **depends on an account owner's decision**, and what to do next. Keep it current; do not put secrets in it.

**New rollout prerequisite (2026-11-03):** main after CHAT-05 / PR #27 uses `make_offer_once` and `respond_offer_once`. Verify the selected backend's migration history and apply `supabase/migrations/0008_offer_retries.sql` if missing **before deploying that source**. Legacy RPCs remain compatible with older clients. This review did not apply 0008 or publish a build; the selected project's dashboard still requires sign-in here. See [backend-setup.md](backend-setup.md) for the ordered migrations. The deployment/hosted results below are historical evidence, not confirmation that 0008 is live.

## How it fits together

| Piece | Where | Notes |
| --- | --- | --- |
| Site (static React app) | GitHub Pages from a **public build-only repo**, `iiitdblackmarket/iiitdblackmarket.github.io`, at `https://iiitdblackmarket.github.io/` (moved there on 2026-11-06; the old `AbhikRao/iiitd-black-market` repo now only redirects) | The private source repo is never published. `npm run deploy:pages -- iiitdblackmarket/iiitdblackmarket.github.io` builds and pushes only `dist/`. |
| Backend | Supabase project `iiitd-black-market` (Free plan, Mumbai, ref `mkepigiktixxrowsteje`) | Database, Google sign-in, private photo storage, realtime messages. Created by Codex under `AbhikRao's Org`. |
| Sign-in | Google, restricted to `@iiitd.ac.in` by a database trigger (not just the browser hint) | New people wait for admin approval unless they are on the roster. |
| Keep-alive | Workflow `keepalive.yml` in the public repo pings `rpc/ping` twice a week and adds an empty commit when the repo has been quiet for 30 days | Free Supabase projects pause after about a week without activity, and GitHub switches off scheduled workflows in a public repo after 60 days without a commit. Ran once on 2026-10-31 after the redeploy: success. |

Browser settings that must match: Supabase **Site URL** `https://iiitdblackmarket.github.io/`, redirect URLs `https://iiitdblackmarket.github.io/**`, `https://abhikrao.github.io/iiitd-black-market/**` (old address, can be removed later) and `http://localhost:5173/**`, and Google's authorized redirect URI `https://mkepigiktixxrowsteje.supabase.co/auth/v1/callback`.

## Verified so far

- The six migrations (`0001` to `0006`) apply as one transaction on a fresh database, locally and on the hosted project (`launch-bundle.sql`).
- `npm test` (37 database checks on PGlite) and `npm run e2e:local` (19 checks with separate accounts against a real local Supabase stack: auth, row-level security, private storage, offers, blocks, reports, notifications, expiry, realtime, admin bootstrap).
- The e2e run caught a real bug in the first version of the sign-up trigger: GoTrue inserts the user and confirms the email in a follow-up update, so a check made only at insert time would have left the owner's first Google sign-in pending instead of admin. `0006_launch.sql` now handles both orders (a provider check at insert, plus a trigger that promotes bootstrap-admin and roster emails when the email becomes confirmed) and defers the admin alert to the end of the sign-up transaction. A hosted project that ran an earlier bundle needs `~/iiitd-launch/fix-signup-trigger-v2.sql` once; it is the idempotent block between the `BEGIN/END SIGNUP TRIGGERS` markers in `0006_launch.sql`.
- A 4032 x 3024 photo uploaded through the real sell form is resized in the browser to a 1600 x 1200 JPEG of about 280 KB (this also removes EXIF data such as GPS), stored privately and shown with a signed URL. Chat attachments use the same path.
- The build boots from `404.html` on a deep link (the site is at the root `/` since 2026-11-06; the old sub-path build did the same) and remembers the page you wanted across the Google round trip.
- Against the hosted project with only the public key: `rpc/ping` works, anonymous users see zero listings, `profiles` and `admin_bootstrap` are permission denied.
- **Live site (2026-10-31, after the owner approved creating the public build-only repo):** `AbhikRao/iiitd-black-market` is public, default branch `main`, with the `.iiitd-market-build-only` marker; Pages serves it at `https://abhikrao.github.io/iiitd-black-market/`. Deployed with `npm run deploy:pages` from source `a235788`. Checked: `/`, `/privacy.html`, `/terms.html`, `/favicon.svg` and the JS bundle return 200; a deep link such as `/listing/xyz` is served by `404.html` and boots the app (checked from a local copy of the same build in a browser: login page, Google button enabled, privacy and terms links correct); the bundle contains only the hosted project URL and the publishable key (no JWTs, no local values); the Google authorize link with this site as the return address reaches Google's "IIITD Black Market" sign-in page with no client or redirect errors.
- **Redeploys:** Abhik reports redeploying with the same script from source `f74c10d` and then `8dc2c60`, including PR #16 (sign-in state) and PR #17 (chat loading). PR #18 review independently confirmed latest public build commit `1228bc4` declares source `8dc2c60`, the live JS bytes match that build, chat fallback/error copy is present, and home/privacy/terms/favicon/JS return 200. The reviewed `8dc2c60` source has 60 passing regressions; the earlier AUTH-02 source had 51. Future application changes reach the live site only after an authorized redeploy; this documentation review does not deploy or authorize publication.
- **Student codes live (2026-10-31):** `0007_student_codes.sql` and the 2,376 codes (batches 2023 to 2026: 570, 597, 607, 602) were applied to the live project through the SQL editor. Read-only aggregate checks: the sign-up and confirm triggers reference the code rule; `authenticated` can neither read `student_codes` nor execute `approve_listed_students()`; `test25025@iiitd.ac.in` matches and `professor@iiitd.ac.in` does not; no profile was waiting, so nobody was newly approved. The site was redeployed from source `8870e96` (Pages commit `91a3361`) so the privacy, terms and pending-page wording matches. Not yet exercised: a real new student's first Google sign-in.

## Not verified (needs the account owner)

Latest independent public delivery check (DEPLOY-03, 2026-10-31): build `20fd56b` declares source `981724d`, and the live JS bytes match it, including saved-item/editor/chat fix copy. Public install assets and pages return 200; Pages and keep-alive runs on that build succeeded. See docs/live-qa.md for evidence and limits. This reviewer has not inspected hosted billing/quotas or admin rows, installed on a physical phone, deployed the site or changed provider settings.

Independent PR #15 review confirmed the live pages/bundle and Google-provider redirect using only public configuration; the live 390px sign-in screen and a deep link also render correctly. See docs/live-qa.md for exact observed statuses and limits. Garv reports Google authentication reaches Awaiting approval; owner admin setup, approved-user campus flows, reviewer dashboard access and full phone QA remain pending; Google app publication is reported by Abhik and has not been independently inspected in this chat. Preserve the 22-scenario local service coverage added in PR #14 when updating this document; the 19-scenario result above describes the earlier launch head.

- A real Google sign-in on the hosted project. Public Auth settings show the Google provider enabled; the authorization redirect alone does not prove a completed sign-in. Check the provider hand-off with
  `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://mkepigiktixxrowsteje.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fabhikrao.github.io%2Fiiitd-black-market%2F"`
  which should print `302` and an `accounts.google.com` URL.
- Approved-user access on the live site. Public hosting is verified here; Abhik reports his setup session published the Google OAuth app to production (Google Auth Platform shows `In production`; the saved Branding homepage, privacy and terms URLs match the live pages), so people with an @iiitd.ac.in Google account should be able to reach the site's approval screen. Garv clarifies that institute Google authentication reaches Awaiting approval. Abhik must use his project access to apply the owner-requested private admin SQL (CLOUD-02); no hosted role update has been performed in this chat. Other authenticated flows and account-isolation checks remain pending.
- Behaviour on phones and other laptops beyond the browser checks in this repo.

## Owner checklist

Garv selected **Abhik's existing project** on 2026-10-31. Use project `mkepigiktixxrowsteje` and its reported Google provider configuration under Abhik's organization. Verify access and the intended project in the dashboards before applying migrations or changing providers. The selection does not itself grant new permissions, transfer ownership, or approve public deployment. Do not request secrets in chat or recreate resources solely because older TODO entries said setup was absent.

1. Open the existing public site and test institute Google sign-in. Public deployment is already recorded; do not recreate it for this check.
2. Open the site, choose **Continue with IIITD Google**. Make yourself admin if you are not already (Supabase > SQL Editor):
   ```sql
   insert into public.admin_bootstrap (email) values ('you@iiitd.ac.in') on conflict do nothing;
   update public.profiles set role = 'admin', status = 'approved' where email = 'you@iiitd.ac.in';
   ```
3. Current B.Tech students are approved automatically (see Student codes below). Approve everyone else in **Admin > Waiting for approval**, or paste verified emails into the roster (approved on first sign-in). Admins get a bell alert when someone new signs up. Faculty and staff share the domain, so approve only people you can confirm.
4. Delete any Supabase access token you created for setup (Account > Access Tokens). Nothing here needs it.
5. To let someone else administer the backend, transfer the Supabase project to their organization (Project settings > General).

## Student codes (automatic approval, numbers only)

IIIT-Delhi publishes current B.Tech roll numbers on its public students page (`https://iiitd.ac.in/people/btech`). A roll number such as 2025025 gives the numeric part of that student's address, `<name>25025@iiitd.ac.in` (last five digits). `0007_student_codes.sql` adds an admin-only `student_codes` table holding **only those five-digit codes** (no names, programs or addresses) and the sign-up rule: a provider-verified `@iiitd.ac.in` address that is letters followed by exactly five digits, where the digits are listed, is approved automatically. Everyone else (faculty, alumni, M.Tech/PhD, newly admitted, unlisted) still waits for an admin. Suspended or rejected accounts are never re-approved by this rule.

- **Load or refresh (once per semester):** `cd app && npm run student-codes -- --out ~/iiitd-launch/student-codes.sql` reads the public page (certificate checking stays on), keeps only codes for the four current batches, refuses to write a suspiciously small list, and writes a SQL file of codes only. Run that file once in the Supabase SQL editor; it ends by approving people who were already waiting. Do not commit it (`*.local.sql` is ignored).
- **Trim leavers:** `delete from public.student_codes where substring(code, 1, 2)::int < 23;` removes codes of batches older than 2023 (adjust the number each year).
- **Limits:** the page lists B.Tech only. The numeric code proves only that the Google account holds a listed address, which is stronger than the domain alone but not a manual check; keep using the Admin page for anyone unusual. The snapshot used on 2026-10-31 had 2,376 codes (batches 2023 to 2026).
- Privacy pages (`privacy.html`, `terms.html`) describe this accurately.

## Redeploying

Before the first deploy, the owner must create the chosen **public build-only** repository with an initialized `main` branch, then add `.iiitd-market-build-only` containing exactly `iiitdblackmarket-static-output`. The deployer refuses private, archived, non-main, or unmarked targets before replacing files. Never add this marker to the source repository. This guard does not create repositories or grant publishing approval. The marker is preserved in generated deployments.

```sh
cd app
cp ~/iiitd-launch/public-config.env .env.production.local   # URL + publishable key only
npm run check:config
npm run deploy:pages -- iiitdblackmarket/iiitdblackmarket.github.io
```

The script refuses non-HTTPS or secret-looking keys, builds with `VITE_BASE=/` for a `<owner>.github.io` repository (`/<repo>/` for any other, see `scripts/pages-site.mjs`), strips the demo and local-login switches, and pushes `dist/` plus the keep-alive workflow to the repo's `main`.

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

- In-app and opt-in Web Push are implemented; email notifications are not. Provider setup does not prove device delivery. See [push-notifications.md](push-notifications.md).
- Free tier: 500 MB database, 1 GB file storage (a resized photo is roughly 100 to 200 KB plus a 480 px thumbnail), 5 GB of bandwidth a month. Going over restricts the project until the monthly reset instead of charging anything; see [free-tier.md](free-tier.md). The owner cannot pay, so upgrading is not an option: reduce photo sizes and review usage if the campus outgrows it; never purge photos solely because they are old.
- Search is substring matching, with 60 results per page and Load more.
