import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as settle } from 'node:timers/promises'
import { observeConversation } from '../src/lib/conversationState.ts'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function fixture(t) {
  const conversation = deferred()
  const messages = [], offers = [], snapshots = []
  let messageEvent, offerEvent, reads = 0, subscriptions = 0, removals = 0
  const dispose = observeConversation('c1', {
    loadConversation: () => conversation.promise,
    loadMessages: () => { const r = deferred(); messages.push(r); return r.promise },
    loadOffers: () => { const r = deferred(); offers.push(r); return r.promise },
    markRead: async () => { reads++ },
    subscribe: (m, o) => { subscriptions++; messageEvent = m; offerEvent = o; return () => { removals++ } },
    publish: value => snapshots.push(value),
  })
  t.after(dispose)
  return {
    conversation, messages, offers, snapshots, dispose,
    messageEvent: () => messageEvent(), offerEvent: () => offerEvent(),
    get current() { return snapshots.at(-1) },
    get reads() { return reads },
    get subscriptions() { return subscriptions },
    get removals() { return removals },
    open: async () => { conversation.resolve({ id: 'c1', buyer_id: 'a', seller_id: 'b' }); await settle() },
  }
}

test('unavailable conversations end loading without fetching messages or marking read', async t => {
  const f = fixture(t)
  f.conversation.resolve(null)
  await settle()
  assert.equal(f.current.loading, false)
  assert.equal(f.current.conversation, null)
  assert.equal(f.current.error, '')
  assert.equal(f.messages.length, 0)
  assert.equal(f.subscriptions, 0)
  assert.equal(f.reads, 0)
})

test('conversation query failures end loading with a retryable error', async t => {
  const f = fixture(t)
  f.conversation.reject(new Error('offline'))
  await settle()
  assert.equal(f.current.loading, false)
  assert.match(f.current.error, /try again/i)
  assert.equal(f.subscriptions, 0)
})

test('a fresh attempt loads after a failed attempt was disposed', async t => {
  const failed = fixture(t)
  failed.conversation.reject(new Error('offline'))
  await settle()
  failed.dispose()
  const retry = fixture(t)
  await retry.open()
  retry.messages[0].resolve([{ id: 'm1', conversation_id: 'c1' }])
  retry.offers[0].resolve([])
  await settle()
  assert.equal(retry.current.conversation.id, 'c1')
  assert.equal(retry.current.messages[0].id, 'm1')
  assert.equal(retry.current.error, '')
  assert.equal(retry.reads, 1)
})

test('navigation before metadata arrives cannot open subscriptions or publish old chat', async t => {
  const f = fixture(t)
  f.dispose()
  const count = f.snapshots.length
  await f.open()
  assert.equal(f.snapshots.length, count)
  assert.equal(f.subscriptions, 0)
  assert.equal(f.messages.length, 0)
})

test('navigation during message loads removes subscription and prevents old read receipts', async t => {
  const f = fixture(t)
  await f.open()
  f.dispose()
  const count = f.snapshots.length
  f.messages[0].resolve([{ id: 'old' }])
  f.offers[0].resolve([{ id: 'old-offer' }])
  f.messageEvent()
  f.offerEvent()
  await settle()
  assert.equal(f.removals, 1)
  assert.equal(f.snapshots.length, count)
  assert.equal(f.messages.length, 1)
  assert.equal(f.offers.length, 1)
  assert.equal(f.reads, 0)
})

test('out-of-order realtime message queries preserve the newest result', async t => {
  const f = fixture(t)
  await f.open()
  f.messageEvent()
  f.messages[1].resolve([{ id: 'latest' }])
  await settle()
  f.messages[0].resolve([{ id: 'outdated' }])
  await settle()
  assert.equal(f.current.messages[0].id, 'latest')
  assert.equal(f.reads, 1)
})

test('out-of-order offer queries cannot restore an obsolete pending offer', async t => {
  const f = fixture(t)
  await f.open()
  f.offerEvent()
  f.offers[1].resolve([{ id: 'o1', status: 'accepted' }])
  await settle()
  f.offers[0].resolve([{ id: 'o1', status: 'pending' }])
  await settle()
  assert.equal(f.current.offers[0].status, 'accepted')
})

test('message and offer failures are visible rather than indistinguishable from empty data', async t => {
  const f = fixture(t)
  await f.open()
  f.messages[0].reject(new Error('network'))
  await settle()
  assert.equal(f.current.messageStatus, 'error')
  f.offers[0].reject(new Error('network'))
  await settle()
  assert.match(f.current.error, /load offers.*try again/i)
  assert.equal(f.reads, 0)
})

test('a response for a different conversation cannot open the route', async t => {
  const f = fixture(t)
  f.conversation.resolve({ id: 'c2' })
  await settle()
  assert.equal(f.current.conversation, null)
  assert.equal(f.current.loading, false)
  assert.equal(f.subscriptions, 0)
})
