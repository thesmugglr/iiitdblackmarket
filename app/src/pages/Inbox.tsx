import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { emptyInbox, loadInbox, observeInbox } from '../lib/inboxState'
import type { Conversation } from '../lib/types'

export default function Inbox() {
  const { profile } = useAuth()
  return profile ? <PersonalInbox key={profile.id} member={profile.id} /> : null
}

function PersonalInbox({ member }: { member: string }) {
  const [{ conversations: convs, unread, loading, error }, setSnapshot] = useState(emptyInbox)
  const observer = useRef<ReturnType<typeof observeInbox> | null>(null)

  useEffect(() => {
    const current = observeInbox({
      load: () => loadInbox(supabase, member), publish: setSnapshot,
      subscribe: changed => {
        window.addEventListener('notices-changed', changed)
        return () => window.removeEventListener('notices-changed', changed)
      },
    })
    observer.current = current
    return () => { current.dispose(); observer.current = null }
  }, [member])

  if (!convs && loading) return <p className="muted">Loading…</p>
  // Requests are direct chats someone else started that you haven't accepted. Declined ones stay hidden from you.
  const isRequest = (c: Conversation) => c.kind === 'direct' && c.request_status !== 'accepted' && c.seller_id === member
  const requests = convs?.filter((c) => isRequest(c) && c.request_status === 'pending') ?? []
  const chats = convs?.filter((c) => !isRequest(c)) ?? []
  const row = (c: Conversation) => {
    const other = c.buyer_id === member ? c.seller : c.buyer
    const direct = c.kind === 'direct'
    return (
      <li key={c.id}>
        <Link to={`/inbox/${c.id}`}>
          <strong>{direct ? other?.display_name : (c.listing?.title ?? 'Listing removed')}</strong>
          <span className="muted small">{direct ? (c.request_status === 'pending' ? (c.seller_id === member ? ' wants to message you' : ' · request sent') : ' · direct message') : ` with ${other?.display_name}`}</span>
          {unread[c.id] > 0 && <span className="badge unread">{unread[c.id]}</span>}
        </Link>
      </li>
    )
  }
  return (
    <>
      <h1>Inbox</h1>
      {error && <p className="error small" role="alert">{error} <button onClick={() => void observer.current?.reload()}>Try again</button></p>}
      {convs && loading && <p className="muted small" role="status">Refreshing…</p>}
      {requests.length > 0 && (
        <section className="requests">
          <h2>Requests <span className="badge">{requests.length}</span></h2>
          <p className="muted small">Listings sent to you by people you haven’t chatted with. Open one to accept or decline.</p>
          <ul className="list">{requests.map(row)}</ul>
        </section>
      )}
      {convs && chats.length === 0 && requests.length === 0 && !error && !loading && <p className="muted">No conversations yet. Open a listing and tap “Chat with seller”.</p>}
      <ul className="list">{chats.map(row)}</ul>
    </>
  )
}
