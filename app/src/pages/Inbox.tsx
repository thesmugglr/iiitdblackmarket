import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { emptyInbox, loadInbox, observeInbox } from '../lib/inboxState'

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
  return (
    <>
      <h1>Inbox</h1>
      {error && <p className="error small" role="alert">{error} <button onClick={() => void observer.current?.reload()}>Try again</button></p>}
      {convs && loading && <p className="muted small" role="status">Refreshing…</p>}
      {convs?.length === 0 && !error && !loading && <p className="muted">No conversations yet. Open a listing and tap “Chat with seller”.</p>}
      <ul className="list">
        {convs?.map((c) => {
          const other = c.buyer_id === member ? c.seller : c.buyer
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
