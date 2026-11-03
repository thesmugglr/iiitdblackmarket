import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadProfileDashboard, observeProfileDashboard, saveProfile } from '../src/lib/profileData.ts'

const success = data => ({ data, error: null })
const failure = { data: null, error: { message: 'denied' } }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

// Responses stand in for HTTP results, not application state. Record filters
// and the requested public columns so the tests also catch unsafe query scope.
function api(...responses) {
  const calls = []
  const next = call => {
    calls.push(call)
    assert.ok(responses.length, 'unexpected query')
    const response = responses.shift()
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  }
  return { calls, from(table) {
    const call = { table }, b = {}
    for (const method of ['select', 'update', 'eq', 'neq', 'or', 'order']) b[method] = (...args) => { call[method] = args; return b }
    b.single = () => next(call)
    b.then = (yes, no) => next(call).then(yes, no)
    return b
  } }
}

test('profile save confirms the current account and normalized editable fields without requesting email', async () => {
  const row = { id: 'me', display_name: 'Student', batch: '2027' }
  const client = api(success(row))
  assert.deepEqual(await saveProfile(client, 'me', ' Student ', ' 2027 '), row)
  assert.deepEqual(client.calls, [{ table: 'profiles', update: [{ display_name: 'Student', batch: '2027' }], eq: ['id', 'me'], select: ['id,display_name,batch'] }])
})

test('blank optional batch is stored and confirmed as null', async () => {
  const client = api(success({ id: 'me', display_name: 'Student', batch: null }))
  assert.equal((await saveProfile(client, 'me', 'Student', '  ')).batch, null)
  assert.equal(client.calls[0].update[0].batch, null)
})

test('whitespace-only name is rejected before a network write', async () => {
  const client = api()
  await assert.rejects(saveProfile(client, 'me', '  ', ''), /Enter a display name/)
  assert.equal(client.calls.length, 0)
})

for (const [name, response] of [
  ['denied write', failure], ['zero affected rows', success(null)],
  ['different account', success({ id: 'other', display_name: 'Student', batch: null })],
  ['unchanged name', success({ id: 'me', display_name: 'Before', batch: null })],
  ['unchanged batch', success({ id: 'me', display_name: 'Student', batch: '2026' })],
]) test(`profile save cannot report success for ${name}`, async () => {
  await assert.rejects(saveProfile(api(response), 'me', 'Student', ''), /Could not confirm/)
})

test('a failed save can be retried with the same draft', async () => {
  const client = api(new Error('offline'), success({ id: 'me', display_name: 'Student', batch: null }))
  await assert.rejects(saveProfile(client, 'me', 'Student', ''))
  assert.equal((await saveProfile(client, 'me', 'Student', '')).display_name, 'Student')
  assert.deepEqual(client.calls[0], client.calls[1])
})

test('dashboard queries exclude removed listings and scope accepted deals to either side of the current account', async () => {
  const client = api(success([{ id: 'l1' }]), success([{ id: 'd1' }]))
  assert.deepEqual(await loadProfileDashboard(client, 'me'), { mine: [{ id: 'l1' }], deals: [{ id: 'd1' }] })
  assert.deepEqual(client.calls[0].eq, ['seller_id', 'me'])
  assert.deepEqual(client.calls[0].neq, ['status', 'removed'])
  assert.deepEqual(client.calls[1].eq, ['status', 'accepted'])
  assert.deepEqual(client.calls[1].or, ['buyer_id.eq.me,seller_id.eq.me', { referencedTable: 'conversation' }])
  assert.match(client.calls[1].select[0], /conversation:conversations!inner/)
})

for (const [name, responses] of [
  ['listing failure', [failure, success([])]], ['deal failure', [success([]), failure]],
  ['missing response', [success(null), success([])]], ['network exception', [new Error('offline'), success([])]],
]) test(`dashboard ${name} is retryable and cannot look like a successfully empty dashboard`, async () => {
  const states = []
  observeProfileDashboard(() => loadProfileDashboard(api(...responses), 'me'), s => states.push(s))
  await settle()
  assert.equal(states[0].loading, true)
  assert.equal(states.at(-1).loading, false)
  assert.match(states.at(-1).error, /Could not load/)
  observeProfileDashboard(() => loadProfileDashboard(api(success([]), success([])), 'me'), s => states.push(s))
  await settle()
  assert.deepEqual(states.at(-1), { mine: [], deals: [], loading: false, error: '' })
})

for (const outcome of ['success', 'failure']) test(`obsolete dashboard ${outcome} cannot replace a newer account or retry`, async () => {
  const old = deferred(), states = []
  const dispose = observeProfileDashboard(() => old.promise, s => states.push(s))
  dispose()
  observeProfileDashboard(async () => ({ mine: [{ id: 'new' }], deals: [] }), s => states.push(s))
  await settle()
  const current = states.at(-1), count = states.length
  if (outcome === 'success') old.resolve({ mine: [{ id: 'old' }], deals: [] })
  else old.reject(new Error('late failure'))
  await settle()
  assert.equal(states.length, count)
  assert.equal(states.at(-1), current)
  assert.equal(current.mine[0].id, 'new')
})
