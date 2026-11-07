# Current implementation and verification

Updated 7 November 2026. Use this page for the latest source/verification split; dated entries in changelog.md and pr-review-log.md retain historical evidence.

## Deployed baseline (reported and previously checked)

- Private source: `garvrao80/iiitdblackmarket`. Public static output: `iiitdblackmarket/iiitdblackmarket.github.io`.
- Site: https://iiitdblackmarket.github.io/ . The former personal Pages address redirects, retaining paths, query and hash.
- Supabase project `mkepigiktixxrowsteje`, Mumbai, Free. The new Site URL is saved; redirects retain both site addresses and local development.
- Google OAuth is in production. The client callback remains `https://mkepigiktixxrowsteje.supabase.co/auth/v1/callback`. Both GitHub Pages domains are authorized. Branding homepage/privacy/terms still use the former address: the requested edits were discarded when the existing branding-verification banner was observed. No verification submission was made.
- Migration 0009, the push function and public push configuration were reported applied on 6 November. The recorded HTTP 200 result with zero recipients establishes a backend handshake, not phone delivery.
- Admin setup was reported completed and checked for the designated owners. Do not infer current permissions from historical rows in the task board without checking the selected account.

## Fix rollout completed on 7 November 2026

PR #40 merged at `0af7b1e` after 531 unit/database tests, 49 disposable Supabase service scenarios and browser send/scroll checks at 390×844 and 1280×800 passed. A 390×400 viewport check also passed. Production migration 0010 was then applied transactionally, the push Edge Function deployed, and Pages build `06494ef` published source `0af7b1e`. Live HTML, JavaScript, CSS, service worker and privacy bytes matched the build. Trusted read-back confirmed both new RPCs and member-only conversation acknowledgement. A nonexistent-notification probe returned HTTP 200 with `no_notification`, confirming the revised handler without sending a phone alert.

The user reports an installed Android app with notification permission granted: the bell works, but no phone alert appeared. The exact failed production stage is not yet established. An aggregate production query found a registered Firebase endpoint for the reporting account. A recent provider acceptance coincided with a chat notice. The retained response has no device identifier or display receipt.

Confirmed local defects addressed:

- Grouped unread notifications previously stopped later message events. The row now refreshes; pushes are dispatched for insert/refresh with a 15-second leading-edge burst limit.
- Reading visible chat messages clears only their read receipts and clears the grouped bell entry only when no unseen incoming messages remain. Background loading does not mark them read.
- Browser subscription alone no longer means notifications are on. Exact backend registration for the current account and VAPID key is confirmed; errors offer repair.
- Push delivery reports attempted, accepted, expired and failed counts/categories. Failed deliveries do not masquerade as an HTTP 200 zero-send handshake. Transient failures are retained, not pruned; there is no durable delivery/retry queue in this patch.
- Conversation routes get a bounded viewport and message-list-only scrolling, with a visible composer and retained reading position. Automated Chromium send/scroll/viewport checks passed. Physical keyboard and device delivery remain to be checked.

## Remaining acceptance

- Real Android push with an opted-in account: foreground, background and closed app; record provider acceptance separately from observed device display. Repeat after old/new-origin installation and sign-out/account changes.
- Phone keyboard, orientation, short-height chat, long messages, image loading, incoming messages while reading history, and offer controls.
- Separate-account hosted access isolation and the newly deployed features, where no dated live result exists.
- Enrollment ownership and graduated/withdrawn account handling; code refresh adds entries, it does not revoke old access.
- Storage/egress monitoring and an explicit retention policy. The read-only storage audit currently omits lost & found references; its candidates must never be used as deletion instructions.

## Ownership and constraints

Abhik owns design/UI; Garv/Codex handle engineering. The owner requested these functional chat layout fixes directly. Keep the design style, free-only hosting and existing access rules. Keep secrets, subscription keys/endpoints, student lists and private chats out of public logs and docs.
