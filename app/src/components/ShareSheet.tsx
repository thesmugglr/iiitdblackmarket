import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Drawer from './Drawer'
import { supabase } from '../lib/supabase'
import { appUrl } from '../lib/redirect'
import { findPeople, listingLink, sendListingTo, telegramUrl, whatsappUrl, type Person } from '../lib/share'

/** Share a listing outside the app (WhatsApp, Instagram via the phone's share menu, Telegram, link) or to a member inside it. */
export default function ShareSheet({ open, onClose, listing, me }: { open: boolean; onClose: () => void; listing: { id: string; title: string }; me: string }) {
  const nav = useNavigate()
  const link = listingLink(appUrl(), listing.id)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ term: string; people: Person[] }>({ term: '', people: [] })
  const [recent, setRecent] = useState<Person[]>([])
  const [to, setTo] = useState<Person | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // People you already chat with, for one-tap sending.
  useEffect(() => {
    if (!open) return
    let live = true
    void supabase.from('conversations')
      .select('buyer_id,seller_id,created_at, buyer:profiles!conversations_buyer_id_fkey(id,display_name,batch), seller:profiles!conversations_seller_id_fkey(id,display_name,batch)')
      .or(`buyer_id.eq.${me},seller_id.eq.${me}`).neq('request_status', 'declined').order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => {
        if (!live || !data) return
        const seen = new Map<string, Person>()
        for (const c of data as unknown as { buyer_id: string; buyer: Person | null; seller: Person | null }[]) {
          const p = c.buyer_id === me ? c.seller : c.buyer
          if (p && !seen.has(p.id)) seen.set(p.id, p)
        }
        setRecent([...seen.values()].slice(0, 8))
      })
    return () => { live = false }
  }, [open, me])

  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      findPeople(supabase, me, q).then((r) => { if (live) { setFound({ term: q, people: r }); setErr('') } }).catch((e: Error) => { if (live) setErr(e.message) })
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [q, me])

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setMsg('Link copied. Paste it anywhere, like an Instagram DM.') }
    catch { setMsg(link) }
  }
  const native = async () => {
    try { await navigator.share({ title: listing.title, text: `${listing.title} on The Smugglr`, url: link }) } catch { /* cancelled */ }
  }
  const send = async () => {
    if (!to || busy) return
    setBusy(true); setErr('')
    try {
      const chat = await sendListingTo(supabase, listing.id, to.id, note)
      onClose()
      nav(`/inbox/${chat}`)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send it.') }
    finally { setBusy(false) }
  }
  const pick = (p: Person) => { setTo(p); setErr('') }
  const searching = q.trim().length >= 2
  const people = found.term === q ? found.people : []
  const list = searching ? people : recent

  return (
    <Drawer open={open} onClose={onClose} title="Share listing">
      <div className="share-apps">
        <a className="btn" href={whatsappUrl(listing.title, link)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        {typeof navigator !== 'undefined' && 'share' in navigator && <button onClick={native}>Instagram & more</button>}
        <a className="btn" href={telegramUrl(listing.title, link)} target="_blank" rel="noopener noreferrer">Telegram</a>
        <button onClick={copy}>Copy link</button>
      </div>
      {msg && <p className="muted small" role="status">{msg}</p>}
      <p className="muted small">Only signed-in students can open the listing.</p>

      <h3>Send in The Smugglr</h3>
      {to ? (
        <div className="share-to">
          <p>To <strong>{to.display_name}</strong>{to.batch ? ` (${to.batch})` : ''} <button className="link" onClick={() => setTo(null)}>change</button></p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Add a message (optional)" />
          <button className="primary" disabled={busy} onClick={() => void send()}>{busy ? 'Sending…' : 'Send'}</button>
          <p className="muted small">If you haven’t chatted before, it arrives as a message request they can accept or decline.</p>
        </div>
      ) : (
        <>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search people" />
          {q.trim().length < 2 && recent.length > 0 && <p className="muted small">Recent chats</p>}
          <ul className="people">
            {list.map((p) => <li key={p.id}><button onClick={() => pick(p)}>{p.display_name}{p.batch && <span className="muted small"> {p.batch}</span>}</button></li>)}
          </ul>
          {searching && found.term === q && !people.length && !err && <p className="muted small">No one found.</p>}
        </>
      )}
      {err && <p className="error small" role="alert">{err}</p>}
    </Drawer>
  )
}
