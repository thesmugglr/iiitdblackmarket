# Amber Market — isolated design concept

Owner: Codex, task DESIGN-04. Requested separately by Garv while Abhik owns the canonical website design. This standalone preview deliberately keeps its files, lockfile, dependencies, and CSS out of `app/`. It is a visual proposal, not a second production app or a change to real account/data access.

Use Node.js 24. From this directory run `npm ci`, then `npm run dev` (port 5180). `npm run build` creates `dist/`. `npm run typecheck` checks the concept.

React + TypeScript + Tailwind CSS + Framer Motion. Twelve illustrative listings; sample sellers/ratings/quotes are labelled. Search, categories, sort/filter, saved items, details, and preview listing creation operate on session-only fixtures. No real sign-in, messages, listings, or email subscriptions are sent. Production integration is a separate coordinated task after design review.

The source is modular so individual components/tokens can be integrated into Abhik's UI after agreement. Do not merge this as a replacement for `app/`. Verification and asset provenance will be recorded here when complete.
