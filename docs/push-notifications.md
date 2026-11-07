# Phone and browser notifications (Web Push)

Status on 2026-11-06: **set up on the live project.** Migration 0009 is applied, the `push` function is deployed with its secrets, the public settings are in `push_config`, and a live check (the database calling the function with its own secret) got `{"sent":0,"removed":0}` with status 200. The owner subsequently confirmed Android delivery on 7 November as recorded below.

Everything here is free: Web Push is a browser standard, Supabase Edge Functions include 500,000 invocations a month on the free plan, and pg_net is a built-in Postgres extension.

## Current fix and Android incident (7 November 2026)

The user allowed notifications in an installed Android app and saw the website bell update, but received no phone alert. This proves the in-app path worked for that event; the exact production delivery failure is still unconfirmed. Read-only aggregate checks found a registered Firebase endpoint and a provider-accepted send close in time to a chat notification. On 7 November, the owner confirmed that a fresh chat message displayed an alert on the installed Android app after closing it.

Migration 0010 and the accompanying client/function changes were deployed on **7 November 2026** from merged PR #40 (`0af7b1e`, Pages `06494ef`). The public bundle and worker match the tested build. The client checks the exact subscription for the current approved account and current VAPID key before showing On. Repair notifications reuses or replaces the browser subscription and confirms its server registration. Worker startup is awaited for up to five seconds; permission is requested directly from the user's tap. Installing on a new origin requires enabling notifications there again.

Grouped unread notices now refresh on later events. A leading-edge 15-second per-row burst limit bounds push requests; it does not promise one delivery per message or a trailing summary. Reading a visible chat at its end acknowledges only loaded message IDs; the bell stays unread if other incoming messages remain unseen. The realtime client observes both inserts and updates. Background loading is not a read receipt.

Phone display is handled by the service worker. The old hidden-tab `new Notification()` fallback was removed because it can fail on mobile and race server push into duplicate alerts.

### Diagnosing delivery without disclosing secrets

Check stages independently: device permission and active worker; exact current-account subscription registration; notification creation/refresh; pg_net dispatch; Edge Function invocation; provider response; physical-device display. Record counts and status categories only, never endpoints, keys, secrets or chat contents.

The function reports `attempted`, `sent`, `removed`, `failed`, `failures`, `pruneFailed` and `status` (a deleted notification has only the basic counters/status). `sent` means provider acceptance, not a visible alert. Zero recipients is `no_subscriptions`; rejected sends or failed pruning return HTTP 502. Only 404/410 subscriptions are pruned. Authentication errors, rate limits and network/provider errors retain the subscription. There is no automatic durable retry queue; failed events need diagnosis, not blind whole-batch replay that could duplicate successful deliveries.

Test on an explicitly opted-in Android device in foreground, background and closed-app states. Verify account switching, denied/re-enabled permission and the new origin. OS notification settings can still suppress display even after provider acceptance.

### Rollout

Apply missing migrations in order through 0010, deploy the revised `push` function, then deploy the client/worker. Keep the same VAPID key pair. Old clients retain their legacy `mark_read` RPC; new clients require 0010's `mark_conversation_seen` and `push_subscription_registered`. Do not claim this rollout completed until hosted state and actual device delivery are checked.

## How it works

1. On the profile or notifications page, a student taps **Turn on notifications**. The browser asks for permission and creates a push subscription for this site's public VAPID key (`app/src/lib/push.ts`). The app stores it with `save_push_subscription()`.
2. Whenever a row is added to or refreshed in `notifications` (after migration 0010) (new message or offer, price drop or sale of a saved item, lost & found reply, expiry reminder, approval request), the trigger `send_push` asks the database to call the `push` Edge Function with the notification id, through pg_net. This does not delay or block the notification itself.
3. The function (`supabase/functions/push`) hands the id and the request's secret header to `push_payload()`. The database checks the secret, which it generated itself and never leaves except in that header, and returns the title, the link and the person's subscriptions.
4. The function encrypts the message for each browser (RFC 8291), signs the request with the site's VAPID key (RFC 8292) and sends it to the browser maker's push service. Subscriptions the push service reports as gone (404 or 410) are removed with `push_prune()`.
5. The service worker (`app/public/sw.js`) shows the notification; tapping it opens the right page.

The push service (Google, Apple, Mozilla and so on) only sees encrypted bytes. The message contains the notification title, such as "New message about Kettle", and the app path.

On iPhone and iPad, Web Push only works for the site added to the Home Screen (iOS 16.4 or later). The app explains this.

## One-time setup on the live project

1. Apply missing migrations in order, including `0009_features.sql` and `0010_notification_delivery.sql`. Migration 0009 enables pg_net.
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

Android closed-app delivery was confirmed by the owner on 7 November. iOS device delivery remains untested.
