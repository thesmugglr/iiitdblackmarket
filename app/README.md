# Marketplace application

React/TypeScript/Vite frontend. Supabase supplies Auth, PostgreSQL, Storage, and Realtime; migrations live in `../supabase/migrations/`. Abhik owns the UI. Garv Rao/Codex own backend integration, tests, configuration, and CI.

Use Node.js 24:

```sh
npm ci
npm test
npm run build
npm run lint
npm run dev
```

For real sign-in, copy `.env.example` to `.env.local`, set the Supabase project URL and browser-safe publishable key, then run `npm run check:config -- development`. Legacy `VITE_SUPABASE_ANON_KEY` is also supported. The hosted check is `npm run check:config`; it deliberately fails for missing/example credentials and local HTTP endpoints. It does not verify remote services. Never put server secrets in `VITE_` variables.

For UI-only work, `VITE_DEMO=1` on the dev server uses labelled fictional in-memory data. It cannot verify real access controls and is excluded from production bundles. Disable it for live tests.

- [Backend setup and deployment preparation](../docs/backend-setup.md)
- [Live QA record](../docs/live-qa.md)
- [Shared contribution guide](../CONTRIBUTING.md)
- [Task board](../TODO.md)

`npm test` runs local PGlite access tests, configuration tests, and a Vite secret-rejection check. Auth/storage fixture schemas simulate platform behavior; live OAuth, actual file transfers, realtime, and concurrent sessions still need QA. Tests do not use or print production credentials.
