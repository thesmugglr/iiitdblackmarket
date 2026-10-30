# Backend modules

Add `auth/`, `listings/`, `chat/`, and `moderation/` modules when their tasks begin. Each module should own route registration, request validation, business logic, and related tests. Only `/api/health` is currently registered.

Before exposing marketplace routes, enforce institute identity plus current-student eligibility and database ownership/participant policies. Keep server secrets here, never in the web workspace or shared package. Do not add allow-all CORS as a substitute for the same-origin proxy.
