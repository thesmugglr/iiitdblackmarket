# IIITD Black Market

A campus marketplace for IIIT-Delhi students: buy, sell, rent and give away things to the people down the corridor. Only verified `@iiitd.ac.in` students can see or post anything.

**Live:** [iiitdblackmarket.github.io](https://iiitdblackmarket.github.io/) (the old address, abhikrao.github.io/iiitd-black-market, redirects here.)

**On your phone:** open the site, then use *Install app* on Android Chrome or *Share → Add to Home Screen* on iPhone Safari.

Student-run and not affiliated with IIIT-Delhi.

## Features

- **Listings:** sell, rent or give away, with up to 6 photos. Photos are resized in the browser, which also strips their location data. Categories, condition, search, filters, sorting and saved items.
- **Chat and offers:** a private chat for each listing, with photos, read receipts and unread counts. Buyers make offers and sellers accept or decline. There are one-tap quick replies, and sellers get a *Mark sold to this buyer* button.
- **Trust:** after a sale the buyer can give a thumbs-up, and listings show "N smooth deals". Anyone can report a listing or message, or block a person.
- **Notifications:** an in-app bell, plus phone and browser notifications, even with the site closed, for messages, offers, price drops or sales of saved items, and replies.
- **Looking for:** post what you need, and sellers point you to their listing.
- **Moving-out bundles:** sell several items together at one price.
- **Lost & found:** say what you lost or found and where. Replies stay private between you and the person who writes.
- **Admin:** approve or suspend members, review reports and remove listings.
- **Your account:** edit your profile, or delete your account and everything in it at any time. Dark mode follows your phone's setting.

## Who can join

Sign-in is Google only. The database, not just the browser, rejects any address outside `@iiitd.ac.in`.

Current B.Tech students are approved automatically. The database keeps only the five-digit roll codes from IIIT-Delhi's public student list (no names) and matches them against the number in the address, so `name25025@iiitd.ac.in` matches roll number 2025025. Everyone else, such as faculty, M.Tech and PhD students and new admits, waits for an admin. See [docs/student-approval-review.md](docs/student-approval-review.md).

## How it's built

| Part | What | Cost |
| --- | --- | --- |
| Website | React 19, TypeScript, Vite and Framer Motion; a static site on GitHub Pages (the `iiitdblackmarket` organization); installable as an app (PWA) | Free |
| Backend | Supabase (Mumbai): Postgres with row-level security, Google sign-in, private photo storage, realtime chat | Free plan, no card on file |
| Push notifications | A Supabase Edge Function that sends Web Push using only standard Web Crypto | Free |
| Keep-alive | A GitHub Actions job pings the backend twice a week so the free project never pauses | Free |

Everything stays on free plans. [docs/free-tier.md](docs/free-tier.md) lists the limits and what to watch.

```
app/                   the website: src/pages, src/components, src/lib; tests in app/test; tooling in app/scripts
supabase/migrations/   database schema, access rules and functions (0001 to 0009, applied in order)
supabase/functions/    push: the function that delivers phone notifications
docs/                  setup, operations and the project history
```

## Run it locally

You need Node.js 24, plus Docker for the full local backend.

**Just the interface, with sample data:**

```bash
cd app && npm ci && echo 'VITE_DEMO=1' >> .env.local && npm run dev
```

Demo mode only runs on the dev server and never ships in a production build.

**The whole stack against a local Supabase.** From the repo root:

1. Start the stack. The first run downloads the images and applies every migration.

   ```bash
   npx supabase start -x studio,mailpit,edge-runtime,vector,logflare,imgproxy,postgres-meta,supavisor
   ```
2. Run `npx supabase status -o env` for the local API URL and keys. Put the URL and the publishable key in `app/.env.local`, with `VITE_DEV_LOGIN=1` to show a local-only email sign-in form.
3. Run `cd app && npm run dev`, then create users and approve the first admin in SQL.

**Checks**, run inside `app/`:

- `npm test`: 510 unit and database tests.
- `npm run build`
- `npm run lint`
- `npm run e2e:local`: 48 end-to-end checks against the local stack, using separate accounts.

## Deploying

1. **Database:** apply any new file in `supabase/migrations/` in the Supabase SQL editor, in order, and never rerun one that is already applied.
2. **Website:** `cd app && npm run deploy:pages -- iiitdblackmarket/iiitdblackmarket.github.io`. It builds with only the public URL and publishable key from `app/.env.production.local`, and pushes the built files to the build-only Pages repository.
3. **Push notifications** need a one-time setup: [docs/push-notifications.md](docs/push-notifications.md).

The full runbooks are [docs/launch.md](docs/launch.md) and [docs/backend-setup.md](docs/backend-setup.md).

## Looking after it

- **Each academic year**, refresh the student codes:

  ```bash
  cd app && npm run student-codes -- --out ~/iiitd-launch/student-codes.sql
  ```

  Then run that file once in the SQL editor. It contains numbers only, so never commit it.
- **New admin:** add their address to `admin_bootstrap` before their first sign-in, or set `role = 'admin'` on their profile in the SQL editor.
- **Storage and bandwidth:** check the Supabase usage page now and then. [docs/storage-operations.md](docs/storage-operations.md) has a read-only audit.

## Status

Live. Still to test on the live site:

- push notification delivery to a real phone (the server side is set up and checked; turn notifications on from Profile on a signed-in device);
- installing the app on a physical phone;
- removing graduated students automatically.

[TODO.md](TODO.md) is the task board.

## Team

- **Abhik Rao:** design and interface.
- **Garv Rao:** backend, sign-in, access rules and tests.

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before contributing. Dated progress notes and review records live in [docs/changelog.md](docs/changelog.md).

[Privacy policy](https://iiitdblackmarket.github.io/privacy.html) · [Terms of use](https://iiitdblackmarket.github.io/terms.html)
