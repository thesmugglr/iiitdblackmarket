import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as settle } from 'node:timers/promises'
import { observeAuth } from '../src/lib/authState.ts'

const session = (id, token = id) => ({ user: { id }, access_token: token })
const profile = (id, status = 'approved') => ({ id, status, role: 'student' })
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture(t) {
  const bootstrap = deferred()
  const snapshots = []
  const requests = []
  const waiting = []
  let listener, unsubscribed = false
  const observer = observeAuth({
    getSession: () => bootstrap.promise,
    subscribe: callback => { listener = callback; return () => { unsubscribed = true } },
    loadProfile: () => {
      const request = deferred()
      if (waiting.length) waiting.shift()(request)
      else requests.push(request)
      return request.promise
    },
    publish: value => snapshots.push(value),
  })
  t.after(() => observer.dispose())
  return {
    ...observer, bootstrap, snapshots,
    event: value => listener(value),
    nextLoad: () => requests.length ? Promise.resolve(requests.shift()) : new Promise(resolve => waiting.push(resolve)),
    get current() { return snapshots.at(-1) },
    get unsubscribed() { return unsubscribed },
  }
}

test('switching accounts clears the old profile immediately and ignores its late refresh', { timeout: 2000 }, async t => {
  const f = fixture(t)
  f.bootstrap.resolve(session('a'))
  const initial = await f.nextLoad()
  initial.resolve(profile('a'))
  await settle()
  assert.equal(f.current.profile.id, 'a')
  const oldRefresh = f.refresh()
  const old = await f.nextLoad()
  f.event(session('b'))
  assert.deepEqual(f.current, { session: session('b'), profile: null, loading: true })
  const next = await f.nextLoad()
  next.resolve(profile('b', 'pending'))
  await settle()
  old.resolve(profile('a'))
  await oldRefresh
  assert.equal(f.current.profile.id, 'b')
  assert.equal(f.current.profile.status, 'pending')
})

test('sign-out stays signed out when an in-flight profile request completes', { timeout: 2000 }, async t => {
  const f = fixture(t)
  f.event(session('a'))
  const old = await f.nextLoad()
  f.event(null)
  assert.deepEqual(f.current, { session: null, profile: null, loading: false })
  old.resolve(profile('a'))
  f.bootstrap.resolve(session('a'))
  await settle()
  assert.deepEqual(f.current, { session: null, profile: null, loading: false })
})

test('an auth event wins over a delayed initial session lookup', { timeout: 2000 }, async t => {
  const f = fixture(t)
  f.event(session('b'))
  const request = await f.nextLoad()
  f.bootstrap.resolve(session('a'))
  request.resolve(profile('b'))
  await settle()
  assert.equal(f.current.session.user.id, 'b')
  assert.equal(f.current.profile.id, 'b')
  assert.equal(f.current.loading, false)
})

test('token refresh preserves the active profile/page while loading fresh membership', { timeout: 2000 }, async t => {
  const f = fixture(t)
  f.bootstrap.resolve(session('a'))
  const initial = await f.nextLoad()
  initial.resolve(profile('a'))
  await settle()
  f.event(session('a', 'new-token'))
  assert.equal(f.current.session.access_token, 'new-token')
  assert.equal(f.current.profile.status, 'approved')
  assert.equal(f.current.loading, false)
  const refresh = await f.nextLoad()
  refresh.resolve(profile('a', 'suspended'))
  await settle()
  assert.equal(f.current.profile.status, 'suspended')
})

test('out-of-order manual refreshes cannot restore older approval', { timeout: 2000 }, async t => {
  const f = fixture(t)
  f.event(session('a'))
  const initial = await f.nextLoad()
  const refreshing = f.refresh()
  const latest = await f.nextLoad()
  latest.resolve(profile('a', 'suspended'))
  await refreshing
  initial.resolve(profile('a'))
  await settle()
  assert.equal(f.current.profile.status, 'suspended')
})

test('unmount unsubscribes and discards profile, session and event completions', { timeout: 2000 }, async t => {
  const f = fixture(t)
  f.event(session('a'))
  const request = await f.nextLoad()
  const count = f.snapshots.length
  f.dispose()
  request.resolve(profile('a'))
  f.bootstrap.resolve(session('a'))
  f.event(session('b'))
  await f.refresh()
  await settle()
  assert.equal(f.unsubscribed, true)
  assert.equal(f.snapshots.length, count)
})

test('profile failures leave the loading gate and allow a successful retry', { timeout: 2000 }, async t => {
  const f = fixture(t)
  f.bootstrap.resolve(session('a'))
  const initial = await f.nextLoad()
  initial.reject(new Error('network unavailable'))
  await settle()
  assert.equal(f.current.profile, null)
  assert.equal(f.current.loading, false)
  const refreshing = f.refresh()
  const retry = await f.nextLoad()
  retry.resolve(profile('a'))
  await refreshing
  assert.equal(f.current.profile.id, 'a')
})

test('an inconsistent profile cannot open the approved-account gate', { timeout: 2000 }, async t => {
  const f = fixture(t)
  f.bootstrap.resolve(session('a'))
  const request = await f.nextLoad()
  request.resolve(profile('b'))
  await settle()
  assert.equal(f.current.profile, null)
  assert.equal(f.current.loading, false)
})

test('startup lookup failure ends loading in the signed-out state', async t => {
  const f = fixture(t)
  f.bootstrap.reject(new Error('session unavailable'))
  await settle()
  assert.deepEqual(f.current, { session: null, profile: null, loading: false })
})

test('auth callbacks return before starting profile RPC work', { timeout: 2000 }, async t => {
  const bootstrap = deferred()
  let inCallback = false
  const began = deferred()
  let listener
  const observer = observeAuth({
    getSession: () => bootstrap.promise,
    subscribe: callback => { listener = callback; return () => {} },
    loadProfile: async () => {
      assert.equal(inCallback, false)
      began.resolve()
      return profile('a')
    },
    publish: () => {},
  })
  t.after(() => observer.dispose())
  inCallback = true
  assert.equal(listener(session('a')), undefined)
  inCallback = false
  await began.promise
})
