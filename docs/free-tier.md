# Running costs: nothing to pay (checked 2026-10-31)

**Current status:** see [current-status.md](current-status.md) for the deployed baseline, local fix branch and remaining verification. Older dated results below are historical evidence, not current access/setup blockers.


Owner constraint: the owner cannot pay for anything, so every part of production must stay on free plans. Do not add a paid service, plan, store fee or card without asking the owner first.

| Part | Plan | Evidence | Cost |
| --- | --- | --- | --- |
| Database, sign-in, photo storage, realtime | Supabase Free, one project (Mumbai) in the organization "AbhikRao's Org" | Dashboard billing page read on 2026-10-31: Free Plan, spend cap enabled, "No payment methods", no invoices | 0 |
| Website hosting | GitHub Pages from the public build-only repository | Free for public repositories | 0 |
| Keep-alive | GitHub Actions in that same public repository | Free for public repositories | 0 |
| Google sign-in | Google Cloud OAuth client, email and profile only | Needs no billing account (not re-checked in the console) | 0 |
| Address | `iiitdblackmarket.github.io` (a free GitHub organization site) | No custom domain | 0 |
| Phone notifications | Supabase Edge Function `push` plus browser push services | Free plan includes 500,000 function invocations a month; Web Push itself is free | 0 |

## What happens at the limits

The Free plan has no overage billing. Supabase's billing FAQ says that when the quota is exceeded there is a notice, then a grace period, then restrictions (pausing, read-only database, HTTP 402 on API requests) until the quota refills at the next monthly reset. Nobody is charged unless the organization is upgraded, and with no card on file nothing could be charged anyway. The risk is therefore an outage, not a bill.

Free-plan quotas to watch (confirm on supabase.com/pricing): 500 MB database, 1 GB file storage, 5 GB egress a month, 50,000 monthly active users; a project with no requests for about a week is paused.

## What the code does to stay inside them

- **Keep-alive.** `keepalive.yml` in the public repository pings the backend twice a week, and adds an empty commit when the repository has been quiet for 30 days. GitHub switches off scheduled workflows in a public repository after 60 days without a commit, which would otherwise let the project pause during a long break.
- **Photos.** Uploads are re-encoded to at most 1280 px (JPEG 0.8) plus a 480 px thumbnail for grids, previews, the home page and bundles. In a real browser test on one synthetic photo the full copy was 34% smaller than before (129 KB against 194 KB) and the thumbnail was 33 KB. Chat photos get no thumbnail.
- **Reused links.** Signed listing-photo links are batched into one request, reused for up to 23 hours and kept in browser local storage for the confirmed approved account. Account changes, observed approval loss, failed membership refresh and sign-out clear the cache and discard late signing replies; same-account refresh/reload can reuse it. Legacy unscoped links are discarded on the next app load. A request-level signing failure is retried on a later request rather than cached as a missing object. Already-issued URLs retain their existing expiry; this does not revoke tokens or measure hosted bandwidth. Chat links remain uncached with a one-hour expiry.
- **Discovery summary.** The Hero fetches only the three listings it displays. Category totals use eight exact HEAD counts instead of downloading 200 full listing rows to sample them. This uses more small requests per refresh, with no listing-body payload for the counts; no quota/billing claim is inferred from this source change.
- **Discovery pages.** Each grid request fetches at most 61 rows: 60 displayed listings plus one lookahead. Additional requests happen through Load more; loaded cards are retained in browser memory. Refresh restarts the grid query and category/featured summary. These pages reflect changing data rather than a database snapshot; no hosted quota/performance result is claimed.
- **Storage hygiene.** Owner listing deletion now requires the actual deleted row before cleaning its current photo list and thumbnails. Cleanup is awaited; a failure stays visible with a retry instead of silently navigating away. Removing a photo or leaving the form with unsaved uploads also attempts file/thumbnail cleanup. Photos of listings an admin deletes for someone else, and of expired listings, stay (storage rules only let owners delete). Leaving the cleanup retry page after a failure can still leave files for later trusted cleanup.
- **Chat retries.** Within one mounted chat, photo retries reuse the prepared file/path/message ID. Lost upload responses are checked against the exact stored bytes, and confirmed uploads are not repeated when only message linkage needs retry. No uncertain object is deleted because its message may already have committed. Leaving or reloading before linkage can still leave an unlinked object for trusted cleanup; no automatic purge is implemented.
- **Editor save protection.** Photos included in a listing save are protected before the request starts. Removal/unmount cleanup skips them because a lost reply can follow a committed listing. Creation retries reuse one ID and confirm the original request before applying newer edits. Confirmed saves await cleanup of eligible dropped photos and expose failures for retry. Protected photos no longer linked after later edits, and late/uncertain uploads, can still need trusted cleanup; no automatic purge is claimed.

## What would cost money (none of it is used)

Google Play developer account (US$25 once), Apple Developer Program (US$99 a year), a custom domain, Supabase Pro (US$25 a month), Google's Android developer verification fee for full distribution (US$25 once). See [mobile-app.md](mobile-app.md).

## Open items

Google Cloud billing was not re-checked in the console. Storage and bandwidth use are not monitored yet. [The storage operations runbook](storage-operations.md) now supplies a trusted-admin, read-only inventory of both app buckets, known/unknown metadata sizes, missing references and old unlinked review candidates. It preserves all listing/message references, including expired/removed listings; it does not delete files or establish safe retention. The organization Usage page remains necessary for the project's current period, quotas, egress and billing status. Actual hosted totals, automatic monitoring/alerts, real-photo size measurements and any trusted cleanup remain pending. Do not purge referenced expired-listing photos: renewal can use them.
