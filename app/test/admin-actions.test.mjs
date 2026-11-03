import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addStudentRoster, changeMemberStatus, removeReportedListing, updateReportStatus } from '../src/lib/adminActions.ts'

const success = data => ({ data, error: null })
const failure = { data: null, error: { message: 'denied' } }
const report = { id: 'r1', listing_id: 'l1' }

// Script responses at the network boundary, recording the actual query and
// failing on unexpected calls (especially a report update after failed removal).
function api(...responses) {
  const calls = []
  const next = call => {
    calls.push(call)
    assert.ok(responses.length, 'unexpected API call')
    const response = responses.shift()
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  }
  return {
    calls,
    rpc: (name, args) => next({ rpc: name, args }),
    from(table) {
      const call = { table }, b = {}
      for (const method of ['update', 'upsert', 'eq', 'select']) b[method] = (...args) => { call[method] = args; return b }
      b.single = b.maybeSingle = () => next(call)
      b.then = (yes, no) => next(call).then(yes, no)
      return b
    },
  }
}

for (const [name, response] of [
  ['server failure', failure], ['zero affected rows', success(null)],
  ['wrong returned listing', success({ id: 'other', status: 'removed' })],
  ['unconfirmed status', success({ id: 'l1', status: 'active' })],
  ['network exception', new Error('offline')],
]) {
  test(`listing removal ${name} cannot resolve the report`, async () => {
    const client = api(response)
    await assert.rejects(removeReportedListing(client, report))
    assert.equal(client.calls.length, 1)
    assert.equal(client.calls[0].table, 'listings')
    assert.deepEqual(client.calls[0].eq, ['id', 'l1'])
  })
}

test('successful removal confirms both records in order', async () => {
  const client = api(success({ id: 'l1', status: 'removed' }), success({ id: 'r1', status: 'resolved' }))
  await removeReportedListing(client, report)
  assert.deepEqual(client.calls.map(c => [c.table, c.update, c.eq]), [
    ['listings', [{ status: 'removed' }], ['id', 'l1']],
    ['reports', [{ status: 'resolved' }], ['id', 'r1']],
  ])
})

test('report failure after removal distinguishes the partial result and allows resolution retry', async () => {
  const client = api(success({ id: 'l1', status: 'removed' }), failure, success({ id: 'r1', status: 'resolved' }))
  await assert.rejects(removeReportedListing(client, report), /listing was removed.*report could not be resolved/)
  await updateReportStatus(client, report.id, 'resolved')
  assert.deepEqual(client.calls.map(c => c.table), ['listings', 'reports', 'reports'])
})

test('a report without a listing never makes a write', async () => {
  const client = api()
  await assert.rejects(removeReportedListing(client, { ...report, listing_id: null }), /no listing/)
  assert.equal(client.calls.length, 0)
})

test('report dismissal must return the requested row and state', async () => {
  const client = api(success(null), success({ id: 'r1', status: 'open' }), success({ id: 'r1', status: 'dismissed' }))
  await assert.rejects(updateReportStatus(client, 'r1', 'dismissed'), /Could not update/)
  await assert.rejects(updateReportStatus(client, 'r1', 'dismissed'), /Could not update/)
  await updateReportStatus(client, 'r1', 'dismissed')
})

test('member RPC failure or missing confirmation cannot report approval', async () => {
  const denied = api(failure)
  await assert.rejects(changeMemberStatus(denied, 'u1', 'approved'), /Could not update/)
  assert.equal(denied.calls.length, 1)
  const missing = api(success(null), success(null))
  await assert.rejects(changeMemberStatus(missing, 'u1', 'approved'), /Could not confirm/)
})

test('roster deduplicates addresses and retains partial member approval results', async () => {
  const a = 'a@iiitd.ac.in', b = 'b@iiitd.ac.in', c = 'c@iiitd.ac.in'
  const client = api(success([{ email: a }, { email: b }, { email: c }]), failure,
    success({ id: 'b', status: 'approved' }), success({ id: 'c', status: 'pending' }))
  const result = await addStudentRoster(client, ` A@iiitd.ac.in;${a}\n${b},${c}`, [
    { id: 'a', email: a, status: 'pending' }, { id: 'b', email: b, status: 'pending' },
    { id: 'c', email: c, status: 'pending' }, { id: 'other', email: 'other@iiitd.ac.in', status: 'pending' },
    { id: 'suspended', email: a, status: 'suspended' },
  ])
  assert.deepEqual(result, { added: 3, approved: 1, failed: 2 })
  assert.deepEqual(client.calls[0].upsert, [[{ email: a }, { email: b }, { email: c }]])
  assert.equal(client.calls.filter(c => c.table === 'profiles').length, 3)
  assert.equal(client.calls.some(c => c.rpc), false)
})

test('roster failure and incomplete returning rows do not start approvals', async () => {
  for (const response of [failure, success([]), new Error('offline')]) {
    const client = api(response)
    await assert.rejects(addStudentRoster(client, 'a@iiitd.ac.in', [{ id: 'a', email: 'a@iiitd.ac.in', status: 'pending' }]))
    assert.equal(client.calls.length, 1)
  }
})

test('invalid mixed roster input refuses the entire batch before writing', async () => {
  for (const input of ['', 'a@iiitd.ac.in other@gmail.com', 'a@@iiitd.ac.in', '@iiitd.ac.in']) {
    const client = api()
    await assert.rejects(addStudentRoster(client, input, []), /no entries were added/)
    assert.equal(client.calls.length, 0)
  }
})
