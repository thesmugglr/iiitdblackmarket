import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Conversation } from '../lib/types'

export default function Inbox() {
  const { profile } = useAuth()
  const [convs, setConvs] = useState<Conversation[] | null>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})

  useEffect(() => {
    const load = () => {
    supabase
      .from('conversations')
      .select('*, listing:listings(title,photos,status), buyer:profiles!conversations_buyer_id_fkey(display_name), seller:profiles!conversations_seller_id_fkey(display_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setConvs((data ?? []) as unknown as Conversation[]))
    supabase.rpc('unread_counts').then(({ data }) => {
      const m: Record<string, number> = {}
      for (const r of (data ?? []) as { conversation_id: string; unread: number }[]) m[r.conversation_id] = Number(r.unread)
      setUnread(m)
    })
    }
    load()
    window.addEventListener('notices-changed', load)
    return () => window.removeEventListener('notices-changed', load)
  }, [])

  if (!convs) return <p className="muted">Loading…</p>
  return (
    <>
      <h1>Inbox</h1>
      {convs.length === 0 && <p className="muted">No conversations yet. Open a listing and tap “Chat with seller”.</p>}
      <ul className="list">
        {convs.map((c) => {
          const other = c.buyer_id === profile?.id ? c.seller : c.buyer
          return (
            <li key={c.id}>
              <Link to={`/inbox/${c.id}`}>
                <strong>{c.listing?.title ?? 'Listing removed'}</strong>
                <span className="muted small"> with {other?.display_name}</span>
                {unread[c.id] > 0 && <span className="badge unread">{unread[c.id]}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
