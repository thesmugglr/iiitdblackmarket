import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Arrow, Clip } from '../components/Icons'
import { inr } from '../lib/constants'
import { preparePhoto } from '../lib/image'
import { useSignedUrls } from '../lib/useSignedUrls'
import { emptyConversation, observeConversation } from '../lib/conversationState'
import { emptyTextComposer, observeTextComposer, sendChatText } from '../lib/chatText'
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
  // A new route must never render the preceding conversation or its draft.
  return <ConversationChat key={`${profile?.id}:${id}`} id={id ?? ''} />
}

function ConversationChat({ id }: { id: string }) {
  const { profile } = useAuth()
  const memberId = profile?.id
  const [snapshot, setSnapshot] = useState(emptyConversation)
  const [attempt, setAttempt] = useState(0)
  const { conversation: conv, messages: msgs, offers, loading, error: loadError } = snapshot
  const [{ text, sending, error: sendError }, setComposer] = useState(emptyTextComposer)
  const composer = useRef<ReturnType<typeof observeTextComposer> | null>(null)
  const [err, setErr] = useState('')
  const [offerAmt, setOfferAmt] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!memberId) return
    const current = observeTextComposer({
      newId: () => crypto.randomUUID(),
      write: request => sendChatText(supabase, id, memberId, request),
      publish: setComposer,
    })
    composer.current = current
    return () => { current.dispose(); composer.current = null }
  }, [id, memberId])

  useEffect(() => {
    return observeConversation(id, {
      loadConversation: async () => {
        const { data, error } = await supabase.from('conversations')
          .select('*, listing:listings(title,photos,status), buyer:profiles!conversations_buyer_id_fkey(display_name), seller:profiles!conversations_seller_id_fkey(display_name)')
          .eq('id', id).maybeSingle()
        if (error) throw error
        return data as unknown as Conversation | null
      },
      loadMessages: async () => {
        const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at')
        if (error) throw error
        return (data ?? []) as Message[]
      },
      loadOffers: async () => {
        const { data, error } = await supabase.from('offers').select('*').eq('conversation_id', id).order('created_at')
        if (error) throw error
        return (data ?? []) as Offer[]
      },
      markRead: async () => {
        const { error } = await supabase.rpc('mark_read', { p_conversation: id })
        if (error) throw error
      },
      subscribe: (messagesChanged, offersChanged) => {
        const ch = supabase.channel(`conv-${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, messagesChanged)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `conversation_id=eq.${id}` }, offersChanged)
          .subscribe()
        return () => { void supabase.removeChannel(ch) }
      },
      publish: setSnapshot,
    })
  }, [id, attempt])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  if (!profile) return null
  if (loading) return <p className="muted">Loading…</p>
  const retry = <button onClick={() => setAttempt(n => n + 1)}>Try again</button>
  if (!conv) return <div><p>{loadError || 'This conversation is not available.'}</p>{retry} <Link to="/inbox">Back to inbox</Link></div>
  const isBuyer = conv.buyer_id === profile.id
  const otherId = isBuyer ? conv.seller_id : conv.buyer_id
  const otherName = isBuyer ? conv.seller?.display_name : conv.buyer?.display_name
  const pending = offers.find((o) => o.status === 'pending')

  const send = (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    void composer.current?.send()
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
      {sendError && <p className="error small" role="alert">{sendError}</p>}
      {loadError && <p className="error small">{loadError} {retry}</p>}
      <form className="composer" onSubmit={send} aria-busy={sending}>
        <label className="attach" title="Attach photo"><Clip /><input type="file" accept="image/*" hidden onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = '' }} /></label>
        <input value={text} onChange={(e) => composer.current?.edit(e.target.value)} maxLength={2000} placeholder="Type a message" />
        <button className="primary" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}</button>
      </form>
    </div>
  )
}
