import type { SupabaseClient } from '@supabase/supabase-js'
import type { Listing, Profile } from './types'

type ProfileApi = Pick<SupabaseClient, 'from'>
type SavedProfile = Pick<Profile, 'id' | 'display_name' | 'batch'>
export interface Deal { id: string; amount_inr: number; listing: { title: string } | null }
export interface ProfileDashboard {
  mine: Listing[]
  deals: Deal[]
  loading: boolean
  error: string
}

export const emptyDashboard = (): ProfileDashboard => ({ mine: [], deals: [], loading: true, error: '' })

export async function saveProfile(api: ProfileApi, id: string, name: string, batch: string): Promise<SavedProfile> {
  const fields = { display_name: name.trim(), batch: batch.trim() || null }
  if (!fields.display_name) throw new Error('Enter a display name before saving.')
  const result = await api.from('profiles').update(fields).eq('id', id).select('id,display_name,batch').single()
  // UPDATE can succeed with no affected row under RLS. Select only public
  // editable fields; email remains accessible through my_profile, not SELECT.
  if (result.error || result.data?.id !== id || result.data?.display_name !== fields.display_name || result.data?.batch !== fields.batch) {
    throw new Error('Could not confirm the profile save. Your entries are retained; please try again.')
  }
  return result.data as SavedProfile
}

export async function loadProfileDashboard(api: ProfileApi, id: string) {
  const [mine, deals] = await Promise.all([
    api.from('listings').select('*').eq('seller_id', id).neq('status', 'removed').order('created_at', { ascending: false }),
    // Administrators can read all offers for moderation. Their personal page
    // must still show only conversations in which they are buyer or seller.
    api.from('offers').select('id,amount_inr,listing:listings(title),conversation:conversations!inner(buyer_id,seller_id)')
      .eq('status', 'accepted').or(`buyer_id.eq.${id},seller_id.eq.${id}`, { referencedTable: 'conversation' }),
  ])
  if (mine.error || deals.error || !mine.data || !deals.data) throw new Error('Dashboard query failed')
  return { mine: mine.data as Listing[], deals: deals.data as unknown as Deal[] }
}

// One attempt belongs to one mounted account. Disposed attempts cannot replace
// the next account or a retried result, including with a late error.
export function observeProfileDashboard(load: () => ReturnType<typeof loadProfileDashboard>, publish: (state: ProfileDashboard) => void) {
  let active = true
  publish(emptyDashboard())
  void (async () => {
    try {
      const data = await load()
      if (active) publish({ ...data, loading: false, error: '' })
    } catch {
      if (active) publish({ mine: [], deals: [], loading: false, error: 'Could not load your listings and completed deals. Please try again.' })
    }
  })()
  return () => { active = false }
}
