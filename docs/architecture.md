# Application foundation

## Workspace boundaries

| Location | Owns | Current behavior |
| --- | --- | --- |
| `apps/web` | Browser UI and API client | Responsive development starter; checks API health. |
| `apps/api` | HTTP routes and future server business logic | Fastify liveness endpoint and graceful shutdown. |
| `packages/shared` | Public type-only API contracts | `HealthResponse`, consumed by both apps. |
| `supabase` | Future database migrations and storage policies | Documentation and reserved migration directory only. |
| `.github` | Shared CI and PR structure | Install, typecheck, test, build, and whitespace checks. |

The website uses React/Vite; the backend uses Fastify. npm workspaces keep dependency installation and commands in one repository without requiring a separate build orchestrator. Shared contracts are type-only; use `import type`, never put credentials or server implementation there. Runtime validation must be added alongside future input-bearing endpoints: TypeScript contracts do not validate HTTP payloads.

## Local request flow

```text
Browser :5173 → Vite dev server
                  /api/* → Fastify :3001
                              GET /api/health → { status: "ok", service: "iiitd-api" }
```

The relative `/api` client URL keeps browser traffic same-origin. `API_PROXY_TARGET` changes the local proxy destination. The API does not enable cross-origin access. Its public health route only reports process liveness; it does not test database readiness or establish an authenticated session. Unknown routes return 404. There are no listing, sign-in, or chat data endpoints yet.

The API reads `apps/api/.env` when present (in both source and compiled execution). Environment variables already supplied by the process take precedence. Host defaults to loopback; port defaults to 3001 and must be an integer from 1 to 65535. The website's optional `.env` is read by Vite. Never use `VITE_` variables for secrets.

## Next implementation boundaries

- UI feature work belongs under `apps/web/src/features`; shared UI can use `src/components` when needed.
- API feature work belongs under `apps/api/src/modules`; keep route validation, logic, and tests together by feature.
- Agree on schema and contract changes before parallel contributions. Add migrations and policies before exposing private data.
- Supabase is proposed for auth/database/storage/realtime but not integrated or installed. Decide student eligibility, project ownership, and credentials during PLAN-02/SETUP-02/AUTH-01.
- Verify authentication and student eligibility server-side. Database policies must enforce ownership and conversation participants even when data is accessed through Supabase clients.

## Build and deployment boundary

`npm run build` emits static website assets to `apps/web/dist` and runnable Node API output to `apps/api/dist`. The shared package exports only types, so it has no runtime output. The compiled API is started with `npm run start --workspace @iiitd/api`.

The local Vite proxy is not included in production assets. A future deployment must serve the website and route `/api/*` to the Node API using a reverse proxy or hosting rewrite, or deliberately introduce a configured public API origin and restricted CORS. Serving `apps/web/dist` alone will not provide a backend. Production hosting, secrets, TLS, database connections, and deployment automation remain SETUP-02/DEPLOY-01 work. Do not treat this as deploy-ready.

## Verification boundary

Two API tests cover credential-free liveness and unregistered private routes. Type checks cover web/API/shared code and API tests. The scaffold was built and HTTP-smoke-tested locally, including the Vite-to-Fastify proxy. Browser rendering, sign-in, database policies, uploads, and multi-user messaging are not verified because those flows are not implemented. CI runs the repository checks on Linux with Node 24; inspect remote results on each PR.
