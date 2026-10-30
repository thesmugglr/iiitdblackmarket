import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { CATEGORIES, inr } from '../lib/constants'
import Sections from '../components/Sections'
import type { Listing, Wanted as WantedPost } from '../lib/types'

export default function Wanted() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState<WantedPost[] | null>(null)
  const [mine, setMine] = useState<Listing[]>([])
  const [form, setForm] = useState({ title: '', description: '', category: 'misc', max: '' })
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('wanted_posts').select('*, poster:profiles!wanted_posts_user_id_fkey(display_name)').order('created_at', { ascending: false }).limit(60)
    setPosts((data ?? []) as unknown as WantedPost[])
    if (profile) {
      const l = await supabase.from('listings').select('*').eq('seller_id', profile.id).eq('status', 'active')
      setMine((l.data ?? []) as Listing[])
    }
  }, [profile])
  useEffect(() => { void load() }, [load])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('wanted_posts').insert({
      user_id: profile!.id, title: form.title.trim(), description: form.description.trim(), category: form.category,
      max_price_inr: form.max ? Number(form.max) : null,
    })
    if (error) return setMsg(error.message)
    setForm({ title: '', description: '', category: 'misc', max: '' }); setOpen(false); setMsg(''); void load()
  }
  const respond = async (id: string) => {
    const { error } = await supabase.rpc('respond_wanted', { p_post: id, p_listing: pick })
    setMsg(error ? error.message : 'Sent. They have been notified about your listing.')
    if (!error) { setReply(null); setPick('') }
  }
  const setStatus = async (id: string, status: string) => {
    await supabase.from('wanted_posts').update({ status }).eq('id', id)
    void load()
  }

  return (
    <>
      <Sections />
      <div className="row between"><h1>Looking for</h1><button className="primary" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Post a request'}</button></div>
      <p className="muted">Can't find it? Ask. Students who have it can point you to their listing.</p>
      {open && (
        <form onSubmit={create} className="form panel">
          <label>What do you need<input required minLength={3} maxLength={120} placeholder="A second-hand kettle" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Details<textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="two">
            <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Max budget (₹, optional)<input type="number" min="0" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} /></label>
          </div>
          <button className="primary">Post request</button>
        </form>
      )}
      {msg && <p className="muted">{msg}</p>}
      {!posts && <p className="muted">Loading…</p>}
      {posts?.length === 0 && <div className="empty"><strong>No open requests</strong><span>Post what you're after and let the campus find it for you.</span></div>}
      <ul className="list">
        {posts?.map((p) => (
          <li key={p.id}>
            <div className="row-between"><strong>{p.title}</strong>{p.max_price_inr != null && <span className="price">up to {inr(p.max_price_inr)}</span>}</div>
            <div className="muted small">{CATEGORIES[p.category]} · {p.poster?.display_name} · {new Date(p.created_at).toLocaleDateString()}{p.status !== 'open' && <span className="badge">{p.status}</span>}</div>
            {p.description && <p>{p.description}</p>}
            <div className="row">
              {p.user_id === profile?.id ? (
                p.status === 'open' && <><button onClick={() => setStatus(p.id, 'fulfilled')}>Found it</button><button className="link" onClick={() => setStatus(p.id, 'closed')}>Close request</button></>
              ) : p.status === 'open' && (reply === p.id ? (
                <>
                  <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Your listing">
                    <option value="">Pick one of your listings</option>
                    {mine.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                  <button className="primary" disabled={!pick} onClick={() => respond(p.id)}>Send</button>
                  <button className="link" onClick={() => setReply(null)}>Cancel</button>
                </>
              ) : <button onClick={() => setReply(p.id)}>I have this</button>)}
            </div>
            {reply === p.id && mine.length === 0 && <p className="muted small">You need an active listing first. List the item, then respond.</p>}
          </li>
        ))}
      </ul>
    </>
  )
}
