import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Notice } from '../lib/types'
import PushSetting from '../components/PushSetting'
import type { PushState } from '../lib/push'

export default function Notifications() {
  const [items, setItems] = useState<Notice[] | null>(null)
  const load = async () => {
    await supabase.rpc('refresh_expiry_notices')
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
    setItems((data ?? []) as Notice[])
  }
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('Notification' in window ? Notification.permission : 'unsupported')
  const [push, setPush] = useState<PushState | null>(null)
  useEffect(() => {
    void load()
    const reload = () => void load()
    window.addEventListener('notices-changed', reload)
    return () => window.removeEventListener('notices-changed', reload)
  }, [])
  const enableAlerts = async () => setPermission(await Notification.requestPermission())
  const markOne = async (n: Notice) => {
    if (!n.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
    window.dispatchEvent(new Event('notices-changed'))
  }
  const markAll = async () => {
    await supabase.rpc('mark_all_notifications_read')
    window.dispatchEvent(new Event('notices-changed'))
    void load()
  }
  if (!items) return <p className="muted">Loading…</p>
  return (
    <>
      <div className="row between"><h1>Notifications</h1>{items.some((n) => !n.read_at) && <button onClick={markAll}>Mark all read</button>}</div>
      <PushSetting compact onState={setPush} />
      {/* Without push, fall back to alerts while the site is open in a background tab. */}
      {(push === 'unsupported' || push === 'unavailable') && permission === 'default' && <p className="panel small">Get a desktop alert when someone messages you while this tab is in the background. <button onClick={enableAlerts}>Turn on alerts</button></p>}
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
