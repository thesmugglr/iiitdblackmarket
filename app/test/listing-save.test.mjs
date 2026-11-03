import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ListingWriteRejected, observeListingSave, writeListingDraft } from '../src/lib/listingSave.ts'

const draft = { title: 'Fixture listing', description: 'Fixture', listing_type: 'sale', category: 'misc', condition: 'good', negotiable: false, price_inr: 100, pickup_area: null, rental_period: null, deposit_inr: null, photos: ['owner/new.jpg'] }
const listing = { ...draft, id: 'l1', seller_id: 'owner', status: 'active' }
const success = data => ({ data, error: null })
const failure = { data: null, error: { message: 'denied' } }
function api(...responses) {
  const calls = []
  const result = () => {
    assert.ok(responses.length, 'unexpected API call')
    const response = responses.shift()
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  }
  return { calls, from(table) {
    const call = { table, query: [] }, b = {}; calls.push(call)
    for (const method of ['upsert', 'update', 'select', 'eq', 'neq']) b[method] = (...args) => { call.query.push([method, ...args]); return b }
    b.single = result; b.then = (yes, no) => result().then(yes, no)
    return b
  } }
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
function editor(overrides = {}) {
  const states = [], writes = [], cleanups = [], saved = []
  let ids = 0
  const current = observeListingSave({
    newId: () => { ids++; return 'l1' },
    write: async r => { writes.push(r); return overrides.write?.(r) },
    cleanup: async (row, canClean) => { cleanups.push({ row, canClean }); return overrides.cleanup?.(row, canClean) },
    saved: id => saved.push(id), publish: s => states.push(s), ...overrides.source,
  })
  return { ...current, states, writes, cleanups, saved, ids: () => ids, latest: () => states.at(-1) }
}

test('creation is insert-only on the retained ID with exact owned-row confirmation', async () => {
  const client = api(success(null), success(listing))
  await writeListingDraft(client, 'owner', { id: 'l1', create: true, row: draft })
  assert.deepEqual(client.calls[0], { table: 'listings', query: [['upsert', { ...draft, id: 'l1', seller_id: 'owner' }, { onConflict: 'id', ignoreDuplicates: true }]] })
  assert.deepEqual(client.calls[1].query.slice(1), [['eq', 'id', 'l1'], ['eq', 'seller_id', 'owner']])
})
test('updates explicitly scope the owned non-removed row and request confirmation of all fields', async () => {
  const client = api(success(listing))
  await writeListingDraft(client, 'owner', { id: 'l1', create: false, row: draft })
  assert.deepEqual(client.calls[0].query.slice(0, 4), [['update', draft], ['eq', 'id', 'l1'], ['eq', 'seller_id', 'owner'], ['neq', 'status', 'removed']])
  for (const key of Object.keys(listing)) assert.ok(client.calls[0].query[4][1].split(',').includes(key))
})
for (const [name, response] of [
  ['zero row', success(null)], ['query error', failure], ['network failure', new Error('offline')],
  ['other ID', success({ ...listing, id: 'l2' })], ['other owner', success({ ...listing, seller_id: 'other' })],
  ['removed', success({ ...listing, status: 'removed' })], ['unknown status', success({ ...listing, status: 'unknown' })],
  ...Object.keys(draft).map(key => [`mismatched ${key}`, success({ ...listing, [key]: key === 'photos' ? ['owner/other.jpg'] : 'different' })]),
  ['reordered photos', success({ ...listing, photos: ['owner/new.jpg', 'owner/extra.jpg'] })],
]) test(`${name} cannot confirm a listing save`, async () => {
  await assert.rejects(writeListingDraft(api(response), 'owner', { id: 'l1', create: false, row: draft }))
})
test('SQL creation rejection is distinguished from a lost or fetch error response', async () => {
  await assert.rejects(writeListingDraft(api({ data: null, error: { code: '23514' } }), 'owner', { id: 'l1', create: true, row: draft }), ListingWriteRejected)
  for (const response of [new Error('lost reply'), failure, ...['', '08006', '08007', '40003', 'PGRST000'].map(code => ({ data: null, error: { code, message: 'Uncertain reply' } }))]) {
    await assert.rejects(writeListingDraft(api(response), 'owner', { id: 'l1', create: true, row: draft }), e => !(e instanceof ListingWriteRejected))
  }
})
test('creation read-back rejects a collision without an update', async () => {
  const client = api(success(null), success({ ...listing, title: 'Other listing' }))
  await assert.rejects(writeListingDraft(client, 'owner', { id: 'l1', create: true, row: draft }))
  assert.equal(client.calls.some(c => c.query.some(([method]) => method === 'update')), false)
})
test('missing listing identity cannot start a write', async () => {
  const client = api()
  await assert.rejects(writeListingDraft(client, '', { id: 'l1', create: true, row: draft }))
  await assert.rejects(writeListingDraft(client, 'owner', { id: '', create: false, row: draft }))
  assert.equal(client.calls.length, 0)
})

test('submitted photos are protected BEFORE a write; duplicate submissions cannot create another request', async () => {
  const pending = deferred(), c = editor({ write: () => pending.promise })
  const saving = c.save(draft)
  assert.equal(c.canClean(draft.photos[0]), false); assert.equal(c.canClean('owner/never-submitted.jpg'), true)
  assert.equal(c.isBusy(), true); await c.save({ ...draft, title: 'Second click' })
  assert.equal(c.writes.length, 1)
  pending.resolve(); await saving
  assert.deepEqual(c.saved, ['l1']); assert.equal(c.ids(), 1); assert.equal(c.isBusy(), false)
})
test('lost creation response retains original ID/payload and protects photos during unmount cleanup', async () => {
  let first = true
  const c = editor({ write: () => { if (first) { first = false; throw new Error('lost reply') } } })
  await c.save(draft)
  assert.ok(c.latest().error); assert.equal(c.cleanups.length, 0); assert.deepEqual(c.saved, [])
  await c.save(draft)
  assert.equal(c.writes.length, 2); assert.equal(c.writes[0].id, c.writes[1].id)
  assert.strictEqual(c.writes[0].row, c.writes[1].row)
  assert.equal(c.writes.every(r => r.create), true); assert.equal(c.ids(), 1)
  assert.deepEqual(c.saved, ['l1']); c.dispose()
  assert.deepEqual(['owner/new.jpg', 'owner/unused.jpg'].filter(c.canClean), ['owner/unused.jpg'])
})
test('editing an uncertain creation confirms its original first, then updates that same listing', async () => {
  let first = true
  const c = editor({ write: () => { if (first) { first = false; throw new Error('lost reply') } } })
  const original = { ...draft, photos: [...draft.photos] }
  await c.save(original)
  original.title = 'Newer draft'; original.photos.push('owner/second.jpg')
  await c.save(original)
  assert.deepEqual(c.writes.map(r => [r.id, r.create, r.row.title]), [['l1', true, draft.title], ['l1', true, draft.title], ['l1', false, 'Newer draft']])
  assert.deepEqual(c.writes[0].row.photos, draft.photos)
  assert.equal(c.canClean('owner/new.jpg'), false); assert.equal(c.canClean('owner/second.jpg'), false)
  assert.equal(c.cleanups.at(-1).row.title, 'Newer draft'); assert.deepEqual(c.saved, ['l1'])
})
test('explicit rejection on the first creation allows a corrected draft with the same ID', async () => {
  let first = true
  const c = editor({ write: () => { if (first) { first = false; throw new ListingWriteRejected('constraint') } } })
  await c.save(draft); await c.save({ ...draft, title: 'Corrected draft' })
  assert.equal(c.writes[1].create, true); assert.equal(c.writes[1].row.title, 'Corrected draft'); assert.equal(c.ids(), 1)
})
test('a later SQL denial cannot erase an earlier uncertain creation payload', async () => {
  let count = 0
  const c = editor({ write: () => { if (++count === 1) throw new Error('lost reply'); if (count === 2) throw new ListingWriteRejected('suspended') } })
  await c.save(draft); await c.save({ ...draft, title: 'Newer' }); await c.save({ ...draft, title: 'Newest' })
  assert.deepEqual(c.writes.slice(0, 3).map(r => r.row.title), [draft.title, draft.title, draft.title])
  assert.equal(c.writes[3].create, false); assert.equal(c.writes[3].row.title, 'Newest')
})
test('an existing listing retries a failed update before any cleanup/navigation', async () => {
  let first = true
  const c = editor({ source: { id: 'existing' }, write: () => { if (first) { first = false; throw new Error('offline') } } })
  await c.save(draft); assert.equal(c.cleanups.length, 0); assert.deepEqual(c.saved, [])
  await c.save(draft)
  assert.equal(c.writes.every(r => r.id === 'existing' && !r.create), true); assert.equal(c.ids(), 0)
  assert.deepEqual(c.saved, ['existing'])
})
test('partial cleanup failure retains an explicit retry and re-confirms before retrying cleanup', async () => {
  let first = true
  const c = editor({ cleanup: () => { if (first) { first = false; throw new Error('denied cleanup') } } })
  await c.save(draft); assert.match(c.latest().error, /listing was saved/); assert.deepEqual(c.saved, [])
  await c.save(draft)
  assert.deepEqual(c.writes.map(r => r.create), [true, false]); assert.equal(c.cleanups.length, 2); assert.deepEqual(c.saved, ['l1'])
})
for (const phase of ['create', 'update', 'cleanup']) for (const outcome of ['success', 'failure']) {
  test(`disposal during ${phase} ${outcome} prevents later cleanup/navigation and old-account publication`, async () => {
    const wait = deferred()
    const c = editor({ source: phase === 'update' ? { id: 'existing' } : {}, write: () => phase === 'cleanup' ? undefined : wait.promise, cleanup: () => phase === 'cleanup' ? wait.promise : undefined })
    const saving = c.save(draft); await flush(); c.dispose(); const count = c.states.length
    if (outcome === 'success') wait.resolve(); else wait.reject(new Error('old error'))
    await saving; await c.save(draft)
    assert.equal(c.states.length, count); assert.deepEqual(c.saved, [])
    assert.equal(c.cleanups.length, phase === 'cleanup' ? 1 : 0)
    assert.equal(c.isActive(), false); assert.equal(c.canClean(draft.photos[0]), false)
  })
}
test('disposal after original creation confirmation cannot start a newer update', async () => {
  let first = true, c
  c = editor({ write: () => { if (first) { first = false; throw new Error('lost reply') } c.dispose() } })
  await c.save(draft); await c.save({ ...draft, title: 'Newer' })
  assert.equal(c.writes.length, 2); assert.equal(c.writes.every(r => r.create), true); assert.deepEqual(c.saved, [])
})
test('ID failure releases the save guard without writing or protecting never-submitted photos', async () => {
  let first = true
  const c = editor({ source: { newId: () => { if (first) { first = false; throw new Error('unavailable') } return 'l1' } } })
  await c.save(draft); assert.equal(c.isBusy(), false); assert.ok(c.latest().error); assert.equal(c.canClean(draft.photos[0]), true)
  await c.save(draft); assert.deepEqual(c.saved, ['l1'])
})
