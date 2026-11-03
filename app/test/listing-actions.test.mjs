import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanupListingPhotos, deleteOwnedListing, updateOwnedListingStatus } from '../src/lib/listingActions.ts'

const success = data => ({ data, error: null })
const failure = { data: null, error: { message: 'denied' } }
const deleted = { id: 'item', seller_id: 'owner', photos: ['owner/current.jpg'] }

// Fake only network responses; record row filters and storage calls. Unexpected
// calls fail, so a rejected listing mutation cannot silently begin cleanup.
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
    for (const method of ['update', 'delete', 'eq', 'select']) b[method] = (...args) => { call.query.push([method, ...args]); return b }
    b.single = result
    return b
  }, storage: { from(bucket) { return { remove(paths) {
    calls.push({ bucket, paths })
    return result()
  } } } } }
}

test('status changes confirm the exact owned row and requested status', async () => {
  const client = api(success({ id: 'item', seller_id: 'owner', status: 'sold' }))
  await updateOwnedListingStatus(client, 'item', 'owner', 'sold')
  assert.deepEqual(client.calls[0].query, [
    ['update', { status: 'sold' }], ['eq', 'id', 'item'], ['eq', 'seller_id', 'owner'], ['select', 'id,seller_id,status'],
  ])
})

for (const [name, response] of [
  ['denied', failure], ['zero affected rows', success(null)],
  ['wrong row', success({ id: 'other', seller_id: 'owner', status: 'sold' })],
  ['wrong seller', success({ id: 'item', seller_id: 'other', status: 'sold' })],
  ['unconfirmed status', success({ id: 'item', seller_id: 'owner', status: 'active' })],
  ['network failure', new Error('offline')],
]) test(`status ${name} is not a confirmed update`, async () => {
  await assert.rejects(updateOwnedListingStatus(api(response), 'item', 'owner', 'sold'))
})

test('deletion returns the actual deleted row photos rather than a page snapshot', async () => {
  const client = api(success(deleted))
  assert.deepEqual(await deleteOwnedListing(client, 'item', 'owner'), ['owner/current.jpg'])
  assert.deepEqual(client.calls, [{ table: 'listings', query: [
    ['delete'], ['eq', 'id', 'item'], ['eq', 'seller_id', 'owner'], ['select', 'id,seller_id,photos'],
  ] }])
})

for (const [name, response] of [
  ['denied', failure], ['zero affected rows', success(null)],
  ['wrong row', success({ ...deleted, id: 'other' })],
  ['wrong seller', success({ ...deleted, seller_id: 'other' })],
  ['missing photo list', success({ ...deleted, photos: null })],
  ['network failure', new Error('offline')],
]) test(`deletion ${name} cannot start photo cleanup`, async () => {
  const client = api(response)
  await assert.rejects((async () => {
    const photos = await deleteOwnedListing(client, 'item', 'owner')
    await cleanupListingPhotos(client, 'owner', photos)
  })())
  assert.equal(client.calls.length, 1)
  assert.equal(client.calls[0].table, 'listings')
})

test('confirmed deletion cleans only returned originals and thumbnails, deduplicated', async () => {
  const client = api(success(deleted), success([]))
  const photos = await deleteOwnedListing(client, 'item', 'owner')
  await cleanupListingPhotos(client, 'owner', [...photos, ...photos])
  assert.deepEqual(client.calls[1], { bucket: 'listing-photos', paths: ['owner/current.jpg', 'owner/current_t.jpg'] })
})

test('listing without photos needs no storage request', async () => {
  const client = api()
  await cleanupListingPhotos(client, 'owner', [])
  assert.equal(client.calls.length, 0)
})

test('foreign, nested and malformed paths refuse the whole cleanup batch', async () => {
  for (const path of ['other/photo.jpg', 'owner-other/photo.jpg', 'owner/nested/photo.jpg', 'owner/', 'owner/..', null]) {
    const client = api()
    await assert.rejects(cleanupListingPhotos(client, 'owner', ['owner/current.jpg', path]))
    assert.equal(client.calls.length, 0)
  }
})

for (const [name, response] of [['API error', failure], ['network exception', new Error('offline')], ['missing response', success(null)]]) {
  test(`cleanup ${name} retains an explicitly partial result and retries without another listing deletion`, async () => {
    const client = api(success(deleted), response, success([]))
    const photos = await deleteOwnedListing(client, 'item', 'owner')
    await assert.rejects(cleanupListingPhotos(client, 'owner', photos), /listing was deleted.*Retry photo cleanup/)
    await cleanupListingPhotos(client, 'owner', photos)
    assert.equal(client.calls.filter(c => c.table === 'listings').length, 1)
    assert.deepEqual(client.calls[1], client.calls[2])
  })
}
