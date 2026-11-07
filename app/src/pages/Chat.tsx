import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Arrow, ArrowUp, Camera, Clip } from '../components/Icons'
import { canTakePhoto } from '../lib/device'
import { inr } from '../lib/constants'
import { preparePhoto } from '../lib/image'
import { usePhotoThumbs, useSignedUrls } from '../lib/useSignedUrls'
import { groupReactions, react } from '../lib/share'
import { emptyConversation, observeConversation } from '../lib/conversationState'
import { emptyTextComposer, observeTextComposer, sendChatText } from '../lib/chatText'
import { emptyOfferComposer, makeOfferOnce, observeOfferComposer, respondOfferOnce } from '../lib/chatOffers'
import { emptyAttachment, observeAttachment, sendChatImage, uploadChatAttachment } from '../lib/chatAttachments'
import { shouldFollowChat, nearChatBottom } from '../lib/chatScroll'
import { REACTIONS, type Conversation, type Deal, type Message, type Offer, type Reaction, type ReactionEmoji } from '../lib/types'

// One tap fills the message box; the text can still be edited before sending.
const BUYER_REPLIES = ['Is this still available?', 'Would you take ₹', 'Can we meet today?', 'Could you send a few more photos?']
const SELLER_REPLIES = ['Yes, it is still available.', 'When can you pick it up?', 'Sorry, the price is fixed.', 'Sorry, it has been sold.']

interface SharedListing { id: string; title: string; photos: string[]; price_inr: number; listing_type: string; status: string }

// "just now", "5m ago", "2h ago", then a clock time or date, like Instagram's Seen line.
function seenAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ago`
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function ListingCardMini({ l }: { l: SharedListing | undefined }) {
  const [thumb] = usePhotoThumbs(l?.photos?.length ? [l.photos[0]] : [])
  if (!l) return <div className="shared-listing muted small">Listing no longer available</div>
  return (
    <Link to={`/listing/${l.id}`} className="shared-listing">
      {thumb ? <img src={thumb} alt="" /> : <span className="shared-thumb" />}
      <span><strong>{l.title}</strong><span className="small">{l.listing_type === 'giveaway' ? 'Free' : inr(l.price_inr)}{l.status !== 'active' ? ` · ${l.status}` : ''}</span></span>
    </Link>
  )
}

function Bubble({ m, mine, me, quoted, quotedName, listing, reactions, onReport, onReply, onReact, canAct }: {
  m: Message; mine: boolean; me: string; quoted?: Message; quotedName?: string; listing?: SharedListing
  reactions?: { counts: [ReactionEmoji, number][]; mine: ReactionEmoji | null }
  onReport: () => void; onReply: () => void; onReact: (e: ReactionEmoji) => void; canAct: boolean
}) {
  const [img] = useSignedUrls('chat-attachments', m.image_path ? [m.image_path] : [])
  const [picking, setPicking] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const [dx, setDx] = useState(0)
  const jump = () => document.getElementById(`m-${m.reply_to_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return (
    <div id={`m-${m.id}`} className={`bubble-row ${mine ? 'mine' : ''}`}
      onTouchStart={(e) => { if (canAct) touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
      onTouchMove={(e) => { const t = touch.current; if (!t) return; const x = e.touches[0].clientX - t.x; if (Math.abs(e.touches[0].clientY - t.y) > 30) { touch.current = null; setDx(0); return } setDx(Math.max(0, Math.min(x, 80))) }}
      onTouchEnd={() => { if (dx > 56) onReply(); touch.current = null; setDx(0) }}
      style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
      <div className={`bubble ${mine ? 'mine' : ''}${picking ? ' picked' : ''}`} role="button" tabIndex={0} aria-label="Message options" aria-expanded={picking}
        onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button')) setPicking((v) => !v) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setPicking((v) => !v) }}
        onDoubleClick={() => { if (canAct) { setPicking(false); onReact('❤️') } }}>
        {m.reply_to_id && (
          <button type="button" className="quote" onClick={jump}>
            <strong className="small">{quoted ? (quoted.sender_id === me ? 'You' : quotedName) : ''}</strong>
            <span className="small">{quoted ? (quoted.body || (quoted.image_path ? 'Photo' : '')) : 'Original message unavailable'}</span>
          </button>
        )}
        {m.shared_listing_id !== undefined && m.shared_listing_id !== null && <ListingCardMini l={listing} />}
        {img && <img src={img} alt="attachment" />}
        {m.body && <div>{m.body}</div>}
        <div className="msg-time">
          {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>
      {!!reactions?.counts.length && (
        <div className="reactions">
          {reactions.counts.map(([e, n]) => (
            <button key={e} className={reactions.mine === e ? 'on' : ''} disabled={!canAct} onClick={() => onReact(e)} aria-label={`${e} ${n}${reactions.mine === e ? ', yours: tap to remove' : ''}`}>{e}{n > 1 ? ` ${n}` : ''}</button>
          ))}
        </div>
      )}
      {picking && (
        <div className="msg-menu">
          {canAct && (
            <div className="react-picker" role="group" aria-label="Pick a reaction">
              {REACTIONS.map((e) => <button key={e} className={reactions?.mine === e ? 'on' : ''} onClick={() => { setPicking(false); onReact(e) }}>{e}</button>)}
            </div>
          )}
          <div className="msg-actions">
            {canAct && <button onClick={() => { setPicking(false); onReply() }}>Reply</button>}
            {!mine && <button onClick={() => { setPicking(false); onReport() }}>Report</button>}
          </div>
        </div>
      )}
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
  const messageList = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const previousLast = useRef<string | null>(null)
  const [newMessages, setNewMessages] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [dealBusy, setDealBusy] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const replyRef = useRef<Message | null>(null)
  useEffect(() => { replyRef.current = replyTo }, [replyTo])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [shared, setShared] = useState<Record<string, SharedListing>>({})
  const [requestBusy, setRequestBusy] = useState(false)

  useEffect(() => {
    if (!memberId) return
    const current = observeTextComposer({
      newId: () => crypto.randomUUID(),
      write: request => sendChatText(supabase, id, memberId, request),
      replyTo: () => replyRef.current?.id,
      sent: () => setReplyTo(null),
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

  // Reactions for this chat, kept live. Removing a reaction is an update to null, so a filtered subscription sees it.
  useEffect(() => {
    let live = true
    const load = () => supabase.from('message_reactions').select('message_id,user_id,conversation_id,emoji').eq('conversation_id', id)
      .then(({ data }) => { if (live && data) setReactions(data as Reaction[]) })
    void load()
    const ch = supabase.channel(`react-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `conversation_id=eq.${id}` }, () => { void load() })
      .subscribe()
    return () => { live = false; void supabase.removeChannel(ch) }
  }, [id, attempt])

  // Listing cards shown inside messages.
  const sharedKey = [...new Set(msgs.map((m) => m.shared_listing_id).filter((x): x is string => !!x))].sort().join(',')
  useEffect(() => {
    if (!sharedKey) return
    let live = true
    void supabase.from('listings').select('id,title,photos,price_inr,listing_type,status').in('id', sharedKey.split(','))
      .then(({ data }) => { if (live && data) setShared(Object.fromEntries((data as SharedListing[]).map((l) => [l.id, l]))) })
    return () => { live = false }
  }, [sharedKey])

  const toLatest = () => {
    const list = messageList.current
    if (list) list.scrollTop = list.scrollHeight
    following.current = true
    setNewMessages(false)
  }
  useLayoutEffect(() => {
    const last = msgs.at(-1)
    if (!last || !messageList.current) return
    if (shouldFollowChat(previousLast.current, last.id, last.sender_id === memberId, following.current)) toLatest()
    else if (last.id !== previousLast.current) setNewMessages(true)
    previousLast.current = last.id
  }, [msgs, memberId])
  useEffect(() => {
    const list = messageList.current
    if (!list) return
    const resize = new ResizeObserver(() => { if (following.current) list.scrollTop = list.scrollHeight })
    resize.observe(list)
    return () => resize.disconnect()
  }, [loading])
  useEffect(() => {
    let live = true, busy = false, acknowledged = false
    const read = async () => {
      if (!live || busy || acknowledged || document.hidden || !messageList.current || !nearChatBottom(messageList.current) || !msgs.length) return
      busy = true
      try {
        const { error } = await supabase.rpc('mark_conversation_seen', { p_conversation: id, p_messages: msgs.map(m => m.id) })
        if (!error && live) {
          acknowledged = true
          window.dispatchEvent(new Event('notices-changed'))
        }
      } finally { busy = false }
    }
    void read().catch(() => {})
    const trigger = () => { void read().catch(() => {}) }
    window.addEventListener('focus', trigger)
    document.addEventListener('visibilitychange', trigger)
    const list = messageList.current
    list?.addEventListener('scroll', trigger)
    return () => { live = false; window.removeEventListener('focus', trigger); document.removeEventListener('visibilitychange', trigger); list?.removeEventListener('scroll', trigger) }
  }, [msgs, id])

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
  const direct = conv.kind === 'direct'
  const status = conv.request_status ?? 'accepted'
  // In a direct chat buyer_id started it; the receiver decides on a pending request.
  const waitingOnMe = direct && status !== 'accepted' && conv.seller_id === profile.id
  const canSend = status === 'accepted' || (status === 'pending' && conv.buyer_id === profile.id)
  const byId = new Map(msgs.map((m) => [m.id, m]))
  // Instagram-style receipt: only under the newest message, and only when it is mine.
  const lastMsg = msgs.at(-1)
  const receipt = lastMsg && lastMsg.sender_id === profile.id ? lastMsg : null
  const grouped = groupReactions(reactions, profile.id)
  const nameOf = (sender: string) => sender === profile.id ? 'You' : (otherName ?? '')

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
  const answerRequest = async (accept: boolean) => {
    setErr('')
    setRequestBusy(true)
    const { error } = await supabase.rpc('respond_request', { p_conversation: id, p_accept: accept })
    setRequestBusy(false)
    if (error) setErr(error.message)
    else { window.dispatchEvent(new Event('notices-changed')); setAttempt(n => n + 1) }
  }
  const reactTo = async (m: Message, emoji: ReactionEmoji) => {
    const current = grouped.get(m.id)?.mine ?? null
    const next = current === emoji ? null : emoji
    // Show it at once; the realtime refresh confirms or corrects it.
    setReactions((rs) => [...rs.filter((r) => !(r.message_id === m.id && r.user_id === profile.id)), { message_id: m.id, user_id: profile.id, conversation_id: id, emoji: next }])
    try { await react(supabase, { message_id: m.id, conversation_id: id, user_id: profile.id }, emoji, current) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save your reaction.'); setAttempt(n => n + 1) }
  }
  const startReply = (m: Message) => { setReplyTo(m); input.current?.focus() }
  const quickReply = (reply: string) => {
    composer.current?.edit(reply)
    input.current?.focus()
  }
  const canSell = !direct && !isBuyer && !deal && (conv.listing?.status === 'active' || conv.listing?.status === 'reserved')
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
          <div className="small muted">{direct ? (status === 'pending' ? (waitingOnMe ? 'Message request' : 'Request sent') : 'Direct message') : <Link to={`/listing/${conv.listing_id}`}>{conv.listing?.title}</Link>}</div>
        </div>
        <button className="link" onClick={block}>Block</button>
      </div>
      <div className="messages" ref={messageList} onScroll={() => { if (messageList.current) following.current = nearChatBottom(messageList.current); if (following.current) setNewMessages(false) }} onLoadCapture={() => { if (following.current) toLatest() }}>
        {msgs.map((m) => {
          const q = m.reply_to_id ? byId.get(m.reply_to_id) : undefined
          return <Bubble key={m.id} m={m} me={profile.id} mine={m.sender_id === profile.id} quoted={q} quotedName={q ? nameOf(q.sender_id) : undefined}
            listing={m.shared_listing_id ? shared[m.shared_listing_id] : undefined} reactions={grouped.get(m.id)} canAct={canSend}
            onReport={() => reportMsg(m)} onReply={() => startReply(m)} onReact={(e) => void reactTo(m, e)} />
        })}
        {receipt && <div className="receipt" aria-live="polite">{receipt.read_at ? `Seen ${seenAgo(receipt.read_at)}` : 'Sent'}</div>}
      </div>
      {newMessages && <button className="new-messages" onClick={toLatest}>New messages ↓</button>}
      {!direct && pending && (
        <div className="offer-bar">
          Offer: <strong>{inr(pending.amount_inr)}</strong>
          {!isBuyer && (<><button className="primary" disabled={offerBusy} onClick={() => respond(pending, true)}>Accept</button><button disabled={offerBusy} onClick={() => respond(pending, false)}>Decline</button></>)}
          {isBuyer && <span className="muted"> waiting for seller</span>}
        </div>
      )}
      {!direct && isBuyer && !pending && conv.listing?.status === 'active' && (
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
      {waitingOnMe && (
        <div className="offer-bar request-bar">
          <span><strong>{otherName}</strong> {status === 'declined' ? 'had a request you declined.' : 'wants to message you. Accept to reply, or decline to hide it.'}</span>
          <button className="primary" disabled={requestBusy} onClick={() => void answerRequest(true)}>Accept</button>
          {status === 'pending' && <button disabled={requestBusy} onClick={() => void answerRequest(false)}>Decline</button>}
          <button className="link" onClick={block}>Block</button>
        </div>
      )}
      {direct && status === 'pending' && !waitingOnMe && <p className="muted small deal-note">Request sent. {otherName} can reply once they accept.</p>}
      {direct && status === 'declined' && !waitingOnMe && <p className="muted small deal-note">{otherName} isn’t accepting messages from you.</p>}
      {canSend && !direct && !msgs.some((m) => m.sender_id === profile.id) && (
      <div className={text.trim() ? "quick-replies composing" : "quick-replies"} role="group" aria-label="Quick replies">
          {(isBuyer ? BUYER_REPLIES : SELLER_REPLIES).map((reply) => (
            <button key={reply} type="button" onClick={() => quickReply(reply)}>{reply.endsWith('₹') ? `${reply}…?` : reply}</button>
          ))}
      </div>
      )}
      {canSend && replyTo && (
        <div className="reply-preview">
          <div><strong className="small">Replying to {nameOf(replyTo.sender_id) === 'You' ? 'yourself' : nameOf(replyTo.sender_id)}</strong><span className="small muted">{replyTo.body || 'Photo'}</span></div>
          <button className="icon-btn" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}
      {canSend && <form className="composer" onSubmit={send} aria-busy={sending || photoState.busy}>
        <label className="attach" title="Attach photo"><Clip /><input type="file" accept="image/*" hidden disabled={photoState.busy || photoState.locked} onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} /></label>
        {canTakePhoto() && <label className="attach" title="Take photo"><Camera /><input type="file" accept="image/*" capture="environment" hidden disabled={photoState.busy || photoState.locked} onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} /></label>}
        <input ref={input} value={text} onChange={(e) => composer.current?.edit(e.target.value)} maxLength={2000} placeholder="Message" />
        <button className="primary send" aria-label={sending ? 'Sending' : 'Send'} disabled={sending || !text.trim()}><ArrowUp /></button>
      </form>}
    </div>
  )
}
