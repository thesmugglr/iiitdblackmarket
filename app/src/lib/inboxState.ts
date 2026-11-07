import type { SupabaseClient } from '@supabase/supabase-js'
import type { Conversation } from './types'

interface InboxData { conversations: Conversation[]; unread: Record<string, number> }
export interface InboxSnapshot { conversations: Conversation[] | null; unread: Record<string, number>; loading: boolean; error: string }
export const emptyInbox = (): InboxSnapshot => ({ conversations: null, unread: {}, loading: true, error: '' })

export async function loadInbox(api: Pick<SupabaseClient, 'from' | 'rpc'>, member: string): Promise<InboxData> {
  if (!member) throw new Error('Missing Inbox member')
  const [conversations, counts] = await Promise.all([
    // Admins have broader moderation reads. Inbox is still a personal view.
    api.from('conversations')
      .select('id,listing_id,buyer_id,seller_id,created_at,kind,request_status, listing:listings(title,photos,status), buyer:profiles!conversations_buyer_id_fkey(display_name), seller:profiles!conversations_seller_id_fkey(display_name), last:messages(body,image_path,sender_id,created_at)')
      .or(`buyer_id.eq.${member},seller_id.eq.${member}`).order('created_at', { ascending: false })
      // Only the newest message per chat, for the preview line.
      .order('created_at', { referencedTable: 'last', ascending: false }).limit(1, { referencedTable: 'last' }),
    api.rpc('unread_counts'),
  ])
  if (conversations.error || counts.error || !Array.isArray(conversations.data) || !Array.isArray(counts.data)) throw new Error('Inbox query failed')
  const rows = conversations.data as unknown as Conversation[]
  if (rows.some(c => !c || !c.id || (c.buyer_id !== member && c.seller_id !== member))) throw new Error('Inbox participant mismatch')
  const ids = new Set(rows.map(c => c.id)), unread: Record<string, number> = {}
  for (const row of counts.data as { conversation_id: string; unread: string | number }[]) {
    if (!row || !ids.has(row.conversation_id)) continue
    const count = Number(row.unread)
    if (!['number', 'string'].includes(typeof row.unread) || (typeof row.unread === 'string' && !/^\d+$/.test(row.unread)) || !Number.isSafeInteger(count) || count < 0) throw new Error('Invalid unread count')
    unread[row.conversation_id] = count
  }
  // Most recent activity first, like Messages.
  const active = (c: Conversation) => c.last?.[0]?.created_at ?? c.created_at
  return { conversations: [...rows].sort((a, b) => active(b).localeCompare(active(a))), unread }
}

interface InboxSource {
  load: () => Promise<InboxData>
  subscribe: (changed: () => void) => () => void
  publish: (snapshot: InboxSnapshot) => void
}

// Each mounted account owns its state. A single revision covers BOTH query
// results, so old refreshes cannot mix earlier counts with a newer Inbox.
export function observeInbox(source: InboxSource) {
  let active = true, revision = 0, snapshot = emptyInbox()
  const publish = (next: Partial<InboxSnapshot>) => {
    if (!active) return
    snapshot = { ...snapshot, ...next }
    source.publish(snapshot)
  }
  const reload = async () => {
    if (!active) return
    const current = ++revision
    publish({ loading: true, error: '' })
    try {
      const data = await source.load()
      if (active && current === revision) publish({ ...data, loading: false, error: '' })
    } catch {
      if (active && current === revision) publish({ loading: false, error: 'Could not refresh your Inbox. Please try again.' })
    }
  }
  const unsubscribe = source.subscribe(() => { void reload() })
  void reload()
  return { reload, dispose: () => { active = false; ++revision; unsubscribe() } }
}
