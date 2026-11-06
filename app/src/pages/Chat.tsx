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
import { emptyOfferComposer, makeOfferOnce, observeOfferComposer, respondOfferOnce } from '../lib/chatOffers'
import { emptyAttachment, observeAttachment, sendChatImage, uploadChatAttachment } from '../lib/chatAttachments'
import type { Conversation, Deal, Message, Offer } from '../lib/types'

// One tap fills the message box; the text can still be edited before sending.
const BUYER_REPLIES = ['Is this still available?', 'Would you take ₹', 'Can we meet today?', 'Could you send a few more photos?']
const SELLER_REPLIES = ['Yes, it is still available.', 'When can you pick it up?', 'Sorry, the price is fixed.', 'Sorry, it has been sold.']

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
  const [{ amount: offerAmt, busy: offerBusy, error: offerError }, setOfferComposer] = useState(emptyOfferComposer)
  const offerComposer = useRef<ReturnType<typeof observeOfferComposer> | null>(null)
  const [photoState, setPhotoState] = useState(emptyAttachment)
  const attachment = useRef<ReturnType<typeof observeAttachment> | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [dealBusy, setDealBusy] = useState(false)

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
    if (!memberId) return
    const current = observeOfferComposer({
      conversation: id, member: memberId, newId: () => crypto.randomUUID(),
      make: request => makeOfferOnce(supabase, id, memberId, request),
      respond: (offerId, accept) => respondOfferOnce(supabase, id, offerId, accept),
      confirmed: () => setAttempt(n => n + 1), publish: setOfferComposer,
    })
    offerComposer.current = current
    return () => { current.dispose(); offerComposer.current = null }
  }, [id, memberId])
  useEffect(() => { offerComposer.current?.acknowledge(offers) }, [offers])

  useEffect(() => {
    if (!memberId) return
    const current = observeAttachment({
      conversation: id, newId: () => crypto.randomUUID(), prepare: preparePhoto,
      upload: request => uploadChatAttachment(supabase, request),
      link: request => sendChatImage(supabase, id, memberId, request),
      confirmed: () => setAttempt(n => n + 1), publish: setPhotoState,
    })
    attachment.current = current
    return () => { current.dispose(); attachment.current = null }
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

  // The sale record for this chat, if the seller has marked it sold (refreshed when new messages arrive).
  useEffect(() => {
    let live = true
    void supabase.from('deals').select('*').eq('conversation_id', id).maybeSingle()
      .then(({ data }) => { if (live) setDeal((data as Deal | null) ?? null) })
    return () => { live = false }
  }, [id, attempt, msgs.length])

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
  const attach = (file?: File) => {
    if (!file) return
    setErr('')
    void attachment.current?.choose(file)
  }
  const makeOffer = () => {
    setErr('')
    void offerComposer.current?.make()
  }
  const respond = (o: Offer, accept: boolean) => {
    setErr('')
    void offerComposer.current?.respond(o.id, accept)
  }
  const block = async () => {
    if (!confirm(`Block ${otherName}? They will no longer be able to message you.`)) return
    const { error } = await supabase.from('blocks').insert({ blocker_id: profile.id, blocked_id: otherId })
    setErr(error ? error.message : `${otherName} is blocked.`)
  }
  const markSold = async () => {
    if (!confirm(`Mark "${conv.listing?.title ?? 'this item'}" as sold to ${otherName}? Nobody else will be able to make offers on it.`)) return
    setErr('')
    setDealBusy(true)
    const { error } = await supabase.rpc('mark_sold_to', { p_conversation: id })
    setDealBusy(false)
    if (error) setErr(error.message)
    else setAttempt(n => n + 1)
  }
  const rate = async (smooth: boolean) => {
    setErr('')
    setDealBusy(true)
    const { error } = await supabase.rpc('rate_deal', { p_conversation: id, p_smooth: smooth })
    setDealBusy(false)
    if (error) setErr(error.message)
    else setAttempt(n => n + 1)
  }
  const quickReply = (reply: string) => {
    composer.current?.edit(reply)
    input.current?.focus()
  }
  const canSell = !isBuyer && !deal && (conv.listing?.status === 'active' || conv.listing?.status === 'reserved')
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
          {!isBuyer && (<><button className="primary" disabled={offerBusy} onClick={() => respond(pending, true)}>Accept</button><button disabled={offerBusy} onClick={() => respond(pending, false)}>Decline</button></>)}
          {isBuyer && <span className="muted"> waiting for seller</span>}
        </div>
      )}
      {isBuyer && !pending && conv.listing?.status === 'active' && (
        <div className="offer-bar">
          <input type="number" min="0" step="1" placeholder="Offer ₹" value={offerAmt} onChange={(e) => offerComposer.current?.edit(e.target.value)} />
          <button onClick={makeOffer} disabled={offerBusy || !offerAmt.trim()}>{offerBusy ? 'Sending…' : 'Make offer'}</button>
        </div>
      )}
      {canSell && (
        <div className="offer-bar deal-bar">
          <span>Handed it over?</span>
          <button className="primary" disabled={dealBusy} onClick={markSold}>{dealBusy ? 'Saving…' : `Mark sold to ${otherName}`}</button>
        </div>
      )}
      {deal && isBuyer && deal.smooth === null && (
        <div className="offer-bar deal-bar">
          <span>Did buying this go smoothly?</span>
          <button className="primary" disabled={dealBusy} onClick={() => rate(true)}>👍 Yes, smooth</button>
          <button disabled={dealBusy} onClick={() => rate(false)}>Not really</button>
        </div>
      )}
      {deal && (isBuyer ? deal.smooth !== null : true) && (
        <p className="muted small deal-note">
          {isBuyer
            ? (deal.smooth ? 'You gave this deal a thumbs-up. Thanks!' : 'Thanks for telling us.')
            : deal.smooth ? `Sold to ${otherName}, who said it went smoothly.` : `Sold to ${otherName}.`}
        </p>
      )}
      {err && <p className="error small">{err}</p>}
      {sendError && <p className="error small" role="alert">{sendError}</p>}
      {offerError && <p className="error small" role="alert">{offerError}</p>}
      {photoState.busy && <p className="muted small" role="status">Sending photo…</p>}
      {photoState.error && <p className="error small" role="alert">{photoState.name}: {photoState.error} <button disabled={photoState.busy} onClick={() => void attachment.current?.retry()}>Retry photo</button></p>}
      {loadError && <p className="error small">{loadError} {retry}</p>}
      {!text.trim() && (
        <div className="quick-replies" role="group" aria-label="Quick replies">
          {(isBuyer ? BUYER_REPLIES : SELLER_REPLIES).map((reply) => (
            <button key={reply} type="button" onClick={() => quickReply(reply)}>{reply.endsWith('₹') ? `${reply}…?` : reply}</button>
          ))}
        </div>
      )}
      <form className="composer" onSubmit={send} aria-busy={sending || photoState.busy}>
        <label className="attach" title="Attach photo"><Clip /><input type="file" accept="image/*" hidden disabled={photoState.busy || photoState.locked} onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} /></label>
        <input ref={input} value={text} onChange={(e) => composer.current?.edit(e.target.value)} maxLength={2000} placeholder="Type a message" />
        <button className="primary" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}</button>
      </form>
    </div>
  )
}
