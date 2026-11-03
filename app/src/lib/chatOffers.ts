import type { SupabaseClient } from '@supabase/supabase-js'
import type { Offer } from './types'

type OfferApi = Pick<SupabaseClient, 'from' | 'rpc'>
export interface OfferRequest { id: string; amount: number }
export interface OfferComposer { amount: string; busy: boolean; error: string }
export const emptyOfferComposer = (): OfferComposer => ({ amount: '', busy: false, error: '' })

export async function makeOfferOnce(api: OfferApi, conversation: string, buyer: string, request: OfferRequest) {
  if (!Number.isInteger(request.amount) || request.amount < 0 || request.amount > 2147483647) throw new Error('Invalid offer amount')
  const result = await api.rpc('make_offer_once', { p_conversation: conversation, p_amount: request.amount, p_request: request.id })
  if (result.error || result.data !== request.id) throw new Error('Offer request could not be confirmed')
  const confirmed = await api.from('offers').select('id,conversation_id,buyer_id,amount_inr,status').eq('id', request.id).single()
  const offer = confirmed.data
  if (confirmed.error || offer?.id !== request.id || offer?.conversation_id !== conversation || offer?.buyer_id !== buyer || offer?.amount_inr !== request.amount || !['pending', 'accepted', 'declined'].includes(offer?.status)) {
    throw new Error('Offer could not be confirmed')
  }
}

export async function respondOfferOnce(api: OfferApi, conversation: string, id: string, accept: boolean) {
  const result = await api.rpc('respond_offer_once', { p_offer: id, p_accept: accept })
  if (result.error) throw new Error('Offer response could not be confirmed')
  const confirmed = await api.from('offers').select('id,conversation_id,status').eq('id', id).single()
  if (confirmed.error || confirmed.data?.id !== id || confirmed.data?.conversation_id !== conversation || confirmed.data?.status !== (accept ? 'accepted' : 'declined')) {
    throw new Error('Offer response could not be confirmed')
  }
}

interface OfferSource {
  conversation: string
  member: string
  newId: () => string
  make: (request: OfferRequest) => Promise<void>
  respond: (id: string, accept: boolean) => Promise<void>
  confirmed: () => void
  publish: (snapshot: OfferComposer) => void
}

export function observeOfferComposer(source: OfferSource) {
  let active = true, busy = false, revision = 0
  let pending: (OfferRequest & { revision: number }) | null = null
  const known = new Set<string>()
  let snapshot = emptyOfferComposer()
  const publish = (next: Partial<OfferComposer>) => {
    if (!active) return
    snapshot = { ...snapshot, ...next }
    source.publish(snapshot)
  }
  publish(snapshot)
  const edit = (amount: string) => {
    if (!active) return
    ++revision
    publish({ amount, error: '' })
  }
  const acknowledge = (offers: Pick<Offer, 'id' | 'conversation_id' | 'buyer_id' | 'amount_inr'>[]) => {
    if (!active || !pending) return
    const attempt = pending
    if (!offers.some(o => o.id === attempt.id && o.conversation_id === source.conversation && o.buyer_id === source.member && o.amount_inr === attempt.amount)) return
    known.add(attempt.id)
    pending = null
    publish({ error: '', ...(attempt.revision === revision ? { amount: '' } : {}) })
  }
  const make = async () => {
    if (!active || busy) return
    const draft = snapshot.amount.trim(), amount = Number(draft)
    if (!/^\d+$/.test(draft) || !Number.isInteger(amount) || amount > 2147483647) {
      publish({ error: 'Enter a whole INR amount between 0 and 2147483647.' })
      return
    }
    busy = true
    publish({ busy: true, error: '' })
    let attempt: (OfferRequest & { revision: number }) | null = null
    try {
      pending = { id: pending?.amount === amount ? pending.id : source.newId(), amount, revision }
      attempt = pending
      await source.make({ id: attempt.id, amount })
      if (!active) return
      known.add(attempt.id)
      if (pending?.id === attempt.id) pending = null
      publish({ error: '', ...(attempt.revision === revision ? { amount: '' } : {}) })
      source.confirmed()
    } catch {
      if (!attempt || !known.has(attempt.id)) publish({ error: 'Could not confirm the offer. Your amount is retained; try again.' })
    } finally {
      busy = false
      publish({ busy: false })
    }
  }
  const respond = async (id: string, accept: boolean) => {
    if (!active || busy) return
    busy = true
    publish({ busy: true, error: '' })
    try {
      await source.respond(id, accept)
      if (active) source.confirmed()
    } catch {
      publish({ error: 'Could not confirm the response. Refresh or retry the same response.' })
    } finally {
      busy = false
      publish({ busy: false })
    }
  }
  return { edit, make, respond, acknowledge, dispose: () => { active = false } }
}
