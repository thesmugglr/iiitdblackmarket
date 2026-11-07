import { test } from 'node:test'
import assert from 'node:assert/strict'
import { observeTextComposer, sendChatText } from '../src/lib/chatText.ts'

const success = data => ({ data, error: null })
const failure = { data: null, error: { message: 'denied' } }
const request = { id: 'm1', body: 'Hello' }
const message = { id: 'm1', conversation_id: 'c1', sender_id: 'u1', body: 'Hello', image_path: null }
function api(...responses) {
  const calls = []
  const result = () => {
    assert.ok(responses.length, 'unexpected API call')
    const response = responses.shift()
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  }
  return { calls, from(table) {
    const call = { table, query: [] }, b = {}
    calls.push(call)
    for (const method of ['upsert', 'select', 'eq']) b[method] = (...args) => { call.query.push([method, ...args]); return b }
    b.single = result
    b.then = (yes, no) => result().then(yes, no)
    return b
  } }
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function composer(write) {
  const states = [], calls = []
  let ids = 0
  const current = observeTextComposer({
    newId: () => `m${++ids}`,
    write: request => { calls.push({ ...request }); return write(request) },
    publish: state => states.push(state),
  })
  return { ...current, states, calls, latest: () => states.at(-1) }
}

test('text write uses a stable insert-only ID and confirms its exact message row', async () => {
  const client = api(success(null), success(message))
  await sendChatText(client, 'c1', 'u1', request)
  assert.deepEqual(client.calls[0], { table: 'messages', query: [['upsert', {
    id: 'm1', conversation_id: 'c1', sender_id: 'u1', body: 'Hello',
  }, { onConflict: 'id', ignoreDuplicates: true }]] })
  assert.deepEqual(client.calls[1].query, [['select', 'id,conversation_id,sender_id,body,image_path,reply_to_id'], ['eq', 'id', 'm1']])
})

for (const [name, response] of [['rejected', failure], ['uncertain network', new Error('response lost')]]) {
  test(`${name} insert cannot become a confirmed send`, async () => {
    const client = api(response)
    await assert.rejects(sendChatText(client, 'c1', 'u1', request))
    assert.equal(client.calls.length, 1)
  })
}

for (const [name, response] of [
  ['failed read', failure], ['missing row', success(null)], ['network failure', new Error('offline')],
  ...Object.entries({ id: 'different', conversation_id: 'different', sender_id: 'different', body: 'different', image_path: 'c1/photo.jpg' })
    .map(([field, value]) => [`mismatched ${field}`, success({ ...message, [field]: value })]),
]) test(`${name} cannot confirm a text message`, async () => {
  await assert.rejects(sendChatText(api(success(null), response), 'c1', 'u1', request))
})

test('blank and oversize messages are rejected without a write', async () => {
  const client = api()
  for (const body of ['  ', 'x'.repeat(2001)]) await assert.rejects(sendChatText(client, 'c1', 'u1', { id: 'm1', body }))
  assert.equal(client.calls.length, 0)
})

test('pending send retains the draft, trims only the payload and ignores duplicate submits', async () => {
  const pending = deferred(), c = composer(() => pending.promise)
  c.edit(' Hello ')
  const sending = c.send()
  assert.equal(c.latest().text, ' Hello ')
  assert.equal(c.latest().sending, true)
  await c.send()
  assert.deepEqual(c.calls, [{ id: 'm1', body: 'Hello' }])
  pending.resolve()
  await sending
  assert.deepEqual(c.latest(), { text: '', sending: false, error: '' })
})

test('failed send retains the draft; retry reuses its ID and a subsequent confirmed send gets a fresh one', async () => {
  let first = true
  const c = composer(async () => { if (first) { first = false; throw new Error('uncertain response') } })
  c.edit('Hello')
  await c.send()
  assert.equal(c.latest().text, 'Hello')
  assert.equal(c.latest().sending, false)
  assert.match(c.latest().error, /Press Send to retry/)
  await c.send()
  assert.equal(c.latest().text, '')
  c.edit('Hello')
  await c.send()
  assert.deepEqual(c.calls.map(r => r.id), ['m1', 'm1', 'm2'])
})

test('editing a failed draft sends a new payload with a new ID', async () => {
  const c = composer(async () => { throw new Error('offline') })
  c.edit('First')
  await c.send()
  c.edit('Second')
  await c.send()
  assert.deepEqual(c.calls, [{ id: 'm1', body: 'First' }, { id: 'm2', body: 'Second' }])
  assert.equal(c.latest().text, 'Second')
})

for (const finalDraft of ['New draft', 'Hello']) test(`confirmation preserves newer edits ending in ${finalDraft}`, async () => {
  const pending = deferred(), c = composer(() => pending.promise)
  c.edit('Hello')
  const sending = c.send()
  c.edit('New draft')
  c.edit(finalDraft)
  pending.resolve()
  await sending
  assert.equal(c.latest().text, finalDraft)
  assert.equal(c.latest().sending, false)
})

test('failure while editing never replaces the newer draft', async () => {
  const pending = deferred(), c = composer(() => pending.promise)
  c.edit('First')
  const sending = c.send()
  c.edit('Second')
  pending.reject(new Error('offline'))
  await sending
  assert.equal(c.latest().text, 'Second')
})

for (const result of ['success', 'failure']) test(`disposed account/route cannot publish a late send ${result}`, async () => {
  const pending = deferred(), old = composer(() => pending.promise)
  old.edit('Private old draft')
  const sending = old.send()
  old.dispose()
  const count = old.states.length
  const current = composer(async () => {})
  current.edit('Current draft')
  if (result === 'success') pending.resolve()
  else pending.reject(new Error('old failure'))
  await sending
  old.edit('late edit')
  await old.send()
  assert.equal(old.states.length, count)
  assert.equal(old.calls.length, 1)
  assert.equal(current.latest().text, 'Current draft')
})

test('blank draft creates no request or pending state', async () => {
  const c = composer(async () => {})
  c.edit('  ')
  await c.send()
  assert.equal(c.calls.length, 0)
  assert.equal(c.latest().sending, false)
})

test('ID creation failure releases the submit guard and retains the draft', async () => {
  const states = [], calls = []
  let first = true
  const c = observeTextComposer({ newId: () => { if (first) { first = false; throw new Error('unavailable') } return 'm1' }, write: async r => { calls.push(r) }, publish: s => states.push(s) })
  c.edit('Hello')
  await c.send()
  assert.equal(states.at(-1).text, 'Hello')
  assert.equal(states.at(-1).sending, false)
  await c.send()
  assert.deepEqual(calls, [{ id: 'm1', body: 'Hello' }])
  assert.equal(states.at(-1).text, '')
})
