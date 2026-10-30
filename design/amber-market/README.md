# Amber Market — isolated design concept

Owner: Codex, task DESIGN-04. Requested separately by Garv while Abhik owns the canonical website design. This standalone preview deliberately keeps its files, lockfile, dependencies, and CSS out of `app/`. It is a visual proposal, not a second production app or a change to real account/data access.

Use Node.js 24. From this directory run `npm ci`, then `npm run dev` (port 5180). `npm run build` creates `dist/`. `npm run typecheck` checks the concept.

React + TypeScript + Tailwind CSS + Framer Motion. Twelve illustrative listings; sample sellers/ratings/quotes are labelled. Search, categories, sort/filter, saved items, details, and preview listing creation operate on session-only fixtures. No real sign-in, messages, listings, or email subscriptions are sent. Production integration is a separate coordinated task after design review.

The source is modular so individual components/tokens can be integrated into Abhik's UI after agreement. Do not merge this as a replacement for `app/`. [PR #11](https://github.com/garvrao80/iiitdblackmarket/pull/11) holds this proposal; the separate Amber concept workflow builds it only when its own files change.

## Component map

- `src/AmberMarketplace.tsx`: navigation, local state, filtering, and overlays.
- `src/components/Hero.tsx`: opening collage and search.
- `src/components/ListingCard.tsx`: reusable listing presentation.
- `src/components/StorySections.tsx`: how it works, community, CTA, and footer.
- `src/components/PreviewForms.tsx`: local listing creation and access explanation.
- `src/components/Primitives.tsx`: motion/reduced-motion handling and native accessible dialogs.
- `src/theme.css`: isolated CSS variables and Tailwind-powered theme.
- `src/data.ts`: twelve illustrative fixtures; no Supabase client or credentials.

## Verification (2026-10-31)

Clean `npm ci` and `npm run build` pass with Node 24. Browser checks on the production bundle at 1440px, 390px, and 320px found no horizontal page overflow, broken loaded images, or console errors. Manually checked search, category filtering, price cap/sorting, save/detail views, empty states, preview creation, mobile navigation, and truthful subscription/access states. Escape dismisses native dialogs and restores focus to the trigger. Reduced-motion preferences disable transitions and reveal movement in code. Selected text/background contrast pairs are 5.82:1 or higher; this is not a full accessibility audit.

The untouched canonical `app/` also passes all 30 tests, build, and lint (existing lint/chunk-size warnings). Real OAuth, student access checks, messaging, and cloud behavior are not exercised by this concept. No integration into `app/` is performed.

Photo upload preview stays on-device using a temporary object URL, with JPEG/PNG/WebP and 5 MB client-side checks. Refreshing clears sample creations and saved items. The newsletter field never transmits or stores addresses. Asset provenance and font licenses are recorded in [ASSETS.md](ASSETS.md).
