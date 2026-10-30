import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const demo = import.meta.env.DEV && import.meta.env.VITE_DEMO === '1'
const demoClient = demo ? (await import('./demo')).demoClient : undefined
export const demoMode = demo

export const isConfigured = demo || Boolean(url && key)
export const supabase: SupabaseClient = demo
  ? (demoClient as unknown as SupabaseClient)
  : createClient(url ?? 'http://localhost', key ?? 'missing')
