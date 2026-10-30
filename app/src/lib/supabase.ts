import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readClientConfig } from './config'

const config = readClientConfig(import.meta.env, import.meta.env.DEV)
const demo = import.meta.env.DEV && import.meta.env.VITE_DEMO === '1'
const demoClient = demo ? (await import('./demo')).demoClient : undefined
export const demoMode = demo

export const isConfigured = demo || config.configured
export const supabase: SupabaseClient = demo
  ? (demoClient as unknown as SupabaseClient)
  : createClient(config.configured ? config.url : 'http://localhost', config.configured ? config.key : 'missing')
