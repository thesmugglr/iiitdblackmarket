# Hosting the site under the "IIITD Black Market" name

Written 2026-11-06 after the owner asked what the options are. The site is at `abhikrao.github.io/iiitd-black-market` today, which works but carries a personal name. Everything must stay free (see [free-tier.md](free-tier.md)).

## Options

| # | Address | Cost | What it takes | Notes |
| --- | --- | --- | --- | --- |
| 1 | `iiitdblackmarket.github.io` (a free GitHub organization named `iiitdblackmarket` with a public build-only repo called `iiitdblackmarket.github.io`) | Free | Create the organization in the GitHub web UI (an account-level step for the owner), add the repo, point `npm run deploy:pages` at it, update the sign-in settings below | Same pipeline as today. The names `iiitdblackmarket`, `iiitd-black-market` and `iiitdmarket` are unused on GitHub (checked 2026-11-06). The site then lives at the root `/`, which also makes the base path simpler. GitHub Pages limits: about 100 GB a month of bandwidth, 1 GB site size. |
| 2 | `iiitdblackmarket.pages.dev` (Cloudflare Pages) | Free | A free Cloudflare account; deploy the built `dist/` with Wrangler or connect the repo | Unlimited bandwidth on static files, 500 builds a month, 20,000 files and 25 MiB per file. The name looks unused (no DNS record on 2026-11-06). A second service to keep an eye on. |
| 3 | `blackmarket.iiitd.ac.in` (an institute subdomain) | Free | Ask IIIT-Delhi IT for the subdomain and a CNAME to the free host above | The only option that looks official, and it would probably build trust. It needs the institute's approval, and the "not affiliated with IIIT-Delhi" wording would have to change with it. |
| 4 | A real domain such as `iiitdblackmarket.in` or `.com` | Paid: roughly 700 to 1,500 rupees a year | Buy and point it at option 1 or 2 | Not allowed by the owner's free-only rule. GitHub's Student Developer Pack gives a free `.me` domain for the first year only; renewals cost money, so the site would stop working under that name unless someone pays. |
| 5 | Netlify, Vercel, Firebase, Render, Surge, GitLab Pages | Free | A new account on each | No advantage over options 1 and 2; several of these hosts answer DNS for any name, so availability can only be checked by creating the project. |

## Recommendation

Option 1 now (free, same tooling, name available), and option 3 as an upgrade if IIIT-Delhi agrees. Option 2 is the fallback if GitHub Pages bandwidth ever becomes a problem.

## What changes when the address changes

The address is the site's identity, so moving it touches several places. Plan to do them together:

1. **Supabase** (Authentication, URL configuration): add the new site URL to the Site URL and redirect allow-list; keep the old one until the move is finished.
2. **Google Cloud** (Google Auth Platform, Branding): change the home page, privacy policy, terms and authorized domain to the new address. Sign-in redirects go through Supabase's callback, so the OAuth client itself does not change.
3. **Deploy script and build:** target the new repository; `VITE_BASE` becomes `/` (option 1 or 2) and the privacy and terms links in the app follow it.
4. **The old address:** leave a small redirect page in the old repository so existing links, bookmarks and the shared URL keep working.
5. **People:** the new address is a different origin, so everyone signs in again, saved browser data is not carried over, and anyone who installed the app to their home screen installs it again.

Updating the docs, README, privacy page and terms with the new URL is part of the move.
