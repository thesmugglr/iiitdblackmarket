import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as settle } from 'node:timers/promises'
import { observeListing } from '../src/lib/listingState.ts'

const first = { id: 'first', title: 'First listing', seller_id: 'seller-a', photos: ['a.jpg'] }
const second = { id: 'second', title: 'Second listing', seller_id: 'seller-b', photos: ['b.jpg'] }
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('initial loading hides previous content until the requested record arrives', async t => {
  const request = deferred(), seen = []
  t.after(observeListing('first', () => request.promise, s => seen.push(s)))
  assert.deepEqual(seen, [{ listing: null, loading: true, error: '' }])
  request.resolve(first)
  await settle()
  assert.deepEqual(seen.at(-1), { listing: first, loading: false, error: '' })
})

test('a missing listing ends loading without leaving the next route unavailable', async t => {
  const seen = []
  const cancel = observeListing('missing', async () => null, s => seen.push(s))
  await settle()
  assert.deepEqual(seen.at(-1), { listing: null, loading: false, error: '' })
  cancel()
  t.after(observeListing('second', async () => second, s => seen.push(s)))
  await settle()
  assert.equal(seen.at(-1).listing, second)
})

test('query failure is retryable and never presented as a missing record', async t => {
  const seen = []
  const cancel = observeListing('first', async () => { throw new Error('offline') }, s => seen.push(s))
  await settle()
  assert.equal(seen.at(-1).loading, false)
  assert.equal(seen.at(-1).listing, null)
  assert.match(seen.at(-1).error, /try again/)
  cancel()
  t.after(observeListing('first', async () => first, s => seen.push(s)))
  assert.equal(seen.at(-1).error, '')
  await settle()
  assert.equal(seen.at(-1).listing, first)
})

test('a response for another ID cannot expose its content or actions on this URL', async t => {
  const seen = []
  t.after(observeListing('first', async () => second, s => seen.push(s)))
  await settle()
  assert.equal(seen.at(-1).listing, null)
  assert.match(seen.at(-1).error, /try again/)
})

for (const outcome of ['success', 'missing', 'failure']) {
  test(`late ${outcome} from a disposed route cannot replace the next listing`, async t => {
    const old = deferred(), seen = []
    const cancel = observeListing('first', () => old.promise, s => seen.push(s))
    cancel()
    t.after(observeListing('second', async () => second, s => seen.push(s)))
    await settle()
    const count = seen.length
    if (outcome === 'failure') old.reject(new Error('old network failure'))
    else old.resolve(outcome === 'missing' ? null : first)
    await settle()
    assert.equal(seen.length, count)
    assert.equal(seen.at(-1).listing, second)
  })
}

test('refresh after mutation clears stale content and can observe a newly unavailable record', async () => {
  const seen = []
  const cancel = observeListing('first', async () => first, s => seen.push(s))
  await settle()
  cancel()
  const stop = observeListing('first', async () => null, s => seen.push(s))
  assert.equal(seen.at(-1).listing, null)
  assert.equal(seen.at(-1).loading, true)
  await settle()
  assert.deepEqual(seen.at(-1), { listing: null, loading: false, error: '' })
  stop()
})

test('a disposed account cannot publish its pending result, even for the same listing', async () => {
  const old = deferred(), seen = []
  const cancel = observeListing('first', () => old.promise, s => seen.push(s))
  cancel()
  const stop = observeListing('first', async () => null, s => seen.push(s))
  await settle()
  old.resolve(first)
  await settle()
  assert.equal(seen.at(-1).listing, null)
  stop()
})

test('an absent route ID ends loading without querying an unspecified record', async () => {
  const seen = []
  let reads = 0
  const stop = observeListing('', async () => { reads++; return first }, s => seen.push(s))
  await settle()
  assert.equal(reads, 0)
  assert.deepEqual(seen.at(-1), { listing: null, loading: false, error: '' })
  stop()
})
