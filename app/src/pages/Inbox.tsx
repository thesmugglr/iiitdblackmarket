import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { emptyInbox, loadInbox, observeInbox } from '../lib/inboxState'
import type { Conversation } from '../lib/types'
import { usePhotoThumbs } from '../lib/useSignedUrls'

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
  const row = (c: Conversation) => <InboxRow key={c.id} c={c} member={member} unread={unread[c.id] ?? 0} />
  return (
    <>
      <h1 className="page-title">Inbox</h1>
      {error && <p className="error small" role="alert">{error} <button onClick={() => void observer.current?.reload()}>Try again</button></p>}
      {convs && loading && <p className="muted small" role="status">Refreshing…</p>}
      {requests.length > 0 && (
        <section className="requests">
          <h2 className="section-label">Requests · {requests.length}</h2>
          <ul className="threads">{requests.map(row)}</ul>
        </section>
      )}
      {convs && chats.length === 0 && requests.length === 0 && !error && !loading && <p className="muted empty-note">No messages yet.</p>}
      {requests.length > 0 && chats.length > 0 && <h2 className="section-label">Messages</h2>}
      <ul className="threads">{chats.map(row)}</ul>
    </>
  )
}

// Messages-style time: clock today, weekday this week, otherwise a short date.
function when(iso: string) {
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (now.getTime() - d.getTime() < 6 * 86400000) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}
const initials = (name?: string) => (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

function InboxRow({ c, member, unread }: { c: Conversation; member: string; unread: number }) {
  const other = c.buyer_id === member ? c.seller : c.buyer
  const direct = c.kind === 'direct'
  const photo = !direct && c.listing?.photos?.length ? [c.listing.photos[0]] : []
  const [thumb] = usePhotoThumbs(photo)
  const last = c.last?.[0]
  const request = direct && c.request_status === 'pending'
  const preview = last
    ? `${last.sender_id === member ? 'You: ' : ''}${last.body || (last.image_path ? 'Photo' : '')}`
    : request ? (c.seller_id === member ? 'Wants to message you' : 'Request sent') : ''
  return (
    <li>
      <Link to={`/inbox/${c.id}`} className={`thread${unread ? ' unread' : ''}`}>
        <span className="avatar" aria-hidden="true">{thumb ? <img src={thumb} alt="" /> : initials(direct ? other?.display_name : c.listing?.title)}</span>
        <span className="thread-body">
          <span className="thread-top">
            <strong>{other?.display_name}</strong>
            <time className="muted">{when(last?.created_at ?? c.created_at)}</time>
          </span>
          {!direct && <span className="thread-sub">{c.listing?.title ?? 'Listing removed'}</span>}
          <span className="thread-preview muted">{preview}</span>
        </span>
        {unread > 0 && <span className="dot" aria-label={`${unread} unread`} />}
      </Link>
    </li>
  )
}
