import type { Conversation, Message, Offer } from './types'

export interface ConversationSnapshot {
  conversation: Conversation | null
  messages: Message[]
  offers: Offer[]
  messageStatus: 'loading' | 'ready' | 'error'
  loading: boolean
  error: string
}

interface ConversationSource {
  loadConversation: () => Promise<Conversation | null>
  loadMessages: () => Promise<Message[]>
  loadOffers: () => Promise<Offer[]>
  markRead?: () => Promise<unknown>
  subscribe: (messagesChanged: () => void, offersChanged: () => void) => () => void
  publish: (snapshot: ConversationSnapshot) => void
}

export const emptyConversation = (): ConversationSnapshot => ({
  conversation: null, messages: [], offers: [], messageStatus: 'loading', loading: true, error: '',
})

// A subscription and its loads belong to one route instance. Independent
// counters prevent slow realtime queries from replacing newer query results.
export function observeConversation(id: string, source: ConversationSource) {
  let active = true
  let messageRevision = 0
  let offerRevision = 0
  let unsubscribe = () => {}
  let snapshot = emptyConversation()
  const publish = (next: Partial<ConversationSnapshot>) => {
    if (!active) return
    snapshot = { ...snapshot, ...next }
    source.publish(snapshot)
  }
  publish(snapshot)

  const loadMessages = async () => {
    if (!active) return
    const revision = ++messageRevision
    try {
      const messages = await source.loadMessages()
      if (!active || revision !== messageRevision) return
      publish({ messages, messageStatus: 'ready' })
      // A navigation that disposed this observer cannot mark the old chat read.
      void source.markRead?.().catch(() => { /* Read receipts can retry on the next refresh. */ })
    } catch {
      if (revision === messageRevision) publish({ messageStatus: 'error' })
    }
  }
  const loadOffers = async () => {
    if (!active) return
    const revision = ++offerRevision
    try {
      const offers = await source.loadOffers()
      if (active && revision === offerRevision) publish({ offers })
    } catch {
      if (revision === offerRevision) publish({ error: 'Could not load offers. Please try again.' })
    }
  }

  void (async () => {
    try {
      const conversation = id ? await source.loadConversation() : null
      if (!active) return
      if (!conversation || conversation.id !== id) {
        publish({ loading: false })
        return
      }
      publish({ conversation, loading: false })
      void loadMessages()
      void loadOffers()
      unsubscribe = source.subscribe(() => { void loadMessages() }, () => { void loadOffers() })
    } catch {
      publish({ loading: false, error: 'Could not load this conversation. Please try again.' })
    }
  })()

  return () => {
    active = false
    ++messageRevision
    ++offerRevision
    unsubscribe()
  }
}
