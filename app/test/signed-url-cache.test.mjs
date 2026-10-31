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
function fixture({ store, clock = { now: 1_000_000 }, exists = ['a.jpg', 'b.jpg', 'a_t.jpg'], failOnce = false } = {}) {
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
    store,
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
  assert.deepEqual(saved.map((row) => row[0]), ['a.jpg'])
})

test('unreadable or broken storage never breaks image loading', async () => {
  const broken = { getItem: () => '{not json', setItem: () => { throw new Error('quota') }, removeItem: () => { throw new Error('blocked') } }
  const { cache } = fixture({ store: broken })
  assert.match((await cache.links(['a.jpg']))[0], /a\.jpg/)
  assert.doesNotThrow(() => cache.clear())
})
