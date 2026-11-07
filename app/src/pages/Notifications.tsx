import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Notice } from '../lib/types'
import PushSetting from '../components/PushSetting'

export default function Notifications() {
  const [items, setItems] = useState<Notice[] | null>(null)
  const [error, setError] = useState('')
  const load = async () => {
    await supabase.rpc('refresh_expiry_notices')
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
    if (error) { setError('Could not load notifications. Please retry.'); return }
    setError('')
    setItems((data ?? []) as Notice[])
  }
  useEffect(() => {
    void load()
    const reload = () => void load()
    window.addEventListener('notices-changed', reload)
    return () => window.removeEventListener('notices-changed', reload)
  }, [])
  const markOne = async (n: Notice) => {
    if (!n.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
    window.dispatchEvent(new Event('notices-changed'))
  }
  const markAll = async () => {
    await supabase.rpc('mark_all_notifications_read')
    window.dispatchEvent(new Event('notices-changed'))
    void load()
  }
  if (!items) return error ? <p role="alert">{error} <button onClick={() => void load()}>Retry</button></p> : <p className="muted">Loading…</p>
  return (
    <>
      <div className="row between"><h1 className="page-title">Notifications</h1>{items.some((n) => !n.read_at) && <button onClick={markAll}>Mark all read</button>}</div>
      {error && <p role="alert">{error} <button onClick={() => void load()}>Retry</button></p>}
      <PushSetting />
      {items.length === 0 && <div className="empty"><strong>You're all caught up</strong><span>New messages, replies, price drops on saved items and expiry reminders show up here.</span></div>}
      <ul className="list">
        {items.map((n) => (
          <li key={n.id} className={n.read_at ? 'read' : 'unread-row'}>
            <Link to={n.link ?? '/'} onClick={() => markOne(n)}>
              {!n.read_at && <span className="dot" aria-label="Unread" />}
              <strong>{n.title}</strong>
              <span className="muted small"> · {new Date(n.created_at).toLocaleDateString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
