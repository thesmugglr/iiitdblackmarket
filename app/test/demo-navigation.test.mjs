import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demoClient } from '../src/lib/demo.ts'
import { observeListing } from '../src/lib/listingState.ts'

const listingRoute = id => new Promise(resolve => {
  observeListing(id, async () => {
    const { data, error } = await demoClient.from('listings')
      .select('*, seller:profiles!listings_seller_id_fkey(display_name,batch)')
      .eq('id', id).maybeSingle()
    if (error) throw error
    return data
  }, snapshot => { if (!snapshot.loading) resolve(snapshot) })
})

test('every fictional listing link loads its own fixture through the production route observer', { timeout: 2000 }, async () => {
  const { data: listings } = await demoClient.from('listings')
  assert.ok(listings.length > 1)
  for (const expected of listings) {
    const snapshot = await listingRoute(expected.id)
    assert.equal(snapshot.error, '')
    assert.equal(snapshot.listing?.id, expected.id)
    assert.equal(snapshot.listing?.title, expected.title)
  }
})

test('missing preview routes are unavailable and selecting another fixture does not alter the source', { timeout: 2000 }, async () => {
  const snapshot = await listingRoute('missing-listing')
  assert.equal(snapshot.listing, null)
  assert.equal(snapshot.error, '')
  const wanted = await demoClient.from('wanted_posts').select('*').eq('id', 'w2').maybeSingle()
  assert.equal(wanted.data?.title, 'Used cycle lock')
  const missing = await demoClient.from('bundles').select('*').eq('id', 'missing-bundle').maybeSingle()
  assert.equal(missing.data, null)
  assert.equal((await demoClient.from('wanted_posts')).data.length, 2)
  assert.equal((await demoClient.from('bundles')).data.length, 1)
})
