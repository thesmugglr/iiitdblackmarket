import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as settle } from 'node:timers/promises'
import { observeSavedItems } from '../src/lib/savedItemsState.ts'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function fixture(t) {
  const loads = [], writes = [], snapshots = []
  const observer = observeSavedItems({
    load: () => { const r = deferred(); loads.push(r); return r.promise },
    write: (id, saved) => { const r = { ...deferred(), id, saved }; writes.push(r); return r.promise },
    publish: value => snapshots.push(value),
  })
  t.after(observer.dispose)
  return { ...observer, loads, writes, snapshots, get current() { return snapshots.at(-1) },
    ready: async (ids = []) => { loads[0].resolve(ids); await settle() } }
}

test('unknown initial membership cannot trigger a save or unsave', async t => {
  const f = fixture(t)
  await f.toggle('a')
  assert.equal(f.writes.length, 0)
  await f.ready(['a'])
  const changed = f.toggle('a')
  assert.equal(f.writes[0].saved, false)
  f.writes[0].resolve()
  await changed
  assert.equal(f.current.ids.has('a'), false)
})

test('a failed save preserves unsaved state and allows the same operation to retry', async t => {
  const f = fixture(t)
  await f.ready()
  const first = f.toggle('a')
  assert.equal(f.current.ids.has('a'), false)
  f.writes[0].reject(new Error('offline'))
  await first
  assert.equal(f.current.ids.has('a'), false)
  assert.match(f.current.error, /update.*try again/)
  assert.equal(f.current.pending.size, 0)
  const retry = f.toggle('a')
  f.writes[1].resolve()
  await retry
  assert.equal(f.current.ids.has('a'), true)
  assert.equal(f.current.error, '')
})

test('a failed unsave retains the confirmed saved state', async t => {
  const f = fixture(t)
  await f.ready(['a'])
  const changed = f.toggle('a')
  f.writes[0].reject(new Error('permission or network failure'))
  await changed
  assert.equal(f.current.ids.has('a'), true)
})

test('two independent saves completing out of order both remain saved', async t => {
  const f = fixture(t)
  await f.ready()
  const a = f.toggle('a'), b = f.toggle('b')
  f.writes[1].resolve()
  await b
  f.writes[0].resolve()
  await a
  assert.deepEqual([...f.current.ids].sort(), ['a', 'b'])
  assert.equal(f.current.pending.size, 0)
})

test('duplicate clicks on one item produce only one in-flight mutation', async t => {
  const f = fixture(t)
  await f.ready()
  const first = f.toggle('a')
  await f.toggle('a')
  assert.equal(f.writes.length, 1)
  f.writes[0].resolve()
  await first
  assert.equal(f.current.ids.has('a'), true)
})

test('failed initial reads can retry without guessing that the collection is empty', async t => {
  const f = fixture(t)
  f.loads[0].reject(new Error('offline'))
  await settle()
  assert.equal(f.current.loading, false)
  assert.match(f.current.error, /load.*try again/)
  await f.toggle('a')
  assert.equal(f.writes.length, 0)
  const retry = f.retry()
  f.loads[1].resolve(['a'])
  await retry
  assert.equal(f.current.ids.has('a'), true)
  assert.equal(f.current.error, '')
})

test('a reload cannot erase an in-flight confirmed write', async t => {
  const f = fixture(t)
  await f.ready()
  const write = f.toggle('a')
  await f.retry()
  assert.equal(f.loads.length, 1)
  f.writes[0].resolve()
  await write
  assert.equal(f.current.ids.has('a'), true)
})

test('disposed account loads and writes cannot publish into a new account view', async t => {
  const oldLoad = fixture(t)
  oldLoad.dispose()
  const initialCount = oldLoad.snapshots.length
  await oldLoad.ready(['old-account-item'])
  assert.equal(oldLoad.snapshots.length, initialCount)
  const oldWrite = fixture(t)
  await oldWrite.ready()
  const writing = oldWrite.toggle('a')
  oldWrite.dispose()
  const writeCount = oldWrite.snapshots.length
  oldWrite.writes[0].resolve()
  await writing
  assert.equal(oldWrite.snapshots.length, writeCount)
})
