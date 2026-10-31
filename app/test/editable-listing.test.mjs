import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as settle } from 'node:timers/promises'
import { observeEditableListing } from '../src/lib/editableListing.ts'

const owned = { id: 'l1', seller_id: 'owner', status: 'active', title: 'Existing draft', photos: ['owner/cover.jpg', 'owner/second.jpg'] }

test('an owned listing is hydrated only after loading, with its original photo order', async t => {
  let resolve
  const pending = new Promise(yes => { resolve = yes })
  const loaded = [], errors = []
  t.after(observeEditableListing('l1', 'owner', () => pending, l => loaded.push(l), e => errors.push(e)))
  assert.equal(loaded.length, 0)
  resolve(owned)
  await settle()
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0], owned)
  assert.deepEqual(loaded[0].photos, ['owner/cover.jpg', 'owner/second.jpg'])
  assert.deepEqual(errors, [])
})

for (const [name, record] of [
  ['missing listing', null],
  ['another seller’s listing', { ...owned, seller_id: 'other' }],
  ['administrator-removed listing', { ...owned, status: 'removed' }],
  ['wrong route response', { ...owned, id: 'l2' }],
]) {
  test(`${name} never opens the edit form`, async t => {
    const loaded = [], errors = []
    t.after(observeEditableListing('l1', 'owner', async () => record, l => loaded.push(l), e => errors.push(e)))
    await settle()
    assert.deepEqual(loaded, [])
    assert.equal(errors.length, 1)
    assert.match(errors[0], /unavailable|cannot be edited/)
  })
}

test('a failed load produces a retryable error and a new attempt can succeed', async t => {
  const errors = [], loaded = []
  const cancel = observeEditableListing('l1', 'owner', async () => { throw new Error('offline') }, l => loaded.push(l), e => errors.push(e))
  await settle()
  assert.equal(loaded.length, 0)
  assert.match(errors[0], /try again/)
  cancel()
  t.after(observeEditableListing('l1', 'owner', async () => owned, l => loaded.push(l), e => errors.push(e)))
  await settle()
  assert.deepEqual(loaded, [owned])
  assert.equal(errors.length, 1)
})

test('a late successful load cannot hydrate an editor after navigation or unmount', async () => {
  let resolve
  const pending = new Promise(yes => { resolve = yes })
  const results = []
  const cancel = observeEditableListing('l1', 'owner', () => pending, l => results.push(l), e => results.push(e))
  cancel()
  resolve(owned)
  await settle()
  assert.deepEqual(results, [])
})

test('a late failed load cannot replace the next route with an old error', async () => {
  let reject
  const pending = new Promise((_yes, no) => { reject = no })
  const results = []
  const cancel = observeEditableListing('l1', 'owner', () => pending, l => results.push(l), e => results.push(e))
  cancel()
  reject(new Error('old request failed'))
  await settle()
  assert.deepEqual(results, [])
})
