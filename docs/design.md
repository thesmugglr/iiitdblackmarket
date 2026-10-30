# Dark campus design

The owner selected **dark tech — black, electric green, crisp cards** on 31 October 2026.

## Contribution boundary

This design builds directly on AbhikRao's `feat/mvp-app` / PR #3 (`8e7d363`). The public page is in `app/src/features/landing/`, mounted by the existing Login page. Google OAuth continues to use the existing Supabase client, redirect, and institute-domain hint. The existing approval gate, data queries, chat logic, and database migration are preserved.

The original scaffold-based design draft PR #2 is superseded. The new design branch is `feat/DESIGN-01-mvp-theme`; review and merge PR #3 first, then retarget this design PR to main if GitHub does not do so automatically. Do not merge PR #1 and PR #3 blindly: they introduce different frontend directory structures. This PR does not decide that integration or change either contributor's branch.

## Tokens and typography

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0b0d0b` | Page background |
| `--card` / `--surface` | `#131613` | Cards, forms, dialogs |
| `--fg` / `--text` | `#f2f2ed` | Main text |
| `--muted` | `#a2a89d` | Supporting copy |
| `--accent` | `#c0fa51` | Primary actions, prices, selected states |
| `--line` / `--border` | `#2b302a` | Subtle divisions |
| `--danger` | `#ff9e93` | Error text |

Self-hosted Space Grotesk regular and bold keep fonts consistent without third-party font requests. License is included under `app/public/fonts/OFL-Space-Grotesk.txt`; source is Google Fonts' Space Grotesk family. Headlines are bold, compact, and oversized. Supporting copy is restrained. Use dark text on lime surfaces, including buttons, unread badges, and sent chat bubbles. Do not use white text on lime.

The global theme is in `app/src/index.css`. Presentation-specific rules are scoped under `.landing-page` in `features/landing/landing.css` using native CSS nesting, so homepage typography does not change feature-screen heading sizes. Target modern browsers supported by the Vite app. Do not copy the entire landing stylesheet into a feature screen.

## Component and interaction rules

- Use the shared stroke icon component in `src/components/Icon.tsx`; it follows current text color and hides decorative SVGs from assistive technology.
- Use 4–8px radii, deliberate whitespace, thin borders, and limited hover movement. Preserve keyboard focus rings and reduced-motion rules.
- Responsive category grids use six columns on desktop, three on tablet, two on phones. Category buttons change explanatory content; they are not public listing queries.
- Public illustrations must not appear to be actual inventory, seller identities, ratings, or transaction counts.
- Campus access opens a native dialog. With configuration present, the Google button calls the existing OAuth flow; without it, show an honest unavailable message. Never fake a session or bypass approval for previews.
- The dialog supports Escape, native focus containment/return, a labelled close control, and backdrop dismissal. Mobile navigation closes after selecting a section.
- Listing queries, offer behavior, and authorization stay with the feature owner. Coordinate before changing them.

## Original artwork

Project asset: `app/public/images/campus-gear.png` (about 2.3 MB). Generated with the built-in imagegen tool, not an external product photo. It is decorative editorial artwork and does not represent available listings. SVG brand marks and icons are code-native. Consider an optimized WebP/AVIF derivative during the performance pass; preserve the source.

Generation prompt:

> Use case: product-mockup. Asset type: editorial homepage artwork for a student secondhand marketplace with a dark-tech black/electric-green aesthetic. Create one premium photorealistic 3D studio still-life, landscape 4:3 composition, no text or UI. A silver and matte-black over-ear headphone pair dominates the upper middle, a compact brushed-silver digital camera lower left, a lime-green game controller lower right, two closed worn charcoal textbooks at back right with blank spines. Objects are artfully suspended just above stacked dark graphite rectangular plinths with believable subtle shadows, slightly angled, all fully in frame with generous 10 percent margins. Near-black charcoal backdrop and floor, very subtle fine grain, small deliberate electric lime-green rim light from right, soft large neutral studio key light, excellent material texture, cinematic but crisp editorial product photography, muted metallic highlights, balanced asymmetry. No logos, brands, letters, words, numbers, watermarks, people, gradients as graphic backgrounds, or excessive neon glow. This is decorative original artwork, not a real listing photo. Output must be a saved local image asset suitable to copy into a website.

## Verification and handoff

- `npm ci`: passed, lockfile unchanged.
- `npm run build`: TypeScript and production bundle passed. Vite reports a bundle-size warning for the combined app; code splitting remains a separate performance task.
- `npm run lint`: no errors; five existing warnings in auth, ListingCard, Browse, Admin, and Chat.
- Public page checked in browser at desktop and phone widths; tested category selection, mobile menu/section navigation, FAQ expansion, access dialog, Escape-to-close, and focus return. No horizontal page overflow at 390px.
- Authenticated screens receive shared theme styles, but rendering with actual listings/chat and live Google sign-in were not exercised. No real Supabase credentials are available in this checkout. QA-01 remains required; no security or backend verification is implied by the visual work.
