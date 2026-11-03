import { test } from 'node:test'
import assert from 'node:assert/strict'
import { observeAttachment, sendChatImage, uploadChatAttachment } from '../src/lib/chatAttachments.ts'

const blob = new Blob(['prepared bytes'], { type: 'image/jpeg' })
const prepared = { blob, ext: 'jpg', type: 'image/jpeg' }
const file = new File(['original private metadata'], 'fixture.png', { type: 'image/png' })
const request = { id: 'm1', conversation: 'c1', path: 'c1/m1.jpg', blob, type: prepared.type }
const success = data => ({ data, error: null })
const failure = { data: null, error: { message: 'denied' } }
function storage(upload, download) {
  const calls = []
  return { calls, storage: { from(bucket) {
    assert.equal(bucket, 'chat-attachments')
    return {
      async upload(...args) { calls.push(['upload', ...args]); return upload(...args) },
      async download(...args) { calls.push(['download', ...args]); return download(...args) },
    }
  } } }
}
function messages(...responses) {
  const calls = []
  const result = () => {
    assert.ok(responses.length, 'unexpected query')
    const response = responses.shift()
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  }
  return { calls, from(table) {
    const query = [], b = {}; calls.push({ table, query })
    for (const key of ['upsert', 'select', 'eq']) b[key] = (...args) => { query.push([key, ...args]); return b }
    b.single = result; b.then = (yes, no) => result().then(yes, no)
    return b
  } }
}
const row = { id: request.id, conversation_id: 'c1', sender_id: 'u1', body: '', image_path: request.path }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function attachment(overrides = {}) {
  const states = [], calls = { prepare: [], upload: [], link: [], confirmed: 0, ids: 0 }
  const current = observeAttachment({
    conversation: 'c1', newId: () => { calls.ids++; return `m${calls.ids}` },
    prepare: async f => { calls.prepare.push(f); return overrides.prepare ? overrides.prepare(f) : prepared },
    upload: async r => { calls.upload.push(r); return overrides.upload?.(r) },
    link: async r => { calls.link.push(r); return overrides.link?.(r) },
    confirmed: () => { calls.confirmed++ }, publish: s => states.push(s),
    ...overrides.source,
  })
  return { ...current, calls, states, latest: () => states.at(-1) }
}

test('confirmed upload sends only prepared bytes, never overwrites and avoids a download', async () => {
  const client = storage(() => success({ path: request.path }), () => { throw new Error('unexpected download') })
  await uploadChatAttachment(client, request)
  assert.deepEqual(client.calls, [['upload', request.path, blob, { contentType: prepared.type, upsert: false }]])
})
for (const [name, response] of [
  ['lost response', () => { throw new Error('offline') }], ['duplicate/error', () => failure],
  ['empty response', () => success(null)], ['wrong path', () => success({ path: 'other/photo.jpg' })],
]) test(`${name} confirms only exact bytes at the original prepared path`, async () => {
  const client = storage(response, () => success(new Blob(['prepared bytes'])))
  await uploadChatAttachment(client, request)
  assert.equal(client.calls.length, 2)
  assert.deepEqual(client.calls[1], ['download', request.path])
})
for (const [name, response] of [
  ['different bytes of same size', () => success(new Blob(['different byte']))],
  ['different size', () => success(new Blob(['short']))], ['missing', () => success(null)],
  ['denied', () => failure], ['offline', () => { throw new Error('offline') }],
]) test(`${name} cannot confirm an uncertain upload`, async () => {
  const client = storage(() => failure, response)
  await assert.rejects(uploadChatAttachment(client, request), /could not be confirmed/)
  assert.equal(client.calls.length, 2)
})
for (const path of ['c2/m1.jpg', 'c1/m2.jpg', 'c1/m1.jpg/extra', 'c1/m1.', 'c1/m1.jpg?x']) {
  test(`invalid attachment path ${path} cannot start upload or message linkage`, async () => {
    const client = storage(() => { throw new Error('unexpected') })
    await assert.rejects(uploadChatAttachment(client, { ...request, path }), /Invalid/)
    const api = messages()
    await assert.rejects(sendChatImage(api, 'c1', 'u1', { id: request.id, path }), /Invalid/)
    assert.equal(client.calls.length, 0); assert.equal(api.calls.length, 0)
  })
}
test('image message uses insert-only stable ID and confirms its exact linkage', async () => {
  const client = messages(success(null), success(row))
  await sendChatImage(client, 'c1', 'u1', request)
  assert.deepEqual(client.calls, [
    { table: 'messages', query: [['upsert', row, { onConflict: 'id', ignoreDuplicates: true }]] },
    { table: 'messages', query: [['select', 'id,conversation_id,sender_id,body,image_path'], ['eq', 'id', request.id]] },
  ])
})
for (const [name, response] of [['denied', failure], ['lost response', new Error('offline')]]) {
  test(`${name} message insert cannot clear an attachment`, async () => {
    await assert.rejects(sendChatImage(messages(response), 'c1', 'u1', request))
  })
}
for (const [name, response] of [
  ['missing', success(null)], ['denied', failure], ['offline', new Error('offline')],
  ...Object.keys(row).map(key => [`mismatched ${key}`, success({ ...row, [key]: 'different' })]),
]) test(`${name} image read-back cannot confirm linkage`, async () => {
  await assert.rejects(sendChatImage(messages(success(null), response), 'c1', 'u1', request))
})

test('failed upload retains exact prepared file/path/ID; upload retry links once and clears pending state', async () => {
  let first = true
  const c = attachment({ upload: () => { if (first) { first = false; throw new Error('offline') } } })
  await c.choose(file)
  assert.equal(c.latest().name, file.name); assert.equal(c.latest().locked, true); assert.ok(c.latest().error)
  await c.choose(new File(['other'], 'other.png'))
  await c.retry()
  assert.equal(c.calls.prepare.length, 1); assert.equal(c.calls.ids, 1)
  assert.strictEqual(c.calls.upload[0], c.calls.upload[1]); assert.strictEqual(c.calls.upload[0].blob, blob)
  assert.equal(c.calls.link.length, 1); assert.equal(c.calls.confirmed, 1)
  assert.deepEqual(c.latest(), { busy: false, pending: false, locked: false, name: '', error: '' })
  await c.choose(file)
  assert.equal(c.calls.ids, 2)
})
test('uncertain message response retries linkage with the same ID without preparing/uploading another file', async () => {
  let first = true
  const c = attachment({ link: () => { if (first) { first = false; throw new Error('reply lost') } } })
  await c.choose(file); assert.ok(c.latest().error)
  await c.retry()
  assert.equal(c.calls.prepare.length, 1); assert.equal(c.calls.upload.length, 1)
  assert.equal(c.calls.link.length, 2); assert.strictEqual(c.calls.link[0], c.calls.link[1])
  assert.equal(c.calls.confirmed, 1)
})
for (const phase of ['prepare', 'upload', 'link']) test(`${phase} in flight rejects duplicate retry and file replacement`, async () => {
  const wait = deferred(), c = attachment({ [phase]: () => wait.promise })
  const sending = c.choose(file)
  // Flush the asynchronous phase transitions before checking the guard.
  await new Promise(resolve => setImmediate(resolve))
  await c.choose(new File(['other'], 'other.png')); await c.retry()
  assert.equal(c.calls.prepare.length, 1); assert.equal(c.latest().name, file.name); assert.equal(c.latest().busy, true)
  wait.resolve(phase === 'prepare' ? prepared : undefined); await sending
  assert.equal(c.calls.upload.length, 1); assert.equal(c.calls.link.length, 1)
})
test('preparation failure can retry or replace its file without allocating an upload path', async () => {
  let fail = true
  const c = attachment({ prepare: () => { if (fail) throw new Error('cannot decode'); return prepared } })
  await c.choose(file); await c.retry()
  assert.equal(c.latest().locked, false); assert.equal(c.calls.ids, 0); assert.equal(c.calls.upload.length, 0)
  fail = false
  const replacement = new File(['other'], 'replacement.png', { type: 'image/png' })
  await c.choose(replacement)
  assert.strictEqual(c.calls.prepare.at(-1), replacement); assert.equal(c.calls.confirmed, 1)
})
test('ID generation failure releases busy guard and reuses prepared bytes on retry', async () => {
  let first = true
  const c = attachment({ source: { newId: () => { if (first) { first = false; throw new Error('unavailable') } return 'm1' } } })
  await c.choose(file); assert.equal(c.latest().busy, false); assert.ok(c.latest().error)
  await c.retry()
  assert.equal(c.calls.prepare.length, 1); assert.equal(c.calls.upload.length, 1); assert.equal(c.calls.confirmed, 1)
})
for (const phase of ['prepare', 'upload', 'link']) for (const outcome of ['success', 'failure']) {
  test(`disposal during ${phase} ${outcome} prevents later phases and stale page publication`, async () => {
    const wait = deferred(), c = attachment({ [phase]: () => wait.promise })
    const sending = c.choose(file)
    await new Promise(resolve => setImmediate(resolve))
    c.dispose(); const count = c.states.length
    if (outcome === 'success') wait.resolve(phase === 'prepare' ? prepared : undefined)
    else wait.reject(new Error('old request'))
    await sending; await c.retry(); await c.choose(file)
    assert.equal(c.states.length, count); assert.equal(c.calls.confirmed, 0)
    assert.equal(c.calls.upload.length, phase === 'prepare' ? 0 : 1)
    assert.equal(c.calls.link.length, phase === 'link' ? 1 : 0)
  })
}
