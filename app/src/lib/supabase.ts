import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readClientConfig } from './config'

// Read each variable by name: passing the whole `import.meta.env` object would make Vite embed every VITE_ value
// from every env file (including unrelated local ones) into the public bundle.
const config = readClientConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
}, import.meta.env.DEV)
const demo = import.meta.env.DEV && import.meta.env.VITE_DEMO === '1'
const demoClient = demo ? (await import('./demo')).demoClient : undefined
export const demoMode = demo

export const isConfigured = demo || config.configured
export const supabase: SupabaseClient = demo
  ? (demoClient as unknown as SupabaseClient)
  : createClient(config.configured ? config.url : 'http://localhost', config.configured ? config.key : 'missing')
