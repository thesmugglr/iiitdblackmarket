import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLinkCache } from '../src/lib/signedUrlCache.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

function memoryStore(initial = {}) {
  const data = new Map(Object.entries(initial))
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

// A signer that only knows some objects, and records every request it receives.
function fixture({ store, clock = { now: 1_000_000 }, exists = ['a.jpg', 'b.jpg', 'a_t.jpg'], failOnce = false, scope } = {}) {
  const calls = []
  let failed = !failOnce
  const cache = createLinkCache({
    sign: async (paths) => {
      calls.push([...paths])
      if (!failed) { failed = true; throw new Error('network down') }
      // The token differs per signing (request number and moment), like a real signed link.
      return paths.filter((p) => exists.includes(p)).map((path) => ({ path, url: `https://files.example/${path}?token=${calls.length}-${clock.now}` }))
    },
    lifetimeMs: 24 * HOUR,
    renewBeforeMs: HOUR,
    missingMs: 10 * MINUTE,
    store, scope,
    now: () => clock.now,
  })
  return { cache, calls, clock }
}

test('everything asked for in the same moment is signed in one request, once per path', async () => {
  const { cache, calls } = fixture()
  const [first, second] = await Promise.all([cache.links(['a.jpg']), cache.links(['b.jpg', 'a.jpg'])])
  assert.equal(calls.length, 1)
  assert.deepEqual([...calls[0]].sort(), ['a.jpg', 'b.jpg'])
  assert.equal(first[0], second[1], 'the same link is handed to both callers')
  assert.match(second[0], /b\.jpg/)
})

test('a link is reused until an hour before it expires, then signed again', async () => {
  const { cache, calls, clock } = fixture()
  const [first] = await cache.links(['a.jpg'])
  clock.now += 22 * HOUR
  assert.equal((await cache.links(['a.jpg']))[0], first)
  assert.equal(calls.length, 1, 'no new request, so the browser keeps using its cached picture')
  clock.now += 90 * MINUTE // now 23.5 h old: inside the renewal margin
  const [renewed] = await cache.links(['a.jpg'])
  assert.notEqual(renewed, first)
  assert.equal(calls.length, 2)
})

test('a missing object (no thumbnail yet) is remembered briefly, then checked again', async () => {
  const { cache, calls, clock } = fixture()
  assert.deepEqual(await cache.links(['nothing_t.jpg']), [''])
  assert.deepEqual(await cache.links(['nothing_t.jpg']), [''])
  assert.equal(calls.length, 1)
  clock.now += 11 * MINUTE
  await cache.links(['nothing_t.jpg'])
  assert.equal(calls.length, 2)
})

test('a failed request gives no link and is not remembered', async () => {
  const { cache, calls } = fixture({ failOnce: true })
  assert.deepEqual(await cache.links(['a.jpg']), [''])
  const [link] = await cache.links(['a.jpg'])
  assert.match(link, /a\.jpg/)
  assert.equal(calls.length, 2)
})

test('links survive a page reload through the store, expire on time, and are wiped by clear()', async () => {
  const store = memoryStore()
  const clock = { now: 5_000_000 }
  const [link] = await fixture({ store, clock }).cache.links(['a.jpg'])

  const reloaded = fixture({ store, clock })
  assert.equal((await reloaded.cache.links(['a.jpg']))[0], link)
  assert.equal(reloaded.calls.length, 0, 'the reloaded page asked for nothing')

  clock.now += 23.5 * HOUR
  const later = fixture({ store, clock })
  assert.notEqual((await later.cache.links(['a.jpg']))[0], link)
  assert.equal(later.calls.length, 1)

  later.cache.clear()
  assert.equal(store.data.size, 0)
  const afterSignOut = fixture({ store, clock })
  await afterSignOut.cache.links(['a.jpg'])
  assert.equal(afterSignOut.calls.length, 1)
})

test('only real links are written to the store: nothing for missing objects', async () => {
  const store = memoryStore()
  const { cache } = fixture({ store })
  await cache.links(['a.jpg', 'ghost.jpg'])
  const saved = JSON.parse([...store.data.values()][0])
  assert.deepEqual(saved.rows.map((row) => row[0]), ['a.jpg'])
})

test('unreadable or broken storage never breaks image loading', async () => {
  const broken = { getItem: () => '{not json', setItem: () => { throw new Error('quota') }, removeItem: () => { throw new Error('blocked') } }
  const { cache } = fixture({ store: broken })
  assert.match((await cache.links(['a.jpg']))[0], /a\.jpg/)
  assert.doesNotThrow(() => cache.clear())
})

function deferredCache(scope = 'account-a') {
  const store = memoryStore(), calls = []
  const cache = createLinkCache({ scope, store, lifetimeMs: HOUR, renewBeforeMs: MINUTE, missingMs: MINUTE,
    sign: paths => new Promise((resolve, reject) => calls.push({ paths, resolve, reject })),
  })
  return { cache, store, calls }
}

test('clear cancels queued signing before any request and settles every waiter', { timeout: 2000 }, async () => {
  const { cache, store, calls } = deferredCache()
  const a = cache.links(['a.jpg', 'b.jpg']), b = cache.links(['a.jpg'])
  cache.clear()
  assert.deepEqual(await a, ['', '']); assert.deepEqual(await b, [''])
  await Promise.resolve()
  assert.equal(calls.length, 0); assert.equal(store.data.size, 0)
})

test('clear settles an in-flight request even if the signer never replies', { timeout: 2000 }, async () => {
  const { cache, calls } = deferredCache()
  const pending = cache.links(['a.jpg'])
  await Promise.resolve(); assert.equal(calls.length, 1)
  cache.clear()
  assert.deepEqual(await pending, [''])
})

for (const oldFirst of [true, false]) test(`old signing cannot refill or settle a new same-path request (${oldFirst ? 'old' : 'new'} reply first)`, { timeout: 2000 }, async () => {
  const { cache, store, calls } = deferredCache()
  const old = cache.links(['a.jpg'])
  await Promise.resolve()
  cache.setScope(null); cache.setScope('account-b')
  const next = cache.links(['a.jpg'])
  await Promise.resolve()
  assert.equal(calls.length, 2); assert.deepEqual(await old, [''])
  let settled = false; void next.then(() => { settled = true })
  const finishOld = () => calls[0].resolve([{ path: 'a.jpg', url: 'https://example.invalid/old-account' }])
  if (oldFirst) {
    finishOld(); await Promise.resolve(); await Promise.resolve()
    assert.equal(settled, false); assert.equal(store.data.size, 0)
  }
  calls[1].resolve([{ path: 'a.jpg', url: 'https://example.invalid/new-account' }])
  assert.deepEqual(await next, ['https://example.invalid/new-account'])
  if (!oldFirst) { finishOld(); await Promise.resolve() }
  assert.deepEqual(await cache.links(['a.jpg']), ['https://example.invalid/new-account'])
  const saved = JSON.parse([...store.data.values()][0])
  assert.equal(saved.scope, 'account-b'); assert.equal(JSON.stringify(saved).includes('old-account'), false)
})

test('old rejected signing cannot erase a newer successful result', { timeout: 2000 }, async () => {
  const { cache, calls } = deferredCache()
  const old = cache.links(['a.jpg']); await Promise.resolve()
  cache.clear()
  const next = cache.links(['a.jpg']); await Promise.resolve()
  calls[1].resolve([{ path: 'a.jpg', url: 'new' }]); await next
  calls[0].reject(new Error('old failure')); await Promise.resolve()
  assert.deepEqual(await old, ['']); assert.deepEqual(await cache.links(['a.jpg']), ['new'])
})

test('disabled cache cannot sign or disclose persisted links before approval', async () => {
  const store = memoryStore()
  await fixture({ store, scope: 'account-a' }).cache.links(['a.jpg'])
  const disabled = fixture({ store, scope: null })
  assert.deepEqual(await disabled.cache.links(['a.jpg']), ['']); assert.equal(disabled.calls.length, 0)
})

test('same approved account can restore persisted links after reload', async () => {
  const store = memoryStore()
  const original = await fixture({ store, scope: 'account-a' }).cache.links(['a.jpg'])
  const reloaded = fixture({ store, scope: null })
  reloaded.cache.setScope('account-a')
  assert.deepEqual(await reloaded.cache.links(['a.jpg']), original); assert.equal(reloaded.calls.length, 0)
})

test('a different approved account cannot restore the previous account links', async () => {
  const store = memoryStore()
  await fixture({ store, scope: 'account-a' }).cache.links(['a.jpg'])
  const reloaded = fixture({ store, scope: null })
  reloaded.cache.setScope('account-b')
  assert.equal(store.data.size, 0)
  await reloaded.cache.links(['a.jpg'])
  assert.equal(reloaded.calls.length, 1)
  assert.equal(JSON.parse([...store.data.values()][0]).scope, 'account-b')
})

test('loss of approval wipes persistence and blocks new signing until approval returns', async () => {
  const store = memoryStore(), f = fixture({ store, scope: 'account-a' })
  await f.cache.links(['a.jpg']); f.cache.setScope(null)
  assert.equal(store.data.size, 0); assert.deepEqual(await f.cache.links(['a.jpg']), ['']); assert.equal(f.calls.length, 1)
  f.cache.setScope('account-a'); await f.cache.links(['a.jpg'])
  assert.equal(f.calls.length, 2)
})

test('same-account token refresh preserves an in-flight signing batch', { timeout: 2000 }, async () => {
  const { cache, calls } = deferredCache()
  const pending = cache.links(['a.jpg']); await Promise.resolve()
  cache.setScope('account-a')
  const shared = cache.links(['a.jpg'])
  calls[0].resolve([{ path: 'a.jpg', url: 'same' }])
  assert.deepEqual(await pending, ['same']); assert.deepEqual(await shared, ['same']); assert.equal(calls.length, 1)
})

test('old queued microtasks cannot consume a new account signing batch', { timeout: 2000 }, async () => {
  const { cache, calls } = deferredCache()
  const old = cache.links(['old.jpg'])
  cache.setScope('account-b')
  const next = cache.links(['new.jpg'])
  await Promise.resolve()
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].paths, ['new.jpg'])
  calls[0].resolve([{ path: 'new.jpg', url: 'new' }])
  assert.deepEqual(await old, ['']); assert.deepEqual(await next, ['new'])
})

test('legacy unscoped persistence is discarded without restoring its URLs', async () => {
  const store = memoryStore({ 'iiitd.photo-links.v1': JSON.stringify([['a.jpg', 'legacy-secret-link', Date.now() + HOUR]]) })
  const f = fixture({ store, scope: null })
  assert.equal(store.data.size, 0)
  f.cache.setScope('account-a'); await f.cache.links(['a.jpg'])
  assert.equal(f.calls.length, 1); assert.equal(JSON.stringify([...store.data]).includes('legacy-secret-link'), false)
})
