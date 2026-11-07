import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adminRemovePost } from '../src/lib/adminActions.ts'

// Minimal query-builder fake: records the call and resolves with the given result.
function fake(result) {
  const calls = []
  const chain = { update(v) { calls.push(['update', v]); return chain }, delete() { calls.push(['delete']); return chain }, eq(k, v) { calls.push(['eq', k, v]); return chain }, select() { return chain }, maybeSingle() { return Promise.resolve(result) }, then(ok, bad) { return Promise.resolve(result).then(ok, bad) } }
  return { calls, api: { from(t) { calls.push(['from', t]); return chain }, rpc() { throw new Error('unused') } } }
}

test('listings and bundles become removed, requests closed', async () => {
  for (const [kind, table, status] of [['listing', 'listings', 'removed'], ['bundle', 'bundles', 'removed'], ['wanted', 'wanted_posts', 'closed']]) {
    const f = fake({ data: { id: 'x', status }, error: null })
    await adminRemovePost(f.api, kind, 'x')
    assert.deepEqual(f.calls.slice(0, 2), [['from', table], ['update', { status }]])
  }
})

test('lost & found posts are deleted and the deleted row must come back', async () => {
  const ok = fake({ data: [{ id: 'x' }], error: null })
  await adminRemovePost(ok.api, 'lostfound', 'x')
  assert.deepEqual(ok.calls.slice(0, 2), [['from', 'lost_found'], ['delete']])
  await assert.rejects(adminRemovePost(fake({ data: [], error: null }).api, 'lostfound', 'x'), /Could not remove/)
})

test('a silent RLS no-op or an error is not reported as success', async () => {
  await assert.rejects(adminRemovePost(fake({ data: null, error: null }).api, 'listing', 'x'), /Could not remove/)
  await assert.rejects(adminRemovePost(fake({ data: null, error: { message: 'denied' } }).api, 'bundle', 'x'), /Could not remove/)
})
