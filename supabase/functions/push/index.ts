// Supabase Edge Function `push`: delivers one in-app notification to the person's phones and browsers.
// Deployed with JWT checking off (the caller is the database, authorised by a shared secret); see
// docs/push-notifications.md. Function secrets: PUSH_API_KEY (the public API key), VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY and VAPID_SUBJECT. SUPABASE_URL is provided by the platform.
import { createHandler } from './handler.ts'

Deno.serve(createHandler({ env: (name) => Deno.env.get(name), fetch }))
