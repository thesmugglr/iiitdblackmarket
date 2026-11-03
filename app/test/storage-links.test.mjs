import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requestSignedLinks } from '../src/lib/storageLinks.ts'
import { createLinkCache } from '../src/lib/signedUrlCache.ts'

function api(reply) {
  const calls = []
  return { calls, storage: { from: bucket => ({ createSignedUrls: async (paths, seconds) => {
    calls.push({ bucket, paths, seconds }); return typeof reply === 'function' ? reply() : reply
  } }) } }
}

test('signing passes the exact bucket, paths and expiry and maps individual missing files', async () => {
  const client = api({ data: [{ path: 'a.jpg', signedUrl: 'signed-a' }, { path: 'missing.jpg', error: 'not found' }], error: null })
  assert.deepEqual(await requestSignedLinks(client, 'listing-photos', ['a.jpg', 'missing.jpg'], 86400), [{ path: 'a.jpg', url: 'signed-a' }, { path: 'missing.jpg', url: '' }])
  assert.deepEqual(client.calls, [{ bucket: 'listing-photos', paths: ['a.jpg', 'missing.jpg'], seconds: 86400 }])
})

for (const reply of [{ data: null, error: { message: 'private diagnostic' } }, { data: [], error: { message: 'denied' } }, { data: null, error: null }]) {
  test('request-level errors or missing data reject without exposing diagnostics', async () => {
    await assert.rejects(requestSignedLinks(api(reply), 'chat-attachments', ['a.jpg'], 3600), { message: 'Could not sign photo links.' })
  })
}

test('transport rejection reaches the cache without becoming a remembered missing file', async () => {
  let calls = 0
  const client = api(() => { if (++calls === 1) throw new Error('offline'); return { data: [{ path: 'a.jpg', signedUrl: 'recovered' }], error: null } })
  const cache = createLinkCache({ sign: paths => requestSignedLinks(client, 'listing-photos', paths, 86400), lifetimeMs: 86400000, renewBeforeMs: 3600000, missingMs: 600000 })
  assert.deepEqual(await cache.links(['a.jpg']), [''])
  assert.deepEqual(await cache.links(['a.jpg']), ['recovered']); assert.equal(calls, 2)
})

test('SDK error replies can recover on the next cache request without a ten-minute negative cache', async () => {
  let calls = 0
  const client = api(() => ++calls === 1 ? { data: null, error: { message: 'network' } } : { data: [{ path: 'a.jpg', signedUrl: 'recovered' }], error: null })
  const cache = createLinkCache({ sign: paths => requestSignedLinks(client, 'listing-photos', paths, 86400), lifetimeMs: 86400000, renewBeforeMs: 3600000, missingMs: 600000 })
  assert.deepEqual(await cache.links(['a.jpg']), ['']); assert.deepEqual(await cache.links(['a.jpg']), ['recovered']); assert.equal(calls, 2)
})
