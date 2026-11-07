import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadInbox, observeInbox } from '../src/lib/inboxState.ts'

const success = data => ({ data, error: null })
const failure = { data: null, error: { message: 'offline' } }
const conversation = { id: 'c1', listing_id: 'l1', buyer_id: 'u1', seller_id: 'u2', listing: { title: 'Fixture' } }
const data = { conversations: [conversation], unread: { c1: 2 } }
const flush = () => new Promise(resolve => setImmediate(resolve))
function api(conversations = success([conversation]), counts = success([{ conversation_id: 'c1', unread: '2' }])) {
  const calls = []
  return { calls, from(table) {
    const call = { table, query: [] }, b = {}; calls.push(call)
    for (const method of ['select', 'or', 'order', 'limit']) b[method] = (...args) => { call.query.push([method, ...args]); return b }
    b.then = (yes, no) => (conversations instanceof Error ? Promise.reject(conversations) : Promise.resolve(conversations)).then(yes, no)
    return b
  }, rpc(name) { calls.push({ rpc: name }); return counts instanceof Error ? Promise.reject(counts) : Promise.resolve(counts) } }
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function observer(load) {
  const states = []
  let changed, unsubscribe = 0
  const current = observeInbox({ load, publish: s => states.push(s), subscribe: callback => { changed = callback; return () => { unsubscribe++ } } })
  return { ...current, states, changed: () => changed(), unsubscribed: () => unsubscribe, latest: () => states.at(-1) }
}

test('personal Inbox applies participant filtering for every account, preserving joins and unread counts', async () => {
  const client = api()
  assert.deepEqual(await loadInbox(client, 'u1'), data)
  assert.equal(client.calls[0].table, 'conversations')
  assert.deepEqual(client.calls[0].query.slice(1), [['or', 'buyer_id.eq.u1,seller_id.eq.u1'], ['order', 'created_at', { ascending: false }], ['order', 'created_at', { referencedTable: 'last', ascending: false }], ['limit', 1, { referencedTable: 'last' }]])
  assert.match(client.calls[0].query[0][1], /listing:listings\(title,photos,status\)/)
  assert.match(client.calls[0].query[0][1], /buyer:profiles!conversations_buyer_id_fkey\(display_name\)/)
  assert.deepEqual(client.calls[1], { rpc: 'unread_counts' })
  assert.equal((await loadInbox(api(), 'u2')).conversations.length, 1, 'seller side remains visible')
})
test('unknown account cannot start personal queries', async () => {
  const client = api()
  await assert.rejects(loadInbox(client, ''))
  assert.equal(client.calls.length, 0)
})
test('successful empty results differ from failed reads, and unrelated count rows cannot create badges', async () => {
  assert.deepEqual(await loadInbox(api(success([]), success([])), 'u1'), { conversations: [], unread: {} })
  assert.deepEqual(await loadInbox(api(success([conversation]), success([{ conversation_id: 'elsewhere', unread: 10 }])), 'u1'), { conversations: [conversation], unread: {} })
})
for (const [name, result] of [['query error', failure], ['missing data', success(null)], ['non-array', success({})], ['network exception', new Error('offline')]]) {
  for (const target of ['conversations', 'counts']) test(`${target} ${name} cannot look like a successfully empty Inbox`, async () => {
    await assert.rejects(loadInbox(target === 'conversations' ? api(result) : api(undefined, result), 'u1'))
  })
}
test('a response containing unrelated conversations is refused even for a broader admin API', async () => {
  await assert.rejects(loadInbox(api(success([{ ...conversation, buyer_id: 'other', seller_id: 'another' }])), 'admin'), /participant/)
  await assert.rejects(loadInbox(api(success([null])), 'u1'), /participant/)
})
for (const unread of [-1, 0.5, 'oops', '', null, Number.MAX_SAFE_INTEGER + 1]) test(`invalid unread count ${JSON.stringify(unread)} cannot erase confirmed badges`, async () => {
  await assert.rejects(loadInbox(api(undefined, success([{ conversation_id: 'c1', unread }])), 'u1'), /Invalid/)
})
test('initial failure ends loading with unknown data and retry can confirm an empty Inbox', async () => {
  let fail = true
  const current = observer(async () => { if (fail) throw new Error('offline'); return { conversations: [], unread: {} } })
  await flush()
  assert.equal(current.latest().loading, false); assert.equal(current.latest().conversations, null); assert.ok(current.latest().error)
  fail = false; await current.reload()
  assert.deepEqual(current.latest(), { conversations: [], unread: {}, loading: false, error: '' })
})
test('failed refresh retains the last confirmed conversations and badges together', async () => {
  let fail = false
  const current = observer(async () => { if (fail) throw new Error('offline'); return data })
  await flush(); fail = true; current.changed(); await flush()
  assert.deepEqual(current.latest().conversations, data.conversations); assert.deepEqual(current.latest().unread, data.unread)
  assert.equal(current.latest().loading, false); assert.ok(current.latest().error)
})
for (const outcome of ['success', 'failure']) test(`older refresh ${outcome} cannot replace a newer confirmed snapshot`, async () => {
  const old = deferred(), newest = { conversations: [{ ...conversation, id: 'c2' }], unread: { c2: 1 } }
  let first = true
  const current = observer(() => { if (first) { first = false; return old.promise } return Promise.resolve(newest) })
  current.changed(); await flush()
  if (outcome === 'success') old.resolve(data)
  else old.reject(new Error('old error'))
  await flush()
  assert.deepEqual(current.latest(), { ...newest, loading: false, error: '' })
})
for (const outcome of ['success', 'failure']) test(`disposed account ignores late ${outcome}, stops subscription and cannot reload`, async () => {
  const pending = deferred(); let calls = 0
  const old = observer(() => { calls++; return pending.promise })
  old.dispose(); const count = old.states.length
  const current = observer(async () => ({ conversations: [], unread: {} }))
  if (outcome === 'success') pending.resolve(data)
  else pending.reject(new Error('old error'))
  await flush(); await old.reload(); old.changed()
  assert.equal(old.states.length, count); assert.equal(old.unsubscribed(), 1); assert.equal(calls, 1)
  assert.deepEqual(current.latest().conversations, []); assert.deepEqual(current.latest().unread, {})
})
test('a synchronous loader exception is retryable without escaping the observer', async () => {
  const current = observer(() => { throw new Error('offline') })
  await flush(); assert.equal(current.latest().loading, false); assert.ok(current.latest().error)
})
