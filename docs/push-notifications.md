# Phone and browser notifications (Web Push)

Status on 2026-11-06: **set up on the live project.** Migration 0009 is applied, the `push` function is deployed with its secrets, the public settings are in `push_config`, and a live check (the database calling the function with its own secret) got `{"sent":0,"removed":0}` with status 200. **Not tested:** a notification arriving on a real phone, which needs someone to turn notifications on from a signed-in device.

Everything here is free: Web Push is a browser standard, Supabase Edge Functions include 500,000 invocations a month on the free plan, and pg_net is a built-in Postgres extension.

## How it works

1. On the profile or notifications page, a student taps **Turn on notifications**. The browser asks for permission and creates a push subscription for this site's public VAPID key (`app/src/lib/push.ts`). The app stores it with `save_push_subscription()`.
2. Whenever a row is added to `notifications` (new message or offer, price drop or sale of a saved item, lost & found reply, expiry reminder, approval request), the trigger `send_push` asks the database to call the `push` Edge Function with the notification id, through pg_net. This does not delay or block the notification itself.
3. The function (`supabase/functions/push`) hands the id and the request's secret header to `push_payload()`. The database checks the secret, which it generated itself and never leaves except in that header, and returns the title, the link and the person's subscriptions.
4. The function encrypts the message for each browser (RFC 8291), signs the request with the site's VAPID key (RFC 8292) and sends it to the browser maker's push service. Subscriptions the push service reports as gone (404 or 410) are removed with `push_prune()`.
5. The service worker (`app/public/sw.js`) shows the notification; tapping it opens the right page.

The push service (Google, Apple, Mozilla and so on) only sees encrypted bytes. The message contains the notification title, such as "New message about Kettle", and the app path.

On iPhone and iPad, Web Push only works for the site added to the Home Screen (iOS 16.4 or later). The app explains this.

## One-time setup on the live project

1. Apply `supabase/migrations/0009_features.sql` in the SQL editor. It also enables pg_net.
2. The owner signs the Supabase CLI in once: `npx supabase login` (opens the browser).
3. From `app/`: `npm run push:setup`, and answer Yes to the Supabase CLI's two confirmation prompts (set the secrets, deploy the function). It creates the VAPID key pair (kept in `~/iiitd-launch/vapid-keys.json`, mode 600, never committed or printed), stores the function secrets `PUSH_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`, deploys the function with JWT checking off, and writes `~/iiitd-launch/push-config.sql`.
4. Run `~/iiitd-launch/push-config.sql` in the SQL editor. It holds only public values: the function URL and the public key. Its last query should show `configured`, `has_key`, `secret_ready` and `pg_net_on` all true.
5. Redeploy the site. The "Turn on notifications" button appears once `push_public_key()` returns the key.

Rotating the key: delete `~/iiitd-launch/vapid-keys.json` and rerun steps 3 to 5. Every device then has to turn notifications on again, because subscriptions are tied to the key.

## Tests

- `app/test/webpush.test.mjs`: reproduces the RFC 8291 example byte for byte, decrypts a real send with an independent receiver, and verifies the VAPID token.
- `app/test/push-handler.test.mjs`: secret handling, delivery, pruning and missing configuration.
- `app/test/features-db.test.mjs`: subscription ownership and the secret-gated payload. Notifications still save when pg_net is missing.
- `npm run e2e:local`: the same database rules against the local Supabase stack.

Not tested: delivery through a real push service to a real phone, which needs the live setup above.
