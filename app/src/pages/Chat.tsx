import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Arrow, Clip } from '../components/Icons'
import { inr } from '../lib/constants'
import { preparePhoto } from '../lib/image'
import { useSignedUrls } from '../lib/useSignedUrls'
import type { Conversation, Message, Offer } from '../lib/types'

function Bubble({ m, mine, onReport }: { m: Message; mine: boolean; onReport: () => void }) {
  const [img] = useSignedUrls('chat-attachments', m.image_path ? [m.image_path] : [])
  return (
    <div className={`bubble ${mine ? 'mine' : ''}`}>
      {img && <img src={img} alt="attachment" />}
      {m.body && <div>{m.body}</div>}
      <div className="small muted">
        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {mine && m.read_at ? ' · read' : ''}
        {!mine && <button className="link" onClick={onReport}>report</button>}
      </div>
    </div>
  )
}

export default function Chat() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [conv, setConv] = useState<Conversation | null>(null)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [offerAmt, setOfferAmt] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  const loadMsgs = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', id!).order('created_at')
    setMsgs((data ?? []) as Message[])
    await supabase.rpc('mark_read', { p_conversation: id })
  }, [id])
  const loadOffers = useCallback(async () => {
    const { data } = await supabase.from('offers').select('*').eq('conversation_id', id!).order('created_at')
    setOffers((data ?? []) as Offer[])
  }, [id])

  useEffect(() => {
    supabase
      .from('conversations')
      .select('*, listing:listings(title,photos,status), buyer:profiles!conversations_buyer_id_fkey(display_name), seller:profiles!conversations_seller_id_fkey(display_name)')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => setConv(data as unknown as Conversation | null))
    void loadMsgs()
    void loadOffers()
    const ch = supabase
      .channel(`conv-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, () => void loadMsgs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `conversation_id=eq.${id}` }, () => void loadOffers())
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [id, loadMsgs, loadOffers])

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [msgs.length])

  if (!profile) return null
  if (!conv) return <p className="muted">Loading…</p>
  const isBuyer = conv.buyer_id === profile.id
  const otherId = isBuyer ? conv.seller_id : conv.buyer_id
  const otherName = isBuyer ? conv.seller?.display_name : conv.buyer?.display_name
  const pending = offers.find((o) => o.status === 'pending')

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const body = text.trim()
    setText('')
    const { error } = await supabase.from('messages').insert({ conversation_id: conv.id, sender_id: profile.id, body })
    if (error) setErr(error.message)
  }
  const attach = async (file?: File) => {
    if (!file) return
    setErr('')
    try {
      const { blob, ext, type } = await preparePhoto(file)
      const path = `${conv.id}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('chat-attachments').upload(path, blob, { contentType: type })
      if (up.error) return setErr(up.error.message)
      const { error } = await supabase.from('messages').insert({ conversation_id: conv.id, sender_id: profile.id, image_path: path })
      if (error) setErr(error.message)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send that photo.')
    }
  }
  const makeOffer = async () => {
    const { error } = await supabase.rpc('make_offer', { p_conversation: conv.id, p_amount: Number(offerAmt) })
    setErr(error?.message ?? '')
    if (!error) setOfferAmt('')
  }
  const respond = async (o: Offer, accept: boolean) => {
    const { error } = await supabase.rpc('respond_offer', { p_offer: o.id, p_accept: accept })
    setErr(error?.message ?? '')
  }
  const block = async () => {
    if (!confirm(`Block ${otherName}? They will no longer be able to message you.`)) return
    const { error } = await supabase.from('blocks').insert({ blocker_id: profile.id, blocked_id: otherId })
    setErr(error ? error.message : `${otherName} is blocked.`)
  }
  const reportMsg = async (m: Message) => {
    const reason = prompt('Why are you reporting this message?')
    if (!reason) return
    const { error } = await supabase.from('reports').insert({ reporter_id: profile.id, message_id: m.id, reason })
    setErr(error ? error.message : 'Report sent.')
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <Link to="/inbox" aria-label="Back to inbox" className="icon-btn"><Arrow /></Link>
        <div>
          <strong>{otherName}</strong>
          <div className="small muted"><Link to={`/listing/${conv.listing_id}`}>{conv.listing?.title}</Link></div>
        </div>
        <button className="link" onClick={block}>Block</button>
      </div>
      <div className="messages">
        {msgs.map((m) => <Bubble key={m.id} m={m} mine={m.sender_id === profile.id} onReport={() => reportMsg(m)} />)}
        <div ref={bottom} />
      </div>
      {pending && (
        <div className="offer-bar">
          Offer: <strong>{inr(pending.amount_inr)}</strong>
          {!isBuyer && (<><button className="primary" onClick={() => respond(pending, true)}>Accept</button><button onClick={() => respond(pending, false)}>Decline</button></>)}
          {isBuyer && <span className="muted"> waiting for seller</span>}
        </div>
      )}
      {isBuyer && !pending && conv.listing?.status === 'active' && (
        <div className="offer-bar">
          <input type="number" min="0" placeholder="Offer ₹" value={offerAmt} onChange={(e) => setOfferAmt(e.target.value)} />
          <button onClick={makeOffer} disabled={!offerAmt}>Make offer</button>
        </div>
      )}
      {err && <p className="error small">{err}</p>}
      <form className="composer" onSubmit={send}>
        <label className="attach" title="Attach photo"><Clip /><input type="file" accept="image/*" hidden onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = '' }} /></label>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type a message" />
        <button className="primary">Send</button>
      </form>
    </div>
  )
}
