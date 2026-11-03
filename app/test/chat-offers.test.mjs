import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeOfferOnce, observeOfferComposer, respondOfferOnce } from '../src/lib/chatOffers.ts'

const success = data => ({ data, error: null })
const failure = { data: null, error: { message: 'denied' } }
const request = { id: 'o1', amount: 300 }
const offer = { id: 'o1', conversation_id: 'c1', buyer_id: 'buyer', amount_inr: 300, status: 'pending' }
function api(...responses) {
  const calls = []
  const next = () => {
    assert.ok(responses.length, 'unexpected API call')
    const response = responses.shift()
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  }
  return { calls, rpc(name, args) { calls.push({ rpc: name, args }); return next() }, from(table) {
    const call = { table, query: [] }, b = {}
    calls.push(call)
    for (const method of ['select', 'eq']) b[method] = (...args) => { call.query.push([method, ...args]); return b }
    b.single = next
    return b
  } }
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function composer(make = async () => {}, respond = async () => {}) {
  const states = [], requests = [], responses = [], confirmations = []
  let ids = 0
  const current = observeOfferComposer({ conversation: 'c1', member: 'buyer', newId: () => `o${++ids}`,
    make: r => { requests.push(r); return make(r) }, respond: (id, accept) => { responses.push({ id, accept }); return respond(id, accept) },
    publish: s => states.push(s), confirmed: () => confirmations.push(true),
  })
  return { ...current, states, requests, responses, confirmations, latest: () => states.at(-1) }
}

for (const status of ['pending', 'accepted', 'declined']) test(`offer creation confirms the matching request even if already ${status}`, async () => {
  const client = api(success('o1'), success({ ...offer, status }))
  await makeOfferOnce(client, 'c1', 'buyer', request)
  assert.deepEqual(client.calls[0], { rpc: 'make_offer_once', args: { p_conversation: 'c1', p_amount: 300, p_request: 'o1' } })
  assert.deepEqual(client.calls[1].query[1], ['eq', 'id', 'o1'])
})

for (const [name, response] of [['rejection', failure], ['wrong returned ID', success('other')], ['network exception', new Error('lost response')]]) {
  test(`offer RPC ${name} cannot report success`, async () => {
    const client = api(response)
    await assert.rejects(makeOfferOnce(client, 'c1', 'buyer', request))
    assert.equal(client.calls.length, 1)
  })
}

for (const [name, response] of [
  ['missing row', success(null)], ['failed read', failure],
  ...Object.entries({ id: 'other', conversation_id: 'other', buyer_id: 'other', amount_inr: 301, status: 'invalid' }).map(([field, value]) => [`wrong ${field}`, success({ ...offer, [field]: value })]),
]) test(`offer read-back ${name} is not confirmed`, async () => {
  await assert.rejects(makeOfferOnce(api(success('o1'), response), 'c1', 'buyer', request))
})

test('invalid amounts are rejected before calling the RPC', async () => {
  const client = api()
  for (const amount of [-1, NaN, Infinity, 1.5, 2147483648]) await assert.rejects(makeOfferOnce(client, 'c1', 'buyer', { id: 'o1', amount }))
  assert.equal(client.calls.length, 0)
})

for (const accept of [true, false]) test(`response ${accept} confirms the exact conversation/offer and target state`, async () => {
  const client = api(success(null), success({ id: 'o1', conversation_id: 'c1', status: accept ? 'accepted' : 'declined' }))
  await respondOfferOnce(client, 'c1', 'o1', accept)
  assert.deepEqual(client.calls[0], { rpc: 'respond_offer_once', args: { p_offer: 'o1', p_accept: accept } })
})

test('rejected response cannot look successful merely because a readable offer exists', async () => {
  const client = api(failure)
  await assert.rejects(respondOfferOnce(client, 'c1', 'o1', true))
  assert.equal(client.calls.length, 1)
})

for (const data of [null, { id: 'other', conversation_id: 'c1', status: 'accepted' }, { id: 'o1', conversation_id: 'other', status: 'accepted' }, { id: 'o1', conversation_id: 'c1', status: 'pending' }]) {
  test(`mismatched response read-back ${JSON.stringify(data)} cannot report acceptance`, async () => {
    await assert.rejects(respondOfferOnce(api(success(null), success(data)), 'c1', 'o1', true))
  })
}

test('pending creation preserves its amount and blocks duplicate/response clicks', async () => {
  const pending = deferred(), c = composer(() => pending.promise)
  c.edit('300')
  const sending = c.make()
  await c.make(); await c.respond('other', false)
  assert.equal(c.latest().amount, '300')
  assert.equal(c.latest().busy, true)
  assert.deepEqual(c.requests, [{ id: 'o1', amount: 300 }])
  assert.equal(c.responses.length, 0)
  pending.resolve(); await sending
  assert.deepEqual(c.latest(), { amount: '', busy: false, error: '' })
  assert.equal(c.confirmations.length, 1)
})

test('uncertain creation reuses its ID; changed amounts and later confirmed intents use fresh IDs', async () => {
  let fail = true
  const c = composer(async () => { if (fail) throw new Error('lost response') })
  c.edit('300'); await c.make(); await c.make()
  c.edit('400'); await c.make()
  fail = false; await c.make()
  c.edit('400'); await c.make()
  assert.deepEqual(c.requests.map(r => r.id), ['o1', 'o1', 'o2', 'o2', 'o3'])
})

test('newer amount edits survive successful creation', async () => {
  const pending = deferred(), c = composer(() => pending.promise)
  c.edit('300'); const sending = c.make(); c.edit('400')
  pending.resolve(); await sending
  assert.equal(c.latest().amount, '400')
})

test('invalid draft validation never takes the action lock or writes', async () => {
  const c = composer()
  for (const draft of ['', ' ', '-1', '1.5', 'NaN', '2147483648']) { c.edit(draft); await c.make(); assert.equal(c.latest().busy, false) }
  assert.equal(c.requests.length, 0)
  c.edit('0'); await c.make()
  assert.deepEqual(c.requests, [{ id: 'o1', amount: 0 }])
})

test('visible acknowledgement resolves a lost response and permits a later same-price intent with a new ID', async () => {
  let fail = true
  const c = composer(async () => { if (fail) throw new Error('lost response') })
  c.edit('300'); await c.make()
  assert.ok(c.latest().error)
  c.acknowledge([{ ...offer, status: 'declined' }])
  assert.equal(c.latest().amount, '')
  assert.equal(c.latest().error, '')
  fail = false; c.edit('300'); await c.make()
  assert.deepEqual(c.requests.map(r => r.id), ['o1', 'o2'])
})

test('acknowledgements must match ID, conversation, buyer and amount', async () => {
  const c = composer(async () => { throw new Error('lost response') })
  c.edit('300'); await c.make()
  for (const changed of [{ id: 'other' }, { conversation_id: 'other' }, { buyer_id: 'other' }, { amount_inr: 400 }]) {
    c.acknowledge([{ ...offer, ...changed }])
    assert.equal(c.latest().amount, '300')
    assert.ok(c.latest().error)
  }
})

test('a realtime acknowledgement preserves newer edits and suppresses a late transport failure', async () => {
  const pending = deferred(), c = composer(() => pending.promise)
  c.edit('300'); const sending = c.make(); c.edit('400')
  c.acknowledge([offer])
  pending.reject(new Error('lost response')); await sending
  assert.equal(c.latest().amount, '400')
  assert.equal(c.latest().error, '')
})

test('response guard blocks opposing/duplicate decisions and another creation until completion', async () => {
  const pending = deferred(), c = composer(undefined, () => pending.promise)
  c.edit('300'); const sending = c.respond('o1', true)
  await c.respond('o1', false); await c.respond('o1', true); await c.make()
  assert.deepEqual(c.responses, [{ id: 'o1', accept: true }])
  assert.equal(c.requests.length, 0)
  pending.resolve(); await sending
  assert.equal(c.latest().busy, false)
  assert.equal(c.latest().amount, '300')
})

for (const action of ['make', 'respond']) for (const outcome of ['success', 'failure']) {
  test(`disposed actor ignores late ${action} ${outcome}`, async () => {
    const pending = deferred(), c = composer(() => pending.promise, () => pending.promise)
    c.edit('300')
    const sending = action === 'make' ? c.make() : c.respond('o1', true)
    c.dispose(); const count = c.states.length
    if (outcome === 'success') pending.resolve(); else pending.reject(new Error('old failure'))
    await sending; c.acknowledge([offer]); c.edit('400'); await c.make(); await c.respond('o1', false)
    assert.equal(c.states.length, count)
    assert.equal(c.confirmations.length, 0)
  })
}
