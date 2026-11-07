import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import AdminRemove from '../components/AdminRemove'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { canTakePhoto } from '../lib/device'
import { useAuth } from '../lib/auth'
import { preparePhoto, thumbPath } from '../lib/image'
import { usePhotoThumbs } from '../lib/useSignedUrls'
import Sections from '../components/Sections'
import type { LostFoundPost, LostFoundReply } from '../lib/types'

type Filter = 'all' | 'lost' | 'found'
const emptyForm = { kind: 'lost' as 'lost' | 'found', title: '', description: '', place: '' }

function PostPhoto({ path }: { path: string }) {
  const [url] = usePhotoThumbs([path])
  return <div className="lf-photo">{url ? <img src={url} alt="" loading="lazy" /> : null}</div>
}

/** Private replies: the poster sees one thread per person who wrote; everyone else sees their thread with the poster. */
function Replies({ post, me }: { post: LostFoundPost; me: string }) {
  const [replies, setReplies] = useState<LostFoundReply[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const mine = post.user_id === me

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('lost_found_replies').select('*').eq('post_id', post.id).order('created_at')
    if (error) return setErr(error.message)
    const rows = (data ?? []) as LostFoundReply[]
    setReplies(rows)
    const others = [...new Set(rows.flatMap((r) => [r.sender_id, r.recipient_id]).filter((id) => id !== me))]
    if (others.length) {
      const people = await supabase.from('profiles').select('id,display_name').in('id', others)
      setNames(Object.fromEntries(((people.data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name])))
    }
  }, [post.id, me])
  useEffect(() => { void load() }, [load])

  const send = async (e: FormEvent, to: string | null) => {
    e.preventDefault()
    const key = to ?? 'poster'
    const body = (drafts[key] ?? '').trim()
    if (!body || busy) return
    setBusy(true)
    setErr('')
    const { error } = await supabase.rpc('reply_lost_found', { p_post: post.id, p_body: body, p_to: to })
    setBusy(false)
    if (error) return setErr(error.message)
    setDrafts((d) => ({ ...d, [key]: '' }))
    void load()
  }

  if (!replies) return <p className="muted small">Loading replies…</p>
  // Group by the other person in each conversation.
  const threads = new Map<string, LostFoundReply[]>()
  for (const r of replies) {
    const other = r.sender_id === me ? r.recipient_id : r.sender_id
    threads.set(other, [...(threads.get(other) ?? []), r])
  }
  const box = (to: string | null, placeholder: string) => (
    <form className="composer" onSubmit={(e) => void send(e, to)}>
      <input value={drafts[to ?? 'poster'] ?? ''} maxLength={1000} placeholder={placeholder} disabled={busy || post.status !== 'open'}
        onChange={(e) => setDrafts((d) => ({ ...d, [to ?? 'poster']: e.target.value }))} />
      <button className="primary" disabled={busy || post.status !== 'open' || !(drafts[to ?? 'poster'] ?? '').trim()}>Send</button>
    </form>
  )
  const thread = (rows: LostFoundReply[]) => rows.map((r) => (
    <div key={r.id} className={`bubble ${r.sender_id === me ? 'mine' : ''}`}>
      <div>{r.body}</div>
      <div className="small muted">{new Date(r.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  ))

  return (
    <div className="lf-replies">
      {err && <p className="error small" role="alert">{err}</p>}
      {mine ? (
        threads.size === 0 ? <p className="muted small">No replies yet. You will get a notification when someone writes.</p> : (
          [...threads].map(([other, rows]) => (
            <div key={other} className="lf-thread">
              <strong className="small">{names[other] ?? 'Student'}</strong>
              {thread(rows)}
              {box(other, `Reply to ${names[other] ?? 'them'}`)}
            </div>
          ))
        )
      ) : (
        <div className="lf-thread">
          {thread(replies)}
          {box(null, post.kind === 'lost' ? 'Seen it? Tell them where (only they can read this)' : 'Is it yours? Describe it so they can check')}
        </div>
      )}
    </div>
  )
}

export default function LostFound() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const [posts, setPosts] = useState<LostFoundPost[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [expanded, setExpanded] = useState<string | null>(params.get('post'))
  const pendingPhoto = useRef<string | null>(null) // uploaded but not yet posted

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('lost_found')
      .select('*, poster:profiles!lost_found_user_id_fkey(display_name)')
      .order('created_at', { ascending: false }).limit(60)
    if (error) return setMsg(error.message)
    setPosts((data ?? []) as unknown as LostFoundPost[])
  }, [])
  useEffect(() => { void load() }, [load])
  // Remove a photo that was uploaded for a post that was never published.
  useEffect(() => () => {
    const path = pendingPhoto.current
    if (path) void supabase.storage.from('listing-photos').remove([path, thumbPath(path)])
  }, [])

  if (!profile) return null
  const me = profile.id

  const choosePhoto = async (file?: File) => {
    if (!file) return
    setUploading(true)
    setMsg('')
    try {
      const { blob, thumb, ext, type } = await preparePhoto(file, { thumb: true })
      const path = `${me}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('listing-photos').upload(path, blob, { contentType: type, cacheControl: '31536000' })
      if (error) throw new Error(error.message)
      if (thumb) await supabase.storage.from('listing-photos').upload(thumbPath(path), thumb, { contentType: type, cacheControl: '31536000' })
      if (pendingPhoto.current) void supabase.storage.from('listing-photos').remove([pendingPhoto.current, thumbPath(pendingPhoto.current)])
      pendingPhoto.current = path
      setPhoto(path)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not add that photo.')
    } finally {
      setUploading(false)
    }
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || uploading) return
    setBusy(true)
    setMsg('')
    const { error } = await supabase.from('lost_found').insert({
      user_id: me, kind: form.kind, title: form.title.trim(), description: form.description.trim(),
      place: form.place.trim(), photo,
    })
    setBusy(false)
    if (error) return setMsg(error.message)
    pendingPhoto.current = null
    setForm(emptyForm)
    setPhoto(null)
    setOpen(false)
    void load()
  }

  const resolve = async (p: LostFoundPost) => {
    const { error } = await supabase.from('lost_found').update({ status: 'resolved' }).eq('id', p.id)
    if (error) return setMsg(error.message)
    void load()
  }
  const remove = async (p: LostFoundPost) => {
    if (!confirm('Delete this post and its replies?')) return
    const { data, error } = await supabase.from('lost_found').delete().eq('id', p.id).select('id')
    if (error || !data?.length) return setMsg(error?.message ?? 'Could not delete this post. Refresh and try again.')
    if (p.photo) void supabase.storage.from('listing-photos').remove([p.photo, thumbPath(p.photo)])
    void load()
  }

  const shown = (posts ?? []).filter((p) => filter === 'all' || p.kind === filter)
  return (
    <>
      <Sections />
      <div className="row between"><h1 className="page-title">Lost &amp; found</h1><button className="primary" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Post'}</button></div>
      <p className="muted">Lost something on campus, or found something that isn't yours? Post it here. Replies are private between you and the person who writes.</p>
      {open && (
        <form onSubmit={create} className="form panel">
          <div className="row" role="radiogroup" aria-label="What happened">
            {(['lost', 'found'] as const).map((k) => (
              <label key={k} className="check"><input type="radio" name="kind" checked={form.kind === k} onChange={() => setForm({ ...form, kind: k })} /> {k === 'lost' ? 'I lost something' : 'I found something'}</label>
            ))}
          </div>
          <label>What is it<input required minLength={3} maxLength={120} placeholder={form.kind === 'lost' ? 'Blue steel water bottle' : 'Set of keys with a red tag'} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Details<textarea rows={3} maxLength={2000} placeholder="Colour, brand, anything that helps the owner recognise it" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>Where<input required minLength={2} maxLength={120} placeholder={form.kind === 'lost' ? 'Where you last had it, e.g. Library, 2nd floor' : 'Where you found it, e.g. Mess entrance'} value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} /></label>
          <label className="btn">{uploading ? 'Adding photo…' : photo ? 'Change photo' : 'Add a photo (optional)'}
            <input className="visually-hidden" type="file" accept="image/*" disabled={uploading || busy} onChange={(e) => { void choosePhoto(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {canTakePhoto() && (
            <label className="btn">Take photo
              <input className="visually-hidden" type="file" accept="image/*" capture="environment" disabled={uploading || busy} onChange={(e) => { void choosePhoto(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )}
          {photo && <PostPhoto path={photo} />}
          <button className="primary" disabled={busy || uploading}>{busy ? 'Posting…' : 'Post'}</button>
        </form>
      )}
      <div className="chips-row" role="group" aria-label="Show">
        {(['all', 'lost', 'found'] as const).map((f) => <button key={f} className={filter === f ? 'on' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'lost' ? 'Lost' : 'Found'}</button>)}
      </div>
      {msg && <p className="error small" role="alert">{msg}</p>}
      {!posts && <p className="muted">Loading…</p>}
      {posts && shown.length === 0 && <div className="empty"><strong>Nothing here right now</strong><span>Lost or found something? Post it and the campus can help.</span></div>}
      <ul className="list">
        {shown.map((p) => (
          <li key={p.id} className="lf-item">
            <div className="lf-main">
              {p.photo && <PostPhoto path={p.photo} />}
              <div>
                <div className="row-between"><strong>{p.title}</strong><span className={`badge ${p.kind}`}>{p.kind === 'lost' ? 'Lost' : 'Found'}</span></div>
                <div className="muted small">{p.place ? `${p.place} · ` : ''}{p.poster?.display_name ?? 'Student'} · {new Date(p.created_at).toLocaleDateString()}{p.status === 'resolved' && <span className="badge">resolved</span>}</div>
                {p.description && <p>{p.description}</p>}
              </div>
            </div>
            <div className="row">
              {p.user_id === me ? (
                <>
                  <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}>{expanded === p.id ? 'Hide replies' : 'Replies'}</button>
                  {p.status === 'open' && <button onClick={() => void resolve(p)}>{p.kind === 'lost' ? 'Got it back' : 'Returned it'}</button>}
                  <button className="link" onClick={() => void remove(p)}>Delete</button>
                </>
              ) : p.status === 'open' && (
                <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}>{expanded === p.id ? 'Close' : p.kind === 'lost' ? 'I have seen it' : 'This is mine'}</button>
              )}
              <AdminRemove kind="lostfound" id={p.id} ownerId={p.user_id} onRemoved={() => void load()} />
            </div>
            {expanded === p.id && <Replies post={p} me={me} />}
          </li>
        ))}
      </ul>
    </>
  )
}
