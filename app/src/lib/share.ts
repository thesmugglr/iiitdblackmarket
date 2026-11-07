import type { SupabaseClient } from '@supabase/supabase-js'
import type { Reaction, ReactionEmoji } from './types.ts'

/** Full link to a listing, including any hosting sub-path. Signed-out visitors land here after sign-in. */
export const listingLink = (root: string, id: string) => new URL(`listing/${encodeURIComponent(id)}`, root).href

export const shareText = (title: string, link: string) => `${title} on The Smugglr: ${link}`
export const whatsappUrl = (title: string, link: string) => `https://wa.me/?text=${encodeURIComponent(shareText(title, link))}`
export const telegramUrl = (title: string, link: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`${title} on The Smugglr`)}`

/** Text safe to place inside a PostgREST or() filter: no separators, wildcards or quotes. */
export const searchTerm = (q: string) => q.replace(/[,()%*\\"':.]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

export interface Person { id: string; display_name: string; batch: string | null }

export async function findPeople(api: Pick<SupabaseClient, 'from'>, me: string, q: string): Promise<Person[]> {
  const term = searchTerm(q)
  if (term.length < 2) return []
  const { data, error } = await api.from('profiles').select('id,display_name,batch')
    .eq('status', 'approved').neq('id', me)
    .or(`display_name.ilike.%${term}%,email.ilike.%${term}%`)
    .order('display_name').limit(12)
  if (error) throw new Error('Could not search right now. Try again.')
  return (data ?? []) as Person[]
}

/** Sends the listing to someone inside the app; returns the chat it landed in. */
export async function sendListingTo(api: Pick<SupabaseClient, 'rpc'>, listing: string, to: string, note: string) {
  const { data, error } = await api.rpc('share_listing', { p_listing: listing, p_to: to, p_note: note.trim().slice(0, 500) })
  if (error || typeof data !== 'string') throw new Error(error?.message || 'Could not send it. Try again.')
  return data
}

/** Groups reactions per message: emoji → count, plus which one (if any) is mine. Removed reactions (null) are skipped. */
export function groupReactions(rows: Reaction[], me: string) {
  const out = new Map<string, { counts: [ReactionEmoji, number][]; mine: ReactionEmoji | null }>()
  const tally = new Map<string, Map<ReactionEmoji, number>>()
  for (const r of rows) {
    if (!r.emoji) continue
    const t = tally.get(r.message_id) ?? new Map<ReactionEmoji, number>()
    t.set(r.emoji, (t.get(r.emoji) ?? 0) + 1)
    tally.set(r.message_id, t)
    const entry = out.get(r.message_id) ?? { counts: [], mine: null }
    if (r.user_id === me) entry.mine = r.emoji
    out.set(r.message_id, entry)
  }
  for (const [id, t] of tally) out.get(id)!.counts = [...t.entries()]
  return out
}

/** Sets my reaction; choosing the one I already have removes it (stored as null so realtime sees an update). */
export async function react(api: Pick<SupabaseClient, 'from'>, row: { message_id: string; conversation_id: string; user_id: string }, emoji: ReactionEmoji, current: ReactionEmoji | null) {
  const next = current === emoji ? null : emoji
  const { error } = await api.from('message_reactions')
    .upsert({ ...row, emoji: next, updated_at: new Date().toISOString() }, { onConflict: 'message_id,user_id' })
  if (error) throw new Error('Could not save your reaction.')
  return next
}
