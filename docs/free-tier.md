# Running costs: nothing to pay (checked 2026-10-31)

Owner constraint: the owner cannot pay for anything, so every part of production must stay on free plans. Do not add a paid service, plan, store fee or card without asking the owner first.

| Part | Plan | Evidence | Cost |
| --- | --- | --- | --- |
| Database, sign-in, photo storage, realtime | Supabase Free, one project (Mumbai) in the organization "AbhikRao's Org" | Dashboard billing page read on 2026-10-31: Free Plan, spend cap enabled, "No payment methods", no invoices | 0 |
| Website hosting | GitHub Pages from the public build-only repository | Free for public repositories | 0 |
| Keep-alive | GitHub Actions in that same public repository | Free for public repositories | 0 |
| Google sign-in | Google Cloud OAuth client, email and profile only | Needs no billing account (not re-checked in the console) | 0 |
| Address | `abhikrao.github.io/iiitd-black-market` | No custom domain | 0 |

## What happens at the limits

The Free plan has no overage billing. Supabase's billing FAQ says that when the quota is exceeded there is a notice, then a grace period, then restrictions (pausing, read-only database, HTTP 402 on API requests) until the quota refills at the next monthly reset. Nobody is charged unless the organization is upgraded, and with no card on file nothing could be charged anyway. The risk is therefore an outage, not a bill.

Free-plan quotas to watch (confirm on supabase.com/pricing): 500 MB database, 1 GB file storage, 5 GB egress a month, 50,000 monthly active users; a project with no requests for about a week is paused.

## What the code does to stay inside them

- **Keep-alive.** `keepalive.yml` in the public repository pings the backend twice a week, and adds an empty commit when the repository has been quiet for 30 days. GitHub switches off scheduled workflows in a public repository after 60 days without a commit, which would otherwise let the project pause during a long break.
- **Photos.** Uploads are re-encoded to at most 1280 px (JPEG 0.8) plus a 480 px thumbnail for grids, previews, the home page and bundles. In a real browser test on one synthetic photo the full copy was 34% smaller than before (129 KB against 194 KB) and the thumbnail was 33 KB. Chat photos get no thumbnail.
- **Reused links.** Signed photo links are batched into one request, reused for up to 23 hours and kept in the browser's local storage (wiped on sign-out), so the browser keeps using the picture it already has instead of downloading it again.
- **Storage hygiene.** Owner listing deletion now requires the actual deleted row before cleaning its current photo list and thumbnails. Cleanup is awaited; a failure stays visible with a retry instead of silently navigating away. Removing a photo or leaving the form with unsaved uploads also attempts file/thumbnail cleanup. Photos of listings an admin deletes for someone else, and of expired listings, stay (storage rules only let owners delete). Leaving the cleanup retry page after a failure can still leave files for later trusted cleanup.

## What would cost money (none of it is used)

Google Play developer account (US$25 once), Apple Developer Program (US$99 a year), a custom domain, Supabase Pro (US$25 a month), Google's Android developer verification fee for full distribution (US$25 once). See [mobile-app.md](mobile-app.md).

## Open items

Google Cloud billing was not re-checked in the console. Storage and bandwidth use are not monitored yet: look at the organization's Usage page in the Supabase dashboard from time to time, and reduce photo sizes further or purge old photos if either quota gets close.
